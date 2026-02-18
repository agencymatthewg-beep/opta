"""Tests for the /v1/rerank endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from opta_lmx.helpers.client import HelperNodeClient, HelperNodeError


async def test_rerank_no_backend(client: AsyncClient) -> None:
    """Returns 503 when no reranking backend is configured."""
    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker",
        "query": "what is Python",
        "documents": ["Python is a language", "Java is a language"],
    })
    assert resp.status_code == 503
    data = resp.json()
    assert data["error"]["code"] == "reranking_unavailable"


async def test_rerank_empty_query(client: AsyncClient) -> None:
    """Returns 400 for empty query."""
    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker",
        "query": "   ",
        "documents": ["doc1"],
    })
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_input"


async def test_rerank_remote_success(client: AsyncClient) -> None:
    """Reranking proxied to helper node returns sorted results."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=HelperNodeClient)
    mock_remote.rerank = AsyncMock(return_value=[
        {"index": 1, "relevance_score": 0.95},
        {"index": 0, "relevance_score": 0.72},
    ])
    mock_remote.model = "jina-reranker-v2-base"
    app.state.remote_reranking = mock_remote

    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker-v2-base",
        "query": "search query",
        "documents": ["doc one", "doc two"],
        "top_n": 2,
    })

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 2
    assert data["results"][0]["relevance_score"] == 0.95
    assert data["results"][0]["index"] == 1
    assert data["results"][0]["document"]["text"] == "doc two"
    assert data["results"][1]["relevance_score"] == 0.72
    assert data["model"] == "jina-reranker-v2-base"
    assert data["usage"]["total_tokens"] > 0
    mock_remote.rerank.assert_called_once_with(
        query="search query", documents=["doc one", "doc two"], top_n=2,
    )


async def test_rerank_remote_failure_skip(client: AsyncClient) -> None:
    """Remote failure with skip fallback returns 502."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=HelperNodeClient)
    mock_remote.rerank = AsyncMock(
        side_effect=HelperNodeError("Connection refused", fallback="skip"),
    )
    app.state.remote_reranking = mock_remote

    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker",
        "query": "test",
        "documents": ["doc1"],
    })
    assert resp.status_code == 502


async def test_rerank_remote_failure_local_fallback(client: AsyncClient) -> None:
    """Remote failure with local fallback falls through to 503 (no local engine yet)."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=HelperNodeClient)
    mock_remote.rerank = AsyncMock(
        side_effect=HelperNodeError("Connection refused", fallback="local"),
    )
    mock_remote.url = "http://192.168.188.21:1234"
    app.state.remote_reranking = mock_remote

    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker",
        "query": "test",
        "documents": ["doc1"],
    })
    # Falls through to 503 since no local reranking engine exists
    assert resp.status_code == 503


async def test_rerank_top_n_clamped(client: AsyncClient) -> None:
    """top_n is clamped to document count."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=HelperNodeClient)
    mock_remote.rerank = AsyncMock(return_value=[
        {"index": 0, "relevance_score": 0.9},
    ])
    mock_remote.model = "jina-reranker"
    app.state.remote_reranking = mock_remote

    resp = await client.post("/v1/rerank", json={
        "model": "jina-reranker",
        "query": "test",
        "documents": ["only one doc"],
        "top_n": 100,  # Much larger than doc count
    })

    assert resp.status_code == 200
    # Verify top_n was clamped to 1 (document count)
    mock_remote.rerank.assert_called_once_with(
        query="test", documents=["only one doc"], top_n=1,
    )


async def test_rerank_response_shape(client: AsyncClient) -> None:
    """Response includes all required fields in Cohere/Jina format."""
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = AsyncMock(spec=HelperNodeClient)
    mock_remote.rerank = AsyncMock(return_value=[
        {"index": 2, "relevance_score": 0.99},
        {"index": 0, "relevance_score": 0.85},
        {"index": 1, "relevance_score": 0.60},
    ])
    mock_remote.model = "test-reranker"
    app.state.remote_reranking = mock_remote

    resp = await client.post("/v1/rerank", json={
        "model": "test-reranker",
        "query": "machine learning",
        "documents": ["deep learning", "cooking recipes", "neural networks"],
    })

    assert resp.status_code == 200
    data = resp.json()

    # Top-level fields
    assert "results" in data
    assert "model" in data
    assert "usage" in data
    assert data["model"] == "test-reranker"
    assert data["usage"]["total_tokens"] > 0

    # Result shape
    for result in data["results"]:
        assert "index" in result
        assert "relevance_score" in result
        assert "document" in result
        assert "text" in result["document"]

    # Document text matches original
    assert data["results"][0]["document"]["text"] == "neural networks"
    assert data["results"][1]["document"]["text"] == "deep learning"
    assert data["results"][2]["document"]["text"] == "cooking recipes"
