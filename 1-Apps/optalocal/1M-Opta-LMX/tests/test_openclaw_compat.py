"""OpenClaw compatibility contract tests for Opta-LMX."""

from __future__ import annotations

import json

from httpx import AsyncClient


async def test_openclaw_chat_supports_user_identity(client: AsyncClient) -> None:
    """Chat accepts OpenClaw-style `user` identity field."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "user": "openclaw-session-01",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["object"] == "chat.completion"


async def test_openclaw_client_headers_are_accounted_in_metrics(client: AsyncClient) -> None:
    """OpenClaw agent header is used for per-client accounting."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    await client.post(
        "/v1/chat/completions",
        headers={"x-openclaw-agent-id": "bot-alpha"},
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    metrics = await client.get("/admin/metrics/json")
    assert metrics.status_code == 200
    assert "bot-alpha" in metrics.json()["per_client"]


async def test_openclaw_stream_include_usage_contract(client: AsyncClient) -> None:
    """Streaming with include_usage emits a usage chunk."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    usage_seen = False
    async with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "stream": True,
            "stream_options": {"include_usage": True},
            "messages": [{"role": "user", "content": "hi"}],
        },
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                continue
            data = json.loads(payload)
            if "usage" in data:
                usage_seen = True
    assert usage_seen is True


async def test_openclaw_stream_multi_choice_contract(client: AsyncClient) -> None:
    """Streaming chat supports n>1 with indexed choice chunks."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    seen_indices: set[int] = set()
    done_seen = False
    async with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "stream": True,
            "n": 2,
            "messages": [{"role": "user", "content": "hi"}],
        },
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                done_seen = True
                continue
            data = json.loads(payload)
            for choice in data.get("choices", []):
                seen_indices.add(choice["index"])

    assert done_seen is True
    assert seen_indices == {0, 1}


async def test_openclaw_stream_logprobs_placeholder_contract(client: AsyncClient) -> None:
    """Streaming chat includes null logprobs placeholders when requested."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    saw_logprobs = False
    async with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "stream": True,
            "logprobs": True,
            "top_logprobs": 2,
            "messages": [{"role": "user", "content": "hi"}],
        },
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                continue
            data = json.loads(payload)
            for choice in data.get("choices", []):
                if "logprobs" in choice:
                    saw_logprobs = True
                    assert choice["logprobs"] is None

    assert saw_logprobs is True


async def test_openclaw_responses_endpoint_contract(client: AsyncClient) -> None:
    """Responses endpoint returns response object with output text."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/responses",
        json={"model": "test-model", "input": "Summarize this."},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["object"] == "response"
    assert payload["status"] == "completed"
    assert isinstance(payload["output_text"], str)


async def test_openclaw_responses_streaming_contract(client: AsyncClient) -> None:
    """Responses endpoint emits created/delta/completed events when streaming."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    event_names: list[str] = []
    async with client.stream(
        "POST",
        "/v1/responses",
        json={"model": "test-model", "input": "hello", "stream": True},
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("event: "):
                event_names.append(line.removeprefix("event: ").strip())

    assert "response.created" in event_names
    assert "response.output_text.delta" in event_names
    assert "response.completed" in event_names


async def test_openclaw_responses_streaming_tool_call_contract(client: AsyncClient) -> None:
    """Responses streaming emits tool-call parity events and completed output data."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield '<minimax:tool_call><invoke name="get_weather">'
        yield '<parameter name="location">Seattle</parameter></invoke>'
        yield "</minimax:tool_call>"

    engine.stream_generate = mock_stream

    event_names: list[str] = []
    completed_payload: dict[str, object] | None = None
    current_event: str | None = None
    async with client.stream(
        "POST",
        "/v1/responses",
        json={
            "model": "test-model",
            "input": "Need weather",
            "stream": True,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "get_weather",
                        "parameters": {
                            "type": "object",
                            "properties": {"location": {"type": "string"}},
                        },
                    },
                }
            ],
        },
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("event: "):
                current_event = line.removeprefix("event: ").strip()
                event_names.append(current_event)
                continue
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]" or current_event != "response.completed":
                continue
            completed_payload = json.loads(payload)

    assert "response.output_item.added" in event_names
    assert "response.function_call_arguments.delta" in event_names
    assert completed_payload is not None
    function_items = [
        item
        for item in completed_payload["output"]  # type: ignore[index]
        if item.get("type") == "function_call"
    ]
    assert len(function_items) == 1
    assert function_items[0]["name"] == "get_weather"
    assert json.loads(function_items[0]["arguments"]) == {"location": "Seattle"}


async def test_openclaw_models_lookup_contract(client: AsyncClient) -> None:
    """Model lookup endpoint returns exact model object by id."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.get("/v1/models/test-model")
    assert response.status_code == 200
    model = response.json()
    assert model["id"] == "test-model"
    assert model["object"] == "model"


async def test_openclaw_legacy_completions_contract(client: AsyncClient) -> None:
    """Legacy completions endpoint remains OpenAI-compatible for old clients."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/completions",
        json={"model": "test-model", "prompt": "hello world"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["object"] == "text_completion"
    assert payload["id"].startswith("cmpl-")
    assert len(payload["choices"]) == 1
