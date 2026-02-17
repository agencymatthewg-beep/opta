"""Tests for Model Stack: remote helper config, client, and stack endpoint."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# Helper to create httpx.Response with required request context
_DUMMY_REQUEST = httpx.Request("POST", "http://test")
from httpx import AsyncClient

from opta_lmx.config import LMXConfig, RemoteHelperEndpoint, RemoteHelpersConfig
from opta_lmx.remote.client import RemoteHelperClient, RemoteHelperError


# ─── Config Tests ────────────────────────────────────────────────────────────


class TestRemoteHelpersConfig:
    """Tests for RemoteHelpersConfig and RemoteHelperEndpoint validation."""

    def test_defaults_no_helpers(self) -> None:
        """Default config has no remote helpers configured."""
        config = LMXConfig()
        assert config.remote_helpers.embedding is None
        assert config.remote_helpers.reranking is None

    def test_embedding_endpoint_config(self) -> None:
        """Can configure a remote embedding endpoint."""
        endpoint = RemoteHelperEndpoint(
            url="http://192.168.188.20:1234",
            model="nomic-embed-text-v1.5",
        )
        assert endpoint.url == "http://192.168.188.20:1234"
        assert endpoint.model == "nomic-embed-text-v1.5"
        assert endpoint.timeout_sec == 10.0
        assert endpoint.fallback == "local"

    def test_reranking_endpoint_config(self) -> None:
        """Can configure a remote reranking endpoint with skip fallback."""
        endpoint = RemoteHelperEndpoint(
            url="http://192.168.188.21:1234",
            model="jina-reranker-v2-base",
            fallback="skip",
        )
        assert endpoint.fallback == "skip"

    def test_custom_timeout(self) -> None:
        """Timeout can be customized."""
        endpoint = RemoteHelperEndpoint(
            url="http://10.0.0.1:8080",
            model="test-model",
            timeout_sec=30.0,
        )
        assert endpoint.timeout_sec == 30.0

    def test_invalid_fallback_rejected(self) -> None:
        """Invalid fallback values are rejected."""
        with pytest.raises(Exception):
            RemoteHelperEndpoint(
                url="http://10.0.0.1:8080",
                model="test-model",
                fallback="retry",  # not "local" or "skip"
            )

    def test_full_config_with_helpers(self) -> None:
        """Full LMXConfig can include remote_helpers section."""
        config = LMXConfig(
            remote_helpers=RemoteHelpersConfig(
                embedding=RemoteHelperEndpoint(
                    url="http://192.168.188.20:1234",
                    model="nomic-embed",
                ),
            ),
        )
        assert config.remote_helpers.embedding is not None
        assert config.remote_helpers.embedding.model == "nomic-embed"
        assert config.remote_helpers.reranking is None


# ─── Client Tests ────────────────────────────────────────────────────────────


class TestRemoteHelperClient:
    """Tests for RemoteHelperClient HTTP operations."""

    @pytest.fixture
    def endpoint(self) -> RemoteHelperEndpoint:
        return RemoteHelperEndpoint(
            url="http://192.168.188.20:1234",
            model="nomic-embed-text-v1.5",
            timeout_sec=5.0,
            fallback="local",
        )

    @pytest.fixture
    def skip_endpoint(self) -> RemoteHelperEndpoint:
        return RemoteHelperEndpoint(
            url="http://192.168.188.21:1234",
            model="jina-reranker",
            timeout_sec=5.0,
            fallback="skip",
        )

    def test_client_properties(self, endpoint: RemoteHelperEndpoint) -> None:
        """Client exposes config properties."""
        client = RemoteHelperClient(endpoint)
        assert client.url == "http://192.168.188.20:1234"
        assert client.model == "nomic-embed-text-v1.5"
        assert client.fallback == "local"
        assert client.is_healthy is True

    @pytest.mark.asyncio
    async def test_embed_success(self, endpoint: RemoteHelperEndpoint) -> None:
        """Successful embed request returns vectors."""
        client = RemoteHelperClient(endpoint)

        mock_response = httpx.Response(
            200,
            json={
                "data": [
                    {"embedding": [0.1, 0.2, 0.3], "index": 0},
                    {"embedding": [0.4, 0.5, 0.6], "index": 1},
                ],
                "model": "nomic-embed-text-v1.5",
                "usage": {"prompt_tokens": 10, "total_tokens": 10},
            },
            request=_DUMMY_REQUEST,
        )

        client._client = AsyncMock()
        client._client.post = AsyncMock(return_value=mock_response)

        vectors = await client.embed(["hello", "world"])
        assert len(vectors) == 2
        assert vectors[0] == [0.1, 0.2, 0.3]
        assert vectors[1] == [0.4, 0.5, 0.6]
        assert client.is_healthy is True

    @pytest.mark.asyncio
    async def test_embed_failure_local_fallback(self, endpoint: RemoteHelperEndpoint) -> None:
        """Failed embed with local fallback raises RemoteHelperError with fallback='local'."""
        client = RemoteHelperClient(endpoint)

        client._client = AsyncMock()
        client._client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))

        with pytest.raises(RemoteHelperError) as exc_info:
            await client.embed(["test"])

        assert exc_info.value.fallback == "local"
        assert client.is_healthy is False

    @pytest.mark.asyncio
    async def test_embed_failure_skip_fallback(self, skip_endpoint: RemoteHelperEndpoint) -> None:
        """Failed embed with skip fallback raises RemoteHelperError with fallback='skip'."""
        client = RemoteHelperClient(skip_endpoint)

        client._client = AsyncMock()
        client._client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))

        with pytest.raises(RemoteHelperError) as exc_info:
            await client.embed(["test"])

        assert exc_info.value.fallback == "skip"

    @pytest.mark.asyncio
    async def test_rerank_success(self, skip_endpoint: RemoteHelperEndpoint) -> None:
        """Successful rerank request returns sorted results."""
        client = RemoteHelperClient(skip_endpoint)

        mock_response = httpx.Response(
            200,
            json={
                "results": [
                    {"index": 1, "relevance_score": 0.95},
                    {"index": 0, "relevance_score": 0.72},
                ],
            },
            request=_DUMMY_REQUEST,
        )

        client._client = AsyncMock()
        client._client.post = AsyncMock(return_value=mock_response)

        results = await client.rerank("query", ["doc1", "doc2"], top_n=2)
        assert len(results) == 2
        assert results[0]["relevance_score"] == 0.95
        assert client.is_healthy is True

    @pytest.mark.asyncio
    async def test_rerank_failure(self, skip_endpoint: RemoteHelperEndpoint) -> None:
        """Failed rerank raises RemoteHelperError."""
        client = RemoteHelperClient(skip_endpoint)

        client._client = AsyncMock()
        client._client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

        with pytest.raises(RemoteHelperError):
            await client.rerank("query", ["doc1"])

        assert client.is_healthy is False

    @pytest.mark.asyncio
    async def test_health_check_healthy(self, endpoint: RemoteHelperEndpoint) -> None:
        """Health check returns True for 200 response."""
        client = RemoteHelperClient(endpoint)

        mock_response = httpx.Response(200, json={"status": "ok"}, request=httpx.Request("GET", "http://test"))
        client._client = AsyncMock()
        client._client.get = AsyncMock(return_value=mock_response)

        assert await client.health_check() is True
        assert client.is_healthy is True

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self, endpoint: RemoteHelperEndpoint) -> None:
        """Health check returns False on connection error."""
        client = RemoteHelperClient(endpoint)

        client._client = AsyncMock()
        client._client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

        assert await client.health_check() is False
        assert client.is_healthy is False

    @pytest.mark.asyncio
    async def test_close(self, endpoint: RemoteHelperEndpoint) -> None:
        """Close shuts down the HTTP client."""
        client = RemoteHelperClient(endpoint)
        client._client = AsyncMock()
        client._client.aclose = AsyncMock()

        await client.close()
        client._client.aclose.assert_called_once()


# ─── Stack Endpoint Tests ────────────────────────────────────────────────────


async def test_stack_endpoint_empty(client: AsyncClient) -> None:
    """Stack endpoint returns empty roles when no aliases configured."""
    resp = await client.get("/admin/stack")
    assert resp.status_code == 200
    data = resp.json()
    assert "roles" in data
    assert "remote_helpers" in data
    assert "loaded_models" in data
    assert data["remote_helpers"] == {}


async def test_stack_endpoint_with_loaded_model(client: AsyncClient) -> None:
    """Stack endpoint shows loaded models and resolved roles."""
    app = client._transport.app  # type: ignore[union-attr]
    engine = app.state.engine

    # Load a mock model
    await engine.load_model("test/coding-model")

    # Configure routing alias
    from opta_lmx.config import RoutingConfig
    from opta_lmx.router.strategy import TaskRouter

    app.state.config.routing.aliases["coding"] = ["test/coding-model"]
    app.state.router = TaskRouter(app.state.config.routing)

    resp = await client.get("/admin/stack")
    assert resp.status_code == 200
    data = resp.json()

    assert "coding" in data["roles"]
    assert data["roles"]["coding"]["loaded"] is True
    assert data["roles"]["coding"]["resolved_model"] == "test/coding-model"
    assert "test/coding-model" in data["loaded_models"]


async def test_stack_endpoint_with_remote_helper(client: AsyncClient) -> None:
    """Stack endpoint shows remote helper status."""
    app = client._transport.app  # type: ignore[union-attr]

    # Inject a mock remote embedding client
    mock_remote = MagicMock()
    mock_remote.url = "http://192.168.188.20:1234"
    mock_remote.model = "nomic-embed-text-v1.5"
    mock_remote.is_healthy = True
    mock_remote.fallback = "local"
    app.state.remote_embedding = mock_remote

    resp = await client.get("/admin/stack")
    assert resp.status_code == 200
    data = resp.json()

    assert "embedding" in data["remote_helpers"]
    helper = data["remote_helpers"]["embedding"]
    assert helper["url"] == "http://192.168.188.20:1234"
    assert helper["model"] == "nomic-embed-text-v1.5"
    assert helper["healthy"] is True
    assert helper["fallback"] == "local"


# ─── Embeddings Remote Proxy Tests ───────────────────────────────────────────


async def test_embeddings_uses_remote_when_configured(client: AsyncClient) -> None:
    """Embedding endpoint proxies to remote helper when configured."""
    app = client._transport.app  # type: ignore[union-attr]

    # Create a mock remote embedding client
    mock_remote = AsyncMock(spec=RemoteHelperClient)
    mock_remote.embed = AsyncMock(return_value=[[0.1, 0.2, 0.3]])
    mock_remote.model = "nomic-embed"
    app.state.remote_embedding = mock_remote

    resp = await client.post("/v1/embeddings", json={
        "input": "hello world",
        "model": "nomic-embed",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["embedding"] == [0.1, 0.2, 0.3]
    assert data["model"] == "nomic-embed"
    mock_remote.embed.assert_called_once_with(["hello world"])


async def test_embeddings_fallback_to_local(client: AsyncClient) -> None:
    """Embedding endpoint falls back to local when remote fails with fallback='local'."""
    app = client._transport.app  # type: ignore[union-attr]

    # Remote that fails with local fallback
    mock_remote = AsyncMock(spec=RemoteHelperClient)
    mock_remote.embed = AsyncMock(
        side_effect=RemoteHelperError("Connection refused", fallback="local"),
    )
    mock_remote.url = "http://192.168.188.20:1234"
    app.state.remote_embedding = mock_remote

    # Mock local embedding engine
    mock_local = AsyncMock()
    mock_local.embed = AsyncMock(return_value=[[0.4, 0.5, 0.6]])
    mock_local.model_id = "local-embed"
    app.state.embedding_engine = mock_local

    resp = await client.post("/v1/embeddings", json={
        "input": "fallback test",
        "model": "local-embed",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["data"][0]["embedding"] == [0.4, 0.5, 0.6]


async def test_embeddings_skip_returns_502(client: AsyncClient) -> None:
    """Embedding endpoint returns 502 when remote fails with fallback='skip'."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=RemoteHelperClient)
    mock_remote.embed = AsyncMock(
        side_effect=RemoteHelperError("Connection refused", fallback="skip"),
    )
    app.state.remote_embedding = mock_remote

    resp = await client.post("/v1/embeddings", json={
        "input": "skip test",
        "model": "test-model",
    })

    assert resp.status_code == 502
