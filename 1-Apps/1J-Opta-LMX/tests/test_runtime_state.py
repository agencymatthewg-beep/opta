"""Tests for runtime state persistence."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from opta_lmx.runtime_state import RuntimeState


class TestRuntimeState:
    """Runtime state save/load cycle."""

    def test_save_creates_json_file(self, tmp_path: Path) -> None:
        """save() writes a valid JSON file."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.save(loaded_models=["model-a", "model-b"], clean=True)

        assert (tmp_path / "state.json").exists()
        data = json.loads((tmp_path / "state.json").read_text())
        assert data["loaded_models"] == ["model-a", "model-b"]
        assert data["last_clean_shutdown"] is True

    def test_load_returns_saved_state(self, tmp_path: Path) -> None:
        """load() returns previously saved state."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.save(loaded_models=["model-a"], clean=False)

        loaded = state.load()
        assert loaded is not None
        assert loaded["loaded_models"] == ["model-a"]
        assert loaded["last_clean_shutdown"] is False

    def test_load_returns_none_when_no_file(self, tmp_path: Path) -> None:
        """load() returns None when state file doesn't exist."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        assert state.load() is None

    def test_tracks_startup_count(self, tmp_path: Path) -> None:
        """Each save increments startup_count."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.save(loaded_models=[], clean=True)
        state.record_startup()
        data = state.load()
        assert data is not None
        assert data["startup_count"] == 1
