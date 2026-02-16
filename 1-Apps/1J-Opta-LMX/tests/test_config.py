"""Tests for configuration loading."""

from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

import pytest

from opta_lmx.config import LMXConfig, load_config


def test_default_config() -> None:
    """Default config has sensible values."""
    config = LMXConfig()
    assert config.server.port == 1234
    assert config.server.host == "127.0.0.1"
    assert config.memory.max_memory_percent == 90
    assert config.models.use_batching is True


def test_load_config_from_yaml(tmp_path: Path) -> None:
    """Config loads from a YAML file."""
    yaml_content = """
server:
  host: "0.0.0.0"
  port: 8080
memory:
  max_memory_percent: 85
"""
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml_content)

    config = load_config(config_file)
    assert config.server.host == "0.0.0.0"
    assert config.server.port == 8080
    assert config.memory.max_memory_percent == 85
    # Defaults preserved for unset values
    assert config.server.workers == 1
    assert config.models.use_batching is True


def test_load_config_empty_file(tmp_path: Path) -> None:
    """Empty YAML file returns defaults."""
    config_file = tmp_path / "config.yaml"
    config_file.write_text("")

    config = load_config(config_file)
    assert config.server.port == 1234


def test_load_config_missing_file() -> None:
    """Missing file returns defaults."""
    config = load_config(Path("/nonexistent/path/config.yaml"))
    assert config.server.port == 1234


def test_memory_percent_validation() -> None:
    """Memory percent must be between 50 and 99."""
    with pytest.raises(Exception):
        LMXConfig(memory={"max_memory_percent": 101})  # type: ignore[arg-type]

    with pytest.raises(Exception):
        LMXConfig(memory={"max_memory_percent": 10})  # type: ignore[arg-type]


def test_auto_load_list() -> None:
    """Auto-load accepts a list of model IDs."""
    config = LMXConfig(models={"auto_load": ["model-a", "model-b"]})  # type: ignore[arg-type]
    assert len(config.models.auto_load) == 2
    assert "model-a" in config.models.auto_load
