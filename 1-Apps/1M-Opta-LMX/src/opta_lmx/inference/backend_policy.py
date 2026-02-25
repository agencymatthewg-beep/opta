"""Backend candidate policy for model loading fallback decisions."""

from __future__ import annotations

from typing import Any

from opta_lmx.inference._model_config import (
    BLOCKED_RUNTIME_SIGNATURES as _GLM_RUNTIME_SIGNATURES,
    _load_model_config,
    _normalize_signature,
)
from opta_lmx.model_safety import CompatibilityRegistry

_ALLOWED_BACKENDS = ("vllm-mlx", "mlx-lm", "gguf")
_GLM_MODEL_HINTS = ("glm-5", "glm5")


def _is_glm_runtime_sensitive(model_id: str) -> bool:
    """Detect GLM signatures that should prefer mlx-lm over vllm-mlx."""
    lowered = model_id.lower()
    if any(hint in lowered for hint in _GLM_MODEL_HINTS):
        return True

    config = _load_model_config(model_id)
    if not isinstance(config, dict):
        return False

    hints: list[str] = []
    model_type = config.get("model_type")
    if isinstance(model_type, str) and model_type.strip():
        hints.append(model_type.strip())

    architectures = config.get("architectures")
    if isinstance(architectures, list):
        hints.extend(
            item.strip()
            for item in architectures
            if isinstance(item, str) and item.strip()
        )

    for hint in hints:
        normalized = _normalize_signature(hint)
        compact = normalized.replace("_", "")
        if any(sig in normalized for sig in _GLM_RUNTIME_SIGNATURES):
            return True
        if any(sig in compact for sig in _GLM_RUNTIME_SIGNATURES):
            return True

    return False


def _prioritize_backend(order: list[str], backend: str) -> list[str]:
    if backend not in order:
        return order
    return [backend, *[candidate for candidate in order if candidate != backend]]


def backend_candidates(
    model_id: str,
    cfg: Any,
    registry: CompatibilityRegistry,
    *,
    allow_failed: bool = False,
    preferred_backend: str | None = None,
) -> list[str]:
    """Return candidate backend order for a model load attempt.

    Rules:
    - Explicit GGUF model IDs are routed directly to GGUF.
    - Otherwise order follows configured backend preference.
    - Runtime-sensitive GLM signatures prefer mlx-lm over vllm-mlx.
    - Optional GGUF fallback is appended when enabled.
    - Explicit preferred backend is prioritized first.
    - Latest known-failed backend is skipped unless allow_failed=True.
    """
    if preferred_backend is not None and preferred_backend not in _ALLOWED_BACKENDS:
        raise ValueError(
            "Unsupported backend override. Expected one of "
            f"{', '.join(_ALLOWED_BACKENDS)}."
        )

    lowered_model_id = model_id.lower()
    if lowered_model_id.endswith(".gguf") or "gguf" in lowered_model_id:
        if preferred_backend is not None and preferred_backend != "gguf":
            raise ValueError("GGUF model IDs can only be loaded with backend='gguf'.")
        return ["gguf"]

    configured = list(
        getattr(
            cfg,
            "backend_preference_order",
            getattr(cfg, "_backend_preference_order", ["vllm-mlx", "mlx-lm"]),
        )
    )
    normalized = [value for value in configured if value in _ALLOWED_BACKENDS and value != "gguf"]
    if not normalized:
        normalized = ["vllm-mlx", "mlx-lm"]

    runtime_sensitive_glm = _is_glm_runtime_sensitive(model_id)
    if runtime_sensitive_glm:
        normalized = _prioritize_backend(normalized, "mlx-lm")

    if bool(getattr(cfg, "gguf_fallback_enabled", getattr(cfg, "_gguf_fallback_enabled", False))):
        normalized.append("gguf")

    ordered = list(dict.fromkeys(normalized))
    if preferred_backend is not None:
        if preferred_backend in ordered:
            ordered = _prioritize_backend(ordered, preferred_backend)
        else:
            ordered = [preferred_backend, *ordered]

    if allow_failed:
        return ordered

    filtered: list[str] = []
    for backend in ordered:
        if preferred_backend is not None and backend == preferred_backend:
            filtered.append(backend)
            continue
        # For GLM runtime-sensitive models, keep mlx-lm in rotation even if a
        # prior attempt failed. Falling through to vllm-mlx can reintroduce the
        # exact runtime signature failures this policy is meant to avoid.
        if runtime_sensitive_glm and backend == "mlx-lm":
            filtered.append(backend)
            continue
        latest = registry.latest_record(model_id, backend=backend)
        if latest is not None and latest.get("outcome") == "fail":
            continue
        filtered.append(backend)

    return filtered or ordered
