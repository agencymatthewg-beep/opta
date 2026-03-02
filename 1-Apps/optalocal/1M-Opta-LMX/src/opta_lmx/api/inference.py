"""Inference API routes — OpenAI-compatible /v1/* endpoints."""

from __future__ import annotations

import logging
import secrets
import time
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.deps import Embeddings, Engine, Metrics, Presets, Router, verify_inference_key
from opta_lmx.api.errors import internal_error, model_not_found, openai_error
from opta_lmx.api.rate_limit import _chat_completions_limit, limiter
from opta_lmx.api.stream_handlers import (
    _chat_completions_sse_stream_n,
    _counting_stream,
    _legacy_completions_sse_stream,
    _responses_sse_stream,
)
from opta_lmx.api.validation import (
    _chat_stream_include_logprobs_placeholder,
    _parse_responses_input_messages,
    _parse_responses_max_tokens,
)
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
from opta_lmx.monitoring.metrics import RequestMetric
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


_SERVING_LANE_TO_PRIORITY: dict[str, str] = {
    "interactive": "high",
    "throughput": "normal",
}
_PRIORITY_TO_SERVING_LANE: dict[str, str] = {
    "high": "interactive",
    "normal": "throughput",
}


def _resolve_serving_lane_and_priority(
    *,
    route: str,
    x_serving_lane: str | None,
    x_priority: str | None,
) -> tuple[str, str]:
    """Resolve serving lane and request priority with deterministic precedence."""
    lane_raw = (x_serving_lane or "").strip().lower()
    if lane_raw:
        if lane_raw not in _SERVING_LANE_TO_PRIORITY:
            allowed = ", ".join(_SERVING_LANE_TO_PRIORITY.keys())
            raise ValueError(
                f"Invalid value for 'x-serving-lane'. Expected one of: {allowed}."
            )
        serving_lane = lane_raw
        priority = _SERVING_LANE_TO_PRIORITY[serving_lane]
        source = "x-serving-lane"
    else:
        priority_raw = (x_priority or "").strip().lower()
        priority = priority_raw or "normal"
        serving_lane = _PRIORITY_TO_SERVING_LANE.get(priority, "custom")
        source = "x-priority" if priority_raw else "default"

    logger.info(
        "serving_lane_resolved",
        extra={
            "route": route,
            "serving_lane": serving_lane,
            "priority": priority,
            "source": source,
        },
    )
    return serving_lane, priority




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
    x_serving_lane: str | None = Header(None),
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
    try:
        _, priority = _resolve_serving_lane_and_priority(
            route="/v1/chat/completions",
            x_serving_lane=x_serving_lane,
            x_priority=x_priority,
        )
    except ValueError as e:
        return openai_error(
            status_code=400,
            message=str(e),
            error_type="invalid_request_error",
            param="x-serving-lane",
            code="invalid_header",
        )
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




@router.post("/v1/responses", response_model=None)
async def responses_endpoint(
    request: Request,
    engine: Engine,
    task_router: Router,
    x_client_id: str | None = Header(None),
    x_openclaw_agent_id: str | None = Header(None),
    x_serving_lane: str | None = Header(None),
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
    try:
        _, priority = _resolve_serving_lane_and_priority(
            route="/v1/responses",
            x_serving_lane=x_serving_lane,
            x_priority=x_priority,
        )
    except ValueError as e:
        return openai_error(
            status_code=400,
            message=str(e),
            error_type="invalid_request_error",
            param="x-serving-lane",
            code="invalid_header",
        )
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
    x_serving_lane: str | None = Header(None),
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

    try:
        _, priority = _resolve_serving_lane_and_priority(
            route="/v1/completions",
            x_serving_lane=x_serving_lane,
            x_priority=x_priority,
        )
    except ValueError as e:
        return openai_error(
            status_code=400,
            message=str(e),
            error_type="invalid_request_error",
            param="x-serving-lane",
            code="invalid_header",
        )
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
