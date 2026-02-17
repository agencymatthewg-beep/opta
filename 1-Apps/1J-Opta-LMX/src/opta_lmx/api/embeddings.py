"""Embeddings API route — OpenAI-compatible /v1/embeddings endpoint."""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.errors import internal_error, openai_error

logger = logging.getLogger(__name__)

router = APIRouter()


class EmbeddingRequest(BaseModel):
    """OpenAI-compatible embedding request."""

    input: str | list[str] = Field(..., description="Text(s) to embed")
    model: str = Field(..., description="Embedding model ID")
    encoding_format: str = Field("float", description="Output format: float or base64")


class EmbeddingData(BaseModel):
    """Single embedding result."""

    object: str = "embedding"
    embedding: list[float]
    index: int


class EmbeddingUsage(BaseModel):
    """Token usage for embedding request."""

    prompt_tokens: int
    total_tokens: int


class EmbeddingResponse(BaseModel):
    """OpenAI-compatible embedding response."""

    object: str = "list"
    data: list[EmbeddingData]
    model: str
    usage: EmbeddingUsage


@router.post("/v1/embeddings", response_model=None)
async def create_embeddings(body: EmbeddingRequest, request: Request) -> Response:
    """Generate embeddings for input text(s).

    OpenAI API compatible — works with the standard openai Python SDK.
    Lazy-loads the embedding model on first request if not pre-loaded.
    """
    embedding_engine = getattr(request.app.state, "embedding_engine", None)
    if embedding_engine is None:
        return openai_error(
            status_code=503,
            message="Embedding engine not available. Add mlx-embeddings to dependencies.",
            error_type="server_error",
            code="embedding_unavailable",
        )

    # Normalize input to list
    texts: list[str] = [body.input] if isinstance(body.input, str) else body.input

    if not texts:
        return openai_error(
            status_code=400,
            message="Input must not be empty",
            error_type="invalid_request_error",
            code="invalid_input",
        )

    try:
        vectors = await embedding_engine.embed(texts, model_id=body.model)
    except RuntimeError as e:
        error_msg = str(e)
        if "No embedding model loaded" in error_msg:
            return openai_error(
                status_code=404,
                message=f"Embedding model '{body.model}' not available",
                error_type="invalid_request_error",
                code="model_not_found",
            )
        return internal_error(error_msg)

    # Approximate token count (4 chars ~ 1 token)
    total_chars = sum(len(t) for t in texts)
    est_tokens = max(1, total_chars // 4)

    return JSONResponse(content=EmbeddingResponse(
        data=[
            EmbeddingData(embedding=vec, index=i)
            for i, vec in enumerate(vectors)
        ],
        model=embedding_engine.model_id or body.model,
        usage=EmbeddingUsage(prompt_tokens=est_tokens, total_tokens=est_tokens),
    ).model_dump())
