"""WebSocket streaming endpoint — bidirectional chat with cancellation support."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage

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
            except asyncio.TimeoutError:
                logger.info("ws_idle_timeout")
                break

            # Message size limit (1MB)
            if len(json.dumps(data)) > 1_000_000:
                await websocket.close(code=1009, reason="Message too large")
                break

            msg_type = data.get("type")

            if msg_type == "chat.request":
                request_id = f"chatcmpl-{secrets.token_urlsafe(16)}"
                task = asyncio.create_task(
                    _handle_chat_request(websocket, request_id, data, engine)
                )
                active_tasks[request_id] = task

                # Clean up completed tasks
                task.add_done_callback(lambda t, rid=request_id: active_tasks.pop(rid, None))

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
        try:
            await websocket.close()
        except Exception:
            pass


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

    messages = [ChatMessage(**m) for m in raw_messages]

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
            # Approximate token count (~4 chars/token). For accurate counts,
            # use the model's tokenizer. This heuristic is sufficient for usage tracking.
            prompt_tokens = max(1, len(prompt_text) // 4)

            async for token in engine.stream_generate(
                model_id=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stop=[stop] if isinstance(stop, str) else stop,
            ):
                completion_tokens += 1
                await websocket.send_json({
                    "type": "chat.token",
                    "request_id": request_id,
                    "content": token,
                })

            await websocket.send_json({
                "type": "chat.done",
                "request_id": request_id,
                "finish_reason": "stop",
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
            )

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
        try:
            await websocket.send_json({
                "type": "chat.done",
                "request_id": request_id,
                "finish_reason": "cancelled",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
            })
        except Exception:
            pass  # Connection may already be closed
    except Exception as e:
        logger.error("ws_chat_error", extra={
            "request_id": request_id,
            "error": str(e),
        })
        try:
            await websocket.send_json({
                "type": "chat.error",
                "request_id": request_id,
                "error": str(e),
            })
        except Exception:
            pass
