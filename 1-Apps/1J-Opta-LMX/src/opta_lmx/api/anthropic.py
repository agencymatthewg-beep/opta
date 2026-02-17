"""Anthropic Messages API — /v1/messages endpoint.

Translates between Anthropic's Messages format and Opta-LMX's internal
OpenAI-compatible engine, enabling clients using the Anthropic SDK to
connect seamlessly.
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.deps import Engine, Metrics, Presets, Router
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric
from opta_lmx.presets.manager import PRESET_PREFIX

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request/Response Models ──────────────────────────────────────────────────


class AnthropicMessage(BaseModel):
    """A single message in an Anthropic conversation."""

    role: str  # "user" or "assistant"
    content: str | list[dict[str, Any]]


class AnthropicRequest(BaseModel):
    """Anthropic Messages API request."""

    model: str
    messages: list[AnthropicMessage]
    max_tokens: int = 4096
    system: str | None = None
    temperature: float = Field(1.0, ge=0, le=1.0)
    top_p: float | None = None
    stream: bool = False
    stop_sequences: list[str] | None = None


class AnthropicContentBlock(BaseModel):
    """A content block in an Anthropic response."""

    type: str = "text"
    text: str = ""


class AnthropicUsage(BaseModel):
    """Token usage in Anthropic format."""

    input_tokens: int
    output_tokens: int


class AnthropicResponse(BaseModel):
    """Anthropic Messages API response."""

    id: str
    type: str = "message"
    role: str = "assistant"
    model: str
    content: list[AnthropicContentBlock]
    stop_reason: str | None = "end_turn"
    stop_sequence: str | None = None
    usage: AnthropicUsage


# ─── Translation Helpers ──────────────────────────────────────────────────────


def _anthropic_to_openai(request: AnthropicRequest) -> tuple[list[ChatMessage], dict[str, Any]]:
    """Convert Anthropic request to OpenAI-compatible format.

    Returns:
        Tuple of (messages, kwargs) for engine.generate().
    """
    messages: list[ChatMessage] = []

    # Anthropic system prompt → OpenAI system message
    if request.system:
        messages.append(ChatMessage(role="system", content=request.system))

    # Convert messages
    for msg in request.messages:
        if isinstance(msg.content, str):
            content = msg.content
        else:
            # Extract text from content blocks
            text_parts = [
                block.get("text", "") for block in msg.content
                if block.get("type") == "text"
            ]
            content = "\n".join(text_parts)
        messages.append(ChatMessage(role=msg.role, content=content))

    kwargs: dict[str, Any] = {
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }
    if request.top_p is not None:
        kwargs["top_p"] = request.top_p
    if request.stop_sequences:
        kwargs["stop"] = request.stop_sequences

    return messages, kwargs


def _make_anthropic_response(
    request_id: str,
    model: str,
    content: str,
    input_tokens: int,
    output_tokens: int,
    stop_reason: str = "end_turn",
) -> AnthropicResponse:
    """Build an Anthropic-format response."""
    return AnthropicResponse(
        id=request_id,
        model=model,
        content=[AnthropicContentBlock(type="text", text=content)],
        stop_reason=stop_reason,
        usage=AnthropicUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        ),
    )


def _anthropic_error(status_code: int, message: str, error_type: str = "invalid_request_error") -> JSONResponse:
    """Return an Anthropic-format error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "type": "error",
            "error": {
                "type": error_type,
                "message": message,
            },
        },
    )


# ─── Streaming ────────────────────────────────────────────────────────────────


async def _anthropic_sse_stream(
    token_stream: AsyncIterator[str],
    request_id: str,
    model: str,
    input_tokens: int,
    metrics: MetricsCollector,
    start_time: float,
) -> AsyncIterator[str]:
    """Convert a token stream to Anthropic SSE format.

    Emits event types: message_start, content_block_start,
    content_block_delta, content_block_stop, message_delta, message_stop.
    """
    # message_start
    msg_start = {
        "type": "message_start",
        "message": {
            "id": request_id,
            "type": "message",
            "role": "assistant",
            "model": model,
            "content": [],
            "stop_reason": None,
            "usage": {"input_tokens": input_tokens, "output_tokens": 0},
        },
    }
    yield f"event: message_start\ndata: {json.dumps(msg_start)}\n\n"

    # content_block_start
    block_start = {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}
    yield f"event: content_block_start\ndata: {json.dumps(block_start)}\n\n"

    output_tokens = 0
    error_occurred = False
    try:
        async for token in token_stream:
            output_tokens += 1
            delta = {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": token}}
            yield f"event: content_block_delta\ndata: {json.dumps(delta)}\n\n"
    except Exception:
        error_occurred = True
        raise
    finally:
        metrics.record(RequestMetric(
            model_id=model,
            latency_sec=time.monotonic() - start_time,
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            stream=True,
            error=error_occurred,
        ))

    # content_block_stop
    yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': 0})}\n\n"

    # message_delta
    msg_delta = {
        "type": "message_delta",
        "delta": {"stop_reason": "end_turn"},
        "usage": {"output_tokens": output_tokens},
    }
    yield f"event: message_delta\ndata: {json.dumps(msg_delta)}\n\n"

    # message_stop
    yield f"event: message_stop\ndata: {json.dumps({'type': 'message_stop'})}\n\n"


# ─── Route ────────────────────────────────────────────────────────────────────


@router.post("/v1/messages", response_model=None)
async def anthropic_messages(
    body: AnthropicRequest,
    engine: Engine,
    metrics: Metrics,
    preset_mgr: Presets,
    task_router: Router,
) -> Response:
    """Anthropic Messages API endpoint.

    Accepts Anthropic-format requests, translates to OpenAI format internally,
    and returns Anthropic-format responses.
    """
    model = body.model

    # Resolve preset (e.g. "preset:code-assistant")
    if model.startswith(PRESET_PREFIX):
        preset_name = model[len(PRESET_PREFIX):]
        preset = preset_mgr.get(preset_name)
        if preset is None:
            return _anthropic_error(404, f"Preset '{preset_name}' not found", "not_found_error")
        model = preset.model
        # Apply preset temperature/max_tokens as defaults
        if preset.parameters:
            if body.temperature == 1.0 and "temperature" in preset.parameters:
                body.temperature = preset.parameters["temperature"]
            if body.max_tokens == 4096 and "max_tokens" in preset.parameters:
                body.max_tokens = preset.parameters["max_tokens"]
        # Prepend system prompt from preset if not provided in request
        if preset.system_prompt and body.system is None:
            body.system = preset.system_prompt

    # Resolve alias (e.g. "auto", "code") to a real loaded model ID
    loaded_ids = [m.model_id for m in engine.get_loaded_models()]
    model = task_router.resolve(model, loaded_ids)

    # Check model is loaded
    if not engine.is_model_loaded(model):
        return _anthropic_error(404, f"Model '{body.model}' is not loaded", "not_found_error")

    messages, kwargs = _anthropic_to_openai(body)
    start_time = time.monotonic()

    # Approximate input tokens
    prompt_text = " ".join(m.content or "" for m in messages)
    est_input_tokens = max(1, len(prompt_text) // 4)

    if body.stream:
        try:
            token_stream = engine.stream_generate(
                model_id=model,
                messages=messages,
                **kwargs,
            )
            sse_stream = _anthropic_sse_stream(
                token_stream,
                request_id=f"msg_{secrets.token_urlsafe(16)}",
                model=model,
                input_tokens=est_input_tokens,
                metrics=metrics,
                start_time=start_time,
            )
            return StreamingResponse(sse_stream, media_type="text/event-stream")
        except Exception as e:
            logger.error("anthropic_stream_error", extra={"model": model, "error": str(e)})
            return _anthropic_error(500, str(e), "api_error")
    else:
        try:
            response = await engine.generate(
                model_id=model,
                messages=messages,
                **kwargs,
            )
            metrics.record(RequestMetric(
                model_id=model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                stream=False,
            ))

            content = response.choices[0].message.content or ""
            stop_reason = "end_turn" if response.choices[0].finish_reason == "stop" else response.choices[0].finish_reason

            result = _make_anthropic_response(
                request_id=f"msg_{secrets.token_urlsafe(16)}",
                model=model,
                content=content,
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
                stop_reason=stop_reason,
            )
            return JSONResponse(content=result.model_dump())
        except Exception as e:
            logger.error("anthropic_completion_error", extra={"model": model, "error": str(e)})
            metrics.record(RequestMetric(
                model_id=model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0, completion_tokens=0,
                stream=False, error=True,
            ))
            return _anthropic_error(500, str(e), "api_error")
