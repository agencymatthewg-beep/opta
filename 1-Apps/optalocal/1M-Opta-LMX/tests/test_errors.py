"""Tests for OpenAI-compatible error response helpers."""

from __future__ import annotations

from opta_lmx.api.errors import (
    download_not_found,
    insufficient_memory,
    internal_error,
    model_in_use,
    model_not_found,
    openai_error,
)


class TestOpenAIError:
    """Tests for the base openai_error helper."""

    def test_returns_correct_status(self) -> None:
        """Status code is set on the response."""
        resp = openai_error(400, "bad", "invalid_request_error")
        assert resp.status_code == 400

    def test_returns_openai_format(self) -> None:
        """Response body matches OpenAI error format."""
        resp = openai_error(422, "oops", "validation_error", param="model", code="invalid")
        body = resp.body.decode()
        import json
        data = json.loads(body)
        assert data["error"]["message"] == "oops"
        assert data["error"]["type"] == "validation_error"
        assert data["error"]["param"] == "model"
        assert data["error"]["code"] == "invalid"

    def test_optional_fields_default_to_none(self) -> None:
        """param and code default to None when not provided."""
        resp = openai_error(500, "fail", "server_error")
        import json
        data = json.loads(resp.body.decode())
        assert data["error"]["param"] is None
        assert data["error"]["code"] is None


class TestConvenienceHelpers:
    """Tests for convenience error helpers."""

    def test_model_not_found(self) -> None:
        """model_not_found returns 404 with model name."""
        resp = model_not_found("gpt-4")
        assert resp.status_code == 404
        import json
        data = json.loads(resp.body.decode())
        assert "gpt-4" in data["error"]["message"]
        assert data["error"]["code"] == "model_not_found"

    def test_insufficient_memory(self) -> None:
        """insufficient_memory returns 507."""
        resp = insufficient_memory("not enough RAM")
        assert resp.status_code == 507
        import json
        data = json.loads(resp.body.decode())
        assert data["error"]["code"] == "insufficient_memory"

    def test_internal_error(self) -> None:
        """internal_error returns 500 with generic message (not detail)."""
        resp = internal_error("secret stack trace")
        assert resp.status_code == 500
        import json
        data = json.loads(resp.body.decode())
        # Detail should NOT leak to client
        assert "secret" not in data["error"]["message"]
        assert data["error"]["message"] == "Internal server error"

    def test_model_in_use(self) -> None:
        """model_in_use returns 409 conflict."""
        resp = model_in_use("llama-3")
        assert resp.status_code == 409
        import json
        data = json.loads(resp.body.decode())
        assert "llama-3" in data["error"]["message"]
        assert data["error"]["code"] == "model_in_use"

    def test_download_not_found(self) -> None:
        """download_not_found returns 404."""
        resp = download_not_found("dl-abc123")
        assert resp.status_code == 404
        import json
        data = json.loads(resp.body.decode())
        assert "dl-abc123" in data["error"]["message"]
        assert data["error"]["code"] == "download_not_found"
