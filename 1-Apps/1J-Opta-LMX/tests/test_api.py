"""Tests for API endpoints using mocked engine."""

from __future__ import annotations

import json
import logging
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from opta_lmx.inference.types import DownloadTask
from opta_lmx.monitoring.logging import JSONFormatter


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """GET /admin/health returns ok."""
    response = await client.get("/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_admin_status(client: AsyncClient) -> None:
    """GET /admin/status returns system info."""
    response = await client.get("/admin/status")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "0.1.0"
    assert "memory" in data
    assert data["memory"]["threshold_percent"] == 90


@pytest.mark.asyncio
async def test_admin_memory(client: AsyncClient) -> None:
    """GET /admin/memory returns memory details."""
    response = await client.get("/admin/memory")
    assert response.status_code == 200
    data = response.json()
    assert data["total_unified_memory_gb"] > 0
    assert data["threshold_percent"] == 90


@pytest.mark.asyncio
async def test_list_models_empty(client: AsyncClient) -> None:
    """GET /v1/models returns empty list when nothing loaded."""
    response = await client.get("/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert data["data"] == []


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_chat_completion_missing_model(client: AsyncClient) -> None:
    """POST /v1/chat/completions without model field returns 422."""
    response = await client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_completion_missing_messages(client: AsyncClient) -> None:
    """POST /v1/chat/completions without messages returns 422."""
    response = await client.post(
        "/v1/chat/completions",
        json={"model": "test-model"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_unload_nonexistent_model(client: AsyncClient) -> None:
    """Unloading a model that isn't loaded returns 404."""
    response = await client.post(
        "/admin/models/unload",
        json={"model_id": "nonexistent"},
    )
    assert response.status_code == 404


# --- Admin models list tests (M4) ---


@pytest.mark.asyncio
async def test_admin_models_empty(client: AsyncClient) -> None:
    """GET /admin/models returns empty list when nothing loaded."""
    response = await client.get("/admin/models")
    assert response.status_code == 200
    data = response.json()
    assert data["loaded"] == []
    assert data["count"] == 0


@pytest.mark.asyncio
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


# --- Legacy completions stub tests (M5) ---


@pytest.mark.asyncio
async def test_legacy_completions_returns_501(client: AsyncClient) -> None:
    """POST /v1/completions returns 501 Not Implemented."""
    response = await client.post(
        "/v1/completions",
        json={"model": "test", "prompt": "Hello"},
    )
    assert response.status_code == 501
    data = response.json()
    assert data["error"]["code"] == "not_implemented"
    assert "/v1/chat/completions" in data["error"]["message"]


# --- Admin key authentication tests ---


@pytest.mark.asyncio
async def test_admin_no_auth_when_key_is_none(client: AsyncClient) -> None:
    """Admin endpoints work without auth header when admin_key is None."""
    response = await client.get("/admin/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_rejects_missing_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints reject requests without X-Admin-Key when auth is enabled."""
    response = await client_with_auth.get("/admin/health")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_rejects_wrong_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints reject requests with wrong X-Admin-Key."""
    response = await client_with_auth.get(
        "/admin/health",
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_accepts_correct_key(client_with_auth: AsyncClient) -> None:
    """Admin endpoints accept requests with correct X-Admin-Key."""
    response = await client_with_auth.get(
        "/admin/health",
        headers={"X-Admin-Key": "test-secret-key"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
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


def test_json_formatter_captures_extra_fields() -> None:
    """JSONFormatter includes extra={} fields in output (C4 fix)."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="model_loaded",
        args=(),
        exc_info=None,
    )
    # Simulate logger.info("model_loaded", extra={"model_id": "test", "duration_sec": 1.5})
    record.model_id = "test"  # type: ignore[attr-defined]
    record.duration_sec = 1.5  # type: ignore[attr-defined]

    output = formatter.format(record)
    data = json.loads(output)

    assert data["message"] == "model_loaded"
    assert data["model_id"] == "test"
    assert data["duration_sec"] == 1.5


def test_json_formatter_redacts_sensitive_keys() -> None:
    """JSONFormatter strips sensitive keys from output (G-LMX-03)."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="event",
        args=(),
        exc_info=None,
    )
    record.api_key = "sk-secret123"  # type: ignore[attr-defined]
    record.token = "bearer-xxx"  # type: ignore[attr-defined]
    record.safe_field = "visible"  # type: ignore[attr-defined]

    output = formatter.format(record)
    data = json.loads(output)

    assert "api_key" not in data
    assert "token" not in data
    assert data["safe_field"] == "visible"


# --- Available models tests ---


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_download_progress_404_for_unknown(client: AsyncClient) -> None:
    """GET /admin/models/download/{id}/progress returns 404 for unknown IDs."""
    response = await client.get("/admin/models/download/nonexistent/progress")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "download_not_found"


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_delete_409_for_loaded_model(client: AsyncClient) -> None:
    """DELETE /admin/models/{id} returns 409 if model is currently loaded."""
    # Load a model first
    await client.post("/admin/models/load", json={"model_id": "test-model"})

    response = await client.request("DELETE", "/admin/models/test-model")
    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "model_in_use"


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_download_requires_auth(client_with_auth: AsyncClient) -> None:
    """POST /admin/models/download rejects without X-Admin-Key."""
    response = await client_with_auth.post(
        "/admin/models/download",
        json={"repo_id": "mlx-community/test-model"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_requires_auth(client_with_auth: AsyncClient) -> None:
    """DELETE /admin/models/{id} rejects without X-Admin-Key."""
    response = await client_with_auth.request(
        "DELETE", "/admin/models/test-model",
    )
    assert response.status_code == 403


# --- Smart routing tests ---


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_prometheus_metrics_endpoint(client: AsyncClient) -> None:
    """GET /admin/metrics returns Prometheus text format."""
    response = await client.get("/admin/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "lmx_requests_total" in response.text
    assert "lmx_uptime_seconds" in response.text


@pytest.mark.asyncio
async def test_metrics_json_endpoint(client: AsyncClient) -> None:
    """GET /admin/metrics/json returns JSON summary."""
    response = await client.get("/admin/metrics/json")
    assert response.status_code == 200
    data = response.json()
    assert "total_requests" in data
    assert "per_model" in data


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_metrics_requires_auth(client_with_auth: AsyncClient) -> None:
    """GET /admin/metrics rejects without X-Admin-Key."""
    response = await client_with_auth.get("/admin/metrics")
    assert response.status_code == 403


# --- Config reload tests ---


@pytest.mark.asyncio
async def test_config_reload_returns_success(client: AsyncClient) -> None:
    """POST /admin/config/reload returns success with updated sections."""
    response = await client.post("/admin/config/reload")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "routing" in data["updated"]
    assert "memory" in data["updated"]


@pytest.mark.asyncio
async def test_config_reload_requires_auth(client_with_auth: AsyncClient) -> None:
    """POST /admin/config/reload rejects without X-Admin-Key."""
    response = await client_with_auth.post("/admin/config/reload")
    assert response.status_code == 403
