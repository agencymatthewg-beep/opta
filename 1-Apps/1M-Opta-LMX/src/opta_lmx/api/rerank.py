"""Reranking API route — /v1/rerank endpoint.

Supports helper node proxy for reranking on LAN devices.
When a helper node reranking endpoint is configured, requests are proxied
to the LAN device first. On failure, falls back to error based on fallback
strategy.

Compatible with Cohere/Jina reranking API format.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.deps import RemoteReranking
from opta_lmx.api.errors import openai_error
from opta_lmx.helpers.client import HelperNodeError

logger = logging.getLogger(__name__)

router = APIRouter()


class RerankRequest(BaseModel):
    """Reranking request — Cohere/Jina compatible."""

    model: str = Field(..., description="Reranking model ID")
    query: str = Field(..., min_length=1, description="Search query")
    documents: list[str] = Field(..., min_length=1, description="Documents to rerank")
    top_n: int | None = Field(None, ge=1, description="Max results to return")


class RerankDocument(BaseModel):
    """Document reference in rerank result."""

    text: str


class RerankResult(BaseModel):
    """Single reranking result."""

    index: int
    relevance_score: float
    document: RerankDocument


class RerankUsage(BaseModel):
    """Token usage for reranking."""

    total_tokens: int


class RerankResponse(BaseModel):
    """Reranking response — Cohere/Jina compatible."""

    results: list[RerankResult]
    model: str
    usage: RerankUsage


@router.post("/v1/rerank", response_model=None)
async def rerank_documents(body: RerankRequest, remote_client: RemoteReranking) -> Response:
    """Rerank documents by relevance to a query.

    Compatible with Cohere/Jina reranking API format.

    Resolution order:
    1. Remote reranking helper (if configured) — proxies to LAN device
    2. Returns error if no reranking backend is available
    """
    if not body.documents:
        return openai_error(
            status_code=400,
            message="Documents list must not be empty",
            error_type="invalid_request_error",
            code="invalid_input",
        )

    if not body.query.strip():
        return openai_error(
            status_code=400,
            message="Query must not be empty",
            error_type="invalid_request_error",
            code="invalid_input",
        )

    # Clamp top_n to document count
    top_n = body.top_n
    if top_n is not None and top_n > len(body.documents):
        top_n = len(body.documents)

    # Try helper node if configured
    if remote_client is not None:
        try:
            results = await remote_client.rerank(
                query=body.query,
                documents=body.documents,
                top_n=top_n,
            )

            # Estimate tokens (query + all docs, ~4 chars per token)
            total_chars = len(body.query) + sum(len(d) for d in body.documents)
            est_tokens = max(1, total_chars // 4)

            return JSONResponse(content=RerankResponse(
                results=[
                    RerankResult(
                        index=r["index"],
                        relevance_score=r["relevance_score"],
                        document=RerankDocument(text=body.documents[r["index"]]),
                    )
                    for r in results
                ],
                model=remote_client.model,
                usage=RerankUsage(total_tokens=est_tokens),
            ).model_dump())
        except HelperNodeError as e:
            if e.fallback == "skip":
                return openai_error(
                    status_code=502,
                    message=f"Helper node reranking failed: {e}",
                    error_type="server_error",
                    code="helper_node_unavailable",
                )
            # fallback == "local" — fall through to local (not yet implemented)
            logger.info("helper_node_rerank_fallback_to_local", extra={
                "remote_url": remote_client.url,
                "reason": str(e),
            })

    # No local reranking engine available yet
    return openai_error(
        status_code=503,
        message=(
            "Reranking engine not available. "
            "Configure helper_nodes.reranking in config.yaml."
        ),
        error_type="server_error",
        code="reranking_unavailable",
    )
