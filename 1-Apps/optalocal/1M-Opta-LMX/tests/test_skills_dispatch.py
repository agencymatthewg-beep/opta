"""Tests for async skills dispatchers."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from opta_lmx.skills.dispatch import (
    LocalSkillDispatcher,
    QueuedSkillDispatcher,
    SkillDispatchOverloadedError,
)
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.manifest import SkillManifest


def _entrypoint_manifest(module: str, function: str) -> SkillManifest:
    return SkillManifest.model_validate(
        {
            "schema": "opta.skills.manifest/v1",
            "name": f"{module}_{function}",
            "kind": "entrypoint",
            "description": "entrypoint",
            "entrypoint": f"{module}:{function}",
        }
    )


def _write_module(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


async def test_local_dispatcher_executes_manifest(tmp_path: Path) -> None:
    _write_module(
        tmp_path / "local_skill.py",
        "def run(topic: str) -> dict[str, dict[str, str]]:\n"
        "    return {'echo': {'topic': topic}}\n",
    )
    manifest = _entrypoint_manifest("local_skill", "run")

    dispatcher = LocalSkillDispatcher(SkillExecutor(module_search_paths=[tmp_path]))
    result = await dispatcher.execute(manifest, arguments={"topic": "local"})
    assert result.ok is True
    assert result.output == {"echo": {"topic": "local"}}
    await dispatcher.close()


async def test_queued_dispatcher_executes_manifest(tmp_path: Path) -> None:
    _write_module(
        tmp_path / "queued_skill.py",
        "def run(topic: str) -> dict[str, dict[str, str]]:\n"
        "    return {'echo': {'topic': topic}}\n",
    )
    manifest = _entrypoint_manifest("queued_skill", "run")

    dispatcher = QueuedSkillDispatcher(
        executor=SkillExecutor(module_search_paths=[tmp_path]),
        worker_count=1,
        max_queue_size=4,
    )
    await dispatcher.start()
    try:
        result = await dispatcher.execute(manifest, arguments={"topic": "queued"})
        assert result.ok is True
        assert result.output == {"echo": {"topic": "queued"}}
    finally:
        await dispatcher.close()


async def test_queued_dispatcher_rejects_when_queue_is_full(tmp_path: Path) -> None:
    _write_module(
        tmp_path / "slow_skill.py",
        "import time\n"
        "def run(delay: float) -> str:\n"
        "    time.sleep(delay)\n"
        "    return 'ok'\n",
    )
    manifest = _entrypoint_manifest("slow_skill", "run")

    dispatcher = QueuedSkillDispatcher(
        executor=SkillExecutor(module_search_paths=[tmp_path]),
        worker_count=1,
        max_queue_size=1,
    )
    await dispatcher.start()
    try:
        first = asyncio.create_task(dispatcher.execute(manifest, arguments={"delay": 0.2}))
        await asyncio.sleep(0.01)
        second = asyncio.create_task(dispatcher.execute(manifest, arguments={"delay": 0.2}))
        await asyncio.sleep(0.01)

        with pytest.raises(SkillDispatchOverloadedError):
            await dispatcher.execute(manifest, arguments={"delay": 0.2})

        await first
        await second
    finally:
        await dispatcher.close()


async def test_sqlite_queued_dispatcher_executes_manifest(tmp_path: Path) -> None:
    _write_module(
        tmp_path / "sqlite_skill.py",
        "def run(topic: str) -> dict[str, dict[str, str]]:\n"
        "    return {'echo': {'topic': topic}}\n",
    )
    manifest = _entrypoint_manifest("sqlite_skill", "run")

    dispatcher = QueuedSkillDispatcher(
        executor=SkillExecutor(module_search_paths=[tmp_path]),
        worker_count=1,
        max_queue_size=4,
        backend="sqlite",
        persist_path=tmp_path / "skills-queue.db",
        poll_interval_sec=0.01,
    )
    await dispatcher.start()
    try:
        result = await dispatcher.execute(manifest, arguments={"topic": "sqlite"})
        assert result.ok is True
        assert result.output == {"echo": {"topic": "sqlite"}}
    finally:
        await dispatcher.close()
