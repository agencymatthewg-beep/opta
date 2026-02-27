"""Shared model config resolution and architecture signature utilities.

These utilities are used by both the inference engine and backend policy
modules to resolve local model configs and detect blocked architecture
signatures without triggering remote HuggingFace downloads.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Architecture signatures known to cause runtime instability with vllm-mlx.
# Used by both the engine (blocked-signature detection) and backend policy
# (GLM runtime-sensitive routing).
BLOCKED_RUNTIME_SIGNATURES: tuple[str, ...] = ("glm_moe_dsa", "glmmoedsa")


def _load_model_config(model_id: str) -> dict[str, Any] | None:
    """Best-effort local config.json resolver without forcing remote downloads.

    Checks the local filesystem first, then the HuggingFace cache.
    Returns None if no config is found or parsing fails.
    """
    try:
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
            return raw
    except Exception as e:
        logger.debug(
            "model_config_resolve_failed",
            extra={"model_id": model_id, "error": str(e)},
        )
    return None


def _normalize_signature(signature: str) -> str:
    """Normalize architecture signature for robust substring checks.

    Converts to lowercase, replaces non-alphanumeric chars with underscores,
    and collapses consecutive underscores.
    """
    normalized_chars = [
        ch.lower() if ch.isalnum() else "_"
        for ch in signature
    ]
    normalized = "".join(normalized_chars).strip("_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized
