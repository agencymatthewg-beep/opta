"""
Kimi Code → Anthropic Proxy
Translates Anthropic API format to Kimi Code API format.
Run via LaunchAgent (com.opta.kimi-proxy) or:
  uvicorn proxy:app --host 127.0.0.1 --port 4999
Then set: ANTHROPIC_BASE_URL=http://localhost:4999
"""

import json
import uuid
import os
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import httpx

app = FastAPI()

KIMI_KEY = os.environ.get(
    "KIMI_CODE_KEY",
    "sk-kimi-uWKtNih6hhd2djxqSIcdoyakDVzn6bFFBnvNysCx2drlOGj9Wt16ZnTXyWJxqMvv"
)
KIMI_URL = "https://api.kimi.com/coding/v1/chat/completions"
KIMI_HEADERS = {
    "Authorization": f"Bearer {KIMI_KEY}",
    "User-Agent": "claude-code/1.0",
    "Content-Type": "application/json",
}
KIMI_TIMEOUT = httpx.Timeout(connect=10, read=180, write=30, pool=10)


def anthropic_to_kimi(body: dict) -> dict:
    """Convert Anthropic messages format to Kimi OpenAI-compatible format."""
    messages = []

    # Inject system prompt if present
    system = body.get("system")
    if system:
        if isinstance(system, str):
            messages.append({"role": "system", "content": system})
        elif isinstance(system, list):
            text = " ".join(b.get("text", "") for b in system if b.get("type") == "text")
            if text:
                messages.append({"role": "system", "content": text})

    # Convert messages (handle content arrays)
    for msg in body.get("messages", []):
        content = msg["content"]
        if isinstance(content, list):
            text = "\n".join(
                b.get("text", "") for b in content if b.get("type") == "text"
            )
            messages.append({"role": msg["role"], "content": text})
        else:
            messages.append({"role": msg["role"], "content": content})

    return {
        "model": "kimi-for-coding",
        "messages": messages,
        "max_tokens": max(body.get("max_tokens", 8000), 4000),  # needs headroom for reasoning
        "temperature": body.get("temperature", 0),
        "stream": False,  # always non-streaming from Kimi (we simulate on our end)
    }


def kimi_to_anthropic(kimi_resp: dict, model: str) -> dict:
    """Convert Kimi response to Anthropic messages format."""
    choice = kimi_resp["choices"][0]
    content = choice["message"].get("content", "")
    usage = kimi_resp.get("usage", {})
    finish = choice.get("finish_reason", "stop")

    return {
        "id": f"msg_{kimi_resp.get('id', uuid.uuid4().hex)[:24]}",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": content}],
        "stop_reason": "end_turn" if finish == "stop" else "max_tokens",
        "stop_sequence": None,
        "usage": {
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
        },
    }


async def _call_kimi(kimi_body: dict) -> tuple[str, dict]:
    """Make the Kimi API call. Returns (content, usage)."""
    async with httpx.AsyncClient(timeout=KIMI_TIMEOUT) as client:
        resp = await client.post(KIMI_URL, json=kimi_body, headers=KIMI_HEADERS)
        data = resp.json()
        if "choices" in data:
            content = data["choices"][0]["message"].get("content", "")
            usage = data.get("usage", {})
            return content, usage
        else:
            err = data.get("error", {}).get("message", str(data))
            return f"[Kimi error: {err}]", {}


@app.get("/v1/models")
async def list_models():
    return {
        "data": [
            {"id": "kimi-for-coding", "object": "model"},
            {"id": "claude-sonnet-4-6", "object": "model"},
            {"id": "claude-opus-4-6", "object": "model"},
        ]
    }


@app.post("/v1/messages")
async def messages(request: Request):
    body = await request.json()
    model = body.get("model", "kimi-for-coding")
    stream = body.get("stream", False)
    kimi_body = anthropic_to_kimi(body)

    if stream:
        return StreamingResponse(
            _stream_response(kimi_body, model),
            media_type="text/event-stream",
        )

    # Non-streaming
    try:
        content, usage = await _call_kimi(kimi_body)
        return JSONResponse({
            "id": f"msg_{uuid.uuid4().hex[:24]}",
            "type": "message",
            "role": "assistant",
            "model": model,
            "content": [{"type": "text", "text": content}],
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {
                "input_tokens": usage.get("prompt_tokens", 0),
                "output_tokens": usage.get("completion_tokens", 0),
            },
        })
    except Exception as e:
        return JSONResponse(
            {"type": "error", "error": {"type": "api_error", "message": str(e)}},
            status_code=500,
        )


async def _stream_response(kimi_body: dict, model: str):
    """
    Fetch full Kimi response then emit as Anthropic SSE stream.
    Using fetch-then-stream avoids async generator lifecycle issues.
    """
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"

    yield f"data: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'content': [], 'model': model, 'stop_reason': None, 'stop_sequence': None, 'usage': {'input_tokens': 0, 'output_tokens': 0}}})}\n\n"
    yield f"data: {json.dumps({'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})}\n\n"
    yield f"data: {json.dumps({'type': 'ping'})}\n\n"

    try:
        content, usage = await _call_kimi(kimi_body)
    except Exception as e:
        content = f"[proxy error: {e}]"
        usage = {}

    # Stream content in chunks (~30 chars each for natural feel)
    chunk_size = 30
    for i in range(0, max(len(content), 1), chunk_size):
        piece = content[i:i + chunk_size]
        if piece:
            yield f"data: {json.dumps({'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'text_delta', 'text': piece}})}\n\n"

    output_tokens = usage.get("completion_tokens", 0)
    input_tokens = usage.get("prompt_tokens", 0)

    yield f"data: {json.dumps({'type': 'content_block_stop', 'index': 0})}\n\n"
    yield f"data: {json.dumps({'type': 'message_delta', 'delta': {'stop_reason': 'end_turn', 'stop_sequence': None}, 'usage': {'output_tokens': output_tokens}})}\n\n"
    yield f"data: {json.dumps({'type': 'message_stop'})}\n\n"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=4999, log_level="info")
