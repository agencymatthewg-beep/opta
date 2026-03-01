"""Tests for configuration loading."""

from __future__ import annotations

from pathlib import Path

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
    with pytest.raises(ValueError):
        LMXConfig(memory={"max_memory_percent": 101})  # type: ignore[arg-type]

    with pytest.raises(ValueError):
        LMXConfig(memory={"max_memory_percent": 10})  # type: ignore[arg-type]


def test_auto_load_list() -> None:
    """Auto-load accepts a list of model IDs."""
    config = LMXConfig(models={"auto_load": ["model-a", "model-b"]})  # type: ignore[arg-type]
    assert len(config.models.auto_load) == 2
    assert "model-a" in config.models.auto_load


# ─── Config Validation Tests ────────────────────────────────────────────


def test_port_validation() -> None:
    """Port must be between 1 and 65535."""
    with pytest.raises(ValueError):
        LMXConfig(server={"port": 0})  # type: ignore[arg-type]

    with pytest.raises(ValueError):
        LMXConfig(server={"port": 70000})  # type: ignore[arg-type]

    config = LMXConfig(server={"port": 65535})  # type: ignore[arg-type]
    assert config.server.port == 65535


def test_workers_validation() -> None:
    """Workers must be >= 1."""
    with pytest.raises(ValueError):
        LMXConfig(server={"workers": 0})  # type: ignore[arg-type]


def test_gguf_context_length_validation() -> None:
    """GGUF context length must be >= 512."""
    with pytest.raises(ValueError):
        LMXConfig(models={"gguf_context_length": 256})  # type: ignore[arg-type]


def test_gguf_gpu_layers_validation() -> None:
    """GGUF GPU layers must be >= -1."""
    with pytest.raises(ValueError):
        LMXConfig(models={"gguf_gpu_layers": -2})  # type: ignore[arg-type]

    config = LMXConfig(models={"gguf_gpu_layers": -1})  # type: ignore[arg-type]
    assert config.models.gguf_gpu_layers == -1


def test_logging_level_validation() -> None:
    """Logging level must be a valid level string."""
    with pytest.raises(ValueError):
        LMXConfig(logging={"level": "TRACE"})  # type: ignore[arg-type]

    config = LMXConfig(logging={"level": "DEBUG"})  # type: ignore[arg-type]
    assert config.logging.level == "DEBUG"


def test_logging_format_validation() -> None:
    """Logging format must be 'structured' or 'text'."""
    with pytest.raises(ValueError):
        LMXConfig(logging={"format": "json"})  # type: ignore[arg-type]

    config = LMXConfig(logging={"format": "text"})  # type: ignore[arg-type]
    assert config.logging.format == "text"


def test_mtls_mode_validation() -> None:
    """mTLS mode must be off/optional/required."""
    with pytest.raises(ValueError):
        LMXConfig(security={"mtls_mode": "strict"})  # type: ignore[arg-type]

    config = LMXConfig(
        security={
            "mtls_mode": "optional",
            "mtls_client_subject_header": "x-client-subject",
        }
    )  # type: ignore[arg-type]
    assert config.security.mtls_mode == "optional"


def test_mtls_header_required_when_mtls_enabled() -> None:
    """mTLS mode optional/required requires a client subject header name."""
    with pytest.raises(ValueError):
        LMXConfig(security={"mtls_mode": "required"})  # type: ignore[arg-type]

    config = LMXConfig(
        security={
            "mtls_mode": "required",
            "mtls_client_subject_header": "x-client-subject",
        }
    )  # type: ignore[arg-type]
    assert config.security.mtls_mode == "required"
