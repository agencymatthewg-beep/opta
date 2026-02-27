"""Smart model routing — resolve task aliases to loaded models."""

from __future__ import annotations

import logging

from opta_lmx.config import RoutingConfig

logger = logging.getLogger(__name__)

# Built-in aliases that are always recognized (even if not in config).
RESERVED_ALIASES = {"auto", "code", "reasoning", "chat"}


class TaskRouter:
    """Resolve model aliases to actual loaded model IDs.

    Given a model identifier from the client (e.g. "auto", "code",
    "mlx-community/Mistral-7B"), resolves it to a concrete model ID
    that is currently loaded in the engine.

    Resolution rules:
    1. If model_id matches a loaded model exactly → return as-is.
    2. If model_id is a known alias → walk its preference list,
       return the first model that is currently loaded.
    3. "auto" alias → use config.default_model if set and loaded,
       otherwise fall back to any loaded model.
    4. If nothing resolves → return the original model_id unchanged
       (the caller will handle the "not loaded" error).
    """

    def __init__(self, config: RoutingConfig) -> None:
        self._aliases = dict(config.aliases)
        self._default_model = config.default_model

    def resolve(
        self,
        model_id: str,
        loaded_model_ids: list[str],
        model_load_snapshot: dict[str, float] | None = None,
    ) -> str:
        """Resolve a model identifier to a loaded model ID.

        Args:
            model_id: Client-provided model name (may be alias or real ID).
            loaded_model_ids: Currently loaded model IDs from the engine.

        Returns:
            Resolved model ID (may still be unloaded if nothing matched).
        """
        loaded_set = set(loaded_model_ids)

        # Fast path: exact match on a loaded model
        if model_id in loaded_set:
            return model_id

        # Handle "auto" alias specially
        if model_id == "auto":
            resolved = self._resolve_auto(loaded_set)
            if resolved:
                logger.info("route_resolved", extra={
                    "alias": "auto", "resolved_to": resolved,
                })
                return resolved
            return model_id

        # Check configured aliases
        if model_id in self._aliases:
            preferences = self._aliases[model_id]
            for candidate in preferences:
                if candidate in loaded_set:
                    logger.info("route_resolved", extra={
                        "alias": model_id, "resolved_to": candidate,
                    })
                    return candidate

            # Alias known but no preferred model is loaded
            logger.warning("route_no_match", extra={
                "alias": model_id,
                "preferences": preferences,
                "loaded": loaded_model_ids,
            })
            return model_id

        # Not an alias — return as-is (caller checks if loaded)
        return model_id

    def _resolve_auto(self, loaded_set: set[str]) -> str | None:
        """Resolve the 'auto' alias.

        Priority:
        1. config.default_model (if set and loaded)
        2. First loaded model (deterministic — sorted)
        """
        if self._default_model and self._default_model in loaded_set:
            return self._default_model

        if loaded_set:
            return sorted(loaded_set)[0]

        return None

    def update_config(self, config: RoutingConfig) -> None:
        """Hot-reload routing configuration."""
        self._aliases = dict(config.aliases)
        self._default_model = config.default_model
        logger.info("routing_config_updated", extra={
            "alias_count": len(self._aliases),
            "default_model": self._default_model,
        })
