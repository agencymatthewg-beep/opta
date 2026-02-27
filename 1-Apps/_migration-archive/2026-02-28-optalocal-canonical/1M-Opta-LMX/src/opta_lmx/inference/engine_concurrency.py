"""Concurrency control for the inference engine.

Manages global, per-model, and per-client request slot acquisition,
adaptive concurrency adjustment based on memory pressure and latency,
and graceful drain for shutdown.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections import deque
from collections.abc import AsyncIterator
from typing import Any

logger = logging.getLogger(__name__)


class ConcurrencyController:
    """Manages inference request concurrency slots and adaptive limits.

    Handles global, per-model, and per-client semaphore management,
    adaptive concurrency based on memory/latency, and drain logic.
    """

    def __init__(
        self,
        *,
        max_concurrent_requests: int = 4,
        semaphore_timeout_sec: float = 30.0,
        per_client_default_concurrency: int | None = None,
        per_client_concurrency_overrides: dict[str, int] | None = None,
        per_model_concurrency_limits: dict[str, int] | None = None,
        adaptive_concurrency_enabled: bool = True,
        adaptive_latency_target_ms: float = 2500.0,
        adaptive_latency_window: int = 128,
        adaptive_min_concurrent_requests: int = 1,
    ) -> None:
        self._max_concurrent = max_concurrent_requests
        self._current_concurrency_limit = max_concurrent_requests
        self._semaphore_timeout = semaphore_timeout_sec

        self._inference_semaphore: asyncio.Semaphore
        self._normal_lane_semaphore: asyncio.Semaphore | None
        self._high_priority_lane_semaphore: asyncio.Semaphore | None
        self._high_priority_lane_slots = 0
        self._rebuild_global_semaphores(max_concurrent_requests)

        self._waiting_global_slot = 0
        self._waiting_model_slot = 0
        self._waiting_client_slot = 0
        self._waiting_normal_lane_slot = 0
        self._waiting_high_lane_slot = 0

        self._per_client_default_concurrency = per_client_default_concurrency
        self._per_client_concurrency_overrides = dict(per_client_concurrency_overrides or {})
        self._client_semaphores: dict[str, asyncio.Semaphore] = {}

        self._per_model_concurrency_limits = dict(per_model_concurrency_limits or {})
        self._model_semaphores: dict[str, asyncio.Semaphore] = {
            model_id: asyncio.Semaphore(limit)
            for model_id, limit in self._per_model_concurrency_limits.items()
            if limit >= 1
        }

        self._active_requests_by_model: dict[str, int] = {}
        self._waiting_requests_by_model: dict[str, int] = {}

        self._in_flight = 0
        self._drain_event = asyncio.Event()
        self._drain_event.set()  # Initially idle

        self._adaptive_concurrency_enabled = adaptive_concurrency_enabled
        self._adaptive_latency_target_sec = max(0.1, adaptive_latency_target_ms / 1000.0)
        self._adaptive_latency_samples: deque[float] = deque(
            maxlen=max(8, adaptive_latency_window)
        )
        self._adaptive_min_concurrent = max(1, adaptive_min_concurrent_requests)
        self._last_adapt_reason = "startup"

    # ── Properties ─────────────────────────────────────────────────────

    @property
    def in_flight_count(self) -> int:
        """Number of currently active inference requests."""
        return self._in_flight

    @property
    def max_concurrent_requests(self) -> int:
        """Current maximum concurrent inference requests."""
        return self._max_concurrent

    @property
    def waiting_queue_count(self) -> int:
        """Number of requests currently waiting for any inference slot."""
        return (
            self._waiting_global_slot
            + self._waiting_model_slot
            + self._waiting_client_slot
            + self._waiting_normal_lane_slot
            + self._waiting_high_lane_slot
        )

    @property
    def latency_p95_sec(self) -> float | None:
        """Rolling p95 latency for adaptive concurrency calculations."""
        if not self._adaptive_latency_samples:
            return None
        ordered = sorted(self._adaptive_latency_samples)
        index = max(0, int((len(ordered) - 1) * 0.95))
        return float(ordered[index])

    @staticmethod
    def _high_priority_lane_size(limit: int) -> int:
        """Reserved privileged lane size for trusted high-priority traffic."""
        if limit < 3:
            return 0
        return 1

    def _rebuild_global_semaphores(self, limit: int) -> None:
        """Rebuild global semaphores for normal and privileged lanes."""
        bounded_limit = max(1, limit)
        high_lane_slots = min(
            self._high_priority_lane_size(bounded_limit),
            max(0, bounded_limit - 1),
        )
        normal_lane_slots = max(1, bounded_limit - high_lane_slots)

        self._inference_semaphore = asyncio.Semaphore(bounded_limit)
        self._normal_lane_semaphore = (
            asyncio.Semaphore(normal_lane_slots) if high_lane_slots > 0 else None
        )
        self._high_priority_lane_semaphore = (
            asyncio.Semaphore(high_lane_slots) if high_lane_slots > 0 else None
        )
        self._high_priority_lane_slots = high_lane_slots

    # ── Counter helpers ────────────────────────────────────────────────

    @staticmethod
    def _increment_counter(counter: dict[str, int], key: str) -> None:
        counter[key] = counter.get(key, 0) + 1

    @staticmethod
    def _decrement_counter(counter: dict[str, int], key: str) -> None:
        remaining = counter.get(key, 0) - 1
        if remaining > 0:
            counter[key] = remaining
        else:
            counter.pop(key, None)

    # ── Client / model semaphores ──────────────────────────────────────

    @staticmethod
    def _normalize_client_key(client_id: str | None) -> str:
        """Normalize client identity for fairness controls."""
        if client_id is None:
            return "anonymous"
        normalized = client_id.strip()
        if not normalized:
            return "anonymous"
        return normalized

    def _per_client_limit_for(self, client_key: str) -> int | None:
        """Resolve per-client concurrency limit, if fairness is enabled."""
        if self._per_client_default_concurrency is None:
            return None

        explicit = self._per_client_concurrency_overrides.get(client_key)
        if explicit is not None:
            return max(1, min(self._max_concurrent, explicit))

        explicit_ci = self._per_client_concurrency_overrides.get(client_key.lower())
        if explicit_ci is not None:
            return max(1, min(self._max_concurrent, explicit_ci))

        return max(1, min(self._max_concurrent, self._per_client_default_concurrency))

    def _client_semaphore_for(self, client_id: str | None) -> asyncio.Semaphore | None:
        """Get or create a per-client semaphore when fairness is enabled."""
        client_key = self._normalize_client_key(client_id)
        limit = self._per_client_limit_for(client_key)
        if limit is None:
            return None

        existing = self._client_semaphores.get(client_key)
        if existing is not None:
            return existing

        created = asyncio.Semaphore(limit)
        self._client_semaphores[client_key] = created
        return created

    def _model_semaphore_for(self, model_id: str) -> asyncio.Semaphore | None:
        """Get per-model semaphore when a model-specific cap is configured."""
        limit = self._per_model_concurrency_limits.get(model_id)
        if limit is None:
            return None
        if limit >= self._max_concurrent:
            return None

        existing = self._model_semaphores.get(model_id)
        if existing is not None:
            return existing

        created = asyncio.Semaphore(max(1, limit))
        self._model_semaphores[model_id] = created
        return created

    # ── Slot acquisition ───────────────────────────────────────────────

    async def _acquire_slot(
        self,
        semaphore: asyncio.Semaphore,
        *,
        queue_kind: str,
        model_id: str,
        client_key: str,
    ) -> None:
        """Acquire one semaphore slot with timeout and queue-depth tracking."""
        if queue_kind == "global":
            self._waiting_global_slot += 1
        elif queue_kind == "model":
            self._waiting_model_slot += 1
        elif queue_kind == "client":
            self._waiting_client_slot += 1
        elif queue_kind == "normal_lane":
            self._waiting_normal_lane_slot += 1
        elif queue_kind == "high_lane":
            self._waiting_high_lane_slot += 1

        try:
            await asyncio.wait_for(semaphore.acquire(), timeout=self._semaphore_timeout)
        except TimeoutError:
            logger.warning("semaphore_timeout", extra={
                "queue_kind": queue_kind,
                "model_id": model_id,
                "client_id": client_key,
                "timeout_sec": self._semaphore_timeout,
                "in_flight": self._in_flight,
                "waiting_total": self.waiting_queue_count,
            })
            raise
        finally:
            if queue_kind == "global":
                self._waiting_global_slot = max(0, self._waiting_global_slot - 1)
            elif queue_kind == "model":
                self._waiting_model_slot = max(0, self._waiting_model_slot - 1)
            elif queue_kind == "client":
                self._waiting_client_slot = max(0, self._waiting_client_slot - 1)
            elif queue_kind == "normal_lane":
                self._waiting_normal_lane_slot = max(0, self._waiting_normal_lane_slot - 1)
            elif queue_kind == "high_lane":
                self._waiting_high_lane_slot = max(0, self._waiting_high_lane_slot - 1)

    @contextlib.asynccontextmanager
    async def _acquire_request_slots(
        self,
        *,
        model_id: str,
        priority: str,
        client_id: str | None,
        queue_wait_sec_ctx: Any,
    ) -> AsyncIterator[None]:
        """Acquire global/model/client slots for one request.

        Args:
            model_id: The model being requested.
            priority: Request priority ("high" uses bounded privileged lane).
            client_id: Optional client identity for fairness.
            queue_wait_sec_ctx: ContextVar to store measured queue wait time.
        """
        acquired: list[asyncio.Semaphore] = []
        client_key = self._normalize_client_key(client_id)
        model_semaphore = self._model_semaphore_for(model_id)
        client_semaphore = self._client_semaphore_for(client_key)
        wait_started = time.monotonic()
        self._increment_counter(self._waiting_requests_by_model, model_id)

        use_high_lane = priority == "high" and self._high_priority_lane_semaphore is not None

        try:
            if use_high_lane:
                await self._acquire_slot(
                    self._high_priority_lane_semaphore,
                    queue_kind="high_lane",
                    model_id=model_id,
                    client_key=client_key,
                )
                acquired.append(self._high_priority_lane_semaphore)
            elif self._normal_lane_semaphore is not None:
                await self._acquire_slot(
                    self._normal_lane_semaphore,
                    queue_kind="normal_lane",
                    model_id=model_id,
                    client_key=client_key,
                )
                acquired.append(self._normal_lane_semaphore)

            await self._acquire_slot(
                self._inference_semaphore,
                queue_kind="global",
                model_id=model_id,
                client_key=client_key,
            )
            acquired.append(self._inference_semaphore)

            if model_semaphore is not None:
                await self._acquire_slot(
                    model_semaphore,
                    queue_kind="model",
                    model_id=model_id,
                    client_key=client_key,
                )
                acquired.append(model_semaphore)

            if client_semaphore is not None:
                await self._acquire_slot(
                    client_semaphore,
                    queue_kind="client",
                    model_id=model_id,
                    client_key=client_key,
                )
                acquired.append(client_semaphore)

            queue_wait_sec_ctx.set(max(0.0, time.monotonic() - wait_started))
            yield
        except TimeoutError:
            queue_wait_sec_ctx.set(max(0.0, time.monotonic() - wait_started))
            raise RuntimeError(
                "Server is busy — all inference slots occupied. Try again shortly."
            ) from None
        finally:
            self._decrement_counter(self._waiting_requests_by_model, model_id)
            for semaphore in reversed(acquired):
                semaphore.release()

    # ── Adaptive concurrency ───────────────────────────────────────────

    def _record_latency_sample(self, latency_sec: float) -> None:
        if latency_sec < 0:
            return
        self._adaptive_latency_samples.append(latency_sec)

    def adapt_concurrency(
        self,
        memory_usage_pct: float,
        memory_threshold_pct: float,
    ) -> int:
        """Dynamically adjust concurrency based on memory pressure and latency.

        Args:
            memory_usage_pct: Current memory usage as a percentage.
            memory_threshold_pct: Memory threshold percentage from MemoryMonitor.

        Returns:
            New concurrency target.
        """
        ratio = memory_usage_pct / memory_threshold_pct if memory_threshold_pct > 0 else 0
        reason = "memory"
        if ratio < 0.7:
            target = self._max_concurrent
        elif ratio < 0.85:
            target = max(
                self._adaptive_min_concurrent,
                min(self._max_concurrent, max(1, self._max_concurrent * 3 // 4)),
            )
        elif ratio < 0.95:
            target = max(
                self._adaptive_min_concurrent,
                min(self._max_concurrent, max(1, self._max_concurrent // 2)),
            )
        else:
            target = self._adaptive_min_concurrent

        # Latency-aware adjustment.
        if self._adaptive_concurrency_enabled:
            p95 = self.latency_p95_sec
            if p95 is not None and len(self._adaptive_latency_samples) >= 8:
                high_watermark = self._adaptive_latency_target_sec * 1.25
                low_watermark = self._adaptive_latency_target_sec * 0.70
                if p95 > high_watermark:
                    target = max(self._adaptive_min_concurrent, target - 1)
                    reason = "latency_high"
                elif p95 < low_watermark and self.waiting_queue_count > 0:
                    target = min(self._max_concurrent, target + 1)
                    reason = "latency_low_queue_backlog"

        if target != self._current_concurrency_limit:
            if self._in_flight == 0:
                self._rebuild_global_semaphores(target)
                self._current_concurrency_limit = target
                self._last_adapt_reason = reason
                logger.info("concurrency_adapted", extra={
                    "new_limit": target,
                    "memory_usage_pct": round(memory_usage_pct, 1),
                    "latency_p95_sec": self.latency_p95_sec,
                    "reason": reason,
                    "in_flight": self._in_flight,
                })
            else:
                logger.debug("concurrency_adaptation_deferred", extra={
                    "target": target,
                    "reason": reason,
                    "in_flight": self._in_flight,
                })
        else:
            self._last_adapt_reason = reason

        return target

    # ── In-flight tracking ─────────────────────────────────────────────

    def enter_inference(self, model_id: str) -> None:
        """Track start of an inference request."""
        self._in_flight += 1
        self._increment_counter(self._active_requests_by_model, model_id)
        self._drain_event.clear()

    def exit_inference(self, model_id: str) -> None:
        """Track end of an inference request."""
        self._in_flight -= 1
        self._decrement_counter(self._active_requests_by_model, model_id)
        if self._in_flight == 0:
            self._drain_event.set()

    # ── Drain ──────────────────────────────────────────────────────────

    async def drain(self, timeout_sec: float = 30.0) -> bool:
        """Wait for all in-flight inference requests to complete.

        Args:
            timeout_sec: Maximum seconds to wait for drain.

        Returns:
            True if all requests completed, False if timed out.
        """
        if self._in_flight == 0:
            return True

        logger.info("drain_started", extra={"in_flight": self._in_flight})
        try:
            await asyncio.wait_for(self._drain_event.wait(), timeout=timeout_sec)
        except TimeoutError:
            logger.warning("drain_timeout", extra={
                "remaining": self._in_flight, "timeout_sec": timeout_sec,
            })
            return False

        logger.info("drain_complete")
        return True

    # ── Load snapshot ──────────────────────────────────────────────────

    def get_model_load_snapshot(
        self,
        model_ids: list[str],
    ) -> dict[str, float]:
        """Return a best-effort per-model live load score (lower is better)."""
        if not model_ids:
            return {}

        global_capacity = max(1, self._max_concurrent)
        global_pressure = self.waiting_queue_count / global_capacity
        snapshot: dict[str, float] = {}

        for model_id in model_ids:
            active = self._active_requests_by_model.get(model_id, 0)
            waiting = self._waiting_requests_by_model.get(model_id, 0)
            model_limit = self._per_model_concurrency_limits.get(model_id, self._max_concurrent)
            if model_limit is None:
                model_limit = self._max_concurrent
            capacity = max(1, min(max(1, int(model_limit)), self._max_concurrent))
            utilization = active / capacity
            queue_ratio = waiting / capacity
            snapshot[model_id] = (
                float(active)
                + float(waiting)
                + utilization
                + queue_ratio
                + global_pressure
            )

        return snapshot
