"""Model lifecycle management for the inference engine.

Handles model load, unload, warmup, canary promotion, TTL/LRU eviction,
admission control with memory reservations, speculative config resolution,
engine creation, and backend probing.
"""

from __future__ import annotations

import asyncio
import contextlib
import gc
import inspect
import logging
import time
from typing import Any, cast

from opta_lmx.inference._model_config import (
    BLOCKED_RUNTIME_SIGNATURES as _UNSUPPORTED_RUNTIME_SIGNATURES,
)
from opta_lmx.inference._model_config import (
    _load_model_config,
    _normalize_signature,
)
from opta_lmx.inference.backend_policy import backend_candidates
from opta_lmx.inference.gguf_resolver import resolve_local_gguf_equivalents
from opta_lmx.inference.mlx_lm_backend import MLXLMBackend
from opta_lmx.inference.types import LoadedModel, ModelInfo
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import (
    CompatibilityRegistry,
    ErrorCodes,
    ReadinessTracker,
    backend_version,
)
from opta_lmx.monitoring.events import EventBus, ServerEvent
from opta_lmx.runtime.child_loader_supervisor import run_loader_supervisor
from opta_lmx.runtime.loader_protocol import LoaderFailure, LoadSpec

logger = logging.getLogger(__name__)

_READINESS_TELEMETRY_STATES = frozenset(
    {"admitted", "loading", "canary_pending", "routable", "quarantined"}
)


class ModelRuntimeCompatibilityError(RuntimeError):
    """Raised when a model is known-incompatible with the active runtime stack."""


def _collect_model_signature_hints(config: dict[str, Any]) -> list[str]:
    """Collect model_type/architectures hints from config payload."""
    hints: list[str] = []
    model_type = config.get("model_type")
    if isinstance(model_type, str) and model_type.strip():
        hints.append(model_type.strip())

    architectures = config.get("architectures")
    if isinstance(architectures, list):
        for item in architectures:
            if isinstance(item, str) and item.strip():
                hints.append(item.strip())
    return hints


def _runtime_backend_versions() -> dict[str, str | None]:
    """Best-effort runtime backend versions for diagnostics."""
    versions: dict[str, str | None] = {"vllm-mlx": None, "mlx-lm": None}
    try:
        from importlib import metadata as importlib_metadata

        with contextlib.suppress(Exception):
            versions["vllm-mlx"] = importlib_metadata.version("vllm-mlx")
        with contextlib.suppress(Exception):
            versions["mlx-lm"] = importlib_metadata.version("mlx-lm")
    except Exception:
        return versions
    return versions


def _detect_runtime_incompatibility(model_id: str) -> dict[str, Any] | None:
    """Detect known architecture/runtime incompatibilities from local model config."""
    config = _load_model_config(model_id)
    if not isinstance(config, dict):
        return None

    hints = _collect_model_signature_hints(config)
    if not hints:
        return None

    matched_signature: str | None = None
    for hint in hints:
        normalized = _normalize_signature(hint)
        compact = normalized.replace("_", "")
        if any(blocked in normalized for blocked in _UNSUPPORTED_RUNTIME_SIGNATURES):
            matched_signature = hint
            break
        if any(blocked in compact for blocked in _UNSUPPORTED_RUNTIME_SIGNATURES):
            matched_signature = hint
            break

    if matched_signature is None:
        return None

    return {
        "matched_signature": matched_signature,
        "model_type": config.get("model_type"),
        "architectures": config.get("architectures"),
        "runtime_versions": _runtime_backend_versions(),
    }


def _resolve_context_length(model_id: str) -> int | None:
    """Try to read max context length from a model's config.json in the HF cache."""
    try:
        config = _load_model_config(model_id)
        if not isinstance(config, dict):
            return None

        for key in ("max_position_embeddings", "max_sequence_length", "n_positions", "seq_length"):
            value = config.get(key)
            if isinstance(value, int):
                return value
    except Exception as e:
        logger.debug("context_length_resolve_failed", extra={
            "model_id": model_id, "error": str(e),
        })
    return None


def _detect_format(model_id: str) -> str:
    """Detect whether model_id is MLX or GGUF."""
    if model_id.endswith(".gguf"):
        return "gguf"
    if "gguf" in model_id.lower():
        return "gguf"
    return "mlx"


def _resolve_engine_model_name(model_id: str) -> str:
    """Prefer a concrete local snapshot path when a repo ID is cached."""
    try:
        from pathlib import Path

        from huggingface_hub import try_to_load_from_cache

        direct_path = Path(model_id).expanduser()
        if direct_path.exists():
            return str(direct_path)

        config_path = try_to_load_from_cache(model_id, "config.json")
        if isinstance(config_path, str):
            snapshot_dir = Path(config_path).parent
            if snapshot_dir.exists():
                return str(snapshot_dir)
    except Exception as e:
        logger.debug("model_source_resolve_failed", extra={
            "model_id": model_id, "error": str(e),
        })
    return model_id


class ModelLifecycleManager:
    """Manages model load/unload, warmup, canary, eviction, and engine creation.

    This class is instantiated internally by InferenceEngine and holds
    lifecycle-specific state.  It delegates readiness/compatibility tracking
    to the shared ReadinessTracker and CompatibilityRegistry instances.
    """

    def __init__(
        self,
        *,
        memory_monitor: MemoryMonitor,
        models: dict[str, LoadedModel],
        load_lock: asyncio.Lock,
        loading_models: set[str],
        load_memory_reservations_gb: dict[str, float],
        readiness: ReadinessTracker,
        compatibility: CompatibilityRegistry,
        autotune: Any,
        event_bus: EventBus | None,
        use_batching: bool,
        auto_evict_lru: bool,
        gguf_context_length: int,
        gguf_gpu_layers: int,
        speculative_model: str | None,
        speculative_num_tokens: int,
        speculative_require_supported: bool,
        kv_bits: int | None,
        kv_group_size: int,
        prefix_cache_enabled: bool,
        loader_isolation_enabled: bool,
        loader_timeout_sec: int,
        backend_preference_order: list[str],
        gguf_fallback_enabled: bool,
        warmup_on_load: bool,
        stream_interval: int,
        scheduler_max_num_seqs: int,
        scheduler_prefill_batch_size: int,
        scheduler_completion_batch_size: int,
        scheduler_cache_memory_percent: float,
        runtime_failure_quarantine_threshold: int,
        # Callables provided by InferenceEngine to adapt concurrency after
        # load/unload and to resolve autotune profiles.
        adapt_concurrency_fn: Any,
        resolve_autotune_backend_fn: Any,
        autotune_backend_version_fn: Any,
    ) -> None:
        self._memory = memory_monitor
        self._models = models
        self._load_lock = load_lock
        self._loading_models = loading_models
        self._load_memory_reservations_gb = load_memory_reservations_gb
        self._readiness = readiness
        self._compatibility = compatibility
        self._autotune = autotune
        self._event_bus = event_bus
        self._use_batching = use_batching
        self._auto_evict_lru = auto_evict_lru
        self._gguf_context_length = gguf_context_length
        self._gguf_gpu_layers = gguf_gpu_layers
        self._speculative_model = speculative_model
        self._speculative_num_tokens = speculative_num_tokens
        self._speculative_require_supported = speculative_require_supported
        self._kv_bits = kv_bits
        self._kv_group_size = kv_group_size
        self._prefix_cache_enabled = prefix_cache_enabled
        self._loader_isolation_enabled = loader_isolation_enabled
        self._loader_timeout_sec = loader_timeout_sec
        self._backend_preference_order = list(backend_preference_order)
        self._gguf_fallback_enabled = gguf_fallback_enabled
        self._warmup_on_load = warmup_on_load
        self._stream_interval = stream_interval
        self._scheduler_max_num_seqs = scheduler_max_num_seqs
        self._scheduler_prefill_batch_size = scheduler_prefill_batch_size
        self._scheduler_completion_batch_size = scheduler_completion_batch_size
        self._scheduler_cache_memory_percent = scheduler_cache_memory_percent
        self._runtime_failure_quarantine_threshold = runtime_failure_quarantine_threshold
        self._adapt_concurrency = adapt_concurrency_fn
        self._resolve_autotune_backend = resolve_autotune_backend_fn
        self._autotune_backend_version = autotune_backend_version_fn

    # ── Memory helpers ─────────────────────────────────────────────────

    def _memory_percent_from_gb(self, value_gb: float) -> float:
        """Convert memory amount in GB to system-wide percent."""
        total = self._memory.total_memory_gb()
        if total <= 0:
            return 0.0
        return (value_gb / total) * 100.0

    def _reserved_load_memory_gb(self) -> float:
        """Total GB currently reserved by in-flight cold loads."""
        return sum(self._load_memory_reservations_gb.values())

    def _reservation_estimate_gb(
        self, performance_overrides: dict[str, Any] | None
    ) -> float | None:
        if not performance_overrides:
            return None
        raw_estimate = performance_overrides.get("memory_estimate_gb")
        if raw_estimate is None:
            return None
        with contextlib.suppress(TypeError, ValueError):
            estimate_gb = float(raw_estimate)
            if estimate_gb > 0:
                return estimate_gb * 1.15
        return None

    def _resolve_admission_reservation_gb(
        self,
        *,
        performance_overrides: dict[str, Any] | None,
        current_usage_percent: float,
        reserved_usage_percent: float,
    ) -> tuple[float, bool]:
        estimated_gb = self._reservation_estimate_gb(performance_overrides)
        if estimated_gb is not None:
            return estimated_gb, True
        remaining_percent = (
            self._memory.threshold_percent - current_usage_percent - reserved_usage_percent
        )
        if remaining_percent <= 0:
            return 0.0, False
        total = self._memory.total_memory_gb()
        if total <= 0:
            return 0.0, False
        return (remaining_percent / 100.0) * total, False

    # ── Event / readiness helpers ──────────────────────────────────────

    async def _publish_engine_event(
        self,
        *,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        if self._event_bus is None:
            return
        try:
            await self._event_bus.publish(ServerEvent(event_type=event_type, data=data))
        except Exception as exc:
            logger.warning(
                "engine_event_publish_failed",
                extra={"event_type": event_type, "error": str(exc)},
            )

    async def _set_readiness_state(
        self,
        model_id: str,
        state: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        previous = self._readiness.get(model_id)
        previous_state = previous.get("state")
        self._readiness.set_state(model_id, state, reason=reason)
        current = self._readiness.get(model_id)
        current_state = current.get("state")
        if (
            current_state != previous_state
            and isinstance(current_state, str)
            and current_state in _READINESS_TELEMETRY_STATES
        ):
            await self._publish_engine_event(
                event_type="model_readiness_changed",
                data={
                    "model_id": model_id,
                    "previous_state": previous_state,
                    "state": current_state,
                    "reason": current.get("reason"),
                    "crash_count": current.get("crash_count"),
                    "updated_at": current.get("updated_at"),
                },
            )
        return current

    async def _mark_readiness_failure(
        self,
        model_id: str,
        *,
        reason: str,
        quarantine_threshold: int,
    ) -> dict[str, Any]:
        previous = self._readiness.get(model_id)
        previous_state = previous.get("state")
        self._readiness.mark_failure(
            model_id,
            reason=reason,
            quarantine_threshold=quarantine_threshold,
        )
        current = self._readiness.get(model_id)
        current_state = current.get("state")
        if (
            current_state != previous_state
            and isinstance(current_state, str)
            and current_state in _READINESS_TELEMETRY_STATES
        ):
            await self._publish_engine_event(
                event_type="model_readiness_changed",
                data={
                    "model_id": model_id,
                    "previous_state": previous_state,
                    "state": current_state,
                    "reason": current.get("reason"),
                    "crash_count": current.get("crash_count"),
                    "last_failure_reason": current.get("last_failure_reason"),
                    "updated_at": current.get("updated_at"),
                },
            )
        return current

    async def _record_compatibility(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version_value: str,
        outcome: str,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        row = self._compatibility.record(
            model_id=model_id,
            backend=backend,
            backend_version_value=backend_version_value,
            outcome=outcome,
            reason=reason,
            metadata=metadata,
        )
        await self._publish_engine_event(
            event_type="model_compatibility_recorded",
            data=row,
        )
        return row

    # ── Speculative config ─────────────────────────────────────────────

    @staticmethod
    def _coerce_bool(value: Any, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "y", "on"}:
                return True
            if normalized in {"0", "false", "no", "n", "off"}:
                return False
        return default

    def _resolve_speculative_config(
        self, performance_overrides: dict[str, Any],
    ) -> tuple[bool, str | None, int | None, bool]:
        raw_spec = performance_overrides.get("speculative", {})
        spec_config = raw_spec if isinstance(raw_spec, dict) else {}

        strict_raw = spec_config.get(
            "require_supported",
            spec_config.get("strict", self._speculative_require_supported),
        )
        require_supported = self._coerce_bool(
            strict_raw,
            default=self._speculative_require_supported,
        )

        draft_override = spec_config.get("draft_model")
        if isinstance(draft_override, str) and draft_override.strip():
            draft_model: str | None = draft_override.strip()
        else:
            draft_model = self._speculative_model

        num_tokens_raw = spec_config.get("num_tokens")
        if num_tokens_raw is None:
            num_tokens_raw = self._speculative_num_tokens if draft_model else None
        try:
            num_tokens = int(num_tokens_raw) if num_tokens_raw is not None else None
        except (TypeError, ValueError):
            num_tokens = self._speculative_num_tokens if draft_model else None

        return bool(draft_model), draft_model, num_tokens, require_supported

    # ── Engine constructor helpers ─────────────────────────────────────

    @staticmethod
    def _engine_constructor_capabilities(engine_cls: type[Any]) -> tuple[set[str], bool]:
        params = inspect.signature(engine_cls.__init__).parameters
        has_var_kwargs = any(
            p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()
        )
        supported = {name for name in params if name != "self"}
        return supported, has_var_kwargs

    @staticmethod
    def _resolve_supported_engine_kwargs(
        requested_kwargs: dict[str, Any],
        supported_params: set[str],
        has_var_kwargs: bool,
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
        if has_var_kwargs:
            return dict(requested_kwargs), {}, {k: k for k in requested_kwargs}

        alias_map: dict[str, tuple[str, ...]] = {
            "speculative_model": ("speculative_model", "draft_model"),
            "num_speculative_tokens": (
                "num_speculative_tokens",
                "num_draft_tokens",
                "speculative_num_tokens",
            ),
            "kv_bits": ("kv_bits",),
            "kv_group_size": ("kv_group_size",),
            "prefix_cache": ("prefix_cache", "enable_prefix_cache"),
        }

        resolved: dict[str, Any] = {}
        unsupported: dict[str, Any] = {}
        mapped_names: dict[str, str] = {}

        for logical_key, value in requested_kwargs.items():
            candidates = alias_map.get(logical_key, (logical_key,))
            target = next((name for name in candidates if name in supported_params), None)
            if target is None:
                unsupported[logical_key] = value
                continue
            resolved[target] = value
            mapped_names[logical_key] = target

        return resolved, unsupported, mapped_names

    # ── Backend probing ────────────────────────────────────────────────

    async def probe_model_backends(
        self,
        model_id: str,
        *,
        timeout_sec: float = 90.0,
        allow_unsupported_runtime: bool = False,
        engine_ref: Any = None,
    ) -> dict[str, Any]:
        """Probe backend candidates for a model without fully loading it."""
        candidates = backend_candidates(
            model_id,
            engine_ref,
            self._compatibility,
            allow_failed=allow_unsupported_runtime,
        )
        outcomes: list[dict[str, Any]] = []

        for bkend in candidates:
            if bkend == "vllm-mlx":
                if not self._loader_isolation_enabled:
                    outcomes.append({
                        "backend": bkend,
                        "outcome": "unknown",
                        "reason": "loader_isolation_disabled",
                    })
                    continue
                try:
                    outcome = await run_loader_supervisor(
                        LoadSpec(
                            model_id=model_id,
                            backend=bkend,
                            use_batching=self._use_batching,
                            performance_overrides={},
                            probe_only=True,
                        ),
                        timeout_sec=float(timeout_sec),
                    )
                except Exception as exc:
                    outcomes.append({
                        "backend": bkend,
                        "outcome": "fail",
                        "reason": f"{ErrorCodes.MODEL_PROBE_FAILED}:{exc}",
                    })
                    continue
                if outcome.ok:
                    outcomes.append({"backend": bkend, "outcome": "pass", "reason": None})
                else:
                    failure = outcome.failure
                    reason = (
                        f"{failure.code}:{failure.message}"
                        if failure is not None
                        else ErrorCodes.MODEL_PROBE_FAILED
                    )
                    outcomes.append({"backend": bkend, "outcome": "fail", "reason": reason})
                continue

            if bkend == "gguf":
                resolved = resolve_local_gguf_equivalents(model_id)
                if resolved:
                    outcomes.append({"backend": bkend, "outcome": "pass", "reason": None})
                else:
                    outcomes.append({
                        "backend": bkend,
                        "outcome": "fail",
                        "reason": "no_local_gguf_equivalent",
                    })
                continue

            if bkend == "mlx-lm":
                backend_instance: MLXLMBackend | None = None
                try:
                    backend_instance = MLXLMBackend(model_id=model_id)
                    async with asyncio.timeout(float(timeout_sec)):
                        await backend_instance.probe()
                    outcomes.append({"backend": bkend, "outcome": "pass", "reason": None})
                except TimeoutError:
                    outcomes.append({
                        "backend": bkend,
                        "outcome": "fail",
                        "reason": f"{ErrorCodes.MODEL_PROBE_FAILED}:probe_timeout",
                    })
                except Exception as exc:
                    outcomes.append({
                        "backend": bkend,
                        "outcome": "fail",
                        "reason": f"{ErrorCodes.MODEL_PROBE_FAILED}:{exc}",
                    })
                finally:
                    if backend_instance is not None:
                        backend_instance.close()
                continue

            outcomes.append({"backend": bkend, "outcome": "unknown", "reason": "not_probed"})

        recommended_backend = next(
            (
                row["backend"]
                for row in outcomes
                if row.get("outcome") in {"pass", "unknown"}
            ),
            None,
        )
        return {
            "model_id": model_id,
            "recommended_backend": recommended_backend,
            "candidates": outcomes,
        }

    # ── Load ───────────────────────────────────────────────────────────

    async def load_model(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
        keep_alive_sec: int | None = None,
        allow_unsupported_runtime: bool = False,
        preferred_backend: str | None = None,
        engine_ref: Any = None,
    ) -> ModelInfo:
        """Load an MLX model into memory with admission control."""
        if ".." in model_id:
            raise ValueError(
                f"Invalid model ID: '{model_id}'. "
                "Path traversal sequences are not allowed."
            )

        while True:
            should_evict = False
            current_usage = 0.0
            reserved_usage = 0.0
            projected_usage = 0.0
            reservation_gb = 0.0
            used_estimate = False

            async with self._load_lock:
                if model_id in self._models:
                    logger.info("model_already_loaded", extra={"model_id": model_id})
                    existing = self._models[model_id]
                    existing.last_used_at = time.time()
                    return ModelInfo(
                        model_id=model_id,
                        loaded=True,
                        memory_used_gb=existing.estimated_memory_gb,
                        loaded_at=existing.loaded_at,
                    )

                if model_id in self._loading_models:
                    raise RuntimeError(
                        f"Model '{model_id}' is already being loaded by another request"
                    )

                current_usage = self._memory.usage_percent()
                reserved_usage = self._memory_percent_from_gb(self._reserved_load_memory_gb())
                reservation_gb, used_estimate = self._resolve_admission_reservation_gb(
                    performance_overrides=performance_overrides,
                    current_usage_percent=current_usage,
                    reserved_usage_percent=reserved_usage,
                )
                reservation_usage = self._memory_percent_from_gb(reservation_gb)
                projected_usage = current_usage + reserved_usage + reservation_usage

                admitted = (
                    projected_usage <= self._memory.threshold_percent
                    and (used_estimate or reservation_gb > 0)
                )
                if admitted:
                    self._loading_models.add(model_id)
                    self._load_memory_reservations_gb[model_id] = reservation_gb
                    break

                should_evict = self._auto_evict_lru and bool(self._models)
                if not should_evict:
                    reserved_reason = (
                        "in-flight load reservations"
                        if reserved_usage > 0
                        else "current usage"
                    )
                    raise MemoryError(
                        f"Insufficient memory headroom for loading '{model_id}': "
                        f"current={current_usage:.1f}% "
                        f"+ reserved={reserved_usage:.1f}% "
                        f"+ requested={self._memory_percent_from_gb(reservation_gb):.1f}% "
                        f"= {projected_usage:.1f}% exceeds "
                        f"{self._memory.threshold_percent}% threshold ({reserved_reason})."
                    )

            if should_evict:
                evicted_id = await self._evict_least_recently_used()
                if evicted_id:
                    logger.info("lru_evicted_for_load", extra={
                        "evicted": evicted_id,
                        "loading": model_id,
                        "current_usage_percent": round(current_usage, 1),
                        "reserved_usage_percent": round(reserved_usage, 1),
                        "projected_usage_percent": round(projected_usage, 1),
                    })
                continue

        await self._set_readiness_state(model_id, "admitted")
        try:
            return await self._do_load(
                model_id, use_batching, performance_overrides,
                keep_alive_sec=keep_alive_sec,
                allow_unsupported_runtime=allow_unsupported_runtime,
                preferred_backend=preferred_backend,
                engine_ref=engine_ref,
            )
        finally:
            async with self._load_lock:
                self._loading_models.discard(model_id)
                self._load_memory_reservations_gb.pop(model_id, None)

    async def _do_load(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
        keep_alive_sec: int | None = None,
        allow_unsupported_runtime: bool = False,
        preferred_backend: str | None = None,
        engine_ref: Any = None,
    ) -> ModelInfo:
        """Execute the actual model load (called after lock/guard checks)."""
        fmt = _detect_format(model_id)
        candidate_backends = backend_candidates(
            model_id,
            engine_ref,
            self._compatibility,
            allow_failed=allow_unsupported_runtime or preferred_backend is not None,
            preferred_backend=preferred_backend,
        )
        selected_backend = candidate_backends[0] if candidate_backends else "vllm-mlx"
        gguf_model_path: str | None = None
        if selected_backend == "gguf" and fmt != "gguf":
            if not self._gguf_fallback_enabled:
                raise RuntimeError("gguf_fallback_disabled")
            gguf_candidates = resolve_local_gguf_equivalents(model_id)
            if not gguf_candidates:
                raise RuntimeError(
                    "No local GGUF equivalent found for model "
                    f"'{model_id}' while GGUF fallback is enabled.",
                )
            gguf_model_path = gguf_candidates[0]
            fmt = "gguf"
        runtime_backend = "mlx" if selected_backend in {"vllm-mlx", "mlx-lm"} else selected_backend
        runtime_issue = (
            _detect_runtime_incompatibility(model_id)
            if fmt == "mlx" and selected_backend == "vllm-mlx"
            else None
        )
        if runtime_issue is not None:
            runtime_versions = runtime_issue.get("runtime_versions", {})
            version_hint_parts = [
                f"{name}={version}"
                for name, version in runtime_versions.items()
                if isinstance(version, str) and version
            ]
            version_hint = (
                ", ".join(version_hint_parts)
                if version_hint_parts
                else "unknown versions"
            )
            if not allow_unsupported_runtime:
                logger.warning("model_runtime_incompatible_blocked", extra={
                    "model_id": model_id,
                    "matched_signature": runtime_issue.get("matched_signature"),
                    "model_type": runtime_issue.get("model_type"),
                    "architectures": runtime_issue.get("architectures"),
                    "runtime_versions": runtime_versions,
                })
                await self._set_readiness_state(
                    model_id,
                    "quarantined",
                    reason=f"{ErrorCodes.MODEL_UNSUPPORTED_BACKEND}:{runtime_issue.get('matched_signature')}",
                )
                await self._record_compatibility(
                    model_id=model_id,
                    backend=selected_backend,
                    backend_version_value=backend_version(runtime_backend),
                    outcome="fail",
                    reason=f"runtime_incompatible:{runtime_issue.get('matched_signature')}",
                    metadata={"runtime_versions": runtime_versions},
                )
                raise ModelRuntimeCompatibilityError(
                    f"Model '{model_id}' appears to use unsupported runtime signature "
                    f"'{runtime_issue.get('matched_signature')}'. This signature is currently "
                    "blocked because it can trigger process-level instability during MLX engine "
                    f"bring-up on this stack ({version_hint}). "
                    "Use a supported model variant or retry with "
                    "`allow_unsupported_runtime=true` if you explicitly accept crash risk."
                )
            logger.warning("model_runtime_incompatibility_override", extra={
                "model_id": model_id,
                "matched_signature": runtime_issue.get("matched_signature"),
                "model_type": runtime_issue.get("model_type"),
                "architectures": runtime_issue.get("architectures"),
                "runtime_versions": runtime_versions,
            })

        batching = use_batching if use_batching is not None else self._use_batching

        # Autotune load-time precedence
        tuned_record = self._get_tuned_profile(model_id, backend=selected_backend)
        if tuned_record is not None:
            tuned_profile = tuned_record.get("profile", {})
            if tuned_profile:
                merged = dict(tuned_profile)
                if performance_overrides:
                    merged.update(performance_overrides)
                perf = merged
                logger.info("autotune_profile_applied", extra={
                    "model_id": model_id,
                    "backend": selected_backend,
                    "tuned_keys": sorted(tuned_profile.keys()),
                    "override_keys": sorted((performance_overrides or {}).keys()),
                })
            else:
                perf = performance_overrides or {}
        else:
            perf = performance_overrides or {}

        await self._set_readiness_state(model_id, "loading")

        if fmt == "mlx" and selected_backend == "vllm-mlx" and self._loader_isolation_enabled:
            try:
                outcome = await run_loader_supervisor(
                    LoadSpec(
                        model_id=model_id,
                        backend=selected_backend,
                        use_batching=batching,
                        performance_overrides=perf,
                        probe_only=True,
                    ),
                    timeout_sec=float(self._loader_timeout_sec),
                )
            except Exception as exc:
                outcome = None
                fallback_failure = LoaderFailure(
                    code=ErrorCodes.MODEL_PROBE_FAILED,
                    message=f"Loader probe failed: {exc}",
                )
            else:
                fallback_failure = LoaderFailure(
                    code=ErrorCodes.MODEL_PROBE_FAILED,
                    message=ErrorCodes.MODEL_PROBE_FAILED,
                )

            if outcome is None or not outcome.ok:
                failure = (
                    fallback_failure
                    if outcome is None
                    else (outcome.failure or fallback_failure)
                )
                failure_reason = f"{failure.code}:{failure.message}"
                await self._mark_readiness_failure(
                    model_id,
                    reason=failure_reason,
                    quarantine_threshold=self._runtime_failure_quarantine_threshold,
                )
                await self._record_compatibility(
                    model_id=model_id,
                    backend=selected_backend,
                    backend_version_value=backend_version(runtime_backend),
                    outcome="fail",
                    reason=failure_reason,
                    metadata={
                        "exit_code": failure.exit_code,
                        "signal": failure.signal,
                        "loader_timeout_sec": self._loader_timeout_sec,
                    },
                )
                raise RuntimeError(failure_reason)

        spec_requested, draft_model, spec_num_tokens, spec_require_supported = (
            self._resolve_speculative_config(perf)
        )
        speculative_status: dict[str, Any] = {
            "requested": spec_requested,
            "active": False,
            "reason": "not_requested" if not spec_requested else None,
            "draft_model": draft_model if spec_requested else None,
            "num_tokens": spec_num_tokens if spec_requested else None,
            "telemetry": "unavailable",
        }
        memory_before = self._memory.used_memory_gb()
        start = time.monotonic()

        backend_instance: Any = None
        engine: Any = None

        try:
            if selected_backend == "mlx-lm":
                backend_instance = MLXLMBackend(model_id=model_id)
                engine = None
            elif fmt == "gguf":
                if spec_requested and spec_require_supported:
                    raise RuntimeError(
                        "Speculative decoding is not supported for GGUF models in Opta-LMX. "
                        "Disable speculative settings for this model (or set "
                        "`speculative.require_supported=false`) or use an MLX backend."
                    )
                if spec_requested:
                    speculative_status["active"] = False
                    speculative_status["reason"] = "backend_unsupported:gguf"
                    logger.warning("speculative_not_supported_backend", extra={
                        "model_id": model_id,
                        "backend_type": "gguf",
                        "reason": speculative_status["reason"],
                    })
                from opta_lmx.inference.gguf_backend import GGUFBackend

                backend_instance = GGUFBackend(
                    model_path=gguf_model_path or model_id,
                    n_ctx=self._gguf_context_length,
                    n_gpu_layers=self._gguf_gpu_layers,
                )
                engine = None
            else:
                created = await self._create_engine(
                    model_id, batching, performance_overrides=perf or None,
                )
                if isinstance(created, tuple) and len(created) == 2:
                    engine, speculative_status = created
                else:
                    engine = created
                    speculative_status = {
                        "requested": spec_requested,
                        "active": spec_requested,
                        "reason": None if spec_requested else "not_requested",
                        "draft_model": draft_model if spec_requested else None,
                        "num_tokens": spec_num_tokens if spec_requested else None,
                        "telemetry": "unavailable",
                    }
        except MemoryError:
            raise
        except OSError:
            raise
        except Exception as e:
            logger.error("model_load_failed", extra={
                "model_id": model_id, "format": fmt, "error": str(e),
            })
            raise RuntimeError(f"Failed to load model {model_id}: {e}") from e

        elapsed = time.monotonic() - start
        memory_after = self._memory.used_memory_gb()
        model_memory_gb = max(0, memory_after - memory_before)

        if self._memory.usage_percent() >= self._memory.threshold_percent:
            logger.warning(
                "model_load_exceeded_threshold",
                extra={"model_id": model_id, "memory_after_percent": self._memory.usage_percent()},
            )
            if backend_instance:
                backend_instance.close()
            if engine:
                del engine
            gc.collect()
            raise MemoryError(
                f"Loading {model_id} pushed memory to {self._memory.usage_percent():.1f}% — "
                f"exceeds {self._memory.threshold_percent}% threshold. Model unloaded."
            )

        ctx_len: int | None = None
        ctx_len = self._gguf_context_length if fmt == "gguf" else _resolve_context_length(model_id)

        loaded_at = time.time()
        loaded = LoadedModel(
            model_id=model_id,
            engine=engine,
            loaded_at=loaded_at,
            use_batching=batching if fmt == "mlx" else False,
            estimated_memory_gb=round(model_memory_gb, 2),
            backend_type=fmt,
            backend=backend_instance,
            context_length=ctx_len,
            performance_overrides=performance_overrides or {},
            keep_alive_sec=keep_alive_sec,
            last_used_at=loaded_at,
            speculative_requested=bool(speculative_status.get("requested")),
            speculative_active=bool(speculative_status.get("active")),
            speculative_reason=cast(str | None, speculative_status.get("reason")),
            speculative_draft_model=cast(str | None, speculative_status.get("draft_model")),
            speculative_num_tokens=cast(int | None, speculative_status.get("num_tokens")),
        )
        loaded.readiness_state = "canary_pending"
        await self._set_readiness_state(model_id, "canary_pending")
        async with self._load_lock:
            self._models[model_id] = loaded

        logger.info(
            "model_loaded",
            extra={
                "model_id": model_id,
                "format": fmt,
                "duration_sec": round(elapsed, 2),
                "memory_used_gb": round(memory_after, 2),
                "batching": batching if fmt == "mlx" else False,
                "speculative_active": loaded.speculative_active,
                "speculative_requested": loaded.speculative_requested,
                "speculative_reason": loaded.speculative_reason,
            },
        )

        await self._publish_engine_event(
            event_type="model_loaded",
            data={
                "model_id": model_id,
                "format": fmt,
                "memory_gb": round(model_memory_gb, 2),
                "duration_sec": round(elapsed, 2),
            },
        )

        if self._warmup_on_load:
            await self._warmup_model(model_id)

        canary_started_at = time.monotonic()
        await self._publish_engine_event(
            event_type="model_canary_started",
            data={
                "model_id": model_id,
                "backend": selected_backend,
            },
        )
        try:
            await self._run_load_canary(model_id)
            loaded.readiness_state = "routable"
            loaded.readiness_reason = None
            await self._set_readiness_state(model_id, "routable")
            await self._record_compatibility(
                model_id=model_id,
                backend=selected_backend,
                backend_version_value=backend_version(runtime_backend),
                outcome="pass",
                reason="canary_ok",
            )
            await self._publish_engine_event(
                event_type="model_canary_passed",
                data={
                    "model_id": model_id,
                    "backend": selected_backend,
                    "duration_sec": round(time.monotonic() - canary_started_at, 4),
                },
            )
        except Exception as e:
            loaded.readiness_state = "quarantined"
            loaded.readiness_reason = f"{ErrorCodes.MODEL_CANARY_FAILED}:{e}"
            await self._mark_readiness_failure(
                model_id,
                reason=str(e),
                quarantine_threshold=self._runtime_failure_quarantine_threshold,
            )
            await self._record_compatibility(
                model_id=model_id,
                backend=selected_backend,
                backend_version_value=backend_version(runtime_backend),
                outcome="fail",
                reason=f"canary_failed:{e}",
            )
            await self._publish_engine_event(
                event_type="model_canary_failed",
                data={
                    "model_id": model_id,
                    "backend": selected_backend,
                    "duration_sec": round(time.monotonic() - canary_started_at, 4),
                    "error": str(e),
                },
            )
            await self.unload_model(model_id, reason="canary_failed")
            raise RuntimeError(
                f"Model '{model_id}' failed canary inference and was quarantined: {e}"
            ) from e

        self._adapt_concurrency()

        return ModelInfo(
            model_id=model_id,
            loaded=True,
            memory_used_gb=round(memory_after, 2),
            loaded_at=loaded.loaded_at,
            use_batching=batching if fmt == "mlx" else False,
        )

    def _get_tuned_profile(
        self,
        model_id: str,
        *,
        backend: str | None = None,
        backend_version_value: str | None = None,
        allow_failed: bool = False,
    ) -> dict[str, Any] | None:
        resolved_backend = backend or self._resolve_autotune_backend(
            model_id,
            allow_failed=allow_failed,
        )
        resolved_version = backend_version_value or self._autotune_backend_version(resolved_backend)
        return self._autotune.get_best(
            model_id=model_id,
            backend=resolved_backend,
            backend_version=resolved_version,
        )

    # ── Engine creation ────────────────────────────────────────────────

    async def _create_engine(
        self,
        model_id: str,
        use_batching: bool,
        performance_overrides: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        resolved_model_name = _resolve_engine_model_name(model_id)
        if resolved_model_name != model_id:
            logger.info("model_source_resolved_local", extra={
                "model_id": model_id, "resolved_model_name": resolved_model_name,
            })

        perf = performance_overrides or {}
        spec_requested, draft_model, spec_num_tokens, spec_require_supported = (
            self._resolve_speculative_config(perf)
        )
        speculative_status: dict[str, Any] = {
            "requested": spec_requested,
            "active": False,
            "reason": "not_requested" if not spec_requested else None,
            "draft_model": draft_model if spec_requested else None,
            "num_tokens": spec_num_tokens if spec_requested else None,
            "telemetry": "unavailable",
        }
        optional_kwargs: dict[str, Any] = {}
        if spec_requested:
            optional_kwargs["speculative_model"] = draft_model
            optional_kwargs["num_speculative_tokens"] = spec_num_tokens

        kv_bits = perf.get("kv_bits", self._kv_bits)
        kv_group_size = perf.get("kv_group_size", self._kv_group_size)
        if kv_bits is not None:
            optional_kwargs["kv_bits"] = kv_bits
            optional_kwargs["kv_group_size"] = kv_group_size

        prefix_cache = perf.get("prefix_cache", self._prefix_cache_enabled)
        if not use_batching and not prefix_cache:
            optional_kwargs["prefix_cache"] = False

        if perf:
            logger.info("performance_overrides_applied", extra={
                "model_id": model_id,
                "overrides": {k: v for k, v in perf.items() if k != "memory_estimate_gb"},
            })

        if use_batching:
            from vllm_mlx.engine.batched import BatchedEngine
            from vllm_mlx.scheduler import SchedulerConfig

            sched_overrides = perf.get("scheduler", {})
            scheduler_config = SchedulerConfig(
                max_num_seqs=sched_overrides.get(
                    "max_num_seqs", self._scheduler_max_num_seqs,
                ),
                prefill_batch_size=sched_overrides.get(
                    "prefill_batch_size", self._scheduler_prefill_batch_size,
                ),
                completion_batch_size=sched_overrides.get(
                    "completion_batch_size", self._scheduler_completion_batch_size,
                ),
                cache_memory_percent=sched_overrides.get(
                    "cache_memory_percent", self._scheduler_cache_memory_percent,
                ),
                enable_prefix_cache=(
                    prefix_cache if isinstance(prefix_cache, bool)
                    else self._prefix_cache_enabled
                ),
            )
            supported_params, has_var_kwargs = self._engine_constructor_capabilities(BatchedEngine)
            engine_kwargs, unsupported_kwargs, mapped_names = self._resolve_supported_engine_kwargs(
                optional_kwargs, supported_params, has_var_kwargs,
            )

            missing_spec = [
                key for key in ("speculative_model", "num_speculative_tokens")
                if key in unsupported_kwargs
            ]
            if spec_requested and missing_spec:
                if spec_require_supported:
                    raise RuntimeError(
                        "Speculative decoding requested but BatchedEngine does not support "
                        f"required constructor kwargs in this vllm-mlx version: {missing_spec}. "
                        "Disable speculative settings, set "
                        "`speculative.require_supported=false`, or update vllm-mlx."
                    )
                speculative_status["active"] = False
                speculative_status["reason"] = (
                    "backend_constructor_unsupported:BatchedEngine"
                )
                logger.warning("speculative_constructor_unsupported", extra={
                    "model_id": model_id,
                    "engine": "BatchedEngine",
                    "missing_kwargs": missing_spec,
                    "reason": speculative_status["reason"],
                })
            elif spec_requested:
                speculative_status["active"] = True
                speculative_status["reason"] = None

            unsupported_non_spec = {
                key: value for key, value in unsupported_kwargs.items()
                if key not in ("speculative_model", "num_speculative_tokens")
            }
            if unsupported_non_spec:
                logger.warning("engine_optional_kwargs_unsupported", extra={
                    "model_id": model_id,
                    "engine": "BatchedEngine",
                    "unsupported_kwargs": sorted(unsupported_non_spec.keys()),
                    "supported_params": sorted(supported_params),
                })

            engine = BatchedEngine(
                model_name=resolved_model_name,
                stream_interval=self._stream_interval,
                scheduler_config=scheduler_config,
                **engine_kwargs,
            )
            await engine.start()
            if mapped_names:
                logger.debug("engine_kwargs_mapped", extra={
                    "model_id": model_id,
                    "engine": "BatchedEngine",
                    "mapped": mapped_names,
                })
            return engine, speculative_status
        else:
            from vllm_mlx.engine.simple import SimpleEngine

            supported_params, has_var_kwargs = self._engine_constructor_capabilities(SimpleEngine)
            engine_kwargs, unsupported_kwargs, mapped_names = self._resolve_supported_engine_kwargs(
                optional_kwargs, supported_params, has_var_kwargs,
            )

            missing_spec = [
                key for key in ("speculative_model", "num_speculative_tokens")
                if key in unsupported_kwargs
            ]
            if spec_requested and missing_spec:
                if spec_require_supported:
                    raise RuntimeError(
                        "Speculative decoding requested but SimpleEngine does not support "
                        f"required constructor kwargs in this vllm-mlx version: {missing_spec}. "
                        "Disable speculative settings, set "
                        "`speculative.require_supported=false`, or update vllm-mlx."
                    )
                speculative_status["active"] = False
                speculative_status["reason"] = (
                    "backend_constructor_unsupported:SimpleEngine"
                )
                logger.warning("speculative_constructor_unsupported", extra={
                    "model_id": model_id,
                    "engine": "SimpleEngine",
                    "missing_kwargs": missing_spec,
                    "reason": speculative_status["reason"],
                })
            elif spec_requested:
                speculative_status["active"] = True
                speculative_status["reason"] = None

            unsupported_non_spec = {
                key: value for key, value in unsupported_kwargs.items()
                if key not in ("speculative_model", "num_speculative_tokens")
            }
            if unsupported_non_spec:
                logger.warning("engine_optional_kwargs_unsupported", extra={
                    "model_id": model_id,
                    "engine": "SimpleEngine",
                    "unsupported_kwargs": sorted(unsupported_non_spec.keys()),
                    "supported_params": sorted(supported_params),
                })
            if mapped_names:
                logger.debug("engine_kwargs_mapped", extra={
                    "model_id": model_id,
                    "engine": "SimpleEngine",
                    "mapped": mapped_names,
                })

            return SimpleEngine(model_name=resolved_model_name, **engine_kwargs), speculative_status

    # ── Unload ─────────────────────────────────────────────────────────

    async def unload_model(self, model_id: str, *, reason: str = "manual") -> float:
        async with self._load_lock:
            if model_id not in self._models:
                raise KeyError(f"Model {model_id} is not loaded")
            loaded = self._models.pop(model_id)
        self._readiness.clear(model_id)

        memory_before = self._memory.used_memory_gb()

        try:
            if loaded.backend is not None:
                loaded.backend.close()
        except Exception as e:
            logger.warning("backend_close_failed", extra={
                "model_id": model_id, "error": str(e),
            })
        finally:
            if loaded.engine is not None:
                del loaded.engine
            gc.collect()

        if loaded.backend_type == "mlx":
            try:
                import mlx.core as mx

                mx.metal.clear_cache()
            except Exception as e:
                logger.debug("metal_cache_clear_failed", extra={"error": str(e)})

        memory_after = self._memory.used_memory_gb()
        freed = max(0, memory_before - memory_after)

        logger.info(
            "model_unloaded",
            extra={"model_id": model_id, "memory_freed_gb": round(freed, 2)},
        )

        if self._event_bus:
            await self._event_bus.publish(ServerEvent(
                event_type="model_unloaded",
                data={
                    "model_id": model_id,
                    "memory_freed_gb": round(freed, 2),
                    "reason": reason,
                },
            ))

        self._adapt_concurrency()

        return freed

    # ── Warmup / canary ────────────────────────────────────────────────

    async def _warmup_model(self, model_id: str) -> None:
        loaded = self._models.get(model_id)
        if loaded is None:
            return

        warmup_messages = [{"role": "user", "content": "Hi"}]
        start = time.monotonic()

        try:
            if loaded.backend is not None:
                await loaded.backend.generate(
                    messages=warmup_messages, temperature=0.0, max_tokens=16,
                    top_p=1.0, stop=None, tools=None, response_format=None,
                )
            elif loaded.engine is not None:
                await loaded.engine.chat(
                    messages=warmup_messages, temperature=0.0, max_tokens=16,
                )
            elapsed = time.monotonic() - start
            logger.info("model_warmup_complete", extra={
                "model_id": model_id, "warmup_ms": round(elapsed * 1000, 1),
            })
        except Exception as e:
            logger.warning("model_warmup_failed", extra={
                "model_id": model_id, "error": str(e),
            })

    async def _run_load_canary(self, model_id: str) -> None:
        loaded = self._models.get(model_id)
        if loaded is None:
            raise RuntimeError("model_not_loaded")

        msg = [{"role": "user", "content": "Reply with exactly: OK"}]
        if loaded.backend is not None:
            result = await loaded.backend.generate(
                messages=msg,
                temperature=0.0,
                max_tokens=8,
                top_p=1.0,
                stop=None,
                tools=None,
                response_format=None,
            )
            text = result[0] if isinstance(result, tuple) and result else str(result)
        else:
            result = await loaded.engine.chat(messages=msg, temperature=0.0, max_tokens=8)
            text = result.text if hasattr(result, "text") else str(result)

        if not str(text).strip():
            raise RuntimeError("empty_canary_response")

    # ── Eviction ───────────────────────────────────────────────────────

    async def _evict_least_recently_used(self) -> str | None:
        if not self._models:
            return None

        lru_model = min(self._models.values(), key=lambda m: m.last_used_at)
        model_id = lru_model.model_id

        logger.info("lru_eviction", extra={
            "model_id": model_id,
            "last_used_at": lru_model.last_used_at,
            "request_count": lru_model.request_count,
        })

        await self.unload_model(model_id, reason="lru")
        return model_id

    async def evict_idle_models(self, ttl_seconds: float) -> list[str]:
        now = time.time()
        evicted: list[str] = []

        for model_id, loaded in list(self._models.items()):
            effective_ttl = (
                loaded.keep_alive_sec if loaded.keep_alive_sec is not None else ttl_seconds
            )
            if effective_ttl <= 0:
                continue
            last_used_at = loaded.last_used_at if loaded.last_used_at > 0 else loaded.loaded_at
            idle_time = now - last_used_at
            if idle_time > effective_ttl:
                logger.info("ttl_eviction", extra={
                    "model_id": model_id,
                    "idle_seconds": round(idle_time, 1),
                    "ttl_seconds": effective_ttl,
                    "per_model_override": loaded.keep_alive_sec is not None,
                })
                try:
                    await self.unload_model(model_id, reason="ttl")
                    evicted.append(model_id)
                    if self._event_bus:
                        await self._event_bus.publish(ServerEvent(
                            event_type="model_ttl_evicted",
                            data={"model_id": model_id, "idle_seconds": round(idle_time, 1)},
                        ))
                except Exception as e:
                    logger.error("ttl_eviction_failed", extra={
                        "model_id": model_id, "error": str(e),
                    })

        return evicted

    # ── Backend label helpers ──────────────────────────────────────────

    @staticmethod
    def _loaded_backend_name(loaded: LoadedModel) -> str:
        if loaded.backend_type == "gguf":
            return "gguf"
        if loaded.backend is not None and loaded.backend.__class__.__name__ == "MLXLMBackend":
            return "mlx-lm"
        return "vllm-mlx"
