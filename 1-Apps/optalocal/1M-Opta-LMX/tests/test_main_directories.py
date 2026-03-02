"""Tests for runtime directory provisioning during app startup."""

from __future__ import annotations

from pathlib import Path

from opta_lmx.config import LMXConfig
from opta_lmx.main import _ensure_runtime_directories


def test_ensure_runtime_directories_creates_required_paths(
    tmp_path: Path, monkeypatch,
) -> None:
    """Startup provisioning should create all required filesystem directories."""
    fake_home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(fake_home))

    config = LMXConfig.model_validate({
        "models": {"models_directory": str(tmp_path / "models")},
        "presets": {"directory": str(tmp_path / "presets")},
        "rag": {"persist_path": str(tmp_path / "rag" / "rag-store.json")},
        "logging": {"file": str(tmp_path / "logs" / "opta-lmx.log")},
        "journaling": {
            "session_logs_dir": str(tmp_path / "session-logs"),
            "update_logs_dir": str(tmp_path / "update-logs"),
        },
        "workers": {"skill_queue_persist_path": str(tmp_path / "queues" / "skills-queue.db")},
        "agents": {
            "queue_persist_path": str(tmp_path / "queues" / "agents-queue.db"),
            "state_store_path": str(tmp_path / "state" / "agents-runs.json"),
        },
    })

    _ensure_runtime_directories(config)

    expected_dirs = [
        fake_home / ".opta-lmx",
        fake_home / ".opta-lmx" / "benchmarks",
        fake_home / ".opta-lmx" / "quantized",
        tmp_path / "models",
        tmp_path / "presets",
        tmp_path / "rag",
        tmp_path / "logs",
        tmp_path / "session-logs",
        tmp_path / "update-logs",
        tmp_path / "queues",
        tmp_path / "state",
    ]
    for expected in expected_dirs:
        assert expected.exists()
        assert expected.is_dir()
