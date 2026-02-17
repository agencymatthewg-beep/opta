"""Tests for structured logging setup and sensitive key redaction."""

from __future__ import annotations

from opta_lmx.monitoring.logging import _filter_sensitive_keys


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
