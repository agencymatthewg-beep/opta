"""Unit tests for TaskRouter — alias resolution and smart routing."""

from __future__ import annotations

from opta_lmx.config import RoutingConfig
from opta_lmx.router.strategy import TaskRouter


def _make_router(
    aliases: dict[str, list[str]] | None = None,
    default_model: str | None = None,
) -> TaskRouter:
    """Create a TaskRouter with given config."""
    config = RoutingConfig(
        aliases=aliases or {},
        default_model=default_model,
    )
    return config, TaskRouter(config)


def test_exact_match_returns_as_is() -> None:
    """A model ID that matches a loaded model passes through unchanged."""
    _, router = _make_router()
    result = router.resolve("mlx-community/Mistral-7B", ["mlx-community/Mistral-7B"])
    assert result == "mlx-community/Mistral-7B"


def test_unknown_model_returns_as_is() -> None:
    """An unknown model ID returns unchanged (caller handles 404)."""
    _, router = _make_router()
    result = router.resolve("nonexistent-model", ["model-a"])
    assert result == "nonexistent-model"


def test_auto_resolves_to_default_model() -> None:
    """'auto' resolves to config.default_model when it's loaded."""
    _, router = _make_router(default_model="preferred-model")
    result = router.resolve("auto", ["other-model", "preferred-model"])
    assert result == "preferred-model"


def test_auto_falls_back_to_first_loaded() -> None:
    """'auto' resolves to the first loaded model (sorted) when no default."""
    _, router = _make_router()
    result = router.resolve("auto", ["z-model", "a-model"])
    assert result == "a-model"


def test_auto_returns_unchanged_when_nothing_loaded() -> None:
    """'auto' returns 'auto' when no models are loaded."""
    _, router = _make_router()
    result = router.resolve("auto", [])
    assert result == "auto"


def test_auto_skips_unloaded_default() -> None:
    """'auto' falls back when default_model is not loaded."""
    _, router = _make_router(default_model="not-loaded")
    result = router.resolve("auto", ["model-a"])
    assert result == "model-a"


def test_alias_resolves_first_loaded_preference() -> None:
    """Alias resolves to the first preference that is loaded."""
    _, router = _make_router(aliases={
        "code": ["first-choice", "second-choice", "third-choice"],
    })
    result = router.resolve("code", ["third-choice", "second-choice"])
    assert result == "second-choice"


def test_alias_returns_unchanged_when_no_preference_loaded() -> None:
    """Alias returns as-is when none of its preferences are loaded."""
    _, router = _make_router(aliases={
        "reasoning": ["model-a", "model-b"],
    })
    result = router.resolve("reasoning", ["completely-different"])
    assert result == "reasoning"


def test_alias_empty_preference_list() -> None:
    """Alias with empty preference list returns unchanged."""
    _, router = _make_router(aliases={"chat": []})
    result = router.resolve("chat", ["some-model"])
    assert result == "chat"


def test_update_config_changes_routing() -> None:
    """update_config() live-reloads routing rules."""
    config, router = _make_router(aliases={"code": ["old-model"]})

    # Initially routes to old-model
    result = router.resolve("code", ["old-model", "new-model"])
    assert result == "old-model"

    # Update config
    new_config = RoutingConfig(aliases={"code": ["new-model"]})
    router.update_config(new_config)

    result = router.resolve("code", ["old-model", "new-model"])
    assert result == "new-model"
