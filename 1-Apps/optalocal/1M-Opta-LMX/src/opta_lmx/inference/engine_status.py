"""Status and Metrics delegation module for the InferenceEngine facade."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from opta_lmx.inference.types import ModelInfo

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine


class EngineStatusDelegator:
    """Handles read-only status and metrics queries for InferenceEngine."""

    def __init__(self, engine: InferenceEngine) -> None:
        self._engine = engine

    def get_loaded_backend_label(self, model_id: str) -> str | None:
        """Return loaded backend label (vllm-mlx/mlx-lm/gguf) or None."""
        loaded = self._engine._models.get(model_id)
        if loaded is None:
            return None
        return self._engine._loaded_backend_name(loaded)

    def readiness_snapshot(self) -> dict[str, dict[str, Any]]:
        """Return readiness rows for all known models."""
        return self._engine._readiness.snapshot()

    def compatibility_summary_by_model(self) -> dict[str, dict[str, Any]]:
        """Return compatibility totals grouped by model."""
        return self._engine._compatibility.summary_by_model()

    def get_inference_defaults(self) -> dict[str, Any]:
        """Return current global inference defaults for admin reporting."""
        return {
            "kv_bits": self._engine._kv_bits,
            "kv_group_size": self._engine._kv_group_size,
            "quantized_kv_start": self._engine._quantized_kv_start,
            "prefix_cache_enabled": self._engine._prefix_cache_enabled,
            "speculative_model": self._engine._speculative_model,
            "speculative_num_tokens": self._engine._speculative_num_tokens,
            "speculative_require_supported": self._engine._speculative_require_supported,
            "warmup_on_load": self._engine._warmup_on_load,
            "stream_interval": self._engine._stream_interval,
            "adaptive": {
                "enabled": self._engine._adaptive_concurrency_enabled,
                "latency_target_ms": round(
                    self._engine._concurrency._adaptive_latency_target_sec * 1000.0,
                    2,
                ),
                "latency_window_size": self._engine._concurrency._adaptive_latency_samples.maxlen,
                "latency_p95_sec": self._engine.latency_p95_sec,
                "min_concurrent_requests": self._engine._concurrency._adaptive_min_concurrent,
                "last_reason": self._engine._concurrency._last_adapt_reason,
            },
            "scheduler": {
                "max_num_seqs": self._engine._scheduler_max_num_seqs,
                "prefill_batch_size": self._engine._scheduler_prefill_batch_size,
                "completion_batch_size": self._engine._scheduler_completion_batch_size,
                "cache_memory_percent": self._engine._scheduler_cache_memory_percent,
            },
        }

    def is_model_routable(self, model_id: str) -> bool:
        if model_id not in self._engine._models:
            return False
        return self._engine._readiness.is_routable(model_id)

    def model_readiness(self, model_id: str) -> dict[str, Any]:
        return self._engine._readiness.get(model_id)

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
            for m in self._engine._models.values()
        ]

    def get_loaded_model_ids(self) -> list[str]:
        """Return loaded model IDs without allocating ModelInfo objects."""
        return list(self._engine._models.keys())

    def is_model_loaded(self, model_id: str) -> bool:
        """Check if a model is currently loaded."""
        return model_id in self._engine._models

    def get_model(self, model_id: str) -> Any:
        """Get a loaded model or raise KeyError."""
        if model_id not in self._engine._models:
            raise KeyError(f"Model '{model_id}' is not loaded")
        return self._engine._models[model_id]
