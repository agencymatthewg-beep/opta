"""SSE streaming utilities for OpenAI-compatible responses."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator

from opta_lmx.inference.schema import (
    ChatCompletionChunk,
    ChunkChoice,
    DeltaMessage,
    FunctionCallDelta,
    ToolCallDelta,
)
from opta_lmx.inference.tool_parser import StreamChunk

logger = logging.getLogger(__name__)


async def format_sse_stream(
    token_stream: AsyncIterator[str],
    request_id: str,
    model: str,
    max_tokens: int | None = None,
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
        max_tokens: Maximum tokens requested (used to determine finish_reason).

    Yields:
        SSE-formatted strings.
    """
    from opta_lmx.api.inference import _StreamEndMarker

    created = int(time.time())
    completion_tokens = 0
    hit_max_tokens = False

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
        async for item in token_stream:
            # Check for our end marker from _counting_stream
            if isinstance(item, _StreamEndMarker):
                completion_tokens = item.completion_tokens
                hit_max_tokens = item.hit_max_tokens
                continue
            completion_tokens += 1
            chunk = ChatCompletionChunk(
                id=request_id,
                created=created,
                model=model,
                choices=[
                    ChunkChoice(
                        delta=DeltaMessage(content=item),
                        finish_reason=None,
                    )
                ],
            )
            yield f"data: {chunk.model_dump_json()}\n\n"
    except Exception as e:
        logger.error(
            "stream_mid_generation_error",
            extra={"request_id": request_id, "error": str(e)},
        )
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

    # Determine finish_reason: use authoritative hit_max_tokens from end marker,
    # fall back to count-based check if marker was never received
    finish_reason = "stop"
    if hit_max_tokens or (max_tokens is not None and completion_tokens >= max_tokens):
        finish_reason = "length"

    # Final chunk: finish_reason depends on whether max_tokens was hit
    final_chunk = ChatCompletionChunk(
        id=request_id,
        created=created,
        model=model,
        choices=[
            ChunkChoice(
                delta=DeltaMessage(),
                finish_reason=finish_reason,
            )
        ],
    )
    yield f"data: {final_chunk.model_dump_json()}\n\n"

    # Done sentinel
    yield "data: [DONE]\n\n"


async def format_sse_tool_stream(
    chunk_stream: AsyncIterator[StreamChunk],
    request_id: str,
    model: str,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    """Convert a StreamChunk stream to OpenAI SSE format with tool call support.

    Like format_sse_stream but handles StreamChunk objects that may contain
    either content deltas or tool call deltas. Emits proper ``delta.tool_calls``
    in SSE chunks matching the OpenAI streaming tool call format.

    Args:
        chunk_stream: Async iterator yielding StreamChunk objects.
        request_id: Unique request ID (chatcmpl-xxx).
        model: Model ID for the response.
        max_tokens: Maximum tokens requested (used to determine finish_reason).

    Yields:
        SSE-formatted strings.
    """
    from opta_lmx.api.inference import _StreamEndMarker

    created = int(time.time())
    saw_tool_calls = False
    completion_tokens = 0
    hit_max_tokens = False

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

    try:
        async for stream_chunk in chunk_stream:
            # Check for end marker from _counting_stream
            if isinstance(stream_chunk, _StreamEndMarker):
                completion_tokens = stream_chunk.completion_tokens
                hit_max_tokens = stream_chunk.hit_max_tokens
                continue

            if stream_chunk.content is not None:
                completion_tokens += 1
                chunk = ChatCompletionChunk(
                    id=request_id,
                    created=created,
                    model=model,
                    choices=[
                        ChunkChoice(
                            delta=DeltaMessage(content=stream_chunk.content),
                            finish_reason=None,
                        )
                    ],
                )
                yield f"data: {chunk.model_dump_json()}\n\n"

            elif stream_chunk.tool_call_delta is not None:
                saw_tool_calls = True
                tc = stream_chunk.tool_call_delta
                chunk = ChatCompletionChunk(
                    id=request_id,
                    created=created,
                    model=model,
                    choices=[
                        ChunkChoice(
                            delta=DeltaMessage(
                                tool_calls=[
                                    ToolCallDelta(
                                        index=tc.index,
                                        id=tc.id,
                                        type="function" if tc.id else None,
                                        function=FunctionCallDelta(
                                            name=tc.name,
                                            arguments=tc.arguments_delta,
                                        ),
                                    )
                                ],
                            ),
                            finish_reason=None,
                        )
                    ],
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
    except Exception as e:
        logger.error(
            "stream_mid_generation_error",
            extra={"request_id": request_id, "error": str(e)},
        )
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

    # Determine finish_reason: check max_tokens first, then tool_calls
    if saw_tool_calls:
        finish_reason = "tool_calls"
    elif hit_max_tokens or (max_tokens is not None and completion_tokens >= max_tokens):
        finish_reason = "length"
    else:
        finish_reason = "stop"

    final_chunk = ChatCompletionChunk(
        id=request_id,
        created=created,
        model=model,
        choices=[
            ChunkChoice(
                delta=DeltaMessage(),
                finish_reason=finish_reason,
            )
        ],
    )
    yield f"data: {final_chunk.model_dump_json()}\n\n"

    yield "data: [DONE]\n\n"
