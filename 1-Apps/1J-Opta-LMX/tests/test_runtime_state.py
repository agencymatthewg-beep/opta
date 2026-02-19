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


class TestCrashLoopDetection:
    """Crash loop detection via rapid startup counting."""

    def test_crash_loop_detection(self, tmp_path: Path) -> None:
        """3 rapid startups within window triggers crash loop."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        # Simulate 3 rapid startups
        for _ in range(3):
            state.record_startup()
        assert state.is_crash_loop() is True

    def test_no_crash_loop_normal(self, tmp_path: Path) -> None:
        """Single startup does not trigger crash loop."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.record_startup()
        assert state.is_crash_loop() is False

    def test_no_crash_loop_when_no_state_file(self, tmp_path: Path) -> None:
        """No state file means no crash loop."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        assert state.is_crash_loop() is False

    def test_crash_loop_below_threshold(self, tmp_path: Path) -> None:
        """2 startups (below default threshold of 3) is not a crash loop."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.record_startup()
        state.record_startup()
        assert state.is_crash_loop() is False

    def test_crash_loop_custom_threshold(self, tmp_path: Path) -> None:
        """Custom threshold of 2 triggers crash loop on 2 startups."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        state.record_startup()
        state.record_startup()
        assert state.is_crash_loop(threshold=2) is True

    def test_crash_loop_resets_after_clean_shutdown(self, tmp_path: Path) -> None:
        """Clean shutdown resets startup count, preventing false crash loop."""
        state = RuntimeState(state_path=tmp_path / "state.json")
        for _ in range(3):
            state.record_startup()
        assert state.is_crash_loop() is True

        # Clean shutdown resets the startup_count to 0
        state.save(loaded_models=[], clean=True)
        assert state.is_crash_loop() is False
