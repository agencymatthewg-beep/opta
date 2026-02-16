"""SSE streaming utilities for OpenAI-compatible responses."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator

from opta_lmx.inference.schema import ChatCompletionChunk, ChunkChoice, DeltaMessage

logger = logging.getLogger(__name__)


async def format_sse_stream(
    token_stream: AsyncIterator[str],
    request_id: str,
    model: str,
) -> AsyncIterator[str]:
    """Convert a token stream to OpenAI SSE format.

    Each line: 'data: {json}\\n\\n'
    Final line: 'data: [DONE]\\n\\n'

    Handles mid-stream errors gracefully by sending a finish chunk
    with reason 'stop' and then [DONE], rather than crashing.

    Args:
        token_stream: Async iterator yielding token strings.
        request_id: Unique request ID (chatcmpl-xxx).
        model: Model ID for the response.

    Yields:
        SSE-formatted strings.
    """
    created = int(time.time())

    # First chunk: send the role
    first_chunk = ChatCompletionChunk(
        id=request_id,
        created=created,
        model=model,
        choices=[
            ChunkChoice(
                delta=DeltaMessage(role="assistant", content=""),
                finish_reason=None,
            )
        ],
    )
    yield f"data: {first_chunk.model_dump_json()}\n\n"

    # Content chunks — wrapped in try/except for GUARDRAIL G-LMX-05
    try:
        async for token in token_stream:
            chunk = ChatCompletionChunk(
                id=request_id,
                created=created,
                model=model,
                choices=[
                    ChunkChoice(
                        delta=DeltaMessage(content=token),
                        finish_reason=None,
                    )
                ],
            )
            yield f"data: {chunk.model_dump_json()}\n\n"
    except Exception as e:
        logger.error("stream_mid_generation_error", extra={"request_id": request_id, "error": str(e)})
        # Can't send an HTTP error at this point (headers already sent).
        # Send an error content chunk so the client sees something, then close cleanly.
        error_chunk = ChatCompletionChunk(
            id=request_id,
            created=created,
            model=model,
            choices=[
                ChunkChoice(
                    delta=DeltaMessage(content=f"\n\n[Error: {e}]"),
                    finish_reason=None,
                )
            ],
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"

    # Final chunk: finish_reason = stop
    final_chunk = ChatCompletionChunk(
        id=request_id,
        created=created,
        model=model,
        choices=[
            ChunkChoice(
                delta=DeltaMessage(),
                finish_reason="stop",
            )
        ],
    )
    yield f"data: {final_chunk.model_dump_json()}\n\n"

    # Done sentinel
    yield "data: [DONE]\n\n"
