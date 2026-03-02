"""Tests for rate limit dynamic callable functions."""

from __future__ import annotations

from unittest.mock import MagicMock

from opta_lmx.api.rate_limit import _chat_completions_limit, _embeddings_limit, request_ctx


def _make_request(config: object | None = None) -> MagicMock:
    """Build a mock Starlette Request with optional app.state.config."""
    request = MagicMock()
    request.app.state.config = config
    return request


def _make_config(
    default: str = "60/minute",
    chat: str | None = None,
    embeddings: str | None = None,
) -> MagicMock:
    cfg = MagicMock()
    cfg.security.rate_limit.default_limit = default
    cfg.security.rate_limit.chat_completions_limit = chat
    cfg.security.rate_limit.embeddings_limit = embeddings
    return cfg


class TestChatCompletionsLimit:
    def test_returns_config_chat_limit_when_set(self) -> None:
        config = _make_config(chat="30/minute")
        request = _make_request(config)
        token = request_ctx.set(request)
        try:
            assert _chat_completions_limit("127.0.0.1") == "30/minute"
        finally:
            request_ctx.reset(token)

    def test_falls_back_to_default_limit(self) -> None:
        config = _make_config(default="100/minute", chat=None)
        request = _make_request(config)
        token = request_ctx.set(request)
        try:
            assert _chat_completions_limit("127.0.0.1") == "100/minute"
        finally:
            request_ctx.reset(token)

    def test_fallback_when_no_config(self) -> None:
        request = _make_request(config=None)
        token = request_ctx.set(request)
        try:
            assert _chat_completions_limit("127.0.0.1") == "60/minute"
        finally:
            request_ctx.reset(token)


class TestEmbeddingsLimit:
    def test_returns_config_embeddings_limit_when_set(self) -> None:
        config = _make_config(embeddings="120/minute")
        request = _make_request(config)
        token = request_ctx.set(request)
        try:
            assert _embeddings_limit("127.0.0.1") == "120/minute"
        finally:
            request_ctx.reset(token)

    def test_falls_back_to_default_limit(self) -> None:
        config = _make_config(default="200/minute", embeddings=None)
        request = _make_request(config)
        token = request_ctx.set(request)
        try:
            assert _embeddings_limit("127.0.0.1") == "200/minute"
        finally:
            request_ctx.reset(token)

    def test_fallback_when_no_config(self) -> None:
        request = _make_request(config=None)
        token = request_ctx.set(request)
        try:
            assert _embeddings_limit("127.0.0.1") == "60/minute"
        finally:
            request_ctx.reset(token)
