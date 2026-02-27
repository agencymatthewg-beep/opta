"""Tests for runtime and update journaling."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from opta_lmx.config import JournalingConfig, LMXConfig
from opta_lmx.main import create_app
from opta_lmx.monitoring.events import ServerEvent
from opta_lmx.monitoring.journal import RuntimeJournalManager, write_update_log


def test_session_filename_and_frontmatter_generation(tmp_path: Path) -> None:
    """Session logs use YJS-style filename and required frontmatter keys."""
    manager = RuntimeJournalManager(
        config=JournalingConfig(
            enabled=True,
            session_logs_dir=tmp_path / "12-Session-Logs",
            update_logs_dir=tmp_path / "updates",
            author="alice",
            timezone="UTC",
            event_jsonl_enabled=False,
        )
    )
    started_at = datetime(2026, 2, 23, 14, 5, tzinfo=UTC)
    ended_at = datetime(2026, 2, 23, 14, 10, tzinfo=UTC)

    manager.start_runtime_session(
        model="opta-lmx-test",
        device="MBP-1",
        user="alice",
        started_at=started_at,
    )
    path = manager.finalize_runtime_session(summary="startup-check", ended_at=ended_at)

    assert path is not None
    assert path.name == "2026-02-23-1405-mbp-1-startup-check.md"
    content = path.read_text(encoding="utf-8")
    assert "date: 2026-02-23" in content
    assert "time: \"14:05 UTC\"" in content
    assert "device: \"mbp-1\"" in content
    assert "user: \"alice\"" in content
    assert "model: \"opta-lmx-test\"" in content
    assert "duration: \"00:05:00\"" in content


def test_event_summary_counting(tmp_path: Path) -> None:
    """Session summary includes aggregated event counts."""
    manager = RuntimeJournalManager(
        config=JournalingConfig(
            enabled=True,
            session_logs_dir=tmp_path / "12-Session-Logs",
            update_logs_dir=tmp_path / "updates",
            timezone="UTC",
            event_jsonl_enabled=False,
        )
    )
    manager.start_runtime_session(
        model="opta-lmx-test",
        started_at=datetime(2026, 2, 23, 10, 0, tzinfo=UTC),
    )
    manager.record_event(ServerEvent(event_type="model_loaded", data={"model_id": "a"}))
    manager.record_event(ServerEvent(event_type="model_loaded", data={"model_id": "b"}))
    manager.record_event(ServerEvent(event_type="download_failed", data={"repo_id": "a"}))

    path = manager.finalize_runtime_session(
        summary="event-summary",
        ended_at=datetime(2026, 2, 23, 10, 1, tzinfo=UTC),
    )
    assert path is not None

    content = path.read_text(encoding="utf-8")
    assert "Total events: 3" in content
    assert "| model_loaded | 2 |" in content
    assert "| download_failed | 1 |" in content


def test_write_update_log_numbering_and_sections(tmp_path: Path) -> None:
    """Update logs use numbered filenames and include standard sections."""
    update_logs_dir = tmp_path / "updates"
    now = datetime(2026, 2, 23, 12, 30, tzinfo=UTC)

    first = write_update_log(
        update_logs_dir=update_logs_dir,
        title="LMX sync",
        summary="Aligned journaling format with Opta CLI.",
        category="sync",
        author="alice",
        timezone="UTC",
        series_start=200,
        now=now,
        command_inputs={"mode": "remote", "components": ["lmx"]},
        steps=[
            {
                "target": "mono512",
                "component": "lmx",
                "step": "deploy",
                "status": "ok",
                "message": "complete",
            }
        ],
    )
    second = write_update_log(
        update_logs_dir=update_logs_dir,
        title="LMX sync",
        summary="Second sync pass.",
        category="sync",
        author="alice",
        timezone="UTC",
        series_start=200,
        now=now,
    )

    assert first.name == "200_2026-02-23_lmx-sync.md"
    assert second.name == "201_2026-02-23_lmx-sync.md"

    content = first.read_text(encoding="utf-8")
    assert "id: 200" in content
    assert "## Summary" in content
    assert "## Command Inputs" in content
    assert "## Step Results" in content
    assert "| mono512 | lmx | deploy | ok | complete |" in content


@pytest.mark.asyncio
async def test_lifespan_journaling_smoke(tmp_path: Path) -> None:
    """Lifespan startup/shutdown writes one session log and event JSONL."""
    config = LMXConfig(
        models={"auto_load": []},
        journaling={
            "enabled": True,
            "session_logs_dir": tmp_path / "12-Session-Logs",
            "update_logs_dir": tmp_path / "updates",
            "event_jsonl_enabled": True,
            "timezone": "UTC",
            "author": "test-user",
        },
    )  # type: ignore[arg-type]
    app = create_app(config)

    async with app.router.lifespan_context(app):
        await app.state.event_bus.publish(ServerEvent(
            event_type="model_loaded",
            data={"model_id": "smoke-model", "memory_gb": 1.0},
        ))
        await asyncio.sleep(0.05)

    session_files = sorted((tmp_path / "12-Session-Logs").glob("*.md"))
    assert len(session_files) == 1
    content = session_files[0].read_text(encoding="utf-8")
    assert "| model_loaded | 1 |" in content

    jsonl_files = sorted((tmp_path / "12-Session-Logs").glob("*.jsonl"))
    assert len(jsonl_files) == 1
    lines = [line for line in jsonl_files[0].read_text(encoding="utf-8").splitlines() if line]
    payloads = [json.loads(line) for line in lines]
    assert any(item.get("event_type") == "model_loaded" for item in payloads)
