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
    metrics: MetricsCollector,
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
        try:
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
            )
            # Approximate prompt tokens for metrics (4 chars ≈ 1 token)
            est_prompt_tokens = max(1, _estimate_prompt_tokens(body.messages))
            include_usage = bool(
                body.stream_options and body.stream_options.get("include_usage")
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
                )
            else:
                sse_stream = format_sse_stream(
                    counted_stream, request_id, resolved_model,
                    include_usage=include_usage, prompt_tokens=est_prompt_tokens,
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
            )
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                stream=False,
                client_id=effective_client_id,
            ))
            return JSONResponse(content=response.model_dump())
        except RuntimeError as e:
            err_msg = str(e)
            if "Server is busy" in err_msg:
                metrics.record(RequestMetric(
                    model_id=resolved_model,
                    latency_sec=time.monotonic() - start_time,
                    prompt_tokens=0, completion_tokens=0,
                    stream=False, error=True,
                    client_id=x_client_id,
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
) -> Response:
    """OpenAI Responses API — simplified single-turn endpoint.

    Accepts ``input`` (string) in place of ``messages``, returning a response
    object with ``output_text``. Supports both streaming (SSE with named events)
    and non-streaming modes.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "invalid JSON"})

    model_id: str = body.get("model", "")
    input_text: str = body.get("input", "")
    stream: bool = bool(body.get("stream", False))
    temperature: float = float(body.get("temperature", 0.7))
    max_tokens: int | None = body.get("max_tokens")
    top_p: float = float(body.get("top_p", 1.0))
    tools: list[dict] | None = body.get("tools")

    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    resolved_model = task_router.resolve(model_id, loaded_ids)

    if not engine.is_model_loaded(resolved_model):
        return model_not_found(model_id)

    messages = [ChatMessage(role="user", content=input_text)]
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
        )
        output_text = response.choices[0].message.content or ""
        return JSONResponse(content={
            "id": request_id,
            "object": "response",
            "status": "completed",
            "output_text": output_text,
            "output": [],
        })
    except Exception as e:
        logger.error("responses_error", extra={"model": resolved_model, "error": str(e)})
        return internal_error(str(e))


@router.post("/v1/completions", response_model=None)
async def legacy_completions() -> JSONResponse:
    """Legacy text completions endpoint — not supported.

    Opta-LMX only supports chat completions (/v1/chat/completions).
    This stub returns 501 so clients get a clear error instead of 404.
    """
    return openai_error(
        status_code=501,
        message="Legacy /v1/completions is not supported. Use /v1/chat/completions instead.",
        error_type="invalid_request_error",
        code="not_implemented",
    )
