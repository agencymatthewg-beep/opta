"""Async skill dispatchers for local and queue-backed execution paths."""

from __future__ import annotations

import asyncio
import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Literal, Protocol

from opta_lmx.skills.executors import SkillExecutionResult, SkillExecutor
from opta_lmx.skills.manifest import SkillManifest


class SkillDispatchOverloadedError(RuntimeError):
    """Raised when skill dispatch queue is saturated."""

    def __init__(self, *, size: int, capacity: int, retry_after: int = 5) -> None:
        self.size = size
        self.capacity = capacity
        self.retry_after = retry_after
        super().__init__(f"Skill dispatch queue is full ({size}/{capacity})")


class SkillDispatcher(Protocol):
    """Async interface for executing skills."""

    async def execute(
        self,
        manifest: SkillManifest,
        *,
        arguments: dict[str, object] | None = None,
        approved: bool = False,
        timeout_sec: float | None = None,
    ) -> SkillExecutionResult:
        """Execute one skill."""

    async def close(self) -> None:
        """Close dispatcher resources."""


class LocalSkillDispatcher:
    """Direct dispatcher that offloads skill execution to a thread."""

    def __init__(self, executor: SkillExecutor) -> None:
        self._executor = executor

    async def execute(
        self,
        manifest: SkillManifest,
        *,
        arguments: dict[str, object] | None = None,
        approved: bool = False,
        timeout_sec: float | None = None,
    ) -> SkillExecutionResult:
        return await asyncio.to_thread(
            self._executor.execute,
            manifest,
            arguments=arguments,
            approved=approved,
            timeout_sec=timeout_sec,
        )

    async def close(self) -> None:
        return


@dataclass(slots=True)
class _QueuedDispatchCall:
    manifest: SkillManifest
    arguments: dict[str, object] | None
    approved: bool
    timeout_sec: float | None
    future: asyncio.Future[SkillExecutionResult]


@dataclass(slots=True)
class _ClaimedSQLiteCall:
    row_id: int
    job_id: str
    payload_json: str


class QueuedSkillDispatcher:
    """Queue-backed dispatcher for heavier skill workloads.

    Supports in-memory queueing and SQLite-backed persistence.
    """

    def __init__(
        self,
        *,
        executor: SkillExecutor,
        worker_count: int = 4,
        max_queue_size: int = 256,
        backend: Literal["memory", "sqlite"] = "memory",
        persist_path: Path | None = None,
        poll_interval_sec: float = 0.05,
    ) -> None:
        if worker_count < 1:
            raise ValueError("worker_count must be >= 1")
        if max_queue_size < 1:
            raise ValueError("max_queue_size must be >= 1")
        if poll_interval_sec <= 0:
            raise ValueError("poll_interval_sec must be > 0")
        if backend not in {"memory", "sqlite"}:
            raise ValueError("backend must be 'memory' or 'sqlite'")

        self._executor = executor
        self._worker_count = worker_count
        self._max_queue_size = max_queue_size
        self._workers: list[asyncio.Task[None]] = []
        self._started = False
        self._backend = backend
        self._poll_interval_sec = poll_interval_sec

        self._queue: asyncio.Queue[_QueuedDispatchCall | None] | None = None
        self._persist_path: Path | None = None
        self._db_lock = Lock()
        self._sqlite_futures: dict[str, asyncio.Future[SkillExecutionResult]] = {}

        if backend == "memory":
            self._queue = asyncio.Queue(maxsize=max_queue_size)
        else:
            if persist_path is None:
                raise ValueError("persist_path is required when backend='sqlite'")
            self._persist_path = Path(persist_path).expanduser()
            self._init_db()
            self._recover_running_rows()

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        self._workers = [
            asyncio.create_task(self._worker_loop(index), name=f"skills-dispatcher-{index}")
            for index in range(self._worker_count)
        ]

    async def execute(
        self,
        manifest: SkillManifest,
        *,
        arguments: dict[str, object] | None = None,
        approved: bool = False,
        timeout_sec: float | None = None,
    ) -> SkillExecutionResult:
        if not self._started:
            raise RuntimeError("QueuedSkillDispatcher is not started")

        if self._backend == "memory":
            queue = self._queue
            if queue is None:
                raise RuntimeError("In-memory skill queue is unavailable")
            loop = asyncio.get_running_loop()
            future: asyncio.Future[SkillExecutionResult] = loop.create_future()
            call = _QueuedDispatchCall(
                manifest=manifest,
                arguments=arguments,
                approved=approved,
                timeout_sec=timeout_sec,
                future=future,
            )
            try:
                queue.put_nowait(call)
            except asyncio.QueueFull as exc:
                raise SkillDispatchOverloadedError(
                    size=queue.qsize(),
                    capacity=queue.maxsize,
                ) from exc
            return await future

        queued_size = await asyncio.to_thread(self._db_count_queued)
        if queued_size >= self._max_queue_size:
            raise SkillDispatchOverloadedError(size=queued_size, capacity=self._max_queue_size)

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        job_id = uuid.uuid4().hex
        payload = {
            "manifest": manifest.model_dump(mode="json", by_alias=True),
            "arguments": dict(arguments or {}),
            "approved": approved,
            "timeout_sec": timeout_sec,
        }
        payload_json = json.dumps(payload, separators=(",", ":"))
        await asyncio.to_thread(self._db_enqueue, job_id, payload_json)
        self._sqlite_futures[job_id] = future
        try:
            return await future
        finally:
            self._sqlite_futures.pop(job_id, None)

    async def close(self) -> None:
        if not self._started:
            return
        self._started = False

        if self._backend == "memory":
            queue = self._queue
            if queue is not None:
                for _ in self._workers:
                    await queue.put(None)
            await asyncio.gather(*self._workers, return_exceptions=True)
            self._workers = []
            return

        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers = []
        self._recover_running_rows()

    async def _worker_loop(self, worker_index: int) -> None:
        if self._backend == "memory":
            await self._memory_worker_loop(worker_index)
            return
        await self._sqlite_worker_loop(worker_index)

    async def _memory_worker_loop(self, worker_index: int) -> None:
        queue = self._queue
        if queue is None:
            return
        while True:
            call = await queue.get()
            try:
                if call is None:
                    return
                result = await asyncio.to_thread(
                    self._executor.execute,
                    call.manifest,
                    arguments=call.arguments,
                    approved=call.approved,
                    timeout_sec=call.timeout_sec,
                )
                if not call.future.done():
                    call.future.set_result(result)
            except Exception as exc:
                if call is not None and not call.future.done():
                    call.future.set_exception(exc)
            finally:
                queue.task_done()

    async def _sqlite_worker_loop(self, worker_index: int) -> None:
        claimed: _ClaimedSQLiteCall | None = None
        while True:
            if not self._started and claimed is None:
                return
            try:
                if claimed is None:
                    claimed = await asyncio.to_thread(self._db_claim_next)
                    if claimed is None:
                        await asyncio.sleep(self._poll_interval_sec)
                        continue

                payload = json.loads(claimed.payload_json)
                manifest = SkillManifest.model_validate(payload.get("manifest", {}))
                arguments_obj = payload.get("arguments")
                arguments: dict[str, object] | None
                if isinstance(arguments_obj, dict):
                    arguments = {str(key): value for key, value in arguments_obj.items()}
                else:
                    arguments = {}
                approved = bool(payload.get("approved", False))
                timeout_value = payload.get("timeout_sec")
                timeout_sec = (
                    float(timeout_value) if isinstance(timeout_value, (int, float)) else None
                )

                result = await asyncio.to_thread(
                    self._executor.execute,
                    manifest,
                    arguments=arguments,
                    approved=approved,
                    timeout_sec=timeout_sec,
                )
                future = self._sqlite_futures.get(claimed.job_id)
                if future is not None and not future.done():
                    future.set_result(result)
                await asyncio.to_thread(self._db_complete_claimed, claimed.row_id)
                claimed = None
            except asyncio.CancelledError:
                if claimed is not None:
                    await asyncio.to_thread(self._db_requeue_claimed, claimed.row_id)
                raise
            except Exception as exc:
                future = None if claimed is None else self._sqlite_futures.get(claimed.job_id)
                if future is not None and not future.done():
                    future.set_exception(exc)
                if claimed is not None:
                    await asyncio.to_thread(self._db_complete_claimed, claimed.row_id)
                    claimed = None
                if self._backend == "sqlite":
                    # Keep worker alive after one bad payload/execution failure.
                    continue
                raise RuntimeError(
                    f"Unexpected sqlite dispatch worker error on worker {worker_index}"
                ) from exc

    def _init_db(self) -> None:
        path = self._require_persist_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute("PRAGMA journal_mode=WAL;")
                con.execute(
                    """
                    CREATE TABLE IF NOT EXISTS skill_queue (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        job_id TEXT NOT NULL UNIQUE,
                        payload_json TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'queued',
                        enqueued_at REAL NOT NULL,
                        claimed_at REAL
                    )
                    """
                )
                con.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_skill_queue_status_id
                    ON skill_queue(status, id)
                    """
                )
                con.commit()
            finally:
                con.close()

    def _recover_running_rows(self) -> None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute(
                    """
                    UPDATE skill_queue
                    SET status='queued', claimed_at=NULL
                    WHERE status='running'
                    """
                )
                con.commit()
            finally:
                con.close()

    def _db_count_queued(self) -> int:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                row = con.execute(
                    "SELECT COUNT(1) FROM skill_queue WHERE status='queued'"
                ).fetchone()
                if row is None:
                    return 0
                return int(row[0])
            finally:
                con.close()

    def _db_enqueue(self, job_id: str, payload_json: str) -> None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute(
                    """
                    INSERT INTO skill_queue(job_id, payload_json, status, enqueued_at)
                    VALUES (?, ?, 'queued', ?)
                    """,
                    (job_id, payload_json, time.time()),
                )
                con.commit()
            finally:
                con.close()

    def _db_claim_next(self) -> _ClaimedSQLiteCall | None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute("BEGIN IMMEDIATE")
                row = con.execute(
                    """
                    SELECT id, job_id, payload_json
                    FROM skill_queue
                    WHERE status='queued'
                    ORDER BY id ASC
                    LIMIT 1
                    """
                ).fetchone()
                if row is None:
                    con.commit()
                    return None
                row_id = int(row[0])
                job_id = str(row[1])
                payload_json = str(row[2])
                con.execute(
                    """
                    UPDATE skill_queue
                    SET status='running', claimed_at=?
                    WHERE id=?
                    """,
                    (time.time(), row_id),
                )
                con.commit()
                return _ClaimedSQLiteCall(row_id=row_id, job_id=job_id, payload_json=payload_json)
            except Exception:
                con.rollback()
                raise
            finally:
                con.close()

    def _db_complete_claimed(self, row_id: int) -> None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute("DELETE FROM skill_queue WHERE id=?", (row_id,))
                con.commit()
            finally:
                con.close()

    def _db_requeue_claimed(self, row_id: int) -> None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute(
                    """
                    UPDATE skill_queue
                    SET status='queued', claimed_at=NULL
                    WHERE id=?
                    """,
                    (row_id,),
                )
                con.commit()
            finally:
                con.close()

    def _require_persist_path(self) -> Path:
        path = self._persist_path
        if path is None:
            raise RuntimeError("SQLite skill queue backend requires a persist path")
        return path
