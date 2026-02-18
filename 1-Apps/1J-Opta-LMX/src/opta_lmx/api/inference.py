"""Inference API routes — OpenAI-compatible /v1/* endpoints."""

from __future__ import annotations

import logging
import secrets
import time
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.responses import Response

from opta_lmx.api.deps import Embeddings, Engine, Metrics, Presets, Router
from opta_lmx.api.errors import internal_error, model_not_found, openai_error
from opta_lmx.inference.context import estimate_prompt_tokens as _estimate_prompt_tokens
from opta_lmx.inference.schema import (
    ChatCompletionRequest,
    ErrorResponse,
    ModelObject,
    ModelsListResponse,
)
from opta_lmx.inference.streaming import format_sse_stream, format_sse_tool_stream
from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric
from opta_lmx.presets.manager import PRESET_PREFIX

logger = logging.getLogger(__name__)


async def _counting_stream(
    token_stream: AsyncIterator[str],
    model_id: str,
    start_time: float,
    prompt_tokens: int,
    metrics: MetricsCollector,
) -> AsyncIterator[str]:
    """Wrap a token stream to count tokens and record metrics when complete."""
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
        ))

router = APIRouter()


@router.post(
    "/v1/chat/completions",
    response_model=None,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def chat_completions(
    body: ChatCompletionRequest,
    engine: Engine,
    task_router: Router,
    metrics: Metrics,
    preset_mgr: Presets,
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
            )
            # Approximate prompt tokens for metrics (4 chars ≈ 1 token)
            est_prompt_tokens = max(1, _estimate_prompt_tokens(body.messages))

            # Wrap stream to count tokens and record final metrics
            counted_stream = _counting_stream(
                token_stream, resolved_model, start_time, est_prompt_tokens, metrics,
            )

            if body.tools:
                # Parse MiniMax XML tool calls from the token stream
                chunk_stream = wrap_stream_with_tool_parsing(
                    counted_stream, tools=body.tools,
                )
                sse_stream = format_sse_tool_stream(
                    chunk_stream, request_id, resolved_model,
                )
            else:
                sse_stream = format_sse_stream(
                    counted_stream, request_id, resolved_model,
                )
            return StreamingResponse(sse_stream, media_type="text/event-stream")
        except Exception as e:
            logger.error("stream_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=True, error=True,
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
            )
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                stream=False,
            ))
            return JSONResponse(content=response.model_dump())
        except Exception as e:
            logger.error("completion_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=False, error=True,
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
