"""MLX inference engine wrapping vllm-mlx, with GGUF fallback support."""

from __future__ import annotations

import asyncio
import contextvars
import logging
from collections.abc import AsyncIterator
from importlib import metadata as importlib_metadata
from typing import Any

from opta_lmx.inference.autotune_registry import AutotuneRegistry
from opta_lmx.inference.backend_policy import backend_candidates
from opta_lmx.inference.engine_concurrency import ConcurrencyController
from opta_lmx.inference.engine_generate import (
    GenerationExecutor,
    SpeculativeTelemetryHelper,
    _resolve_messages,
)
from opta_lmx.inference.engine_lifecycle import (
    ModelLifecycleManager,
    ModelRuntimeCompatibilityError,
    _collect_model_signature_hints,
    _detect_format,
    _detect_runtime_incompatibility,
    _resolve_context_length,
    _resolve_engine_model_name,
    _runtime_backend_versions,
)
from opta_lmx.inference.predictor import UsagePredictor
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
)
from opta_lmx.inference.types import LoadedModel, ModelInfo
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import (
    CompatibilityRegistry,
    ReadinessTracker,
    backend_version,
)
from opta_lmx.monitoring.events import EventBus

logger = logging.getLogger(__name__)

# Re-export module-level symbols that tests and other code import from engine.py
__all__ = [
    "InferenceEngine",
    "ModelRuntimeCompatibilityError",
    "_collect_model_signature_hints",
    "_detect_format",
    "_detect_runtime_incompatibility",
    "_resolve_context_length",
    "_resolve_engine_model_name",
    "_resolve_messages",
    "_runtime_backend_versions",
]


class InferenceEngine:
    """Manages MLX model lifecycle and inference via vllm-mlx.

    Wraps vllm-mlx's SimpleEngine/BatchedEngine and adds:
    - Multi-model management (load, unload, track)
    - Memory checking before load
    - Standardized response formatting
    - Error handling that never crashes
    """

    def __init__(
        self,
        memory_monitor: MemoryMonitor,
        use_batching: bool = True,
        auto_evict_lru: bool = True,
        gguf_context_length: int = 4096,
        gguf_gpu_layers: int = -1,
        event_bus: EventBus | None = None,
        speculative_model: str | None = None,
        speculative_num_tokens: int = 5,
        speculative_require_supported: bool = False,
        kv_bits: int | None = None,
        kv_group_size: int = 64,
        prefix_cache_enabled: bool = True,
        max_concurrent_requests: int = 4,
        inference_timeout_sec: int = 300,
        loader_isolation_enabled: bool = True,
        loader_timeout_sec: int = 120,
        backend_preference_order: list[str] | None = None,
        gguf_fallback_enabled: bool = False,
        warmup_on_load: bool = True,
        stream_interval: int = 1,
        scheduler_max_num_seqs: int = 256,
        scheduler_prefill_batch_size: int = 8,
        scheduler_completion_batch_size: int = 32,
        scheduler_cache_memory_percent: float = 0.2,
        semaphore_timeout_sec: float = 30.0,
        per_client_default_concurrency: int | None = None,
        per_client_concurrency_overrides: dict[str, int] | None = None,
        per_model_concurrency_limits: dict[str, int] | None = None,
        adaptive_concurrency_enabled: bool = True,
        adaptive_latency_target_ms: float = 2500.0,
        adaptive_latency_window: int = 128,
        adaptive_min_concurrent_requests: int = 1,
    ) -> None:
        # Shared mutable state
        self._models: dict[str, LoadedModel] = {}
        self._memory = memory_monitor
        self._event_bus = event_bus
        self._load_lock = asyncio.Lock()
        self._loading_models: set[str] = set()
        self._load_memory_reservations_gb: dict[str, float] = {}
        self._inference_timeout = inference_timeout_sec
        self._backend_preference_order = list(backend_preference_order or ["vllm-mlx", "mlx-lm"])
        self._readiness = ReadinessTracker()
        self._compatibility = CompatibilityRegistry()
        self._autotune = AutotuneRegistry()
        self._predictor = UsagePredictor()

        self._speculative_telemetry_ctx: contextvars.ContextVar[dict[str, Any] | None] = (
            contextvars.ContextVar("speculative_telemetry", default=None)
        )
        self._queue_wait_sec_ctx: contextvars.ContextVar[float | None] = (
            contextvars.ContextVar("queue_wait_sec", default=None)
        )

        # ── Concurrency controller ────────────────────────────────────
        self._concurrency = ConcurrencyController(
            max_concurrent_requests=max_concurrent_requests,
            semaphore_timeout_sec=semaphore_timeout_sec,
            per_client_default_concurrency=per_client_default_concurrency,
            per_client_concurrency_overrides=per_client_concurrency_overrides,
            per_model_concurrency_limits=per_model_concurrency_limits,
            adaptive_concurrency_enabled=adaptive_concurrency_enabled,
            adaptive_latency_target_ms=adaptive_latency_target_ms,
            adaptive_latency_window=adaptive_latency_window,
            adaptive_min_concurrent_requests=adaptive_min_concurrent_requests,
        )

        # Store config values needed by lifecycle and misc methods
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
        self._gguf_fallback_enabled = gguf_fallback_enabled
        self._warmup_on_load = warmup_on_load
        self._stream_interval = stream_interval
        self._scheduler_max_num_seqs = scheduler_max_num_seqs
        self._scheduler_prefill_batch_size = scheduler_prefill_batch_size
        self._scheduler_completion_batch_size = scheduler_completion_batch_size
        self._scheduler_cache_memory_percent = scheduler_cache_memory_percent
        self._max_concurrent = max_concurrent_requests
        self._runtime_failure_quarantine_threshold = 3
        self._adaptive_concurrency_enabled = adaptive_concurrency_enabled

        # ── Lifecycle manager ──────────────────────────────────────────
        self._lifecycle = ModelLifecycleManager(
            memory_monitor=memory_monitor,
            models=self._models,
            load_lock=self._load_lock,
            loading_models=self._loading_models,
            load_memory_reservations_gb=self._load_memory_reservations_gb,
            readiness=self._readiness,
            compatibility=self._compatibility,
            autotune=self._autotune,
            event_bus=event_bus,
            use_batching=use_batching,
            auto_evict_lru=auto_evict_lru,
            gguf_context_length=gguf_context_length,
            gguf_gpu_layers=gguf_gpu_layers,
            speculative_model=speculative_model,
            speculative_num_tokens=speculative_num_tokens,
            speculative_require_supported=speculative_require_supported,
            kv_bits=kv_bits,
            kv_group_size=kv_group_size,
            prefix_cache_enabled=prefix_cache_enabled,
            loader_isolation_enabled=loader_isolation_enabled,
            loader_timeout_sec=loader_timeout_sec,
            backend_preference_order=self._backend_preference_order,
            gguf_fallback_enabled=gguf_fallback_enabled,
            warmup_on_load=warmup_on_load,
            stream_interval=stream_interval,
            scheduler_max_num_seqs=scheduler_max_num_seqs,
            scheduler_prefill_batch_size=scheduler_prefill_batch_size,
            scheduler_completion_batch_size=scheduler_completion_batch_size,
            scheduler_cache_memory_percent=scheduler_cache_memory_percent,
            runtime_failure_quarantine_threshold=self._runtime_failure_quarantine_threshold,
            adapt_concurrency_fn=self.adapt_concurrency,
            resolve_autotune_backend_fn=self.resolve_autotune_backend,
            autotune_backend_version_fn=self.autotune_backend_version,
        )

        # ── Generation executor ────────────────────────────────────────
        self._generator = GenerationExecutor(
            models=self._models,
            inference_timeout=inference_timeout_sec,
            get_model_fn=self.get_model,
            acquire_request_slots_fn=self._acquire_request_slots,
            concurrency=self._concurrency,
            mark_readiness_failure_fn=self._lifecycle._mark_readiness_failure,
            adapt_concurrency_fn=self.adapt_concurrency,
            speculative_telemetry_ctx=self._speculative_telemetry_ctx,
            queue_wait_sec_ctx=self._queue_wait_sec_ctx,
            predictor=self._predictor,
            runtime_failure_quarantine_threshold=self._runtime_failure_quarantine_threshold,
        )

    # ══════════════════════════════════════════════════════════════════
    #  Concurrency — delegated properties
    # ══════════════════════════════════════════════════════════════════

    @property
    def in_flight_count(self) -> int:
        """Number of currently active inference requests."""
        return self._concurrency.in_flight_count

    @property
    def max_concurrent_requests(self) -> int:
        """Current maximum concurrent inference requests."""
        return self._concurrency.max_concurrent_requests

    @property
    def waiting_queue_count(self) -> int:
        """Number of requests currently waiting for any inference slot."""
        return self._concurrency.waiting_queue_count

    @property
    def latency_p95_sec(self) -> float | None:
        """Rolling p95 latency for adaptive concurrency calculations."""
        return self._concurrency.latency_p95_sec

    def adapt_concurrency(self) -> int:
        """Dynamically adjust concurrency based on memory pressure and latency."""
        return self._concurrency.adapt_concurrency(
            memory_usage_pct=self._memory.usage_percent(),
            memory_threshold_pct=self._memory.threshold_percent,
        )

    async def drain(self, timeout_sec: float = 30.0) -> bool:
        """Wait for all in-flight inference requests to complete."""
        return await self._concurrency.drain(timeout_sec=timeout_sec)

    def get_model_load_snapshot(self, model_ids: list[str] | None = None) -> dict[str, float]:
        """Return a best-effort per-model live load score (lower is better)."""
        candidates = model_ids if model_ids is not None else self.get_loaded_model_ids()
        return self._concurrency.get_model_load_snapshot(candidates)

    # Expose private helpers for backward compat (tests may reference them)
    @staticmethod
    def _increment_counter(counter: dict[str, int], key: str) -> None:
        ConcurrencyController._increment_counter(counter, key)

    @staticmethod
    def _decrement_counter(counter: dict[str, int], key: str) -> None:
        ConcurrencyController._decrement_counter(counter, key)

    @staticmethod
    def _normalize_client_key(client_id: str | None) -> str:
        return ConcurrencyController._normalize_client_key(client_id)

    def _per_client_limit_for(self, client_key: str) -> int | None:
        return self._concurrency._per_client_limit_for(client_key)

    def _client_semaphore_for(self, client_id: str | None) -> asyncio.Semaphore | None:
        return self._concurrency._client_semaphore_for(client_id)

    def _model_semaphore_for(self, model_id: str) -> asyncio.Semaphore | None:
        return self._concurrency._model_semaphore_for(model_id)

    def _record_latency_sample(self, latency_sec: float) -> None:
        self._concurrency._record_latency_sample(latency_sec)

    # ── Internal concurrency wiring used by _acquire_request_slots ────
    def _acquire_request_slots(
        self,
        *,
        model_id: str,
        priority: str,
        client_id: str | None,
    ) -> AsyncIterator[None]:
        """Acquire global/model/client slots for one request."""
        return self._concurrency._acquire_request_slots(
            model_id=model_id,
            priority=priority,
            client_id=client_id,
            queue_wait_sec_ctx=self._queue_wait_sec_ctx,
        )

    # ══════════════════════════════════════════════════════════════════
    #  Lifecycle — delegated methods
    # ══════════════════════════════════════════════════════════════════

    async def load_model(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
        keep_alive_sec: int | None = None,
        allow_unsupported_runtime: bool = False,
        preferred_backend: str | None = None,
    ) -> ModelInfo:
        """Load an MLX model into memory via vllm-mlx."""
        return await self._lifecycle.load_model(
            model_id,
            use_batching=use_batching,
            performance_overrides=performance_overrides,
            keep_alive_sec=keep_alive_sec,
            allow_unsupported_runtime=allow_unsupported_runtime,
            preferred_backend=preferred_backend,
            engine_ref=self,
        )

    async def unload_model(self, model_id: str, *, reason: str = "manual") -> float:
        """Unload a model and free memory."""
        return await self._lifecycle.unload_model(model_id, reason=reason)

    async def evict_idle_models(self, ttl_seconds: float) -> list[str]:
        """Unload models idle longer than their TTL."""
        return await self._lifecycle.evict_idle_models(ttl_seconds)

    async def probe_model_backends(
        self,
        model_id: str,
        *,
        timeout_sec: float = 90.0,
        allow_unsupported_runtime: bool = False,
    ) -> dict[str, Any]:
        """Probe backend candidates for a model without fully loading it."""
        return await self._lifecycle.probe_model_backends(
            model_id,
            timeout_sec=timeout_sec,
            allow_unsupported_runtime=allow_unsupported_runtime,
            engine_ref=self,
        )

    # Expose private lifecycle helpers for backward compat (mocks / tests)
    async def _do_load(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
        keep_alive_sec: int | None = None,
        allow_unsupported_runtime: bool = False,
        preferred_backend: str | None = None,
    ) -> ModelInfo:
        return await self._lifecycle._do_load(
            model_id, use_batching, performance_overrides,
            keep_alive_sec=keep_alive_sec,
            allow_unsupported_runtime=allow_unsupported_runtime,
            preferred_backend=preferred_backend,
            engine_ref=self,
        )

    async def _create_engine(
        self,
        model_id: str,
        use_batching: bool,
        performance_overrides: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        return await self._lifecycle._create_engine(
            model_id, use_batching, performance_overrides=performance_overrides,
        )

    async def _warmup_model(self, model_id: str) -> None:
        await self._lifecycle._warmup_model(model_id)

    async def _run_load_canary(self, model_id: str) -> None:
        await self._lifecycle._run_load_canary(model_id)

    async def _evict_least_recently_used(self) -> str | None:
        return await self._lifecycle._evict_least_recently_used()

    def _memory_percent_from_gb(self, value_gb: float) -> float:
        return self._lifecycle._memory_percent_from_gb(value_gb)

    def _reserved_load_memory_gb(self) -> float:
        return self._lifecycle._reserved_load_memory_gb()

    def _reservation_estimate_gb(
        self, performance_overrides: dict[str, Any] | None
    ) -> float | None:
        return self._lifecycle._reservation_estimate_gb(performance_overrides)

    def _resolve_admission_reservation_gb(
        self,
        *,
        performance_overrides: dict[str, Any] | None,
        current_usage_percent: float,
        reserved_usage_percent: float,
    ) -> tuple[float, bool]:
        return self._lifecycle._resolve_admission_reservation_gb(
            performance_overrides=performance_overrides,
            current_usage_percent=current_usage_percent,
            reserved_usage_percent=reserved_usage_percent,
        )

    @staticmethod
    def _loaded_backend_name(loaded: LoadedModel) -> str:
        return ModelLifecycleManager._loaded_backend_name(loaded)

    async def _publish_engine_event(
        self,
        *,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        await self._lifecycle._publish_engine_event(event_type=event_type, data=data)

    async def _set_readiness_state(
        self,
        model_id: str,
        state: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        return await self._lifecycle._set_readiness_state(model_id, state, reason=reason)

    async def _mark_readiness_failure(
        self,
        model_id: str,
        *,
        reason: str,
        quarantine_threshold: int,
    ) -> dict[str, Any]:
        return await self._lifecycle._mark_readiness_failure(
            model_id, reason=reason, quarantine_threshold=quarantine_threshold,
        )

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
        return await self._lifecycle._record_compatibility(
            model_id=model_id,
            backend=backend,
            backend_version_value=backend_version_value,
            outcome=outcome,
            reason=reason,
            metadata=metadata,
        )

    @staticmethod
    def _coerce_bool(value: Any, default: bool) -> bool:
        return ModelLifecycleManager._coerce_bool(value, default)

    def _resolve_speculative_config(
        self, performance_overrides: dict[str, Any],
    ) -> tuple[bool, str | None, int | None, bool]:
        return self._lifecycle._resolve_speculative_config(performance_overrides)

    @staticmethod
    def _engine_constructor_capabilities(engine_cls: type[Any]) -> tuple[set[str], bool]:
        return ModelLifecycleManager._engine_constructor_capabilities(engine_cls)

    @staticmethod
    def _resolve_supported_engine_kwargs(
        requested_kwargs: dict[str, Any],
        supported_params: set[str],
        has_var_kwargs: bool,
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
        return ModelLifecycleManager._resolve_supported_engine_kwargs(
            requested_kwargs, supported_params, has_var_kwargs,
        )

    # ══════════════════════════════════════════════════════════════════
    #  Generation — delegated methods
    # ══════════════════════════════════════════════════════════════════

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        priority: str = "normal",
        num_ctx: int | None = None,
        client_id: str | None = None,
    ) -> ChatCompletionResponse:
        """Non-streaming chat completion."""
        return await self._generator.generate(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stop=stop,
            tools=tools,
            response_format=response_format,
            frequency_penalty=frequency_penalty,
            presence_penalty=presence_penalty,
            priority=priority,
            num_ctx=num_ctx,
            client_id=client_id,
        )

    async def stream_generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        priority: str = "normal",
        num_ctx: int | None = None,
        client_id: str | None = None,
    ) -> AsyncIterator[str]:
        """Streaming chat completion — yields token strings."""
        async for token in self._generator.stream_generate(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stop=stop,
            tools=tools,
            response_format=response_format,
            frequency_penalty=frequency_penalty,
            presence_penalty=presence_penalty,
            priority=priority,
            num_ctx=num_ctx,
            client_id=client_id,
        ):
            yield token

    async def _do_generate(
        self,
        loaded: LoadedModel,
        msg_dicts: list[dict[str, Any]],
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int | None,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict[str, Any]] | None,
        response_format: dict[str, Any] | None,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
    ) -> tuple[str, int, int, dict[str, Any]]:
        return await self._generator._do_generate(
            loaded, msg_dicts, messages, temperature,
            max_tokens, top_p, stop, tools, response_format,
            frequency_penalty, presence_penalty,
        )

    # Speculative telemetry helpers — delegated
    def _base_speculative_telemetry(self, loaded: LoadedModel) -> dict[str, Any]:
        return SpeculativeTelemetryHelper.base_speculative_telemetry(loaded)

    @staticmethod
    def _coerce_payload_mapping(payload: Any) -> dict[str, Any]:
        return SpeculativeTelemetryHelper._coerce_payload_mapping(payload)

    @staticmethod
    def _read_int_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> int | None:
        return SpeculativeTelemetryHelper._read_int_field(mapping, keys)

    @staticmethod
    def _read_bool_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> bool | None:
        return SpeculativeTelemetryHelper._read_bool_field(mapping, keys)

    def _update_speculative_from_payload(
        self,
        telemetry: dict[str, Any],
        payload: Any,
    ) -> None:
        SpeculativeTelemetryHelper.update_speculative_from_payload(telemetry, payload)

    def _finalize_speculative_telemetry(
        self,
        telemetry: dict[str, Any],
        completion_units: int,
    ) -> None:
        SpeculativeTelemetryHelper.finalize_speculative_telemetry(telemetry, completion_units)

    def pop_speculative_telemetry(self) -> dict[str, Any] | None:
        """Return and clear speculative telemetry for the current request context."""
        value = self._speculative_telemetry_ctx.get()
        self._speculative_telemetry_ctx.set(None)
        return value

    def pop_queue_wait_seconds(self) -> float | None:
        """Return and clear queue wait timing for the current request context."""
        value = self._queue_wait_sec_ctx.get()
        self._queue_wait_sec_ctx.set(None)
        return value

    # ══════════════════════════════════════════════════════════════════
    #  Model queries and admin-facing methods
    # ══════════════════════════════════════════════════════════════════

    def get_loaded_backend_label(self, model_id: str) -> str | None:
        """Return loaded backend label (vllm-mlx/mlx-lm/gguf) or None."""
        loaded = self._models.get(model_id)
        if loaded is None:
            return None
        return self._loaded_backend_name(loaded)

    def model_backend_label(self, model_id: str) -> str | None:
        """Backward-compatible alias for backend label lookup."""
        return self.get_loaded_backend_label(model_id)

    def get_model_backend(self, model_id: str) -> str | None:
        """Compatibility alias for API metric attribution helpers."""
        return self.get_loaded_backend_label(model_id)

    def resolve_model_backend(self, model_id: str) -> str | None:
        """Compatibility alias for backend resolution helpers."""
        return self.get_loaded_backend_label(model_id)

    def resolve_backend_for_model(self, model_id: str) -> str | None:
        """Compatibility alias for backend resolution helpers."""
        return self.get_loaded_backend_label(model_id)

    def readiness_snapshot(self) -> dict[str, dict[str, Any]]:
        """Return readiness rows for all known models."""
        return self._readiness.snapshot()

    def get_readiness_snapshot(self) -> dict[str, dict[str, Any]]:
        """Alias for readiness snapshot retrieval."""
        return self.readiness_snapshot()

    def compatibility_summary_by_model(self) -> dict[str, dict[str, Any]]:
        """Return compatibility totals grouped by model."""
        return self._compatibility.summary_by_model()

    def compatibility_summary(self) -> dict[str, dict[str, Any]]:
        """Compatibility alias for admin metrics endpoint helpers."""
        return self.compatibility_summary_by_model()

    def get_compatibility_summary(self) -> dict[str, dict[str, Any]]:
        """Compatibility alias for admin metrics endpoint helpers."""
        return self.compatibility_summary_by_model()

    def model_compatibility_summary(self) -> dict[str, dict[str, Any]]:
        """Compatibility alias for admin metrics endpoint helpers."""
        return self.compatibility_summary_by_model()

    def get_compatibility_summary_by_model(self) -> dict[str, dict[str, Any]]:
        """Alias for compatibility summary retrieval."""
        return self.compatibility_summary_by_model()

    def autotune_backend_version(self, backend: str) -> str:
        """Resolve backend package version used for autotune keying."""
        try:
            if backend == "mlx-lm":
                return importlib_metadata.version("mlx-lm")
            if backend == "vllm-mlx":
                return importlib_metadata.version("vllm-mlx")
            if backend == "gguf":
                return importlib_metadata.version("llama-cpp-python")
        except Exception:
            pass

        if backend in {"vllm-mlx", "mlx-lm"}:
            return backend_version("mlx")
        if backend == "gguf":
            return backend_version("gguf")
        return "unknown"

    def resolve_autotune_backend(
        self,
        model_id: str,
        *,
        allow_failed: bool = False,
    ) -> str:
        """Pick backend label used to resolve tuned profile for a model load."""
        loaded = self._models.get(model_id)
        if loaded is not None:
            return self._loaded_backend_name(loaded)

        candidates = backend_candidates(
            model_id,
            self,
            self._compatibility,
            allow_failed=allow_failed,
        )
        return candidates[0] if candidates else "vllm-mlx"

    def get_tuned_profile(
        self,
        model_id: str,
        *,
        backend: str | None = None,
        backend_version_value: str | None = None,
        allow_failed: bool = False,
    ) -> dict[str, Any] | None:
        """Return best-known tuned profile record for model/backend/version."""
        resolved_backend = backend or self.resolve_autotune_backend(
            model_id,
            allow_failed=allow_failed,
        )
        resolved_version = backend_version_value or self.autotune_backend_version(resolved_backend)
        return self._autotune.get_best(
            model_id=model_id,
            backend=resolved_backend,
            backend_version=resolved_version,
        )

    def save_tuned_profile(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version_value: str,
        profile: dict[str, Any],
        metrics: dict[str, Any],
    ) -> float:
        """Persist scored profile and return computed score."""
        return self._autotune.save_scored_profile(
            model_id=model_id,
            backend=backend,
            backend_version=backend_version_value,
            profile=profile,
            metrics=metrics,
        )

    @property
    def predictor(self) -> UsagePredictor:
        """Access the usage predictor for stats and manual preloading."""
        return self._predictor

    def predict_next_model(self) -> str | None:
        """Predict which model to preload based on access patterns."""
        loaded = set(self._models.keys())
        return self._predictor.predict_next(loaded, exclude=self._loading_models)

    def suggest_prefetch_models(self, max_candidates: int = 1) -> list[str]:
        """Suggest models to prefetch based on access patterns."""
        candidates: list[str] = []
        excluded = set(self._models.keys()) | set(self._loading_models)
        while len(candidates) < max(1, max_candidates):
            predicted = self._predictor.predict_next(set(self._models.keys()), exclude=excluded)
            if predicted is None:
                break
            candidates.append(predicted)
            excluded.add(predicted)
        return candidates

    def get_inference_defaults(self) -> dict[str, Any]:
        """Return current global inference defaults for admin reporting."""
        return {
            "kv_bits": self._kv_bits,
            "kv_group_size": self._kv_group_size,
            "prefix_cache_enabled": self._prefix_cache_enabled,
            "speculative_model": self._speculative_model,
            "speculative_num_tokens": self._speculative_num_tokens,
            "speculative_require_supported": self._speculative_require_supported,
            "warmup_on_load": self._warmup_on_load,
            "stream_interval": self._stream_interval,
            "adaptive": {
                "enabled": self._adaptive_concurrency_enabled,
                "latency_target_ms": round(
                    self._concurrency._adaptive_latency_target_sec * 1000.0, 2,
                ),
                "latency_window_size": self._concurrency._adaptive_latency_samples.maxlen,
                "latency_p95_sec": self.latency_p95_sec,
                "min_concurrent_requests": self._concurrency._adaptive_min_concurrent,
                "last_reason": self._concurrency._last_adapt_reason,
            },
            "scheduler": {
                "max_num_seqs": self._scheduler_max_num_seqs,
                "prefill_batch_size": self._scheduler_prefill_batch_size,
                "completion_batch_size": self._scheduler_completion_batch_size,
                "cache_memory_percent": self._scheduler_cache_memory_percent,
            },
        }

    def is_model_routable(self, model_id: str) -> bool:
        if model_id not in self._models:
            return False
        return self._readiness.is_routable(model_id)

    def model_readiness(self, model_id: str) -> dict[str, Any]:
        return self._readiness.get(model_id)

    def get_loaded_models(self) -> list[ModelInfo]:
        """Return info about all currently loaded models."""
        return [
            ModelInfo(
                model_id=m.model_id,
                loaded=True,
                memory_used_gb=m.estimated_memory_gb,
                loaded_at=m.loaded_at,
                use_batching=m.use_batching,
            )
            for m in self._models.values()
        ]

    def get_loaded_model_ids(self) -> list[str]:
        """Return loaded model IDs without allocating ModelInfo objects."""
        return list(self._models.keys())

    def is_model_loaded(self, model_id: str) -> bool:
        """Check if a model is currently loaded."""
        return model_id in self._models

    def get_loaded_models_detailed(self) -> list[LoadedModel]:
        """Return internal LoadedModel objects for admin endpoints."""
        return list(self._models.values())

    def get_model(self, model_id: str) -> LoadedModel:
        """Get a loaded model or raise KeyError."""
        if model_id not in self._models:
            raise KeyError(f"Model '{model_id}' is not loaded")
        return self._models[model_id]
