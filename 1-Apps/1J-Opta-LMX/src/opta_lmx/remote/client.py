"""Remote helper client — proxies embedding/reranking to LAN devices.

Uses httpx.AsyncClient with connection pooling for efficient LAN communication.
Each client targets a single remote endpoint (embedding OR reranking).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from opta_lmx.config import RemoteHelperEndpoint

logger = logging.getLogger(__name__)


class RemoteHelperClient:
    """Async HTTP client for a remote helper endpoint.

    Provides connection-pooled, timeout-aware requests to a remote
    OpenAI-compatible embedding or reranking endpoint on the LAN.
    """

    def __init__(self, config: RemoteHelperEndpoint) -> None:
        self._config = config
        self._client = httpx.AsyncClient(
            base_url=config.url,
            timeout=httpx.Timeout(config.timeout_sec, connect=5.0),
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
        )
        self._healthy = True
        logger.info("remote_helper_created", extra={
            "url": config.url, "model": config.model, "timeout": config.timeout_sec,
        })

    @property
    def url(self) -> str:
        """Base URL of the remote endpoint."""
        return self._config.url

    @property
    def model(self) -> str:
        """Model name configured for this remote endpoint."""
        return self._config.model

    @property
    def fallback(self) -> str:
        """Fallback strategy: 'local' or 'skip'."""
        return self._config.fallback

    @property
    def is_healthy(self) -> bool:
        """Whether the last request succeeded."""
        return self._healthy

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Send an embedding request to the remote endpoint.

        Args:
            texts: List of texts to embed.

        Returns:
            List of embedding vectors.

        Raises:
            RemoteHelperError: If the request fails and fallback is 'skip'.
        """
        payload: dict[str, Any] = {
            "input": texts,
            "model": self._config.model,
        }

        try:
            resp = await self._client.post("/v1/embeddings", json=payload)
            resp.raise_for_status()
            data = resp.json()
            self._healthy = True

            embeddings = [item["embedding"] for item in data["data"]]
            logger.info("remote_embed_success", extra={
                "url": self._config.url,
                "count": len(texts),
                "dimensions": len(embeddings[0]) if embeddings else 0,
            })
            return embeddings
        except Exception as e:
            self._healthy = False
            logger.error("remote_embed_failed", extra={
                "url": self._config.url,
                "error": str(e),
                "fallback": self._config.fallback,
            })
            raise RemoteHelperError(
                f"Remote embedding failed at {self._config.url}: {e}",
                fallback=self._config.fallback,
            ) from e

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        """Send a reranking request to the remote endpoint.

        Args:
            query: The search query.
            documents: Documents to rerank.
            top_n: Maximum results to return.

        Returns:
            List of reranked results with index and relevance_score.

        Raises:
            RemoteHelperError: If the request fails.
        """
        payload: dict[str, Any] = {
            "model": self._config.model,
            "query": query,
            "documents": documents,
        }
        if top_n is not None:
            payload["top_n"] = top_n

        try:
            resp = await self._client.post("/v1/rerank", json=payload)
            resp.raise_for_status()
            data = resp.json()
            self._healthy = True

            results = data.get("results", [])
            logger.info("remote_rerank_success", extra={
                "url": self._config.url,
                "doc_count": len(documents),
                "result_count": len(results),
            })
            return results
        except Exception as e:
            self._healthy = False
            logger.error("remote_rerank_failed", extra={
                "url": self._config.url,
                "error": str(e),
                "fallback": self._config.fallback,
            })
            raise RemoteHelperError(
                f"Remote reranking failed at {self._config.url}: {e}",
                fallback=self._config.fallback,
            ) from e

    async def health_check(self) -> bool:
        """Check if the remote endpoint is reachable.

        Returns:
            True if the endpoint responds, False otherwise.
        """
        try:
            resp = await self._client.get("/health")
            self._healthy = resp.status_code < 500
            return self._healthy
        except Exception:
            self._healthy = False
            return False

    async def close(self) -> None:
        """Close the HTTP client and release connections."""
        await self._client.aclose()
        logger.info("remote_helper_closed", extra={"url": self._config.url})


class RemoteHelperError(Exception):
    """Raised when a remote helper request fails."""

    def __init__(self, message: str, fallback: str = "skip") -> None:
        super().__init__(message)
        self.fallback = fallback
