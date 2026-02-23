"""MLX inference engine wrapping vllm-mlx, with GGUF fallback support."""

from __future__ import annotations

import asyncio
import contextlib
import contextvars
import gc
import inspect
import logging
import secrets
import time
from collections import deque
from collections.abc import AsyncIterator
from importlib import metadata as importlib_metadata
from typing import Any, cast

from opta_lmx.inference.autotune_registry import AutotuneRegistry
from opta_lmx.inference.context import estimate_prompt_tokens, fit_to_context
from opta_lmx.inference.backend_policy import backend_candidates
from opta_lmx.inference.mlx_lm_backend import MLXLMBackend
from opta_lmx.inference.predictor import UsagePredictor
from opta_lmx.inference.gguf_resolver import resolve_local_gguf_equivalents
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    FunctionCall,
    ResponseMessage,
    ToolCall,
    Usage,
)
from opta_lmx.inference.structured import (
    build_json_system_prompt,
    inject_json_instruction,
    parse_json_output,
)
from opta_lmx.inference.tool_parser import TOOL_CALL_OPEN, MiniMaxToolParser
from opta_lmx.inference.types import LoadedModel, ModelInfo
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import (
    CompatibilityRegistry,
    ErrorCodes,
    ReadinessTracker,
    backend_version,
    detect_backend_type,
)
from opta_lmx.monitoring.events import EventBus, ServerEvent
from opta_lmx.runtime.child_loader_supervisor import run_loader_supervisor
from opta_lmx.runtime.loader_protocol import LoadSpec, LoaderFailure

logger = logging.getLogger(__name__)

_SENTINEL = object()  # Sentinel for sync-to-async iterator conversion
_UNSUPPORTED_RUNTIME_SIGNATURES = ("glm_moe_dsa", "glmmoedsa")


class ModelRuntimeCompatibilityError(RuntimeError):
    """Raised when a model is known-incompatible with the active runtime stack."""


def _load_model_config(model_id: str) -> dict[str, Any] | None:
    """Load config.json for a model from local path or HuggingFace cache."""
    try:
        import json
        from pathlib import Path

        from huggingface_hub import try_to_load_from_cache

        config_path_obj: Path | None = None

        model_path = Path(model_id).expanduser()
        if model_path.exists():
            candidate = model_path / "config.json" if model_path.is_dir() else model_path
            if candidate.name == "config.json" and candidate.exists():
                config_path_obj = candidate

        if config_path_obj is None:
            config_path = try_to_load_from_cache(model_id, "config.json")
            if not isinstance(config_path, str) or not Path(config_path).exists():
                return None
            config_path_obj = Path(config_path)

        raw = json.loads(config_path_obj.read_text())
        if isinstance(raw, dict):
            return cast(dict[str, Any], raw)
    except Exception as e:
        logger.debug("model_config_resolve_failed", extra={
            "model_id": model_id, "error": str(e),
        })
    return None


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


def _normalize_signature(signature: str) -> str:
    """Normalize architecture signature for robust substring checks."""
    normalized_chars = [
        ch.lower() if ch.isalnum() else "_"
        for ch in signature
    ]
    normalized = "".join(normalized_chars).strip("_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized


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
    """Try to read max context length from a model's config.json in the HF cache.

    Checks: max_position_embeddings, max_sequence_length, n_positions, seq_length.
    Returns None if the model config is not found or has no context field.
    """
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
    """Detect whether model_id is MLX or GGUF.

    Rules:
    1. If model_id ends with .gguf → GGUF (local file path)
    2. If model_id contains 'GGUF' or 'gguf' → GGUF (HF repo)
    3. Otherwise → MLX (default, handled by vllm-mlx)
    """
    if model_id.endswith(".gguf"):
        return "gguf"
    if "gguf" in model_id.lower():
        return "gguf"
    return "mlx"


def _resolve_engine_model_name(model_id: str) -> str:
    """Prefer a concrete local snapshot path when a repo ID is cached.

    Passing the snapshot path to vllm-mlx avoids unnecessary remote Hub lookups
    for models that are already on disk.
    """
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


def _resolve_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    """Convert ChatMessage list to dicts, preserving multimodal content and tool fields.

    - String content → {"role": ..., "content": "..."}
    - List content (multimodal) → {"role": ..., "content": [{...}, ...]}
    - None content → {"role": ..., "content": ""}
    - tool_calls / tool_call_id are preserved when present (required by chat templates).

    Note: MiniMax chat templates expect tool_call.function.arguments as a dict,
    not a JSON string (they call .items() on it). We parse it here.
    """
    import json as _json

    result: list[dict[str, Any]] = []
    for m in messages:
        if isinstance(m.content, list):
            d: dict[str, Any] = {"role": m.role, "content": [p.model_dump() for p in m.content]}
        else:
            d = {"role": m.role, "content": m.content or ""}
        # Preserve tool call fields for chat template validation
        if m.tool_calls:
            resolved_tcs = []
            for tc in m.tool_calls:
                tc_dict = tc.model_dump()
                # Parse arguments from JSON string → dict for chat template compatibility
                fn = tc_dict.get("function")
                if fn and isinstance(fn.get("arguments"), str):
                    with contextlib.suppress(_json.JSONDecodeError, TypeError):
                        fn["arguments"] = _json.loads(fn["arguments"])
                resolved_tcs.append(tc_dict)
            d["tool_calls"] = resolved_tcs
        if m.tool_call_id:
            d["tool_call_id"] = m.tool_call_id
        if m.name:
            d["name"] = m.name
        result.append(d)
    return result


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
        self._models: dict[str, LoadedModel] = {}
        self._memory = memory_monitor
        self._use_batching = use_batching
        self._auto_evict_lru = auto_evict_lru
        self._gguf_context_length = gguf_context_length
        self._gguf_gpu_layers = gguf_gpu_layers
        self._event_bus = event_bus
        self._speculative_model = speculative_model
        self._speculative_num_tokens = speculative_num_tokens
        self._speculative_require_supported = speculative_require_supported
        self._kv_bits = kv_bits
        self._kv_group_size = kv_group_size
        self._prefix_cache_enabled = prefix_cache_enabled
        self._load_lock = asyncio.Lock()
        self._loading_models: set[str] = set()  # Models currently being loaded
        # In-flight cold-load reservations (GB), keyed by model_id.
        # These are accounted during admission to avoid TOCTOU overcommit.
        self._load_memory_reservations_gb: dict[str, float] = {}
        self._max_concurrent = max_concurrent_requests
        self._inference_semaphore = asyncio.Semaphore(max_concurrent_requests)
        self._current_concurrency_limit = max_concurrent_requests
        self._inference_timeout = inference_timeout_sec
        self._loader_isolation_enabled = loader_isolation_enabled
        self._loader_timeout_sec = loader_timeout_sec
        self._backend_preference_order = list(backend_preference_order or ["vllm-mlx", "mlx-lm"])
        self._gguf_fallback_enabled = gguf_fallback_enabled
        self._semaphore_timeout = semaphore_timeout_sec
        self._waiting_global_slot = 0
        self._waiting_model_slot = 0
        self._waiting_client_slot = 0
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
        self._warmup_on_load = warmup_on_load
        self._stream_interval = stream_interval
        self._scheduler_max_num_seqs = scheduler_max_num_seqs
        self._scheduler_prefill_batch_size = scheduler_prefill_batch_size
        self._scheduler_completion_batch_size = scheduler_completion_batch_size
        self._scheduler_cache_memory_percent = scheduler_cache_memory_percent
        self._in_flight = 0  # Active inference requests (for graceful shutdown)
        self._drain_event = asyncio.Event()
        self._drain_event.set()  # Initially idle → event is set
        self._predictor = UsagePredictor()
        self._adaptive_concurrency_enabled = adaptive_concurrency_enabled
        self._adaptive_latency_target_sec = max(0.1, adaptive_latency_target_ms / 1000.0)
        self._adaptive_latency_samples: deque[float] = deque(
            maxlen=max(8, adaptive_latency_window)
        )
        self._adaptive_min_concurrent = max(1, adaptive_min_concurrent_requests)
        self._last_adapt_reason = "startup"
        self._speculative_telemetry_ctx: contextvars.ContextVar[dict[str, Any] | None] = (
            contextvars.ContextVar("speculative_telemetry", default=None)
        )
        self._queue_wait_sec_ctx: contextvars.ContextVar[float | None] = (
            contextvars.ContextVar("queue_wait_sec", default=None)
        )
        self._readiness = ReadinessTracker()
        self._compatibility = CompatibilityRegistry()
        self._autotune = AutotuneRegistry()
        self._runtime_failure_quarantine_threshold = 3

    def _memory_percent_from_gb(self, value_gb: float) -> float:
        """Convert memory amount in GB to system-wide percent."""
        total = self._memory.total_memory_gb()
        if total <= 0:
            return 0.0
        return (value_gb / total) * 100.0

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

    def _reserved_load_memory_gb(self) -> float:
        """Total GB currently reserved by in-flight cold loads."""
        return sum(self._load_memory_reservations_gb.values())

    def _reservation_estimate_gb(self, performance_overrides: dict[str, Any] | None) -> float | None:
        """Best-effort memory reservation for a model cold load.

        Uses preset `memory_estimate_gb` when available and applies the same 15%
        safety margin as MemoryMonitor.can_load().
        """
        if not performance_overrides:
            return None

        raw_estimate = performance_overrides.get("memory_estimate_gb")
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
        """Return reservation size (GB) and whether an explicit estimate was used."""
        estimated_gb = self._reservation_estimate_gb(performance_overrides)
        if estimated_gb is not None:
            return estimated_gb, True

        # No estimate available: reserve remaining threshold headroom so that only
        # one unknown-size cold load is admitted at a time.
        remaining_percent = (
            self._memory.threshold_percent - current_usage_percent - reserved_usage_percent
        )
        if remaining_percent <= 0:
            return 0.0, False
        total = self._memory.total_memory_gb()
        if total <= 0:
            return 0.0, False
        return (remaining_percent / 100.0) * total, False

    @staticmethod
    def _loaded_backend_name(loaded: LoadedModel) -> str:
        """Infer backend label used for a loaded model entry."""
        if loaded.backend_type == "gguf":
            return "gguf"
        if loaded.backend is not None and loaded.backend.__class__.__name__ == "MLXLMBackend":
            return "mlx-lm"
        return "vllm-mlx"

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

    async def probe_model_backends(
        self,
        model_id: str,
        *,
        timeout_sec: float = 90.0,
        allow_unsupported_runtime: bool = False,
    ) -> dict[str, Any]:
        """Probe backend candidates for a model without fully loading it."""
        candidates = backend_candidates(
            model_id,
            self,
            self._compatibility,
            allow_failed=allow_unsupported_runtime,
        )
        outcomes: list[dict[str, Any]] = []

        for backend in candidates:
            if backend == "vllm-mlx":
                if not self._loader_isolation_enabled:
                    outcomes.append({
                        "backend": backend,
                        "outcome": "unknown",
                        "reason": "loader_isolation_disabled",
                    })
                    continue
                try:
                    outcome = await run_loader_supervisor(
                        LoadSpec(
                            model_id=model_id,
                            backend=backend,
                            use_batching=self._use_batching,
                            performance_overrides={},
                            probe_only=True,
                        ),
                        timeout_sec=float(timeout_sec),
                    )
                except Exception as exc:
                    outcomes.append({
                        "backend": backend,
                        "outcome": "fail",
                        "reason": f"{ErrorCodes.MODEL_PROBE_FAILED}:{exc}",
                    })
                    continue
                if outcome.ok:
                    outcomes.append({"backend": backend, "outcome": "pass", "reason": None})
                else:
                    failure = outcome.failure
                    reason = (
                        f"{failure.code}:{failure.message}"
                        if failure is not None
                        else ErrorCodes.MODEL_PROBE_FAILED
                    )
                    outcomes.append({"backend": backend, "outcome": "fail", "reason": reason})
                continue

            if backend == "gguf":
                resolved = resolve_local_gguf_equivalents(model_id)
                if resolved:
                    outcomes.append({"backend": backend, "outcome": "pass", "reason": None})
                else:
                    outcomes.append({
                        "backend": backend,
                        "outcome": "fail",
                        "reason": "no_local_gguf_equivalent",
                    })
                continue

            # mlx-lm and other adapters can be lightweight-admitted here.
            outcomes.append({"backend": backend, "outcome": "unknown", "reason": "not_probed"})

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

    async def load_model(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
        keep_alive_sec: int | None = None,
        allow_unsupported_runtime: bool = False,
    ) -> ModelInfo:
        """Load an MLX model into memory via vllm-mlx.

        Args:
            model_id: HuggingFace model ID (e.g., 'mlx-community/Mistral-7B-Instruct-4bit').
            use_batching: Override default batching setting.
            performance_overrides: Per-model performance settings from preset (kv_bits,
                prefix_cache, speculative, max_concurrent). Overrides global defaults.

        Returns:
            ModelInfo with load details.

        Raises:
            MemoryError: If loading would exceed 90% memory threshold.
            RuntimeError: If model loading fails.
        """
        # Block path traversal in model IDs (security).
        if ".." in model_id:
            raise ValueError(
                f"Invalid model ID: '{model_id}'. "
                "Path traversal sequences are not allowed."
            )

        # Admission control is serialized under _load_lock. Each admitted cold load
        # reserves memory before _do_load() begins, preventing concurrent TOCTOU
        # overcommit from multiple loads passing prechecks at once.
        while True:
            should_evict = False
            current_usage = 0.0
            reserved_usage = 0.0
            projected_usage = 0.0
            reservation_gb = 0.0
            used_estimate = False

            async with self._load_lock:
                # Already loaded?
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

                # Already being loaded by another concurrent call?
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

                # For unknown model size (no estimate), reservation_gb==0 means there is
                # no headroom remaining after in-flight reservations.
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

            # Eviction is done outside _load_lock because unload_model() acquires it.
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
                # Retry admission after eviction attempt (or model set changed).
                continue

        self._readiness.set_state(model_id, "admitted")
        try:
            return await self._do_load(
                model_id, use_batching, performance_overrides,
                keep_alive_sec=keep_alive_sec,
                allow_unsupported_runtime=allow_unsupported_runtime,
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
    ) -> ModelInfo:
        """Execute the actual model load (called after lock/guard checks)."""
        fmt = _detect_format(model_id)
        candidate_backends = backend_candidates(
            model_id,
            self,
            self._compatibility,
            allow_failed=allow_unsupported_runtime,
        )
        selected_backend = candidate_backends[0] if candidate_backends else "vllm-mlx"
        gguf_model_path: str | None = None
        if selected_backend == "gguf" and fmt != "gguf":
            if not self._gguf_fallback_enabled:
                raise RuntimeError("gguf_fallback_disabled")
            gguf_candidates = resolve_local_gguf_equivalents(model_id)
            if not gguf_candidates:
                raise RuntimeError(
                    f"No local GGUF equivalent found for model '{model_id}' while GGUF fallback is enabled.",
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
            version_hint = ", ".join(version_hint_parts) if version_hint_parts else "unknown versions"
            if not allow_unsupported_runtime:
                logger.warning("model_runtime_incompatible_blocked", extra={
                    "model_id": model_id,
                    "matched_signature": runtime_issue.get("matched_signature"),
                    "model_type": runtime_issue.get("model_type"),
                    "architectures": runtime_issue.get("architectures"),
                    "runtime_versions": runtime_versions,
                })
                self._readiness.set_state(
                    model_id,
                    "quarantined",
                    reason=f"{ErrorCodes.MODEL_UNSUPPORTED_BACKEND}:{runtime_issue.get('matched_signature')}",
                )
                self._compatibility.record(
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
        perf = performance_overrides or {}
        self._readiness.set_state(model_id, "loading")

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
                failure = fallback_failure if outcome is None else (outcome.failure or fallback_failure)
                failure_reason = f"{failure.code}:{failure.message}"
                self._readiness.mark_failure(
                    model_id,
                    reason=failure_reason,
                    quarantine_threshold=self._runtime_failure_quarantine_threshold,
                )
                self._compatibility.record(
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
                engine = None  # GGUF models use backend, not vllm-mlx engine
            else:
                created = await self._create_engine(
                    model_id, batching, performance_overrides=performance_overrides,
                )
                if isinstance(created, tuple) and len(created) == 2:
                    engine, speculative_status = created
                else:
                    # Backward compatibility for tests/mocks that patch
                    # _create_engine to return only an engine instance.
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

        # Post-load check: if loading pushed us over threshold, unload immediately
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

        # Resolve context length from model config or GGUF setting
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
        self._readiness.set_state(model_id, "canary_pending")
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

        if self._event_bus:
            await self._event_bus.publish(ServerEvent(
                event_type="model_loaded",
                data={
                    "model_id": model_id,
                    "format": fmt,
                    "memory_gb": round(model_memory_gb, 2),
                    "duration_sec": round(elapsed, 2),
                },
            ))

        # Warmup: run a minimal inference to prime JIT/Metal shaders
        if self._warmup_on_load:
            await self._warmup_model(model_id)

        # Canary promotion: model becomes routable only after a successful
        # post-load inference check.
        try:
            await self._run_load_canary(model_id)
            loaded.readiness_state = "routable"
            loaded.readiness_reason = None
            self._readiness.set_state(model_id, "routable")
            self._compatibility.record(
                model_id=model_id,
                backend=selected_backend,
                backend_version_value=backend_version(runtime_backend),
                outcome="pass",
                reason="canary_ok",
            )
        except Exception as e:
            loaded.readiness_state = "quarantined"
            loaded.readiness_reason = f"{ErrorCodes.MODEL_CANARY_FAILED}:{e}"
            self._readiness.mark_failure(
                model_id,
                reason=str(e),
                quarantine_threshold=self._runtime_failure_quarantine_threshold,
            )
            self._compatibility.record(
                model_id=model_id,
                backend=selected_backend,
                backend_version_value=backend_version(runtime_backend),
                outcome="fail",
                reason=f"canary_failed:{e}",
            )
            await self.unload_model(model_id, reason="canary_failed")
            raise RuntimeError(
                f"Model '{model_id}' failed canary inference and was quarantined: {e}"
            ) from e

        # Adjust concurrency based on new memory state
        self.adapt_concurrency()

        return ModelInfo(
            model_id=model_id,
            loaded=True,
            memory_used_gb=round(memory_after, 2),
            loaded_at=loaded.loaded_at,
            use_batching=batching if fmt == "mlx" else False,
        )

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
        """Resolve effective speculative decoding request from overrides + globals."""
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

    @staticmethod
    def _engine_constructor_capabilities(engine_cls: type[Any]) -> tuple[set[str], bool]:
        """Inspect constructor parameters for an engine class."""
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
        """Map optional kwargs to constructor-supported names with aliases."""
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

    def _base_speculative_telemetry(self, loaded: LoadedModel) -> dict[str, Any]:
        """Construct a per-request speculative telemetry record."""
        telemetry_mode = (
            "unavailable"
            if loaded.speculative_active
            else ("disabled" if loaded.speculative_requested else "not_requested")
        )
        return {
            "requested": loaded.speculative_requested,
            "active": loaded.speculative_active,
            "reason": loaded.speculative_reason,
            "draft_model": loaded.speculative_draft_model,
            "num_tokens": loaded.speculative_num_tokens,
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "ignored_tokens": 0,
            "acceptance_ratio": None,
            "telemetry": telemetry_mode,
        }

    @staticmethod
    def _coerce_payload_mapping(payload: Any) -> dict[str, Any]:
        """Best-effort conversion of model payload objects into mappings."""
        if isinstance(payload, dict):
            return payload
        if hasattr(payload, "model_dump"):
            with contextlib.suppress(Exception):
                dumped = payload.model_dump()
                if isinstance(dumped, dict):
                    return dumped
        if hasattr(payload, "__dict__"):
            mapping = vars(payload)
            if isinstance(mapping, dict):
                return mapping
        return {}

    @staticmethod
    def _read_int_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> int | None:
        for key in keys:
            value = mapping.get(key)
            if value is None:
                continue
            with contextlib.suppress(TypeError, ValueError):
                return int(value)
        return None

    @staticmethod
    def _read_bool_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> bool | None:
        for key in keys:
            value = mapping.get(key)
            if isinstance(value, bool):
                return value
        return None

    def _update_speculative_from_payload(
        self,
        telemetry: dict[str, Any],
        payload: Any,
    ) -> None:
        """Update speculative telemetry counters from a backend payload object."""
        if not telemetry.get("active"):
            return

        mapping = self._coerce_payload_mapping(payload)
        nested = mapping.get("speculative")
        if isinstance(nested, dict):
            combined = {**mapping, **nested}
        else:
            combined = mapping

        accepted = self._read_int_field(
            combined,
            (
                "accepted_tokens",
                "draft_accepted_tokens",
                "accepted_draft_tokens",
                "num_accepted_draft_tokens",
                "speculative_accepted_tokens",
            ),
        )
        rejected = self._read_int_field(
            combined,
            (
                "rejected_tokens",
                "draft_rejected_tokens",
                "rejected_draft_tokens",
                "num_rejected_draft_tokens",
                "speculative_rejected_tokens",
            ),
        )
        ignored = self._read_int_field(
            combined,
            (
                "ignored_tokens",
                "draft_ignored_tokens",
                "speculative_ignored_tokens",
            ),
        )

        native_counts_seen = False
        if accepted is not None:
            telemetry["accepted_tokens"] += max(0, accepted)
            native_counts_seen = True
        if rejected is not None:
            telemetry["rejected_tokens"] += max(0, rejected)
            native_counts_seen = True
        if ignored is not None:
            telemetry["ignored_tokens"] += max(0, ignored)
            native_counts_seen = True

        if native_counts_seen:
            telemetry["telemetry"] = "native"
            return

        from_draft = self._read_bool_field(
            combined,
            (
                "from_draft",
                "draft_accepted",
                "accepted_from_draft",
                "is_draft_token",
            ),
        )
        if from_draft is None:
            return

        # When only a per-chunk flag is available, infer a single token unit.
        if from_draft:
            telemetry["accepted_tokens"] += 1
        else:
            telemetry["rejected_tokens"] += 1
        telemetry["telemetry"] = "inferred_from_flag"

    def _finalize_speculative_telemetry(
        self,
        telemetry: dict[str, Any],
        completion_units: int,
    ) -> None:
        """Finalize derived speculative telemetry fields."""
        if not telemetry.get("active"):
            telemetry["acceptance_ratio"] = None
            return

        accepted = max(0, int(telemetry.get("accepted_tokens", 0) or 0))
        rejected = max(0, int(telemetry.get("rejected_tokens", 0) or 0))
        ignored = max(0, int(telemetry.get("ignored_tokens", 0) or 0))

        if accepted == 0 and rejected == 0 and ignored == 0:
            ignored = max(0, int(completion_units))
            telemetry["ignored_tokens"] = ignored
            telemetry["telemetry"] = "unavailable"

        denominator = accepted + rejected
        telemetry["acceptance_ratio"] = (
            round(accepted / denominator, 6) if denominator > 0 else None
        )

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

    async def _create_engine(
        self,
        model_id: str,
        use_batching: bool,
        performance_overrides: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        """Create a vllm-mlx engine instance.

        Uses BatchedEngine for concurrent request support,
        SimpleEngine for maximum single-request throughput.
        Merges per-model performance overrides (from preset) with global defaults.
        """
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

        # KV cache: preset overrides global
        kv_bits = perf.get("kv_bits", self._kv_bits)
        kv_group_size = perf.get("kv_group_size", self._kv_group_size)
        if kv_bits is not None:
            optional_kwargs["kv_bits"] = kv_bits
            optional_kwargs["kv_group_size"] = kv_group_size

        # Prefix cache: preset overrides global
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

            # E3: Build SchedulerConfig from global settings + per-model overrides
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

    async def unload_model(self, model_id: str, *, reason: str = "manual") -> float:
        """Unload a model and free memory.

        Args:
            model_id: Model to unload.

        Returns:
            Estimated GB freed.

        Raises:
            KeyError: If model is not loaded.
        """
        async with self._load_lock:
            if model_id not in self._models:
                raise KeyError(f"Model {model_id} is not loaded")
            loaded = self._models.pop(model_id)
        self._readiness.clear(model_id)

        memory_before = self._memory.used_memory_gb()

        # Close backend if present (GGUF) — always clean up engine even if close() fails
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

        # Try to clear MLX metal cache (only relevant for MLX models)
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

        # Adjust concurrency after freeing memory
        self.adapt_concurrency()

        return freed

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
        )

    @property
    def predictor(self) -> UsagePredictor:
        """Access the usage predictor for stats and manual preloading."""
        return self._predictor

    def predict_next_model(self) -> str | None:
        """Predict which model to preload based on access patterns."""
        loaded = set(self._models.keys())
        return self._predictor.predict_next(loaded, exclude=self._loading_models)

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
                "latency_target_ms": round(self._adaptive_latency_target_sec * 1000.0, 2),
                "latency_window_size": self._adaptive_latency_samples.maxlen,
                "latency_p95_sec": self.latency_p95_sec,
                "min_concurrent_requests": self._adaptive_min_concurrent,
                "last_reason": self._last_adapt_reason,
            },
            "scheduler": {
                "max_num_seqs": self._scheduler_max_num_seqs,
                "prefill_batch_size": self._scheduler_prefill_batch_size,
                "completion_batch_size": self._scheduler_completion_batch_size,
                "cache_memory_percent": self._scheduler_cache_memory_percent,
            },
        }

    @property
    def latency_p95_sec(self) -> float | None:
        """Rolling p95 latency for adaptive concurrency calculations."""
        if not self._adaptive_latency_samples:
            return None
        ordered = sorted(self._adaptive_latency_samples)
        index = max(0, int((len(ordered) - 1) * 0.95))
        return float(ordered[index])

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

    def _record_latency_sample(self, latency_sec: float) -> None:
        if latency_sec < 0:
            return
        self._adaptive_latency_samples.append(latency_sec)

    def adapt_concurrency(self) -> int:
        """Dynamically adjust concurrency based on memory pressure and latency."""
        usage_pct = self._memory.usage_percent()
        threshold = self._memory.threshold_percent

        # Memory-based baseline: full at <70% of threshold, minimum at >95%.
        ratio = usage_pct / threshold if threshold > 0 else 0
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
            # Only swap the semaphore when no requests are in-flight to avoid
            # orphaning waiters on the old semaphore.
            if self._in_flight == 0:
                self._inference_semaphore = asyncio.Semaphore(target)
                self._current_concurrency_limit = target
                self._last_adapt_reason = reason
                logger.info("concurrency_adapted", extra={
                    "new_limit": target,
                    "memory_usage_pct": round(usage_pct, 1),
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

    @contextlib.asynccontextmanager
    async def _acquire_request_slots(
        self,
        *,
        model_id: str,
        priority: str,
        client_id: str | None,
    ) -> AsyncIterator[None]:
        """Acquire global/model/client slots for one request."""
        if priority == "high":
            self._queue_wait_sec_ctx.set(0.0)
            yield
            return

        acquired: list[asyncio.Semaphore] = []
        client_key = self._normalize_client_key(client_id)
        model_semaphore = self._model_semaphore_for(model_id)
        client_semaphore = self._client_semaphore_for(client_key)
        wait_started = time.monotonic()
        self._increment_counter(self._waiting_requests_by_model, model_id)

        try:
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

            self._queue_wait_sec_ctx.set(max(0.0, time.monotonic() - wait_started))
            yield
        except TimeoutError:
            self._queue_wait_sec_ctx.set(max(0.0, time.monotonic() - wait_started))
            raise RuntimeError(
                "Server is busy — all inference slots occupied. Try again shortly."
            ) from None
        finally:
            self._decrement_counter(self._waiting_requests_by_model, model_id)
            for semaphore in reversed(acquired):
                semaphore.release()

    async def _warmup_model(self, model_id: str) -> None:
        """Run a short inference to prime JIT compilation and KV cache.

        Generates 16 tokens to compile both prefill AND decode-loop Metal
        shaders. With max_tokens=1, only the prefill kernel gets compiled,
        leaving the first real request to pay for decode shader compilation.
        """
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
        """Run a lightweight canary inference before promoting to routable."""
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

    def is_model_routable(self, model_id: str) -> bool:
        if model_id not in self._models:
            return False
        return self._readiness.is_routable(model_id)

    def model_readiness(self, model_id: str) -> dict[str, Any]:
        return self._readiness.get(model_id)

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
        """Non-streaming chat completion.

        Args:
            model_id: Which loaded model to use.
            messages: Conversation messages.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (passed through).
            num_ctx: Per-request context window override.
            client_id: Optional client identity used for fairness scheduling.

        Returns:
            Complete ChatCompletionResponse.
        """
        loaded = self.get_model(model_id)
        self._speculative_telemetry_ctx.set(None)
        self._queue_wait_sec_ctx.set(None)
        loaded.request_count += 1
        loaded.last_used_at = time.time()
        self._predictor.record_access(model_id)

        # F5: Per-request context window override, falling back to model's native limit
        effective_ctx = num_ctx or loaded.context_length
        if effective_ctx:
            messages = fit_to_context(
                messages,
                max_context_tokens=effective_ctx,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        async def _run_inference() -> tuple[str, int, int, dict[str, Any]]:
            self._in_flight += 1
            self._increment_counter(self._active_requests_by_model, model_id)
            self._drain_event.clear()
            try:
                return await asyncio.wait_for(
                    self._do_generate(
                        loaded, msg_dicts, messages, temperature,
                        max_tokens, top_p, stop, tools, response_format,
                        frequency_penalty, presence_penalty,
                    ),
                    timeout=self._inference_timeout,
                )
            except TimeoutError:
                logger.error("inference_timeout", extra={
                    "model_id": model_id, "timeout_sec": self._inference_timeout,
                })
                raise RuntimeError(
                    f"Inference timed out after {self._inference_timeout}s"
                ) from None
            except Exception as e:
                self._readiness.mark_failure(
                    model_id,
                    reason=str(e),
                    quarantine_threshold=self._runtime_failure_quarantine_threshold,
                )
                state = self._readiness.get(model_id)
                if state.get("state") == "quarantined":
                    loaded.readiness_state = "quarantined"
                    loaded.readiness_reason = f"{ErrorCodes.MODEL_UNSTABLE}:{state.get('reason')}"
                logger.error("inference_failed", extra={"model_id": model_id, "error": str(e)})
                raise RuntimeError(f"Inference failed: {e}") from e
            finally:
                self._in_flight -= 1
                self._decrement_counter(self._active_requests_by_model, model_id)
                if self._in_flight == 0:
                    self._drain_event.set()

        request_started = time.monotonic()
        try:
            async with self._acquire_request_slots(
                model_id=model_id,
                priority=priority,
                client_id=client_id,
            ):
                content, prompt_tokens, completion_tokens, speculative_telemetry = await _run_inference()
        finally:
            self._record_latency_sample(time.monotonic() - request_started)
            self.adapt_concurrency()
        self._speculative_telemetry_ctx.set(speculative_telemetry)

        # E11: Post-process structured output — extract and validate JSON
        if response_format and not tools:
            _cleaned, parsed_json, is_valid, error = parse_json_output(content, response_format)
            if parsed_json is not None:
                import json as _json
                content = _json.dumps(parsed_json)
            if not is_valid:
                logger.warning("structured_output_validation_failed", extra={
                    "model_id": model_id, "error": error,
                })

        # Parse MiniMax XML tool calls if tools were requested
        response_message: ResponseMessage
        finish_reason: str = "stop"

        if tools and TOOL_CALL_OPEN in content:
            parser = MiniMaxToolParser()
            parsed = parser.parse_tool_calls(content, tools)
            if parsed.has_tool_calls and parsed.tool_calls:
                response_message = ResponseMessage(
                    role="assistant",
                    content=parsed.content,
                    tool_calls=[
                        ToolCall(
                            id=tc.id,
                            type="function",
                            function=FunctionCall(
                                name=tc.name, arguments=tc.arguments,
                            ),
                        )
                        for tc in parsed.tool_calls
                    ],
                )
                finish_reason = "tool_calls"
            else:
                response_message = ResponseMessage(
                    role="assistant", content=content,
                )
        else:
            response_message = ResponseMessage(
                role="assistant", content=content,
            )

        # Determine finish_reason: check tool_calls first, then max_tokens
        # If max_tokens was hit, finish_reason should be "length"
        if (
            finish_reason != "tool_calls"
            and max_tokens is not None
            and completion_tokens >= max_tokens
        ):
            finish_reason = "length"

        return ChatCompletionResponse(
            id=f"chatcmpl-{secrets.token_urlsafe(16)}",
            created=int(time.time()),
            model=model_id,
            choices=[
                Choice(
                    index=0,
                    message=response_message,
                    finish_reason=finish_reason,
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

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
        """Execute inference and return content, token usage, and speculative telemetry."""
        speculative_telemetry = self._base_speculative_telemetry(loaded)
        # E11: Inject JSON system prompt for structured output enforcement.
        # vllm-mlx engines don't handle response_format natively — the server
        # layer injects instructions and post-processes output. We do the same.
        effective_msgs = msg_dicts
        if response_format:
            json_instruction = build_json_system_prompt(response_format)
            if json_instruction:
                effective_msgs = inject_json_instruction(msg_dicts, json_instruction)

        if loaded.backend is not None:
            backend_result = await loaded.backend.generate(
                messages=effective_msgs,
                temperature=temperature,
                max_tokens=max_tokens or 2048,
                top_p=top_p,
                stop=stop,
                tools=tools,
                response_format=response_format,
            )
            content, prompt_tokens, completion_tokens = cast(tuple[str, int, int], backend_result)
            self._finalize_speculative_telemetry(speculative_telemetry, completion_tokens)
            return content, prompt_tokens, completion_tokens, speculative_telemetry

        chat_kwargs: dict[str, Any] = {
            "messages": effective_msgs,
            "temperature": temperature,
            "max_tokens": max_tokens or 2048,
            "top_p": top_p,
        }
        if stop:
            chat_kwargs["stop"] = stop
        if tools:
            chat_kwargs["tools"] = tools
        if frequency_penalty != 0.0:
            chat_kwargs["frequency_penalty"] = frequency_penalty
        if presence_penalty != 0.0:
            chat_kwargs["presence_penalty"] = presence_penalty
        result = await loaded.engine.chat(**chat_kwargs)

        if hasattr(result, "text"):
            content = result.text
            prompt_tokens = (
                getattr(result, "prompt_tokens", 0)
                or estimate_prompt_tokens(messages)
            )
            completion_tokens = (
                getattr(result, "completion_tokens", 0)
                or max(1, len(content) // 4)
            )
        else:
            content = result if isinstance(result, str) else str(result)
            prompt_tokens = estimate_prompt_tokens(messages)
            completion_tokens = max(1, len(content) // 4)
        self._update_speculative_from_payload(speculative_telemetry, result)
        self._finalize_speculative_telemetry(speculative_telemetry, completion_tokens)
        return content, prompt_tokens, completion_tokens, speculative_telemetry

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
        """Streaming chat completion — yields token strings.

        Args:
            model_id: Which loaded model to use.
            messages: Conversation messages.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (passed through).
            num_ctx: Per-request context window override.
            client_id: Optional client identity used for fairness scheduling.

        Yields:
            Individual token strings.
        """
        loaded = self.get_model(model_id)
        self._speculative_telemetry_ctx.set(None)
        self._queue_wait_sec_ctx.set(None)
        loaded.request_count += 1
        loaded.last_used_at = time.time()
        self._predictor.record_access(model_id)
        speculative_telemetry = self._base_speculative_telemetry(loaded)
        completion_units = 0

        # F5: Per-request context window override, falling back to model's native limit
        effective_ctx = num_ctx or loaded.context_length
        if effective_ctx:
            messages = fit_to_context(
                messages,
                max_context_tokens=effective_ctx,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        # E11: Inject JSON system prompt for structured output enforcement
        if response_format:
            json_instruction = build_json_system_prompt(response_format)
            if json_instruction:
                msg_dicts = inject_json_instruction(msg_dicts, json_instruction)

        request_started = time.monotonic()
        try:
            async with self._acquire_request_slots(
                model_id=model_id,
                priority=priority,
                client_id=client_id,
            ):
                self._in_flight += 1
                self._increment_counter(self._active_requests_by_model, model_id)
                self._drain_event.clear()
                try:
                    async with asyncio.timeout(self._inference_timeout):
                        if loaded.backend is not None:
                            async for token in loaded.backend.stream(
                                messages=msg_dicts,
                                temperature=temperature,
                                max_tokens=max_tokens or 2048,
                                top_p=top_p,
                                stop=stop,
                                tools=tools,
                                response_format=response_format,
                            ):
                                completion_units += 1
                                yield token
                        else:
                            chat_kwargs: dict[str, Any] = {
                                "messages": msg_dicts,
                                "temperature": temperature,
                                "max_tokens": max_tokens or 2048,
                                "top_p": top_p,
                            }
                            if stop:
                                chat_kwargs["stop"] = stop
                            if tools:
                                chat_kwargs["tools"] = tools
                            if frequency_penalty != 0.0:
                                chat_kwargs["frequency_penalty"] = frequency_penalty
                            if presence_penalty != 0.0:
                                chat_kwargs["presence_penalty"] = presence_penalty
                            stream = loaded.engine.stream_chat(**chat_kwargs)
                            async for chunk in stream:
                                self._update_speculative_from_payload(speculative_telemetry, chunk)
                                delta = chunk.new_text if hasattr(chunk, "new_text") else str(chunk)
                                if delta:
                                    completion_units += 1
                                    yield delta
                except asyncio.CancelledError:
                    logger.info("stream_cancelled", extra={"model_id": model_id})
                    raise
                except TimeoutError:
                    logger.error("stream_timeout", extra={
                        "model_id": model_id, "timeout_sec": self._inference_timeout,
                    })
                    raise RuntimeError(
                        f"Stream inference timed out after {self._inference_timeout}s"
                    ) from None
                except Exception as e:
                    self._readiness.mark_failure(
                        model_id,
                        reason=str(e),
                        quarantine_threshold=self._runtime_failure_quarantine_threshold,
                    )
                    state = self._readiness.get(model_id)
                    if state.get("state") == "quarantined":
                        loaded.readiness_state = "quarantined"
                        loaded.readiness_reason = f"{ErrorCodes.MODEL_UNSTABLE}:{state.get('reason')}"
                    logger.error("stream_failed", extra={"model_id": model_id, "error": str(e)})
                    raise RuntimeError(f"Stream inference failed: {e}") from e
                finally:
                    self._in_flight -= 1
                    self._decrement_counter(self._active_requests_by_model, model_id)
                    if self._in_flight == 0:
                        self._drain_event.set()
        finally:
            self._finalize_speculative_telemetry(speculative_telemetry, completion_units)
            self._speculative_telemetry_ctx.set(speculative_telemetry)
            self._record_latency_sample(time.monotonic() - request_started)
            self.adapt_concurrency()

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

    def get_model_load_snapshot(self, model_ids: list[str] | None = None) -> dict[str, float]:
        """Return a best-effort per-model live load score (lower is better)."""
        candidates = model_ids if model_ids is not None else self.get_loaded_model_ids()
        if not candidates:
            return {}

        global_capacity = max(1, self._max_concurrent)
        global_pressure = self.waiting_queue_count / global_capacity
        snapshot: dict[str, float] = {}

        for model_id in candidates:
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

    def is_model_loaded(self, model_id: str) -> bool:
        """Check if a model is currently loaded."""
        return model_id in self._models

    def get_loaded_models_detailed(self) -> list[LoadedModel]:
        """Return internal LoadedModel objects for admin endpoints."""
        return list(self._models.values())

    async def _evict_least_recently_used(self) -> str | None:
        """Unload the least-recently-used model to free memory.

        Returns:
            The model_id that was evicted, or None if no models loaded.
        """
        if not self._models:
            return None

        # Find the model with the oldest last_used_at (LRU)
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
        """Unload models idle longer than their TTL.

        Uses per-model keep_alive_sec when set, otherwise falls back
        to the global ttl_seconds parameter.

        Args:
            ttl_seconds: Default maximum idle time before eviction.

        Returns:
            List of evicted model IDs.
        """
        now = time.time()
        evicted: list[str] = []

        # Snapshot model IDs to avoid mutating dict during iteration
        for model_id, loaded in list(self._models.items()):
            # F3: Per-model TTL overrides global TTL
            effective_ttl = (
                loaded.keep_alive_sec if loaded.keep_alive_sec is not None else ttl_seconds
            )
            # keep_alive_sec=0 means "pin model in memory" (never auto-evict).
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

    def get_model(self, model_id: str) -> LoadedModel:
        """Get a loaded model or raise KeyError."""
        if model_id not in self._models:
            raise KeyError(f"Model '{model_id}' is not loaded")
        return self._models[model_id]
