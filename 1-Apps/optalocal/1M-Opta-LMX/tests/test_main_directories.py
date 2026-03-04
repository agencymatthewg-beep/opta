"""Tests for runtime directory provisioning during app startup."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from opta_lmx.config import LMXConfig
from opta_lmx.main import (
    _configure_hf_cache_environment,
    _ensure_runtime_directories,
    _enforce_opta48_no_local_models,
)


def test_ensure_runtime_directories_creates_required_paths(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """Startup provisioning should create all required filesystem directories."""
    fake_home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(fake_home))

    config = LMXConfig.model_validate(
        {
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
        }
    )

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


def test_configure_hf_cache_environment_uses_models_directory(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """Startup should align HF cache env vars to configured models_directory."""
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.delenv("HF_HUB_CACHE", raising=False)

    models_dir = tmp_path / "models-cache"
    config = LMXConfig.model_validate({"models": {"models_directory": str(models_dir)}})

    _configure_hf_cache_environment(config)

    assert Path(str(os.environ.get("HF_HUB_CACHE"))).expanduser() == models_dir
    assert Path(str(os.environ.get("HF_HOME"))).expanduser() == models_dir.parent


def test_enforce_opta48_no_local_models_blocks_fqdn_hostname(monkeypatch) -> None:
    """Opta48 policy should trigger for both bare and FQDN hostnames."""
    monkeypatch.setattr("socket.gethostname", lambda: "Opta48.lan")
    monkeypatch.delenv("OPTA48_ALLOW_LOCAL_MODELS", raising=False)

    config = LMXConfig.model_validate({})

    with pytest.raises(RuntimeError, match="Opta48 policy violation"):
        _enforce_opta48_no_local_models(config)


def test_enforce_opta48_no_local_models_allows_override(monkeypatch) -> None:
    """Explicit override should bypass Opta48 local-hosting guard."""
    monkeypatch.setattr("socket.gethostname", lambda: "opta48.lan")
    monkeypatch.setenv("OPTA48_ALLOW_LOCAL_MODELS", "1")

    config = LMXConfig.model_validate({})
    _enforce_opta48_no_local_models(config)
