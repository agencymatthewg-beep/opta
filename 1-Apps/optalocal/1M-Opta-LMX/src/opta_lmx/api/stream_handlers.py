"""Streaming handlers for inference endpoints."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from opta_lmx.api.deps import Engine
from opta_lmx.inference.schema import ChatCompletionRequest, ChatMessage
from opta_lmx.inference.streaming import format_sse_stream, format_sse_tool_stream
from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric

logger = logging.getLogger(__name__)

@dataclass
class _StreamEndMarker:
    """Sentinel injected at the end of _counting_stream.

    Carries final token counts to the SSE formatter so it can emit
    accurate usage data (used by stream_options.include_usage).
    """

    completion_tokens: int
    hit_max_tokens: bool = False


async def _counting_stream(
    token_stream: AsyncIterator[str],
    model_id: str,
    start_time: float,
    prompt_tokens: int,
    metrics: MetricsCollector | None,
    client_id: str | None = None,
) -> AsyncIterator[str | _StreamEndMarker]:
    """Wrap a token stream to count tokens and record metrics when complete.

    Yields all tokens from the source stream, then a _StreamEndMarker with
    final completion_tokens so downstream SSE formatters can emit usage data.
    """
    completion_tokens = 0
    error_occurred = False
    try:
        async for token in token_stream:
            completion_tokens += 1
            yield token
    except Exception:
        error_occurred = True
        raise
    finally:
        if metrics is not None:
            metrics.record(RequestMetric(
                model_id=model_id,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                stream=True,
                error=error_occurred,
                client_id=client_id,
            ))
    # Only reached when stream completes without exception
    yield _StreamEndMarker(completion_tokens=completion_tokens)


async def _chat_completions_sse_stream_n(
    *,
    body: ChatCompletionRequest,
    engine: Engine,
    resolved_model: str,
    request_id: str,
    created: int,
    est_prompt_tokens: int,
    include_usage: bool,
    start_time: float,
    metrics: MetricsCollector,
    priority: str,
    client_id: str | None,
    include_logprobs_placeholder: bool,
) -> AsyncIterator[str]:
    """Emit chat SSE stream for multi-choice (`n>1`) requests."""
    from opta_lmx.inference.schema import ChatCompletionChunk, Usage

    usage_totals: dict[str, int] = {"prompt_tokens": 0, "completion_tokens": 0}
    try:
        for choice_index in range(body.n):
            token_stream = engine.stream_generate(
                model_id=resolved_model,
                messages=body.messages,
                temperature=body.temperature,
                max_tokens=body.max_tokens,
                top_p=body.top_p,
                stop=[body.stop] if isinstance(body.stop, str) else body.stop,
                tools=body.tools,
                response_format=body.response_format,
                frequency_penalty=body.frequency_penalty,
                presence_penalty=body.presence_penalty,
                priority=priority,
                num_ctx=body.num_ctx,
                client_id=client_id,
            )
            counted_stream = _counting_stream(
                token_stream,
                resolved_model,
                start_time,
                est_prompt_tokens,
                metrics=None,
                client_id=client_id,
            )

            if body.tools:
                chunk_stream = wrap_stream_with_tool_parsing(counted_stream, tools=body.tools)
                async for line in format_sse_tool_stream(
                    chunk_stream,
                    request_id,
                    resolved_model,
                    max_tokens=body.max_tokens,
                    include_usage=False,
                    prompt_tokens=est_prompt_tokens,
                    choice_index=choice_index,
                    emit_done=False,
                    usage_accumulator=usage_totals,
                    created=created,
                    include_logprobs_placeholder=include_logprobs_placeholder,
                ):
                    yield line
            else:
                async for line in format_sse_stream(
                    counted_stream,
                    request_id,
                    resolved_model,
                    max_tokens=body.max_tokens,
                    include_usage=False,
                    prompt_tokens=est_prompt_tokens,
                    choice_index=choice_index,
                    emit_done=False,
                    usage_accumulator=usage_totals,
                    created=created,
                    include_logprobs_placeholder=include_logprobs_placeholder,
                ):
                    yield line

        metrics.record(RequestMetric(
            model_id=resolved_model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=usage_totals["prompt_tokens"],
            completion_tokens=usage_totals["completion_tokens"],
            stream=True,
            client_id=client_id,
        ))

        if include_usage:
            total_tokens = usage_totals["prompt_tokens"] + usage_totals["completion_tokens"]
            usage_chunk = ChatCompletionChunk(
                id=request_id,
                created=created,
                model=resolved_model,
                choices=[],
                usage=Usage(
                    prompt_tokens=usage_totals["prompt_tokens"],
                    completion_tokens=usage_totals["completion_tokens"],
                    total_tokens=total_tokens,
                ),
            )
            yield f"data: {usage_chunk.model_dump_json()}\n\n"
    except Exception as e:
        logger.error("stream_error", extra={"model": resolved_model, "error": str(e)})
        metrics.record(RequestMetric(
            model_id=resolved_model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=usage_totals["prompt_tokens"],
            completion_tokens=usage_totals["completion_tokens"],
            stream=True,
            error=True,
            client_id=client_id,
        ))
    yield "data: [DONE]\n\n"


async def _legacy_completions_sse_stream(
    token_stream: AsyncIterator[str | _StreamEndMarker],
    request_id: str,
    model: str,
    *,
    max_tokens: int | None = None,
    prompt_tokens: int = 0,
    prefix_text: str = "",
    suffix_text: str = "",
    choice_index: int = 0,
    created: int | None = None,
    emit_done: bool = True,
    usage_accumulator: dict[str, int] | None = None,
) -> AsyncIterator[str]:
    """Convert token stream to legacy /v1/completions SSE format."""
    if created is None:
        created = int(time.time())
    completion_tokens = 0
    hit_max_tokens = False

    first_chunk = {
        "id": request_id,
        "object": "text_completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "text": prefix_text,
                "index": choice_index,
                "logprobs": None,
                "finish_reason": None,
            }
        ],
    }
    yield f"data: {json.dumps(first_chunk)}\n\n"

    try:
        async for item in token_stream:
            if isinstance(item, _StreamEndMarker):
                completion_tokens = item.completion_tokens
                hit_max_tokens = item.hit_max_tokens
                continue
            chunk = {
                "id": request_id,
                "object": "text_completion",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "text": item,
                        "index": choice_index,
                        "logprobs": None,
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
    except Exception as e:
        logger.error(
            "legacy_completion_stream_error",
            extra={"request_id": request_id, "error": str(e)},
        )
        error_chunk = {
            "id": request_id,
            "object": "text_completion",
            "created": created,
            "model": model,
            "choices": [
                {
                    "text": f"\n\n[Error: {e}]",
                    "index": choice_index,
                    "logprobs": None,
                    "finish_reason": None,
                }
            ],
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"

    finish_reason = "stop"
    if hit_max_tokens or (max_tokens is not None and completion_tokens >= max_tokens):
        finish_reason = "length"

    final_chunk = {
        "id": request_id,
        "object": "text_completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "text": suffix_text,
                "index": choice_index,
                "logprobs": None,
                "finish_reason": finish_reason,
            }
        ],
    }
    yield f"data: {json.dumps(final_chunk)}\n\n"

    if usage_accumulator is not None:
        usage_accumulator["prompt_tokens"] = (
            usage_accumulator.get("prompt_tokens", 0) + prompt_tokens
        )
        usage_accumulator["completion_tokens"] = (
            usage_accumulator.get("completion_tokens", 0) + completion_tokens
        )

    if emit_done:
        yield "data: [DONE]\n\n"

async def _responses_sse_stream(
    engine: object,
    model_id: str,
    messages: list[ChatMessage],
    request_id: str,
    temperature: float,
    max_tokens: int | None,
    top_p: float,
    tools: list[dict] | None,
    priority: str = "normal",
    client_id: str | None = None,
) -> AsyncIterator[str]:
    """Emit SSE for the /v1/responses streaming endpoint.

    Uses named SSE events (``event: xxx``) matching OpenAI's Responses API format,
    enabling clients to distinguish created/delta/completed lifecycle events.
    For tool calls, emits output_item.added and function_call_arguments.delta events.
    """
    created_payload = json.dumps({"id": request_id, "object": "response", "status": "in_progress"})
    yield f"event: response.created\ndata: {created_payload}\n\n"

    token_stream = engine.stream_generate(  # type: ignore[union-attr]
        model_id=model_id,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        stop=None,
        tools=tools,
        response_format=None,
        priority=priority,
        client_id=client_id,
    )

    content_parts: list[str] = []
    tool_calls: dict[int, dict] = {}

    if tools:
        from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
        chunk_stream = wrap_stream_with_tool_parsing(token_stream, tools=tools)
        async for chunk in chunk_stream:
            if isinstance(chunk, _StreamEndMarker):
                continue
            if chunk.content is not None:
                content_parts.append(chunk.content)
                delta_data = json.dumps({"delta": chunk.content})
                yield f"event: response.output_text.delta\ndata: {delta_data}\n\n"
            elif chunk.tool_call_delta is not None:
                delta = chunk.tool_call_delta
                idx = delta.index
                if idx not in tool_calls:
                    tool_calls[idx] = {
                        "id": delta.id or f"call_{idx}",
                        "type": "function_call",
                        "name": delta.name or "",
                        "arguments": "",
                    }
                    item_data = json.dumps({"item": {
                        "type": "function_call",
                        "id": tool_calls[idx]["id"],
                        "name": delta.name,
                    }})
                    yield f"event: response.output_item.added\ndata: {item_data}\n\n"
                if delta.arguments_delta:
                    tool_calls[idx]["arguments"] += delta.arguments_delta
                    arg_data = json.dumps({
                        "item_id": tool_calls[idx]["id"],
                        "delta": delta.arguments_delta,
                    })
                    yield f"event: response.function_call_arguments.delta\ndata: {arg_data}\n\n"
    else:
        async for token in token_stream:
            if isinstance(token, _StreamEndMarker):
                continue
            content_parts.append(token)
            yield f"event: response.output_text.delta\ndata: {json.dumps({'delta': token})}\n\n"

    output_text = "".join(content_parts)
    output: list[dict] = []
    for idx in sorted(tool_calls.keys()):
        tc = tool_calls[idx]
        output.append({
            "type": "function_call",
            "id": tc["id"],
            "name": tc["name"],
            "arguments": tc["arguments"],
        })

    completed_payload = json.dumps({
        "id": request_id,
        "object": "response",
        "status": "completed",
        "output_text": output_text or None,
        "output": output,
    })
    yield f"event: response.completed\ndata: {completed_payload}\n\n"
    yield "data: [DONE]\n\n"
