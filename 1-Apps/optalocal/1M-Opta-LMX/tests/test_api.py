"""Tests for API endpoints using mocked engine."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from opta_lmx.inference.types import DownloadTask
from opta_lmx.monitoring.logging import _filter_sensitive_keys


async def test_healthz_unauthenticated(client: AsyncClient) -> None:
    """GET /healthz returns ok without auth — liveness probe."""
    response = await client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


async def test_health_check(client: AsyncClient) -> None:
    """GET /admin/health returns ok."""
    response = await client.get("/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


async def test_admin_status(client: AsyncClient) -> None:
    """GET /admin/status returns system info."""
    response = await client.get("/admin/status")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "0.1.0"
    assert "memory" in data
    assert data["memory"]["threshold_percent"] == 90


async def test_admin_memory(client: AsyncClient) -> None:
    """GET /admin/memory returns memory details."""
    response = await client.get("/admin/memory")
    assert response.status_code == 200
    data = response.json()
    assert data["total_unified_memory_gb"] > 0
    assert data["threshold_percent"] == 90


async def test_list_models_empty(client: AsyncClient) -> None:
    """GET /v1/models returns empty list when nothing loaded."""
    response = await client.get("/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert data["data"] == []


async def test_chat_completion_model_not_loaded(client: AsyncClient) -> None:
    """POST /v1/chat/completions with unloaded model returns 404."""
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "nonexistent-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "model_not_found"


async def test_chat_completion_missing_model(client: AsyncClient) -> None:
    """POST /v1/chat/completions without model field returns 422."""
    response = await client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert response.status_code == 422


async def test_chat_completion_missing_messages(client: AsyncClient) -> None:
    """POST /v1/chat/completions without messages returns 422."""
    response = await client.post(
        "/v1/chat/completions",
        json={"model": "test-model"},
    )
    assert response.status_code == 422


async def test_load_and_chat(client: AsyncClient) -> None:
    """Load a mock model, then chat with it."""
    # Load model
    load_response = await client.post(
        "/admin/models/load",
        json={"model_id": "test-model"},
    )
    assert load_response.status_code == 200
    assert load_response.json()["success"] is True

    # Verify it appears in model list
    models_response = await client.get("/v1/models")
    model_ids = [m["id"] for m in models_response.json()["data"]]
    assert "test-model" in model_ids

    # Chat
    chat_response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert chat_response.status_code == 200
    data = chat_response.json()
    assert data["object"] == "chat.completion"
    assert data["id"].startswith("chatcmpl-")
    assert data["choices"][0]["message"]["role"] == "assistant"
    assert len(data["choices"][0]["message"]["content"]) > 0
    assert data["usage"]["total_tokens"] > 0


async def test_chat_completions_supports_n_for_non_stream(client: AsyncClient) -> None:
    """Non-stream chat completions supports n>1 choices."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "n": 2,
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["choices"]) == 2
    assert data["choices"][0]["index"] == 0
    assert data["choices"][1]["index"] == 1
    assert data["usage"]["total_tokens"] > 0


async def test_chat_completions_stream_supports_n_gt_1(client: AsyncClient) -> None:
    """Streaming chat supports multi-choice fan-out for n>1."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    seen_indices: set[int] = set()
    finished_indices: set[int] = set()
    done_seen = False
    async with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "stream": True,
            "n": 2,
            "messages": [{"role": "user", "content": "Hello"}],
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
            chunk = json.loads(payload)
            for choice in chunk.get("choices", []):
                idx = choice["index"]
                seen_indices.add(idx)
                if choice.get("finish_reason") is not None:
                    finished_indices.add(idx)

    assert done_seen is True
    assert seen_indices == {0, 1}
    assert finished_indices == {0, 1}


async def test_chat_completions_accepts_seed_and_logprobs(client: AsyncClient) -> None:
    """Chat accepts seed/logprobs params for compatibility."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "seed": 42,
            "logprobs": True,
            "top_logprobs": 2,
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["choices"]) == 1
    assert "logprobs" in data["choices"][0]
    assert data["choices"][0]["logprobs"] is None


async def test_chat_completions_busy_returns_429_retry_after(client: AsyncClient) -> None:
    """Busy chat path returns OpenAI-style 429 + Retry-After contract."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def busy_generate(*args: object, **kwargs: object):
        raise RuntimeError("Server is busy")

    engine.generate = busy_generate

    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "5"
    assert response.json()["error"]["code"] == "rate_limit_exceeded"


async def test_chat_busy_uses_openclaw_agent_header_for_metrics(client: AsyncClient) -> None:
    """Busy chat path still attributes metrics to OpenClaw header identity."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def busy_generate(*args: object, **kwargs: object):
        raise RuntimeError("Server is busy")

    engine.generate = busy_generate

    response = await client.post(
        "/v1/chat/completions",
        headers={"x-openclaw-agent-id": "bot-busy"},
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 429
    metrics = await client.get("/admin/metrics/json")
    assert "bot-busy" in metrics.json()["per_client"]


async def test_chat_passes_effective_client_id_to_engine(client: AsyncClient) -> None:
    """Chat forwards effective client identity to engine for concurrency controls."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]
    original_generate = engine.generate
    seen: dict[str, object] = {}

    async def capture_generate(*args: object, **kwargs: object):
        seen.update(kwargs)
        return await original_generate(*args, **kwargs)

    engine.generate = capture_generate

    response = await client.post(
        "/v1/chat/completions",
        headers={"x-openclaw-agent-id": "bot-forward"},
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    assert seen["client_id"] == "bot-forward"


async def test_chat_client_id_header_takes_precedence_over_openclaw_header(
    client: AsyncClient,
) -> None:
    """X-Client-ID should override OpenClaw header when both are present."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        headers={
            "X-Client-ID": "cli-primary",
            "x-openclaw-agent-id": "bot-secondary",
        },
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    metrics = await client.get("/admin/metrics/json")
    per_client = metrics.json()["per_client"]
    assert "cli-primary" in per_client
    assert "bot-secondary" not in per_client


async def test_unload_model(client: AsyncClient) -> None:
    """Load then unload a model."""
    # Load
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    # Unload
    unload_response = await client.post(
        "/admin/models/unload",
        json={"model_id": "test-model"},
    )
    assert unload_response.status_code == 200
    assert unload_response.json()["success"] is True

    # Verify removed from list
    models_response = await client.get("/v1/models")
    assert models_response.json()["data"] == []


async def test_unload_nonexistent_model(client: AsyncClient) -> None:
    """Unloading a model that isn't loaded returns 404."""
    response = await client.post(
        "/admin/models/unload",
        json={"model_id": "nonexistent"},
    )
    assert response.status_code == 404


# --- Admin models list tests (M4) ---


async def test_admin_models_empty(client: AsyncClient) -> None:
    """GET /admin/models returns empty list when nothing loaded."""
    response = await client.get("/admin/models")
    assert response.status_code == 200
    data = response.json()
    assert data["loaded"] == []
    assert data["count"] == 0


async def test_admin_models_after_load(client: AsyncClient) -> None:
    """GET /admin/models returns detailed model info after loading."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    response = await client.get("/admin/models")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    model = data["loaded"][0]
    assert model["id"] == "test-model"
    assert model["loaded"] is True
    assert "memory_gb" in model
    assert "loaded_at" in model
    assert "request_count" in model
    assert "last_used_at" in model


# --- Legacy completions compatibility tests (M5) ---


async def test_legacy_completions_success(client: AsyncClient) -> None:
    """POST /v1/completions returns OpenAI-compatible text completion payload."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/completions",
        json={"model": "test-model", "prompt": "Hello", "n": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "text_completion"
    assert data["id"].startswith("cmpl-")
    assert data["model"] == "test-model"
    assert len(data["choices"]) == 2
    assert data["choices"][0]["index"] == 0
    assert data["choices"][1]["index"] == 1
    assert "text" in data["choices"][0]
    assert data["usage"]["total_tokens"] > 0


async def test_legacy_completions_accepts_best_of_noop(client: AsyncClient) -> None:
    """Legacy completions accepts best_of as a compatibility no-op."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/completions",
        json={"model": "test-model", "prompt": "Hello", "n": 1, "best_of": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["choices"]) == 1
    assert data["choices"][0]["index"] == 0


async def test_legacy_completions_streaming_contract(client: AsyncClient) -> None:
    """Streaming /v1/completions emits completion chunks and [DONE]."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args, **kwargs):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    chunks: list[dict] = []
    async with client.stream(
        "POST",
        "/v1/completions",
        json={"model": "test-model", "prompt": "hi", "stream": True},
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                continue
            chunks.append(json.loads(payload))

    assert len(chunks) >= 3  # first chunk + token chunks + final finish chunk
    assert chunks[0]["object"] == "text_completion"
    assert chunks[0]["choices"][0]["text"] == ""


async def test_legacy_completions_stream_supports_n_gt_1(client: AsyncClient) -> None:
    """Legacy streaming supports n>1 with per-choice indexes and single DONE."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "A"
        yield "B"

    engine.stream_generate = mock_stream

    seen_indices: set[int] = set()
    finished_indices: set[int] = set()
    done_count = 0
    async with client.stream(
        "POST",
        "/v1/completions",
        json={"model": "test-model", "prompt": "hi", "stream": True, "n": 2},
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                done_count += 1
                continue
            chunk = json.loads(payload)
            choice = chunk["choices"][0]
            idx = choice["index"]
            seen_indices.add(idx)
            if choice.get("finish_reason") is not None:
                finished_indices.add(idx)

    assert done_count == 1
    assert seen_indices == {0, 1}
    assert finished_indices == {0, 1}


async def test_legacy_completions_stream_supports_prompt_array(client: AsyncClient) -> None:
    """Legacy streaming supports prompt arrays with global index progression."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args: object, **kwargs: object):
        yield "X"

    engine.stream_generate = mock_stream

    seen_indices: set[int] = set()
    done_count = 0
    async with client.stream(
        "POST",
        "/v1/completions",
        json={
            "model": "test-model",
            "prompt": ["p1", "p2"],
            "stream": True,
            "n": 2,
        },
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line.removeprefix("data: ").strip()
            if payload == "[DONE]":
                done_count += 1
                continue
            chunk = json.loads(payload)
            seen_indices.add(chunk["choices"][0]["index"])

    assert done_count == 1
    assert seen_indices == {0, 1, 2, 3}


async def test_responses_invalid_json_returns_openai_error(client: AsyncClient) -> None:
    """/v1/responses malformed JSON returns OpenAI-style error envelope."""
    response = await client.post(
        "/v1/responses",
        content="{not-json",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["type"] == "invalid_request_error"
    assert data["error"]["code"] == "invalid_json"


async def test_responses_busy_returns_429_retry_after(client: AsyncClient) -> None:
    """/v1/responses busy path returns OpenAI-style 429 + Retry-After."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def busy_generate(*args: object, **kwargs: object):
        raise RuntimeError("Server is busy")

    engine.generate = busy_generate

    response = await client.post(
        "/v1/responses",
        json={"model": "test-model", "input": "Hello"},
    )
    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "5"
    assert response.json()["error"]["code"] == "rate_limit_exceeded"


async def test_responses_passes_effective_client_id_to_engine(client: AsyncClient) -> None:
    """/v1/responses forwards effective client identity to engine calls."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]
    original_generate = engine.generate
    seen: dict[str, object] = {}

    async def capture_generate(*args: object, **kwargs: object):
        seen.update(kwargs)
        return await original_generate(*args, **kwargs)

    engine.generate = capture_generate

    response = await client.post(
        "/v1/responses",
        headers={"x-openclaw-agent-id": "bot-resp"},
        json={"model": "test-model", "input": "Hello"},
    )
    assert response.status_code == 200
    assert seen["client_id"] == "bot-resp"


async def test_responses_maps_max_output_tokens_to_max_tokens(client: AsyncClient) -> None:
    """/v1/responses maps max_output_tokens to engine max_tokens."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]
    original_generate = engine.generate
    seen: dict[str, object] = {}

    async def capture_generate(*args: object, **kwargs: object):
        seen.update(kwargs)
        return await original_generate(*args, **kwargs)

    engine.generate = capture_generate

    response = await client.post(
        "/v1/responses",
        json={
            "model": "test-model",
            "input": "Hello",
            "max_tokens": 3,
            "max_output_tokens": 9,
        },
    )
    assert response.status_code == 200
    assert seen["max_tokens"] == 9


async def test_responses_rejects_invalid_max_output_tokens(client: AsyncClient) -> None:
    """/v1/responses rejects non-integer max_output_tokens with request error."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/responses",
        json={"model": "test-model", "input": "Hello", "max_output_tokens": "bad"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["type"] == "invalid_request_error"
    assert data["error"]["param"] == "max_output_tokens"


async def test_responses_accepts_input_message_parts_array(client: AsyncClient) -> None:
    """/v1/responses accepts common input message arrays with input_text parts."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    engine = client._transport.app.state.engine  # type: ignore[union-attr]
    original_generate = engine.generate
    seen: dict[str, object] = {}

    async def capture_generate(*args: object, **kwargs: object):
        seen.update(kwargs)
        return await original_generate(*args, **kwargs)

    engine.generate = capture_generate

    response = await client.post(
        "/v1/responses",
        json={
            "model": "test-model",
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "Hello from parts."},
                    ],
                }
            ],
        },
    )
    assert response.status_code == 200
    messages = seen["messages"]
    assert isinstance(messages, list)
    assert messages[0].role == "user"
    assert isinstance(messages[0].content, list)
    assert messages[0].content[0].type == "text"
    assert messages[0].content[0].text == "Hello from parts."


# --- Admin key authentication tests ---


async def test_admin_no_auth_when_key_is_none(client: AsyncClient) -> None:
    """Admin endpoints work without auth header when admin_key is None."""
    response = await client.get("/admin/health")
    assert response.status_code == 200


async def test_healthz_works_without_auth_key(client_with_auth: AsyncClient) -> None:
    """/healthz is unauthenticated even when admin key is configured."""
    response = await client_with_auth.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_admin_rejects_missing_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints reject requests without X-Admin-Key when auth is enabled."""
    response = await client_with_auth.get("/admin/health")
    assert response.status_code == 403


async def test_admin_rejects_wrong_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints reject requests with wrong X-Admin-Key."""
    response = await client_with_auth.get(
        "/admin/health",
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert response.status_code == 403


async def test_admin_accepts_correct_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints accept requests with correct X-Admin-Key."""
    response = await client_with_auth.get(
        "/admin/health",
        headers={"X-Admin-Key": "test-secret-key"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_admin_status_requires_key(client_with_auth: AsyncClient) -> None:
    """GET /admin/status rejects without key, accepts with key."""
    no_key = await client_with_auth.get("/admin/status")
    assert no_key.status_code == 403

    with_key = await client_with_auth.get(
        "/admin/status",
        headers={"X-Admin-Key": "test-secret-key"},
    )
    assert with_key.status_code == 200


# --- Logging tests ---


def test_sensitive_key_filter_redacts_keys() -> None:
    """_filter_sensitive_keys redacts sensitive keys from event dict (G-LMX-03)."""
    event_dict = {
        "event": "auth_attempt",
        "api_key": "sk-secret123",
        "token": "bearer-xxx",
        "safe_field": "visible",
    }

    result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]

    assert result["api_key"] == "***REDACTED***"
    assert result["token"] == "***REDACTED***"
    assert result["safe_field"] == "visible"


def test_sensitive_key_filter_preserves_non_sensitive() -> None:
    """_filter_sensitive_keys passes through non-sensitive keys unchanged."""
    event_dict = {
        "event": "model_loaded",
        "model_id": "test",
        "duration_sec": 1.5,
    }

    result = _filter_sensitive_keys(None, "info", event_dict)  # type: ignore[arg-type]

    assert result["event"] == "model_loaded"
    assert result["model_id"] == "test"
    assert result["duration_sec"] == 1.5


# --- Available models tests ---


async def test_available_models_empty(client: AsyncClient) -> None:
    """GET /admin/models/available returns empty when no models on disk."""
    with patch(
        "opta_lmx.manager.model.ModelManager.list_available",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await client.get("/admin/models/available")
    assert response.status_code == 200
    assert response.json() == []


async def test_available_models_returns_disk_inventory(client: AsyncClient) -> None:
    """GET /admin/models/available returns cached model info."""
    with patch(
        "opta_lmx.manager.model.ModelManager.list_available",
        new_callable=AsyncMock,
        return_value=[
            {
                "repo_id": "mlx-community/Mistral-7B",
                "local_path": "/cache/models--Mistral",
                "size_bytes": 4_000_000_000,
                "downloaded_at": 1700000000.0,
            }
        ],
    ):
        response = await client.get("/admin/models/available")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["repo_id"] == "mlx-community/Mistral-7B"
    assert data[0]["size_bytes"] == 4_000_000_000


# --- Phase 3: Download endpoint tests ---


async def test_download_returns_download_id(client: AsyncClient) -> None:
    """POST /admin/models/download returns a download_id."""
    mock_task = DownloadTask(
        download_id="abc123",
        repo_id="mlx-community/test-model",
        total_bytes=1000,
    )
    with patch(
        "opta_lmx.manager.model.ModelManager.start_download",
        new_callable=AsyncMock,
        return_value=mock_task,
    ):
        response = await client.post(
            "/admin/models/download",
            json={"repo_id": "mlx-community/test-model"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["download_id"] == "abc123"
    assert data["repo_id"] == "mlx-community/test-model"
    assert data["status"] == "downloading"


async def test_download_progress_404_for_unknown(client: AsyncClient) -> None:
    """GET /admin/models/download/{id}/progress returns 404 for unknown IDs."""
    response = await client.get("/admin/models/download/nonexistent/progress")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "download_not_found"


async def test_download_progress_returns_status(client: AsyncClient) -> None:
    """GET /admin/models/download/{id}/progress returns current progress."""
    # Inject a download task directly into the manager
    task = DownloadTask(
        download_id="prog123",
        repo_id="mlx-community/test-model",
        status="downloading",
        progress_percent=45.2,
        downloaded_bytes=4520,
        total_bytes=10000,
    )
    client._transport.app.state.model_manager._downloads["prog123"] = task  # type: ignore[union-attr]

    response = await client.get("/admin/models/download/prog123/progress")
    assert response.status_code == 200
    data = response.json()
    assert data["download_id"] == "prog123"
    assert data["progress_percent"] == 45.2
    assert data["status"] == "downloading"


async def test_delete_404_for_missing_model(client: AsyncClient) -> None:
    """DELETE /admin/models/{id} returns 404 for unknown models."""
    with patch(
        "opta_lmx.manager.model.ModelManager.delete_model",
        new_callable=AsyncMock,
        side_effect=KeyError("not found"),
    ):
        response = await client.request(
            "DELETE", "/admin/models/nonexistent/model",
        )
    assert response.status_code == 404


async def test_delete_409_for_loaded_model(client: AsyncClient) -> None:
    """DELETE /admin/models/{id} returns 409 if model is currently loaded."""
    # Load a model first
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    response = await client.request("DELETE", "/admin/models/test-model")
    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "model_in_use"


async def test_delete_success(client: AsyncClient) -> None:
    """DELETE /admin/models/{id} deletes and returns freed bytes."""
    with patch(
        "opta_lmx.manager.model.ModelManager.delete_model",
        new_callable=AsyncMock,
        return_value=4_000_000_000,
    ):
        response = await client.request(
            "DELETE", "/admin/models/mlx-community/some-model",
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["freed_bytes"] == 4_000_000_000


async def test_download_requires_auth(client_with_auth: AsyncClient) -> None:
    """POST /admin/models/download rejects without X-Admin-Key."""
    response = await client_with_auth.post(
        "/admin/models/download",
        json={"repo_id": "mlx-community/test-model"},
    )
    assert response.status_code == 403


async def test_delete_requires_auth(client_with_auth: AsyncClient) -> None:
    """DELETE /admin/models/{id} rejects without X-Admin-Key."""
    response = await client_with_auth.request(
        "DELETE", "/admin/models/test-model",
    )
    assert response.status_code == 403


# --- Smart routing tests ---


async def test_auto_routes_to_loaded_model(client: AsyncClient) -> None:
    """model='auto' resolves to a loaded model."""
    # Load a model first
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    # Chat with "auto" — should resolve to test-model
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "test-model"


async def test_auto_returns_404_when_nothing_loaded(client: AsyncClient) -> None:
    """model='auto' returns 404 when no models are loaded."""
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 404


async def test_alias_routes_to_preferred_model(client: AsyncClient) -> None:
    """A configured alias resolves to its preferred loaded model."""
    from opta_lmx.config import RoutingConfig
    from opta_lmx.router.strategy import TaskRouter

    # Load a model
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    # Configure routing so "code" prefers "test-model"
    router = TaskRouter(RoutingConfig(aliases={"code": ["test-model"]}))
    client._transport.app.state.router = router  # type: ignore[union-attr]

    # Chat with alias
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "code",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "test-model"


# --- Metrics endpoint tests ---


async def test_prometheus_metrics_endpoint(client: AsyncClient) -> None:
    """GET /admin/metrics returns Prometheus text format."""
    response = await client.get("/admin/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "lmx_requests_total" in response.text
    assert "lmx_uptime_seconds" in response.text


async def test_metrics_json_endpoint(client: AsyncClient) -> None:
    """GET /admin/metrics/json returns JSON summary."""
    response = await client.get("/admin/metrics/json")
    assert response.status_code == 200
    data = response.json()
    assert "total_requests" in data
    assert "per_model" in data


async def test_metrics_increment_after_chat(client: AsyncClient) -> None:
    """Metrics counters increment after a chat completion."""
    # Load model and chat
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )

    # Check metrics increased
    response = await client.get("/admin/metrics/json")
    data = response.json()
    assert data["total_requests"] >= 1
    assert "test-model" in data["per_model"]


async def test_metrics_requires_auth(client_with_auth: AsyncClient) -> None:
    """GET /admin/metrics rejects without X-Admin-Key."""
    response = await client_with_auth.get("/admin/metrics")
    assert response.status_code == 403


# --- Config reload tests ---


async def test_config_reload_returns_success(client: AsyncClient) -> None:
    """POST /admin/config/reload returns success with updated sections."""
    response = await client.post("/admin/config/reload")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "routing" in data["updated"]
    assert "memory" in data["updated"]


async def test_config_reload_requires_auth(client_with_auth: AsyncClient) -> None:
    """POST /admin/config/reload rejects without X-Admin-Key."""
    response = await client_with_auth.post("/admin/config/reload")
    assert response.status_code == 403


# --- Benchmark endpoint tests ---


async def test_benchmark_model_not_loaded(client: AsyncClient) -> None:
    """POST /admin/benchmark returns 404 for model not loaded."""
    response = await client.post(
        "/admin/benchmark",
        json={"model_id": "nonexistent-model"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "model_not_found"


async def test_benchmark_returns_results(client: AsyncClient) -> None:
    """POST /admin/benchmark returns timing results for a loaded model."""
    # Load model first
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    # Mock stream_generate to yield predictable tokens
    original_engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args, **kwargs):
        for token in ["Hello", " world", "!", " How", " are", " you", "?"]:
            yield token

    original_engine.stream_generate = mock_stream

    response = await client.post(
        "/admin/benchmark",
        json={"model_id": "test-model", "max_tokens": 128, "runs": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "test-model"
    assert data["runs"] == 1
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["run"] == 1
    assert result["tokens_generated"] == 7
    assert result["tokens_per_second"] > 0
    assert result["time_to_first_token_ms"] >= 0
    assert result["total_time_ms"] >= 0
    assert data["avg_tokens_per_second"] > 0


async def test_benchmark_multiple_runs(client: AsyncClient) -> None:
    """POST /admin/benchmark with runs=2 returns averaged results."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    original_engine = client._transport.app.state.engine  # type: ignore[union-attr]

    async def mock_stream(*args, **kwargs):
        for token in ["A", "B", "C"]:
            yield token

    original_engine.stream_generate = mock_stream

    response = await client.post(
        "/admin/benchmark",
        json={"model_id": "test-model", "runs": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["runs"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["run"] == 1
    assert data["results"][1]["run"] == 2
    assert data["avg_tokens_per_second"] > 0
    assert data["avg_time_to_first_token_ms"] >= 0


async def test_benchmark_requires_auth(client_with_auth: AsyncClient) -> None:
    """POST /admin/benchmark rejects without X-Admin-Key."""
    response = await client_with_auth.post(
        "/admin/benchmark",
        json={"model_id": "test-model"},
    )
    assert response.status_code == 403


async def test_benchmark_validation(client: AsyncClient) -> None:
    """POST /admin/benchmark validates request parameters."""
    response = await client.post(
        "/admin/benchmark",
        json={"model_id": "test-model", "runs": 10},  # max is 5
    )
    assert response.status_code == 422


# --- Multimodal content tests ---


async def test_chat_with_string_content(client: AsyncClient) -> None:
    """POST /v1/chat/completions with plain string content works."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["role"] == "assistant"


async def test_chat_with_multimodal_content(client: AsyncClient) -> None:
    """POST /v1/chat/completions with multimodal content array is accepted."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is in this image?"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,iVBORw0KGgo=",
                                "detail": "low",
                            },
                        },
                    ],
                }
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["choices"][0]["message"]["role"] == "assistant"
    assert len(data["choices"][0]["message"]["content"]) > 0


async def test_chat_with_mixed_content_messages(client: AsyncClient) -> None:
    """POST /v1/chat/completions with mix of string and array content."""
    await client.post("/admin/models/load", json={"model_id": "test-model"})
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this image"},
                        {
                            "type": "image_url",
                            "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQ"},
                        },
                    ],
                },
            ],
        },
    )
    assert response.status_code == 200
