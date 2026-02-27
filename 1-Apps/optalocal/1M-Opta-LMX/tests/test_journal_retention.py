"""Tests for journal log retention policy and admin log browsing endpoints."""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import JournalingConfig, LMXConfig
from opta_lmx.main import create_app
from opta_lmx.monitoring.journal import RuntimeJournalManager

# ─── Retention policy unit tests ─────────────────────────────────────────────


def _make_manager(
    tmp_path: Path, *, retention_days: int = 30, max_session_logs: int = 100,
) -> RuntimeJournalManager:
    """Create a RuntimeJournalManager with a temp directory and custom retention."""
    return RuntimeJournalManager(
        config=JournalingConfig(
            enabled=True,
            session_logs_dir=tmp_path / "session-logs",
            update_logs_dir=tmp_path / "update-logs",
            event_jsonl_enabled=False,
            author="test",
            timezone="UTC",
            retention_days=retention_days,
            max_session_logs=max_session_logs,
        )
    )


def _create_file_with_age(directory: Path, filename: str, age_days: int) -> Path:
    """Create a file and backdate its mtime by ``age_days`` days."""
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    path.write_text(f"# {filename}\ntest content\n", encoding="utf-8")
    old_time = time.time() - (age_days * 86400)
    os.utime(path, (old_time, old_time))
    return path


def test_prune_removes_session_logs_older_than_retention_days(tmp_path: Path) -> None:
    """Session log files older than retention_days are deleted."""
    manager = _make_manager(tmp_path, retention_days=7)
    session_dir = tmp_path / "session-logs"

    # Create files: one old (10 days), one recent (2 days)
    old_file = _create_file_with_age(session_dir, "2026-02-01-old-session.md", age_days=10)
    recent_file = _create_file_with_age(session_dir, "2026-02-20-recent-session.md", age_days=2)

    deleted = manager.prune_old_logs()

    assert deleted == 1
    assert not old_file.exists()
    assert recent_file.exists()


def test_prune_removes_update_logs_older_than_retention_days(tmp_path: Path) -> None:
    """Update log files older than retention_days are deleted."""
    manager = _make_manager(tmp_path, retention_days=7)
    update_dir = tmp_path / "update-logs"

    old_file = _create_file_with_age(update_dir, "200_2026-01-01_old-update.md", age_days=10)
    recent_file = _create_file_with_age(update_dir, "201_2026-02-20_recent-update.md", age_days=2)

    deleted = manager.prune_old_logs()

    assert deleted == 1
    assert not old_file.exists()
    assert recent_file.exists()


def test_prune_removes_old_jsonl_session_files(tmp_path: Path) -> None:
    """JSONL event files in the session log directory are also pruned by age."""
    manager = _make_manager(tmp_path, retention_days=5)
    session_dir = tmp_path / "session-logs"

    old_jsonl = _create_file_with_age(session_dir, "2026-01-01-events.jsonl", age_days=10)
    recent_jsonl = _create_file_with_age(session_dir, "2026-02-20-events.jsonl", age_days=1)

    deleted = manager.prune_old_logs()

    assert deleted == 1
    assert not old_jsonl.exists()
    assert recent_jsonl.exists()


def test_prune_respects_max_session_logs_limit(tmp_path: Path) -> None:
    """Excess session *.md files beyond max_session_logs are removed, oldest first."""
    manager = _make_manager(tmp_path, retention_days=365, max_session_logs=3)
    session_dir = tmp_path / "session-logs"

    # Create 5 session .md files with staggered ages (all within retention window)
    files = []
    for i in range(5):
        f = _create_file_with_age(session_dir, f"session-{i:02d}.md", age_days=5 - i)
        files.append(f)

    deleted = manager.prune_old_logs()

    # Should delete the 2 oldest (session-00.md, session-01.md)
    assert deleted == 2
    assert not files[0].exists()
    assert not files[1].exists()
    assert files[2].exists()
    assert files[3].exists()
    assert files[4].exists()


def test_prune_with_empty_directories(tmp_path: Path) -> None:
    """Prune with nonexistent directories returns 0 and does not error."""
    manager = _make_manager(tmp_path, retention_days=7)
    # Directories don't exist yet — should be a no-op
    deleted = manager.prune_old_logs()
    assert deleted == 0


def test_prune_combined_age_and_count(tmp_path: Path) -> None:
    """Files deleted by age don't count against max_session_logs."""
    manager = _make_manager(tmp_path, retention_days=5, max_session_logs=2)
    session_dir = tmp_path / "session-logs"

    # 2 old files (will be pruned by age) + 3 recent files (2 pruned by count)
    old1 = _create_file_with_age(session_dir, "old-1.md", age_days=10)
    old2 = _create_file_with_age(session_dir, "old-2.md", age_days=8)
    recent1 = _create_file_with_age(session_dir, "recent-1.md", age_days=3)
    recent2 = _create_file_with_age(session_dir, "recent-2.md", age_days=2)
    recent3 = _create_file_with_age(session_dir, "recent-3.md", age_days=1)

    deleted = manager.prune_old_logs()

    # 2 deleted by age + 1 deleted by max_session_logs (only 3 remain after age prune, limit=2)
    assert deleted == 3
    assert not old1.exists()
    assert not old2.exists()
    assert not recent1.exists()  # oldest of the remaining 3, trimmed to keep 2
    assert recent2.exists()
    assert recent3.exists()


# ─── Admin endpoint integration tests ────────────────────────────────────────


@pytest.fixture
async def journal_client(tmp_path: Path) -> AsyncClient:
    """Test HTTP client with journaling config pointed at tmp_path."""
    config = LMXConfig(
        models={"auto_load": []},
        journaling={
            "enabled": True,
            "session_logs_dir": str(tmp_path / "session-logs"),
            "update_logs_dir": str(tmp_path / "update-logs"),
            "event_jsonl_enabled": False,
            "timezone": "UTC",
            "author": "test-user",
        },
    )  # type: ignore[arg-type]
    app = create_app(config)

    # Create sample files for the tests
    session_dir = tmp_path / "session-logs"
    update_dir = tmp_path / "update-logs"
    session_dir.mkdir(parents=True, exist_ok=True)
    update_dir.mkdir(parents=True, exist_ok=True)

    (session_dir / "2026-02-20-1000-device-session.md").write_text(
        "# Session Log\nTest session content", encoding="utf-8",
    )
    (session_dir / "2026-02-20-1000-device-events.jsonl").write_text(
        '{"event_type": "test"}\n', encoding="utf-8",
    )
    (update_dir / "200_2026-02-20_test-update.md").write_text(
        "# Update Log\nTest update content", encoding="utf-8",
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Inject required state that lifespan normally sets up
        app.state.config = config
        yield client


@pytest.mark.asyncio
async def test_list_session_logs_endpoint(journal_client: AsyncClient) -> None:
    """GET /admin/logs/sessions returns a list of session log files."""
    resp = await journal_client.get("/admin/logs/sessions")
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # Check structure of first entry
    entry = data[0]
    assert "filename" in entry
    assert "size_bytes" in entry
    assert "created_at" in entry
    assert entry["size_bytes"] > 0


@pytest.mark.asyncio
async def test_read_session_log_endpoint(journal_client: AsyncClient) -> None:
    """GET /admin/logs/sessions/{filename} returns file content."""
    resp = await journal_client.get(
        "/admin/logs/sessions/2026-02-20-1000-device-session.md"
    )
    assert resp.status_code == 200
    assert "Test session content" in resp.text


@pytest.mark.asyncio
async def test_read_session_log_not_found(journal_client: AsyncClient) -> None:
    """GET /admin/logs/sessions/{filename} returns 404 for missing files."""
    resp = await journal_client.get("/admin/logs/sessions/nonexistent.md")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_read_session_log_path_traversal_rejected(journal_client: AsyncClient) -> None:
    """Path traversal attempts are rejected with 400."""
    resp = await journal_client.get("/admin/logs/sessions/..%2F..%2Fetc%2Fpasswd")
    assert resp.status_code in (400, 404)


@pytest.mark.asyncio
async def test_list_update_logs_endpoint(journal_client: AsyncClient) -> None:
    """GET /admin/logs/updates returns a list of update log files."""
    resp = await journal_client.get("/admin/logs/updates")
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["filename"] == "200_2026-02-20_test-update.md"


@pytest.mark.asyncio
async def test_read_update_log_endpoint(journal_client: AsyncClient) -> None:
    """GET /admin/logs/updates/{filename} returns file content."""
    resp = await journal_client.get(
        "/admin/logs/updates/200_2026-02-20_test-update.md"
    )
    assert resp.status_code == 200
    assert "Test update content" in resp.text


@pytest.mark.asyncio
async def test_read_update_log_not_found(journal_client: AsyncClient) -> None:
    """GET /admin/logs/updates/{filename} returns 404 for missing files."""
    resp = await journal_client.get("/admin/logs/updates/999_missing.md")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_session_logs_empty_dir(tmp_path: Path) -> None:
    """GET /admin/logs/sessions returns [] when directory is empty."""
    config = LMXConfig(
        models={"auto_load": []},
        journaling={
            "enabled": True,
            "session_logs_dir": str(tmp_path / "empty-sessions"),
            "update_logs_dir": str(tmp_path / "empty-updates"),
            "event_jsonl_enabled": False,
        },
    )  # type: ignore[arg-type]
    app = create_app(config)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        app.state.config = config
        resp = await client.get("/admin/logs/sessions")
        assert resp.status_code == 200
        assert resp.json() == []
