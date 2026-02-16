"""Inference API routes — OpenAI-compatible /v1/* endpoints."""

from __future__ import annotations

import logging
import secrets
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from opta_lmx.api.deps import Engine, Metrics, Presets, Router
from opta_lmx.api.errors import internal_error, model_not_found, openai_error
from opta_lmx.presets.manager import PRESET_PREFIX
from opta_lmx.monitoring.metrics import RequestMetric
from opta_lmx.inference.schema import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ErrorResponse,
    ModelObject,
    ModelsListResponse,
)
from opta_lmx.inference.streaming import format_sse_stream

logger = logging.getLogger(__name__)

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
):
    """OpenAI-compatible chat completion.

    Supports both streaming (SSE) and non-streaming modes.
    """
    # Resolve preset (e.g. "preset:code-assistant") — applies defaults + swaps model ID
    if body.model.startswith(PRESET_PREFIX):
        preset_name = body.model[len(PRESET_PREFIX):]
        preset = preset_mgr.get(preset_name)
        if preset is None:
            return model_not_found(body.model)  # type: ignore[return-value]
        body = preset_mgr.apply(preset, body)

    # Resolve alias (e.g. "auto", "code") to a real loaded model ID
    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    resolved_model = task_router.resolve(body.model, loaded_ids)

    # Check model is loaded
    if not engine.is_model_loaded(resolved_model):
        return model_not_found(body.model)  # type: ignore[return-value]

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
            )
            sse_stream = format_sse_stream(token_stream, request_id, resolved_model)
            # Record metric for stream start (latency measured to first token setup)
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0,
                completion_tokens=0,
                stream=True,
            ))
            return StreamingResponse(sse_stream, media_type="text/event-stream")
        except Exception as e:
            logger.error("stream_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=True, error=True,
            ))
            return internal_error(str(e))  # type: ignore[return-value]
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
            )
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                stream=False,
            ))
            return response
        except Exception as e:
            logger.error("completion_error", extra={"model": resolved_model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=resolved_model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=False, error=True,
            ))
            return internal_error(str(e))  # type: ignore[return-value]


@router.get("/v1/models")
async def list_models(engine: Engine) -> ModelsListResponse:
    """List all loaded models in OpenAI format."""
    models = engine.get_loaded_models()
    return ModelsListResponse(
        object="list",
        data=[
            ModelObject(
                id=m.model_id,
                object="model",
                created=int(m.loaded_at),
                owned_by="local",
            )
            for m in models
        ],
    )


@router.post("/v1/completions", response_model=None)
async def legacy_completions():
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
