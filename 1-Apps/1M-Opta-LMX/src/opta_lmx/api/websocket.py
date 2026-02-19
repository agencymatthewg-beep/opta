"""WebSocket streaming endpoint — bidirectional chat with cancellation support."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import secrets
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
from opta_lmx.monitoring.metrics import RequestMetric
from opta_lmx.presets.manager import PRESET_PREFIX

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/v1/chat/stream")
async def websocket_chat(websocket: WebSocket) -> None:
    """WebSocket endpoint for bidirectional streaming chat.

    Protocol messages (JSON):

    Client → Server:
        {"type": "chat.request", "model": "...", "messages": [...], ...}
        {"type": "chat.cancel", "request_id": "chatcmpl-abc123"}

    Server → Client:
        {"type": "chat.token", "request_id": "...", "content": "..."}
        {"type": "chat.done", "request_id": "...", "finish_reason": "stop", "usage": {...}}
        {"type": "chat.error", "request_id": "...", "error": "..."}
    """
    await websocket.accept()
    engine: InferenceEngine = websocket.app.state.engine
    active_tasks: dict[str, asyncio.Task[None]] = {}

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=300.0)
            except TimeoutError:
                logger.info("ws_idle_timeout")
                break

            msg_type = data.get("type")

            if msg_type == "chat.request":
                request_id = f"chatcmpl-{secrets.token_urlsafe(16)}"
                task = asyncio.create_task(
                    _handle_chat_request(websocket, request_id, data, engine)
                )
                active_tasks[request_id] = task

                # Clean up completed tasks
                def _cleanup(t: asyncio.Task[None], rid: str = request_id) -> None:
                    active_tasks.pop(rid, None)
                task.add_done_callback(_cleanup)

            elif msg_type == "chat.cancel":
                request_id = data.get("request_id", "")
                if cancel_task := active_tasks.pop(request_id, None):
                    cancel_task.cancel()
                    logger.info("ws_generation_cancelled", extra={"request_id": request_id})

            else:
                await websocket.send_json({
                    "type": "chat.error",
                    "request_id": None,
                    "error": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        logger.info("ws_client_disconnected", extra={
            "active_tasks": len(active_tasks),
        })
    except Exception as e:
        logger.error("ws_connection_error", extra={"error": str(e)})
    finally:
        # Cancel all active generation tasks on disconnect
        for task in active_tasks.values():
            task.cancel()
        active_tasks.clear()
        with contextlib.suppress(Exception):
            await websocket.close()


async def _handle_chat_request(
    websocket: WebSocket,
    request_id: str,
    data: dict[str, Any],
    engine: InferenceEngine,
) -> None:
    """Handle a single chat request — stream tokens back via WebSocket."""
    model = data.get("model", "")
    raw_messages = data.get("messages", [])
    temperature = data.get("temperature", 0.7)
    max_tokens = data.get("max_tokens", 2048)
    top_p = data.get("top_p", 1.0)
    stop = data.get("stop")
    stream = data.get("stream", True)
    response_format = data.get("response_format")
    tools = data.get("tools")

    messages = [ChatMessage(**m) for m in raw_messages]

    # Resolve preset (e.g. "preset:code-assistant") — apply defaults + swap model
    if model.startswith(PRESET_PREFIX):
        preset_name = model[len(PRESET_PREFIX):]
        preset_mgr = websocket.app.state.preset_manager
        preset = preset_mgr.get(preset_name)
        if preset is None:
            await websocket.send_json({
                "type": "chat.error",
                "request_id": request_id,
                "error": f"Preset '{preset_name}' not found",
            })
            return
        model = preset.model
        if preset.parameters:
            temperature = preset.parameters.get("temperature", temperature)
            top_p = preset.parameters.get("top_p", top_p)
            max_tokens = preset.parameters.get("max_tokens", max_tokens)
            stop = preset.parameters.get("stop", stop)
        if preset.system_prompt and not any(m.role == "system" for m in messages):
            messages.insert(0, ChatMessage(role="system", content=preset.system_prompt))

    start_time = time.monotonic()

    try:
        if not engine.is_model_loaded(model):
            # Try to resolve via router
            from opta_lmx.router.strategy import TaskRouter

            task_router: TaskRouter = websocket.app.state.router
            loaded_ids = [m.model_id for m in engine.get_loaded_models()]
            model = task_router.resolve(model, loaded_ids)

            if not engine.is_model_loaded(model):
                await websocket.send_json({
                    "type": "chat.error",
                    "request_id": request_id,
                    "error": f"Model '{data.get('model', '')}' is not loaded",
                })
                return

        if stream:
            completion_tokens = 0
            prompt_text = " ".join(m.content or "" for m in messages)
            prompt_tokens = max(1, len(prompt_text) // 4)
            saw_tool_calls = False

            token_stream = engine.stream_generate(
                model_id=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stop=[stop] if isinstance(stop, str) else stop,
                tools=tools,
                response_format=response_format,
            )

            if tools:
                chunk_stream = wrap_stream_with_tool_parsing(token_stream, tools=tools)
                async for chunk in chunk_stream:
                    completion_tokens += 1
                    if chunk.content is not None:
                        await websocket.send_json({
                            "type": "chat.token",
                            "request_id": request_id,
                            "content": chunk.content,
                        })
                    elif chunk.tool_call_delta is not None:
                        saw_tool_calls = True
                        tc = chunk.tool_call_delta
                        await websocket.send_json({
                            "type": "chat.tool_call",
                            "request_id": request_id,
                            "tool_call": {
                                "index": tc.index,
                                "id": tc.id,
                                "name": tc.name,
                                "arguments": tc.arguments_delta,
                            },
                        })
            else:
                async for token in token_stream:
                    completion_tokens += 1
                    await websocket.send_json({
                        "type": "chat.token",
                        "request_id": request_id,
                        "content": token,
                    })

            websocket.app.state.metrics.record(RequestMetric(
                model_id=model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                stream=True,
            ))

            await websocket.send_json({
                "type": "chat.done",
                "request_id": request_id,
                "finish_reason": "tool_calls" if saw_tool_calls else "stop",
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                },
            })
        else:
            response = await engine.generate(
                model_id=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stop=[stop] if isinstance(stop, str) else stop,
                tools=tools,
                response_format=response_format,
            )

            websocket.app.state.metrics.record(RequestMetric(
                model_id=model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                stream=False,
            ))

            await websocket.send_json({
                "type": "chat.done",
                "request_id": request_id,
                "finish_reason": response.choices[0].finish_reason,
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                },
            })

    except asyncio.CancelledError:
        # Client cancelled — send acknowledgment if connection still open
        with contextlib.suppress(Exception):
            await websocket.send_json({
                "type": "chat.done",
                "request_id": request_id,
                "finish_reason": "cancelled",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
            })
    except Exception as e:
        logger.error("ws_chat_error", extra={
            "request_id": request_id,
            "error": str(e),
        })
        with contextlib.suppress(Exception):
            websocket.app.state.metrics.record(RequestMetric(
                model_id=model,
                latency_sec=time.monotonic() - start_time,
                prompt_tokens=0,
                completion_tokens=0,
                stream=stream,
                error=True,
            ))
        with contextlib.suppress(Exception):
            await websocket.send_json({
                "type": "chat.error",
                "request_id": request_id,
                "error": str(e),
            })
