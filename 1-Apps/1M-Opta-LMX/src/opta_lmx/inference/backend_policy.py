"""Backend candidate policy for model loading fallback decisions."""

from __future__ import annotations

from typing import Any

from opta_lmx.model_safety import CompatibilityRegistry

_ALLOWED_BACKENDS = ("vllm-mlx", "mlx-lm", "gguf")


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def backend_candidates(
    model_id: str,
    cfg: Any,
    registry: CompatibilityRegistry,
    *,
    allow_failed: bool = False,
) -> list[str]:
    """Return candidate backend order for a model load attempt.

    Rules:
    - Explicit GGUF model IDs are routed directly to GGUF.
    - Otherwise order follows configured backend preference.
    - Optional GGUF fallback is appended when enabled.
    - Latest known-failed backend is skipped unless allow_failed=True.
    """
    lowered_model_id = model_id.lower()
    if lowered_model_id.endswith(".gguf") or "gguf" in lowered_model_id:
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

    if bool(getattr(cfg, "gguf_fallback_enabled", getattr(cfg, "_gguf_fallback_enabled", False))):
        normalized.append("gguf")

    ordered = _dedupe_preserve_order(normalized)
    if allow_failed:
        return ordered

    filtered: list[str] = []
    for backend in ordered:
        latest = registry.latest_record(model_id, backend=backend)
        if latest is not None and latest.get("outcome") == "fail":
            continue
        filtered.append(backend)

    return filtered or ordered
