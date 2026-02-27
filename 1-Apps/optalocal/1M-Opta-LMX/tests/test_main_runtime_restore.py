"""Tests for runtime-state based model restore at startup."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


@pytest.mark.asyncio
async def test_unclean_runtime_state_models_are_reloaded_on_startup() -> None:
    """Unclean shutdown snapshots should feed startup auto-load restore."""
    config = LMXConfig(models={"auto_load": []})  # type: ignore[arg-type]
    app = create_app(config)

    fake_runtime_state = MagicMock()
    fake_runtime_state.load.return_value = {
        "last_clean_shutdown": False,
        "loaded_models": ["restored/model", "restored/model"],
    }
    fake_runtime_state.is_crash_loop.return_value = False

    load_model_mock = AsyncMock(return_value=MagicMock())
    with (
        patch("opta_lmx.main.RuntimeState", return_value=fake_runtime_state),
        patch("opta_lmx.main.InferenceEngine.load_model", load_model_mock),
    ):
        async with app.router.lifespan_context(app):
            pass

    load_model_mock.assert_any_await("restored/model", performance_overrides=None)
