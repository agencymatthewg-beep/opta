"""Tests for the subscription provider proxy system.

Covers:
- resolve_subscription_route() prefix matching
- build_auth_headers() Copilot header injection
- _proxy_gemini message translation (OpenAI → Gemini format)
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from opta_lmx.proxy.subscription_providers import (
    SUBSCRIPTION_ROUTE_MAP,
    SubscriptionRoute,
    resolve_subscription_route,
)
from opta_lmx.proxy.subscription_proxy import build_auth_headers, proxy_chat_completion


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def copilot_route() -> SubscriptionRoute:
    """GitHub Copilot subscription route."""
    return SUBSCRIPTION_ROUTE_MAP["github-copilot"]


@pytest.fixture
def gemini_route() -> SubscriptionRoute:
    """Gemini CLI subscription route."""
    return SUBSCRIPTION_ROUTE_MAP["gemini-cli"]


# ─── resolve_subscription_route tests ────────────────────────────────────────


class TestResolveSubscriptionRoute:
    """Tests for the resolve_subscription_route() helper."""

    def test_copilot_slash_prefix(self) -> None:
        """'copilot/gpt-4o' → github-copilot route, model='gpt-4o'."""
        result = resolve_subscription_route("copilot/gpt-4o")
        assert result is not None
        route, model = result
        assert route.provider_id == "github-copilot"
        assert model == "gpt-4o"

    def test_github_copilot_slash_prefix(self) -> None:
        """'github-copilot/gpt-4o' → github-copilot route, model='gpt-4o'."""
        result = resolve_subscription_route("github-copilot/gpt-4o")
        assert result is not None
        route, model = result
        assert route.provider_id == "github-copilot"
        assert model == "gpt-4o"

    def test_gemini_cli_slash_prefix(self) -> None:
        """'gemini-cli/gemini-2.0-flash' → gemini-cli route."""
        result = resolve_subscription_route("gemini-cli/gemini-2.0-flash")
        assert result is not None
        route, model = result
        assert route.provider_id == "gemini-cli"
        assert model == "gemini-2.0-flash"

    def test_bare_copilot_alias(self) -> None:
        """'copilot' (no slash) → github-copilot route with default model."""
        result = resolve_subscription_route("copilot")
        assert result is not None
        route, model = result
        assert route.provider_id == "github-copilot"
        assert model == route.default_model

    def test_bare_github_copilot(self) -> None:
        """'github-copilot' (no slash) → github-copilot route with default model."""
        result = resolve_subscription_route("github-copilot")
        assert result is not None
        route, model = result
        assert route.provider_id == "github-copilot"
        assert model == route.default_model

    def test_bare_gemini_cli(self) -> None:
        """'gemini-cli' (no slash) → gemini-cli route with default model."""
        result = resolve_subscription_route("gemini-cli")
        assert result is not None
        route, model = result
        assert route.provider_id == "gemini-cli"
        assert model == route.default_model

    def test_local_model_returns_none(self) -> None:
        """Unknown model names return None (fall through to local inference)."""
        assert resolve_subscription_route("mlx-community/Mistral-7B") is None

    def test_auto_alias_returns_none(self) -> None:
        """'auto' is a local alias, not a subscription provider."""
        assert resolve_subscription_route("auto") is None

    def test_empty_string_returns_none(self) -> None:
        """Empty model string returns None."""
        assert resolve_subscription_route("") is None

    def test_copilot_with_nested_model_name(self) -> None:
        """'copilot/o3-mini' routes correctly."""
        result = resolve_subscription_route("copilot/o3-mini")
        assert result is not None
        route, model = result
        assert route.provider_id == "github-copilot"
        assert model == "o3-mini"

    def test_gemini_slash_only_uses_default(self) -> None:
        """'gemini-cli/' (trailing slash, empty model) falls back to default."""
        result = resolve_subscription_route("gemini-cli/")
        assert result is not None
        route, model = result
        assert route.provider_id == "gemini-cli"
        assert model == route.default_model

    def test_unknown_prefix_slash_returns_none(self) -> None:
        """'openai/gpt-4o' is not a registered subscription provider."""
        assert resolve_subscription_route("openai/gpt-4o") is None


# ─── build_auth_headers tests ─────────────────────────────────────────────────


class TestBuildAuthHeaders:
    """Tests for build_auth_headers() header construction."""

    def test_copilot_includes_all_required_headers(
        self, copilot_route: SubscriptionRoute
    ) -> None:
        """GitHub Copilot auth headers include all mandatory extra headers."""
        headers = build_auth_headers(copilot_route, "tok-abc123")

        # Core auth
        assert headers["Authorization"] == "Bearer tok-abc123"

        # Copilot-specific required headers
        assert headers["Copilot-Integration-Id"] == "vscode-chat"
        assert "Editor-Version" in headers
        assert "Editor-Plugin-Version" in headers
        assert "OpenAI-Intent" in headers
        assert "X-Github-Api-Version" in headers

    def test_copilot_bearer_token_format(
        self, copilot_route: SubscriptionRoute
    ) -> None:
        """Authorization header is exactly 'Bearer <token>'."""
        headers = build_auth_headers(copilot_route, "my-secret-token")
        assert headers["Authorization"] == "Bearer my-secret-token"

    def test_gemini_standard_bearer(self, gemini_route: SubscriptionRoute) -> None:
        """Gemini CLI uses plain bearer auth with no extra headers."""
        headers = build_auth_headers(gemini_route, "ya29.some-google-token")
        assert headers == {"Authorization": "Bearer ya29.some-google-token"}

    def test_copilot_no_extra_headers_leaked_to_gemini(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """Copilot-specific headers must not appear in Gemini auth headers."""
        headers = build_auth_headers(gemini_route, "token")
        assert "Copilot-Integration-Id" not in headers
        assert "Editor-Version" not in headers


# ─── Gemini message translation tests ────────────────────────────────────────


class TestGeminiMessageTranslation:
    """Tests for OpenAI → Gemini message format translation inside proxy_chat_completion."""

    def _make_gemini_ok_response(self, text: str) -> dict[str, Any]:
        """Construct a minimal valid Gemini generateContent response."""
        return {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [{"text": text}],
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 5,
                "totalTokenCount": 15,
            },
        }

    @pytest.mark.asyncio
    async def test_system_message_becomes_system_instruction(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """system role messages are placed in Gemini's system_instruction field."""
        captured_body: dict[str, Any] = {}

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_body.update(json)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = self._make_gemini_ok_response("Hello!")
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            request_body: dict[str, Any] = {
                "model": "gemini-2.0-flash",
                "messages": [
                    {"role": "system", "content": "You are helpful."},
                    {"role": "user", "content": "Hi"},
                ],
            }

            status, resp, stream = await proxy_chat_completion(
                route=gemini_route,
                token="test-token",
                request_body=request_body,
                stream=False,
            )

        assert status == 200
        assert resp is not None
        assert "system_instruction" in captured_body
        assert captured_body["system_instruction"]["parts"][0]["text"] == "You are helpful."

    @pytest.mark.asyncio
    async def test_user_messages_map_to_user_role(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """user role messages become Gemini 'user' role contents."""
        captured_body: dict[str, Any] = {}

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_body.update(json)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = self._make_gemini_ok_response("Response text")
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            request_body = {
                "model": "gemini-2.0-flash",
                "messages": [{"role": "user", "content": "Hello there"}],
            }

            await proxy_chat_completion(
                route=gemini_route,
                token="test-token",
                request_body=request_body,
                stream=False,
            )

        contents = captured_body.get("contents", [])
        assert len(contents) == 1
        assert contents[0]["role"] == "user"
        assert contents[0]["parts"][0]["text"] == "Hello there"

    @pytest.mark.asyncio
    async def test_assistant_messages_map_to_model_role(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """assistant role messages become Gemini 'model' role contents."""
        captured_body: dict[str, Any] = {}

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_body.update(json)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = self._make_gemini_ok_response("Reply")
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            request_body = {
                "model": "gemini-2.0-flash",
                "messages": [
                    {"role": "user", "content": "Ping"},
                    {"role": "assistant", "content": "Pong"},
                    {"role": "user", "content": "Ping again"},
                ],
            }

            await proxy_chat_completion(
                route=gemini_route,
                token="test-token",
                request_body=request_body,
                stream=False,
            )

        contents = captured_body.get("contents", [])
        roles = [c["role"] for c in contents]
        assert roles == ["user", "model", "user"]

    @pytest.mark.asyncio
    async def test_response_converted_to_openai_format(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """Gemini response is translated to OpenAI chat.completion format."""

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = self._make_gemini_ok_response("The answer is 42.")
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            status, resp, stream = await proxy_chat_completion(
                route=gemini_route,
                token="test-token",
                request_body={
                    "model": "gemini-2.0-flash",
                    "messages": [{"role": "user", "content": "What is the answer?"}],
                },
                stream=False,
            )

        assert status == 200
        assert stream is None
        assert resp is not None
        assert resp["object"] == "chat.completion"
        assert resp["id"].startswith("chatcmpl-gemini-")
        choices = resp["choices"]
        assert len(choices) == 1
        assert choices[0]["message"]["role"] == "assistant"
        assert choices[0]["message"]["content"] == "The answer is 42."
        assert choices[0]["finish_reason"] == "stop"

    @pytest.mark.asyncio
    async def test_max_tokens_maps_to_generation_config(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """max_tokens in OpenAI request → generationConfig.maxOutputTokens in Gemini."""
        captured_body: dict[str, Any] = {}

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_body.update(json)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = self._make_gemini_ok_response("ok")
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            await proxy_chat_completion(
                route=gemini_route,
                token="test-token",
                request_body={
                    "model": "gemini-2.0-flash",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 256,
                },
                stream=False,
            )

        assert captured_body.get("generationConfig", {}).get("maxOutputTokens") == 256

    @pytest.mark.asyncio
    async def test_401_from_gemini_invalidates_token_cache(
        self, gemini_route: SubscriptionRoute
    ) -> None:
        """A 401 from upstream triggers token cache invalidation."""

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.status_code = 401
            mock_resp.text = "Unauthorized"
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            with patch(
                "opta_lmx.proxy.subscription_proxy.invalidate_token"
            ) as mock_invalidate:
                status, resp, stream = await proxy_chat_completion(
                    route=gemini_route,
                    token="expired-token",
                    request_body={
                        "model": "gemini-2.0-flash",
                        "messages": [{"role": "user", "content": "hi"}],
                    },
                    stream=False,
                )

        assert status == 401
        mock_invalidate.assert_called_once_with(gemini_route.provider_id)


# ─── Copilot proxy tests ──────────────────────────────────────────────────────


class TestCopilotProxy:
    """Tests for GitHub Copilot OpenAI-compatible proxy path."""

    @pytest.mark.asyncio
    async def test_copilot_request_includes_required_headers(
        self, copilot_route: SubscriptionRoute
    ) -> None:
        """All required Copilot headers are sent in the upstream request."""
        captured_headers: dict[str, str] = {}

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_headers.update(headers)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "id": "chatcmpl-abc",
                "object": "chat.completion",
                "created": 1,
                "model": "gpt-4o",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "Hi!"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            }
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            status, resp, stream = await proxy_chat_completion(
                route=copilot_route,
                token="ghp_my_copilot_token",
                request_body={
                    "model": "gpt-4o",
                    "messages": [{"role": "user", "content": "Hello Copilot"}],
                },
                stream=False,
            )

        assert status == 200
        assert captured_headers["Authorization"] == "Bearer ghp_my_copilot_token"
        assert captured_headers["Copilot-Integration-Id"] == "vscode-chat"
        assert "Editor-Version" in captured_headers
        assert "OpenAI-Intent" in captured_headers

    @pytest.mark.asyncio
    async def test_copilot_url_targets_correct_endpoint(
        self, copilot_route: SubscriptionRoute
    ) -> None:
        """Request is sent to the Copilot API base URL + /v1/chat/completions."""
        captured_url: list[str] = []

        async def _fake_post(url: str, headers: dict, json: dict, **kwargs: Any) -> MagicMock:
            captured_url.append(url)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "id": "chatcmpl-x",
                "object": "chat.completion",
                "created": 1,
                "model": "gpt-4o",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "ok"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {},
            }
            return mock_resp

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = _fake_post
            mock_client_cls.return_value = mock_client

            await proxy_chat_completion(
                route=copilot_route,
                token="token",
                request_body={
                    "model": "gpt-4o",
                    "messages": [{"role": "user", "content": "test"}],
                },
                stream=False,
            )

        assert len(captured_url) == 1
        assert captured_url[0] == "https://api.githubcopilot.com/v1/chat/completions"
