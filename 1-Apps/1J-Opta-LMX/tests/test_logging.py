"""Tests for structured logging setup and sensitive key redaction."""

from __future__ import annotations

import logging
from pathlib import Path

from opta_lmx.monitoring.logging import _filter_sensitive_keys, setup_logging


class TestSensitiveKeyRedaction:
    """Tests for the _filter_sensitive_keys structlog processor."""

    def test_redacts_api_key(self) -> None:
        """api_key values are replaced with ***REDACTED***."""
        event_dict = {"event": "test", "api_key": "sk-secret123"}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["api_key"] == "***REDACTED***"

    def test_redacts_token(self) -> None:
        """token values are redacted."""
        event_dict = {"event": "test", "token": "bearer-xyz"}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["token"] == "***REDACTED***"

    def test_redacts_password(self) -> None:
        """password values are redacted."""
        event_dict = {"event": "test", "password": "hunter2"}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["password"] == "***REDACTED***"

    def test_redacts_secret(self) -> None:
        """secret values are redacted."""
        event_dict = {"event": "test", "secret": "mysecret"}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["secret"] == "***REDACTED***"

    def test_redacts_credential(self) -> None:
        """credential values are redacted."""
        event_dict = {"event": "test", "credential": "cred123"}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["credential"] == "***REDACTED***"

    def test_preserves_non_sensitive_keys(self) -> None:
        """Non-sensitive keys pass through unchanged."""
        event_dict = {"event": "test", "model_id": "llama-3", "latency_ms": 42}
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["model_id"] == "llama-3"
        assert result["latency_ms"] == 42

    def test_multiple_sensitive_keys(self) -> None:
        """Multiple sensitive keys are all redacted."""
        event_dict = {
            "event": "test",
            "api_key": "key1",
            "token": "tok1",
            "model": "safe-value",
        }
        result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]
        assert result["api_key"] == "***REDACTED***"
        assert result["token"] == "***REDACTED***"
        assert result["model"] == "safe-value"


class TestSetupLogging:
    """Tests for the setup_logging() function."""

    def teardown_method(self) -> None:
        """Reset root logger handlers after each test."""
        root = logging.getLogger()
        root.handlers.clear()

    def test_console_handler_added(self) -> None:
        """setup_logging() with no file adds a StreamHandler."""
        setup_logging(level="DEBUG", structured=False)
        root = logging.getLogger()
        assert any(isinstance(h, logging.StreamHandler) for h in root.handlers)

    def test_level_set_correctly(self) -> None:
        """Root logger level is set from the level parameter."""
        setup_logging(level="WARNING")
        assert logging.getLogger().level == logging.WARNING

    def test_debug_level(self) -> None:
        """DEBUG level is propagated correctly."""
        setup_logging(level="DEBUG")
        assert logging.getLogger().level == logging.DEBUG

    def test_info_level(self) -> None:
        """INFO level is propagated correctly."""
        setup_logging(level="INFO")
        assert logging.getLogger().level == logging.INFO

    def test_structured_mode(self) -> None:
        """setup_logging() with structured=True adds a handler."""
        setup_logging(level="INFO", structured=True)
        root = logging.getLogger()
        assert len(root.handlers) == 1

    def test_unstructured_mode(self) -> None:
        """setup_logging() with structured=False adds a console handler."""
        setup_logging(level="INFO", structured=False)
        root = logging.getLogger()
        assert len(root.handlers) == 1

    def test_file_handler_created(self, tmp_path: Path) -> None:
        """setup_logging() with log_file creates a RotatingFileHandler."""
        from logging.handlers import RotatingFileHandler

        log_path = str(tmp_path / "opta.log")
        setup_logging(level="INFO", log_file=log_path)
        root = logging.getLogger()
        assert any(isinstance(h, RotatingFileHandler) for h in root.handlers)

    def test_file_handler_no_console(self, tmp_path: Path) -> None:
        """When log_file is set, no StreamHandler is added (launchd stderr safety)."""
        log_path = str(tmp_path / "opta.log")
        setup_logging(level="INFO", log_file=log_path)
        root = logging.getLogger()
        assert not any(isinstance(h, logging.StreamHandler)
                       and not hasattr(h, "baseFilename")
                       for h in root.handlers)

    def test_parent_dirs_created(self, tmp_path: Path) -> None:
        """Nested log path parent directories are created automatically."""
        log_path = str(tmp_path / "sub" / "dir" / "app.log")
        setup_logging(level="INFO", log_file=log_path)
        assert Path(log_path).parent.exists()

    def test_reinit_clears_handlers(self) -> None:
        """Calling setup_logging() twice does not duplicate handlers."""
        setup_logging(level="INFO", structured=False)
        setup_logging(level="DEBUG", structured=False)
        root = logging.getLogger()
        assert len(root.handlers) == 1
