"""Autotune delegation module for the InferenceEngine facade."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.model_safety import CompatibilityRegistry
    from opta_lmx.inference.types import LoadedModel


class EngineAutotuneDelegator:
    """Handles autotune backend resolution and profile persistence for InferenceEngine."""

    def __init__(self, engine: InferenceEngine) -> None:
        self._engine = engine

    def autotune_backend_version(self, backend: str) -> str:
        """Resolve backend package version used for autotune keying."""
        import importlib.metadata as importlib_metadata
        from opta_lmx.model_safety import backend_version

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
        from opta_lmx.inference.backend_policy import backend_candidates

        loaded = self._engine._models.get(model_id)
        if loaded is not None:
            return self._engine._loaded_backend_name(loaded)

        candidates = backend_candidates(
            model_id,
            self._engine,
            self._engine._compatibility,
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
        return self._engine._autotune.get_best(
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
        return self._engine._autotune.save_scored_profile(
            model_id=model_id,
            backend=backend,
            backend_version=backend_version_value,
            profile=profile,
            metrics=metrics,
        )
