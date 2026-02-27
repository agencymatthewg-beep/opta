"""Tests for /admin/sessions API routes."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.sessions.store import SessionStore

# ── Fixtures ──────────────────────────────────────────────────────────────────


def _write_session(sessions_dir: Path, session_id: str, **kwargs: object) -> None:
    data = {
        "id": session_id,
        "title": kwargs.get("title", "Test"),
        "model": kwargs.get("model", "claude-3"),
        "tags": kwargs.get("tags", []),
        "created": kwargs.get("created", "2024-01-01T00:00:00Z"),
        "updated": kwargs.get("updated", "2024-01-01T00:00:00Z"),
        "messages": kwargs.get("messages", []),
        "cwd": "/home",
        "toolCallCount": 0,
        "compacted": False,
    }
    (sessions_dir / f"{session_id}.json").write_text(
        json.dumps(data), encoding="utf-8"
    )


@pytest.fixture
async def sessions_client(
    mock_engine: object,
    mock_model_manager: object,
    tmp_path: Path,
) -> AsyncIterator[tuple[AsyncClient, Path]]:
    """Test client with a real SessionStore backed by tmp_path."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()

    test_app = create_app(LMXConfig())
    store = SessionStore(sessions_dir)

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        test_app.state.engine = mock_engine
        test_app.state.memory_monitor = MemoryMonitor(max_percent=90)
        test_app.state.model_manager = mock_model_manager
        test_app.state.router = TaskRouter(RoutingConfig())
        test_app.state.metrics = MetricsCollector()
        test_app.state.preset_manager = PresetManager(tmp_path / "presets")
        test_app.state.event_bus = EventBus()
        test_app.state.embedding_engine = EmbeddingEngine()
        test_app.state.pending_downloads = {}
        test_app.state.start_time = 0.0
        test_app.state.admin_key = "test-key"
        test_app.state.config = LMXConfig()
        test_app.state.remote_embedding = None
        test_app.state.remote_reranking = None
        test_app.state.session_store = store
        yield http_client, sessions_dir


AUTH = {"X-Admin-Key": "test-key"}


# ── GET /admin/sessions ───────────────────────────────────────────────────────


async def test_list_sessions_empty(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, _ = sessions_client
    resp = await client.get("/admin/sessions", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessions"] == []
    assert data["total"] == 0


async def test_list_sessions_with_data(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(sessions_dir, "s1", title="Session One")
    _write_session(sessions_dir, "s2", title="Session Two")
    resp = await client.get("/admin/sessions", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2


async def test_list_sessions_filter_model(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(sessions_dir, "s1", model="claude-opus")
    _write_session(sessions_dir, "s2", model="gpt-4")
    resp = await client.get("/admin/sessions?model=claude", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_list_sessions_pagination(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    for i in range(5):
        _write_session(sessions_dir, f"s{i}")
    resp = await client.get("/admin/sessions?limit=2&offset=0", headers=AUTH)
    assert resp.status_code == 200
    assert len(resp.json()["sessions"]) == 2


async def test_list_sessions_requires_auth(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, _ = sessions_client
    resp = await client.get("/admin/sessions")
    assert resp.status_code in (401, 403)  # Missing admin key → forbidden


# ── GET /admin/sessions/search ────────────────────────────────────────────────


async def test_search_sessions_found(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(sessions_dir, "s1", title="Python debugging session")
    resp = await client.get("/admin/sessions/search?q=python", headers=AUTH)
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["id"] == "s1"


async def test_search_sessions_not_found(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(sessions_dir, "s1", title="Python session")
    resp = await client.get("/admin/sessions/search?q=rust", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == []


# ── GET /admin/sessions/{id} ──────────────────────────────────────────────────


async def test_get_session_found(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(
        sessions_dir, "s1",
        title="Full Session",
        messages=[{"role": "user", "content": "hello"}],
    )
    resp = await client.get("/admin/sessions/s1", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "s1"
    assert data["title"] == "Full Session"
    assert len(data["messages"]) == 1


async def test_get_session_not_found(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, _ = sessions_client
    resp = await client.get("/admin/sessions/nonexistent", headers=AUTH)
    assert resp.status_code == 404


# ── DELETE /admin/sessions/{id} ───────────────────────────────────────────────


async def test_delete_session_success(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, sessions_dir = sessions_client
    _write_session(sessions_dir, "s1")
    resp = await client.delete("/admin/sessions/s1", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == {"deleted": True}
    assert not (sessions_dir / "s1.json").exists()


async def test_delete_session_not_found(
    sessions_client: tuple[AsyncClient, Path],
) -> None:
    client, _ = sessions_client
    resp = await client.delete("/admin/sessions/ghost", headers=AUTH)
    assert resp.status_code == 404
