"""Inference API routes — OpenAI-compatible /v1/* endpoints."""

from __future__ import annotations

import json
import logging
import secrets
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.deps import Embeddings, Engine, Metrics, Presets, Router, verify_inference_key
from opta_lmx.api.errors import internal_error, model_not_found, openai_error
from opta_lmx.api.rate_limit import _chat_completions_limit, limiter
from opta_lmx.inference.context import estimate_prompt_tokens as _estimate_prompt_tokens
from opta_lmx.inference.schema import (
    ChatCompletionRequest,
    ChatMessage,
    ErrorResponse,
    ModelObject,
    ModelsListResponse,
)
from opta_lmx.inference.streaming import format_sse_stream, format_sse_tool_stream
from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric
from opta_lmx.presets.manager import PRESET_PREFIX

logger = logging.getLogger(__name__)


class LegacyCompletionRequest(BaseModel):
    """OpenAI-compatible legacy text completion request."""

    model: str
    prompt: str | list[str]
    suffix: str | None = None
    max_tokens: int | None = None
    temperature: float = Field(0.7, ge=0, le=2.0)
    top_p: float = Field(1.0, ge=0, le=1.0)
    n: int = Field(1, ge=1, le=16)
    stream: bool = False
    logprobs: int | None = Field(None, ge=0, le=20)
    echo: bool = False
    stop: str | list[str] | None = None
    presence_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    best_of: int | None = Field(None, ge=1, le=20)
    user: str | None = None
    seed: int | None = None
    # Opta extension parity with chat completions
    num_ctx: int | None = Field(None, ge=512, le=131072)


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


def _chat_stream_include_logprobs_placeholder(body: ChatCompletionRequest) -> bool:
    """Whether streaming chunks should expose `choices[].logprobs: null`."""
    return bool(body.logprobs or body.top_logprobs is not None)


def _parse_responses_max_tokens(body: dict[str, object]) -> tuple[int | None, str | None]:
    """Resolve `max_output_tokens`/`max_tokens` with OpenAI-style compatibility."""
    if "max_output_tokens" in body:
        raw = body.get("max_output_tokens")
        param = "max_output_tokens"
    else:
        raw = body.get("max_tokens")
        param = "max_tokens" if "max_tokens" in body else None

    if raw is None or param is None:
        return None, None
    if isinstance(raw, bool):
        return None, param
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, param
    if value <= 0:
        return None, param
    return value, None


def _normalize_responses_content_parts(parts: list[object]) -> list[dict[str, object]]:
    """Normalize Responses API content parts into ChatMessage multimodal parts."""
    normalized: list[dict[str, object]] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        part_type = part.get("type")
        if part_type in {"input_text", "text"}:
            text = part.get("text")
            if isinstance(text, str):
                normalized.append({"type": "text", "text": text})
        elif part_type in {"input_image", "image_url"}:
            image_data = part.get("image_url")
            if image_data is None:
                image_data = part.get("image")
            if isinstance(image_data, str):
                normalized.append({
                    "type": "image_url",
                    "image_url": {"url": image_data, "detail": "auto"},
                })
            elif isinstance(image_data, dict):
                url = image_data.get("url")
                if isinstance(url, str):
                    detail = image_data.get("detail")
                    payload: dict[str, object] = {"url": url}
                    if isinstance(detail, str):
                        payload["detail"] = detail
                    normalized.append({"type": "image_url", "image_url": payload})
    return normalized


def _parse_responses_input_messages(input_payload: object) -> list[ChatMessage]:
    """Parse Responses API `input` into ChatMessage list.

    Supported forms:
    - string
    - list[string]
    - list[{role, content}] where content is string or content-parts list
    """
    if isinstance(input_payload, str):
        return [ChatMessage(role="user", content=input_payload)]

    if isinstance(input_payload, dict):
        items: list[object] = [input_payload]
    elif isinstance(input_payload, list):
        items = list(input_payload)
    else:
        raise ValueError("Field 'input' must be a string, object, or array.")

    messages: list[ChatMessage] = []
    for item in items:
        if isinstance(item, str):
            messages.append(ChatMessage(role="user", content=item))
            continue
        if not isinstance(item, dict):
            raise ValueError("Field 'input' contains an invalid item type.")

        role = item.get("role", "user")
        if not isinstance(role, str):
            raise ValueError("Field 'input.role' must be a string.")

        content = item.get("content", "")
        if isinstance(content, str) or content is None:
            messages.append(ChatMessage(role=role, content=content or ""))
            continue
        if isinstance(content, list):
            normalized = _normalize_responses_content_parts(content)
            messages.append(ChatMessage(role=role, content=normalized or ""))
            continue

        raise ValueError("Field 'input.content' must be a string or content-parts array.")

    if not messages:
        raise ValueError("Field 'input' must not be empty.")
    return messages

router = APIRouter(dependencies=[Depends(verify_inference_key)])


@router.post(
    "/v1/chat/completions",
    response_model=None,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
@limiter.limit(_chat_completions_limit)
async def chat_completions(
    request: Request,
    body: ChatCompletionRequest,
    engine: Engine,
    task_router: Router,
    metrics: Metrics,
    preset_mgr: Presets,
    x_client_id: str | None = Header(None),
    x_openclaw_agent_id: str | None = Header(None),
    x_priority: str | None = Header(None),
) -> Response:
    """OpenAI-compatible chat completion.

    Supports both streaming (SSE) and non-streaming modes.
    """
    # Resolve preset (e.g. "preset:code-assistant") — applies defaults + swaps model ID
    if body.model.startswith(PRESET_PREFIX):
        preset_name = body.model[len(PRESET_PREFIX):]
        preset = preset_mgr.get(preset_name)
        if preset is None:
            return model_not_found(body.model)
        body = preset_mgr.apply(preset, body)

    # Resolve alias (e.g. "auto", "code") to a real loaded model ID
    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    resolved_model = task_router.resolve(body.model, loaded_ids)

    # Check model is loaded
    if not engine.is_model_loaded(resolved_model):
        return model_not_found(body.model)
    start_time = time.monotonic()
    priority = x_priority or "normal"
    # x-openclaw-agent-id is the OpenClaw equivalent of X-Client-ID
    effective_client_id = x_client_id or x_openclaw_agent_id

    if body.stream:
        request_id = f"chatcmpl-{secrets.token_urlsafe(16)}"
        created = int(time.time())
        include_logprobs_placeholder = _chat_stream_include_logprobs_placeholder(body)
        try:
            # Approximate prompt tokens for metrics (4 chars ≈ 1 token)
            est_prompt_tokens = max(1, _estimate_prompt_tokens(body.messages))
            include_usage = bool(
                body.stream_options and body.stream_options.get("include_usage")
            )

            if body.n > 1:
                return StreamingResponse(
                    _chat_completions_sse_stream_n(
                        body=body,
                        engine=engine,
                        resolved_model=resolved_model,
                        request_id=request_id,
                        created=created,
                        est_prompt_tokens=est_prompt_tokens,
                        include_usage=include_usage,
                        start_time=start_time,
                        metrics=metrics,
                        priority=priority,
                        client_id=effective_client_id,
                        include_logprobs_placeholder=include_logprobs_placeholder,
                    ),
                    media_type="text/event-stream",
                )

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
                client_id=effective_client_id,
            )
            # Wrap stream to count tokens and record final metrics
            counted_stream = _counting_stream(
                token_stream, resolved_model, start_time, est_prompt_tokens, metrics,
                client_id=effective_client_id,
            )

            if body.tools:
                # Parse MiniMax XML tool calls from the token stream
                chunk_stream = wrap_stream_with_tool_parsing(
                    counted_stream, tools=body.tools,
                )
                sse_stream = format_sse_tool_stream(
                    chunk_stream, request_id, resolved_model,
                    include_usage=include_usage, prompt_tokens=est_prompt_tokens,
                    created=created,
                    include_logprobs_placeholder=include_logprobs_placeholder,
                )
            else:
                sse_stream = format_sse_stream(
                    counted_stream, request_id, resolved_model,
                    include_usage=include_usage, prompt_tokens=est_prompt_tokens,
                    created=created,
                    include_logprobs_placeholder=include_logprobs_placeholder,
                )
            return StreamingResponse(sse_stream, media_type="text/event-stream")
        except Exception as e:
            logger.error("stream_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=True, error=True,
                client_id=effective_client_id,
            ))
            return internal_error(str(e))
    else:
        try:
            response = await engine.generate(
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
                client_id=effective_client_id,
            )
            choices = [response.choices[0].model_dump()]
            prompt_tokens_total = response.usage.prompt_tokens
            completion_tokens_total = response.usage.completion_tokens

            for idx in range(1, body.n):
                alt = await engine.generate(
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
                    client_id=effective_client_id,
                )
                choice = alt.choices[0].model_dump()
                choice["index"] = idx
                choices.append(choice)
                prompt_tokens_total += alt.usage.prompt_tokens
                completion_tokens_total += alt.usage.completion_tokens

            # Compatibility: accept logprobs/top_logprobs requests, returning null
            # placeholders when backend token-level stats are unavailable.
            if body.logprobs or body.top_logprobs is not None:
                for choice in choices:
                    choice["logprobs"] = None

            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=prompt_tokens_total,
                completion_tokens=completion_tokens_total,
                stream=False,
                client_id=effective_client_id,
            ))
            payload = response.model_dump()
            payload["choices"] = choices
            payload["usage"] = {
                "prompt_tokens": prompt_tokens_total,
                "completion_tokens": completion_tokens_total,
                "total_tokens": prompt_tokens_total + completion_tokens_total,
            }
            return JSONResponse(content=payload)
        except RuntimeError as e:
            err_msg = str(e)
            if "Server is busy" in err_msg:
                metrics.record(RequestMetric(
                    model_id=resolved_model,
                    latency_sec=time.monotonic() - start_time,
                    prompt_tokens=0, completion_tokens=0,
                    stream=False, error=True,
                    client_id=effective_client_id,
                ))
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "message": err_msg,
                            "type": "server_error",
                            "code": "rate_limit_exceeded",
                        },
                    },
                    headers={"Retry-After": "5"},
                )
            logger.error("completion_error", extra={"model": resolved_model, "error": err_msg})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=False, error=True,
                client_id=effective_client_id,
            ))
            return internal_error(err_msg)
        except Exception as e:
            logger.error("completion_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=False, error=True,
                client_id=effective_client_id,
            ))
            return internal_error(str(e))

@router.get("/v1/models")
async def list_models(engine: Engine, embedding_engine: Embeddings) -> ModelsListResponse:
    """List all loaded models in OpenAI format.

    Includes both inference models and the embedding model (if loaded).
    """
    data: list[ModelObject] = [
        ModelObject(
            id=m.model_id,
            object="model",
            created=int(m.loaded_at),
            owned_by="local",
        )
        for m in engine.get_loaded_models()
    ]

    # Include embedding model if loaded
    if embedding_engine is not None and embedding_engine.is_loaded:
        info = embedding_engine.get_info()
        data.append(ModelObject(
            id=info["model_id"],
            object="model",
            created=int(info.get("loaded_at") or 0),
            owned_by="local-embedding",
        ))

    return ModelsListResponse(object="list", data=data)


@router.get("/v1/models/{model_id}", response_model=None)
async def get_model(model_id: str, engine: Engine, embedding_engine: Embeddings) -> Response:
    """Return a single model object by ID.

    Returns 404 if the model is not currently loaded.
    """
    for m in engine.get_loaded_models():
        if m.model_id == model_id:
            return JSONResponse(content=ModelObject(
                id=m.model_id,
                object="model",
                created=int(m.loaded_at),
                owned_by="local",
            ).model_dump())

    if embedding_engine is not None and embedding_engine.is_loaded:
        info = embedding_engine.get_info()
        if info.get("model_id") == model_id:
            return JSONResponse(content=ModelObject(
                id=info["model_id"],
                object="model",
                created=int(info.get("loaded_at") or 0),
                owned_by="local-embedding",
            ).model_dump())

    return model_not_found(model_id)


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


@router.post("/v1/responses", response_model=None)
async def responses_endpoint(
    request: Request,
    engine: Engine,
    task_router: Router,
    x_client_id: str | None = Header(None),
    x_openclaw_agent_id: str | None = Header(None),
    x_priority: str | None = Header(None),
) -> Response:
    """OpenAI Responses API — simplified single-turn endpoint.

    Accepts ``input`` (string) in place of ``messages``, returning a response
    object with ``output_text``. Supports both streaming (SSE with named events)
    and non-streaming modes.
    """
    try:
        body = await request.json()
    except Exception:
        return openai_error(
            status_code=400,
            message="Invalid JSON body.",
            error_type="invalid_request_error",
            code="invalid_json",
        )

    model_id: str = body.get("model", "")
    input_payload = body.get("input", "")
    stream: bool = bool(body.get("stream", False))
    temperature: float = float(body.get("temperature", 0.7))
    max_tokens, max_tokens_param_error = _parse_responses_max_tokens(body)
    top_p: float = float(body.get("top_p", 1.0))
    tools: list[dict] | None = body.get("tools")

    if max_tokens_param_error is not None:
        return openai_error(
            status_code=400,
            message=(
                f"Invalid value for '{max_tokens_param_error}'. "
                "Expected a positive integer."
            ),
            error_type="invalid_request_error",
            param=max_tokens_param_error,
            code="invalid_input",
        )

    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    resolved_model = task_router.resolve(model_id, loaded_ids)
    priority = x_priority or "normal"
    effective_client_id = x_client_id or x_openclaw_agent_id

    if not engine.is_model_loaded(resolved_model):
        return model_not_found(model_id)

    try:
        messages = _parse_responses_input_messages(input_payload)
    except ValueError as e:
        return openai_error(
            status_code=400,
            message=str(e),
            error_type="invalid_request_error",
            param="input",
            code="invalid_input",
        )
    request_id = f"resp-{secrets.token_urlsafe(16)}"

    if stream:
        sse = _responses_sse_stream(
            engine=engine,
            model_id=resolved_model,
            messages=messages,
            request_id=request_id,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            tools=tools,
            priority=priority,
            client_id=effective_client_id,
        )
        return StreamingResponse(sse, media_type="text/event-stream")

    # Non-streaming: call generate and return response object
    try:
        response = await engine.generate(
            model_id=resolved_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stop=None,
            tools=tools,
            response_format=None,
            priority=priority,
            client_id=effective_client_id,
        )
        output_text = response.choices[0].message.content or ""
        return JSONResponse(content={
            "id": request_id,
            "object": "response",
            "status": "completed",
            "output_text": output_text,
            "output": [],
        })
    except RuntimeError as e:
        err_msg = str(e)
        if "Server is busy" in err_msg:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "message": err_msg,
                        "type": "server_error",
                        "code": "rate_limit_exceeded",
                    },
                },
                headers={"Retry-After": "5"},
            )
        logger.error("responses_error", extra={"model": resolved_model, "error": err_msg})
        return internal_error(err_msg)
    except Exception as e:
        logger.error("responses_error", extra={"model": resolved_model, "error": str(e)})
        return internal_error(str(e))


@router.post("/v1/completions", response_model=None)
@limiter.limit(_chat_completions_limit)
async def legacy_completions(
    request: Request,
    body: LegacyCompletionRequest,
    engine: Engine,
    task_router: Router,
    metrics: Metrics,
    x_client_id: str | None = Header(None),
    x_openclaw_agent_id: str | None = Header(None),
    x_priority: str | None = Header(None),
) -> Response:
    """OpenAI-compatible legacy /v1/completions endpoint."""
    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    resolved_model = task_router.resolve(body.model, loaded_ids)
    if not engine.is_model_loaded(resolved_model):
        return model_not_found(body.model)

    prompts = [body.prompt] if isinstance(body.prompt, str) else body.prompt
    if not prompts:
        return openai_error(
            status_code=400,
            message="Prompt must not be empty",
            error_type="invalid_request_error",
            param="prompt",
            code="invalid_input",
        )

    priority = x_priority or "normal"
    effective_client_id = x_client_id or x_openclaw_agent_id or body.user
    stop = [body.stop] if isinstance(body.stop, str) else body.stop

    if body.stream:
        request_id = f"cmpl-{secrets.token_urlsafe(16)}"
        created = int(time.time())
        start_time = time.monotonic()

        async def legacy_stream() -> AsyncIterator[str]:
            choice_index = 0
            usage_totals: dict[str, int] = {"prompt_tokens": 0, "completion_tokens": 0}
            try:
                for prompt in prompts:
                    for _ in range(body.n):
                        messages = [ChatMessage(role="user", content=prompt)]
                        est_prompt_tokens = max(1, _estimate_prompt_tokens(messages))
                        token_stream = engine.stream_generate(
                            model_id=resolved_model,
                            messages=messages,
                            temperature=body.temperature,
                            max_tokens=body.max_tokens,
                            top_p=body.top_p,
                            stop=stop,
                            tools=None,
                            response_format=None,
                            frequency_penalty=body.frequency_penalty,
                            presence_penalty=body.presence_penalty,
                            priority=priority,
                            num_ctx=body.num_ctx,
                            client_id=effective_client_id,
                        )
                        counted_stream = _counting_stream(
                            token_stream=token_stream,
                            model_id=resolved_model,
                            start_time=start_time,
                            prompt_tokens=est_prompt_tokens,
                            metrics=None,
                            client_id=effective_client_id,
                        )
                        async for line in _legacy_completions_sse_stream(
                            counted_stream,
                            request_id,
                            resolved_model,
                            max_tokens=body.max_tokens,
                            prompt_tokens=est_prompt_tokens,
                            prefix_text=prompt if body.echo else "",
                            suffix_text=body.suffix or "",
                            choice_index=choice_index,
                            created=created,
                            emit_done=False,
                            usage_accumulator=usage_totals,
                        ):
                            yield line
                        choice_index += 1

                metrics.record(RequestMetric(
                    model_id=resolved_model,
                    latency_sec=time.monotonic() - start_time,
                    prompt_tokens=usage_totals["prompt_tokens"],
                    completion_tokens=usage_totals["completion_tokens"],
                    stream=True,
                    client_id=effective_client_id,
                ))
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(
                    "legacy_completion_stream_error",
                    extra={"model": resolved_model, "error": str(e)},
                )
                metrics.record(RequestMetric(
                    model_id=resolved_model,
                    latency_sec=time.monotonic() - start_time,
                    prompt_tokens=usage_totals["prompt_tokens"],
                    completion_tokens=usage_totals["completion_tokens"],
                    stream=True,
                    error=True,
                    client_id=effective_client_id,
                ))
                yield "data: [DONE]\n\n"

        try:
            return StreamingResponse(
                legacy_stream(),
                media_type="text/event-stream",
            )
        except Exception as e:
            logger.error(
                "legacy_completion_stream_error",
                extra={"model": resolved_model, "error": str(e)},
            )
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0,
                completion_tokens=0,
                stream=True,
                error=True,
                client_id=effective_client_id,
            ))
            return internal_error(str(e))

    request_id = f"cmpl-{secrets.token_urlsafe(16)}"
    created = int(time.time())
    start_time = time.monotonic()
    prompt_tokens_total = 0
    completion_tokens_total = 0
    choices: list[dict[str, object]] = []
    index = 0

    try:
        for prompt in prompts:
            messages = [ChatMessage(role="user", content=prompt)]
            for _ in range(body.n):
                response = await engine.generate(
                    model_id=resolved_model,
                    messages=messages,
                    temperature=body.temperature,
                    max_tokens=body.max_tokens,
                    top_p=body.top_p,
                    stop=stop,
                    tools=None,
                    response_format=None,
                    frequency_penalty=body.frequency_penalty,
                    presence_penalty=body.presence_penalty,
                    priority=priority,
                    num_ctx=body.num_ctx,
                    client_id=effective_client_id,
                )
                text = response.choices[0].message.content or ""
                if body.echo:
                    text = f"{prompt}{text}"
                if body.suffix:
                    text = f"{text}{body.suffix}"

                choices.append({
                    "text": text,
                    "index": index,
                    "logprobs": None,
                    "finish_reason": response.choices[0].finish_reason,
                })
                index += 1
                prompt_tokens_total += response.usage.prompt_tokens
                completion_tokens_total += response.usage.completion_tokens

        metrics.record(RequestMetric(
            model_id=resolved_model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=prompt_tokens_total,
            completion_tokens=completion_tokens_total,
            stream=False,
            client_id=effective_client_id,
        ))
        return JSONResponse(content={
            "id": request_id,
            "object": "text_completion",
            "created": created,
            "model": resolved_model,
            "choices": choices,
            "usage": {
                "prompt_tokens": prompt_tokens_total,
                "completion_tokens": completion_tokens_total,
                "total_tokens": prompt_tokens_total + completion_tokens_total,
            },
        })
    except RuntimeError as e:
        err_msg = str(e)
        if "Server is busy" in err_msg:
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0,
                completion_tokens=0,
                stream=False,
                error=True,
                client_id=effective_client_id,
            ))
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "message": err_msg,
                        "type": "server_error",
                        "code": "rate_limit_exceeded",
                    },
                },
                headers={"Retry-After": "5"},
            )
        metrics.record(RequestMetric(
            model_id=resolved_model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=0,
            completion_tokens=0,
            stream=False,
            error=True,
            client_id=effective_client_id,
        ))
        return internal_error(err_msg)
    except Exception as e:
        metrics.record(RequestMetric(
            model_id=resolved_model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=0,
            completion_tokens=0,
            stream=False,
            error=True,
            client_id=effective_client_id,
        ))
        logger.error("legacy_completion_error", extra={"model": resolved_model, "error": str(e)})
        return internal_error(str(e))
