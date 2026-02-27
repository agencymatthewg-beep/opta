"""Async queue-based scheduler for agent runs."""

from __future__ import annotations

import asyncio
import logging
import sqlite3
import time
from collections.abc import Awaitable, Callable
from itertools import count
from pathlib import Path
from threading import Lock
from typing import Literal

logger = logging.getLogger(__name__)

RunHandler = Callable[[str], Awaitable[None]]
_QueueItem = tuple[int, int, str | None]
_ClaimedItem = tuple[int, str]

_PRIORITY_ORDER: dict[str, int] = {
    "interactive": 0,
    "normal": 1,
    "batch": 2,
}


class RunQueueFullError(RuntimeError):
    """Raised when the run queue reaches its configured capacity."""

    def __init__(self, *, size: int, capacity: int) -> None:
        self.size = size
        self.capacity = capacity
        super().__init__(f"Run queue is full ({size}/{capacity})")


class RunScheduler:
    """Bounded queue worker scheduler for run IDs.

    Supports in-memory queueing (default) and SQLite-backed persistent queueing.
    """

    def __init__(
        self,
        *,
        max_queue_size: int = 128,
        worker_count: int = 2,
        backend: Literal["memory", "sqlite"] = "memory",
        persist_path: Path | None = None,
        poll_interval_sec: float = 0.05,
    ) -> None:
        if max_queue_size < 1:
            raise ValueError("max_queue_size must be >= 1")
        if worker_count < 1:
            raise ValueError("worker_count must be >= 1")
        if poll_interval_sec <= 0:
            raise ValueError("poll_interval_sec must be > 0")
        if backend not in {"memory", "sqlite"}:
            raise ValueError("backend must be 'memory' or 'sqlite'")

        self._max_queue_size = max_queue_size
        self._worker_count = worker_count
        self._workers: list[asyncio.Task[None]] = []
        self._handler: RunHandler | None = None
        self._running = False
        self._sequence = count()
        self._backend = backend
        self._poll_interval_sec = poll_interval_sec

        self._queue: asyncio.PriorityQueue[_QueueItem] | None = None
        self._persist_path: Path | None = None
        self._db_lock = Lock()
        if backend == "memory":
            self._queue = asyncio.PriorityQueue(maxsize=max_queue_size)
        else:
            if persist_path is None:
                raise ValueError("persist_path is required when backend='sqlite'")
            self._persist_path = Path(persist_path).expanduser()
            self._init_db()
            self._recover_running_rows()

    @property
    def is_running(self) -> bool:
        """Whether workers are started."""
        return self._running

    @property
    def max_queue_size(self) -> int:
        """Configured max queue capacity."""
        return self._max_queue_size

    @property
    def queue_size(self) -> int:
        """Current number of queued runs."""
        if self._backend == "memory":
            queue = self._queue
            if queue is None:
                return 0
            return queue.qsize()
        return self._db_count_queued()

    async def start(self, handler: RunHandler) -> None:
        """Start worker tasks."""
        if self._running:
            return
        self._handler = handler
        self._running = True
        self._workers = [
            asyncio.create_task(
                self._worker_loop(index),
                name=f"agents-scheduler-{index}",
            )
            for index in range(self._worker_count)
        ]

    async def stop(self) -> None:
        """Stop workers after draining queued tasks."""
        if not self._running:
            return
        self._running = False

        if self._backend == "memory":
            queue = self._queue
            if queue is not None:
                for _ in self._workers:
                    await queue.put((99, next(self._sequence), None))
        else:
            for worker in self._workers:
                worker.cancel()

        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers = []
        self._handler = None
        if self._backend == "sqlite":
            self._recover_running_rows()

    async def submit(self, run_id: str, *, priority: str = "normal") -> None:
        """Queue a run ID for workers to execute."""
        if not self._running:
            raise RuntimeError("Scheduler is not running")
        queue_priority = _PRIORITY_ORDER.get(priority, _PRIORITY_ORDER["normal"])

        if self._backend == "memory":
            queue = self._queue
            if queue is None:
                raise RuntimeError("Scheduler queue unavailable")
            entry = (queue_priority, next(self._sequence), run_id)
            try:
                queue.put_nowait(entry)
            except asyncio.QueueFull as exc:
                raise RunQueueFullError(
                    size=queue.qsize(),
                    capacity=queue.maxsize,
                ) from exc
            return

        size = await asyncio.to_thread(self._db_count_queued)
        if size >= self._max_queue_size:
            raise RunQueueFullError(size=size, capacity=self._max_queue_size)
        sequence = next(self._sequence)
        await asyncio.to_thread(self._db_enqueue, run_id, queue_priority, sequence)

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
            _, _, run_id = await queue.get()
            try:
                if run_id is None:
                    return
                handler = self._handler
                if handler is None:
                    continue
                await handler(run_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("agents_scheduler_worker_error", extra={"worker": worker_index})
            finally:
                queue.task_done()

    async def _sqlite_worker_loop(self, worker_index: int) -> None:
        claimed: _ClaimedItem | None = None
        while True:
            if not self._running and claimed is None:
                return
            try:
                if claimed is None:
                    claimed = await asyncio.to_thread(self._db_claim_next)
                    if claimed is None:
                        await asyncio.sleep(self._poll_interval_sec)
                        continue

                row_id, run_id = claimed
                handler = self._handler
                if handler is not None:
                    await handler(run_id)
                await asyncio.to_thread(self._db_complete_claimed, row_id)
                claimed = None
            except asyncio.CancelledError:
                if claimed is not None:
                    await asyncio.to_thread(self._db_requeue_claimed, claimed[0])
                raise
            except Exception:
                logger.exception(
                    "agents_scheduler_worker_error",
                    extra={"worker": worker_index, "backend": "sqlite"},
                )
                if claimed is not None:
                    await asyncio.to_thread(self._db_complete_claimed, claimed[0])
                    claimed = None

    def _init_db(self) -> None:
        path = self._require_persist_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute("PRAGMA journal_mode=WAL;")
                con.execute(
                    """
                    CREATE TABLE IF NOT EXISTS run_queue (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT NOT NULL,
                        priority INTEGER NOT NULL,
                        sequence INTEGER NOT NULL,
                        status TEXT NOT NULL DEFAULT 'queued',
                        enqueued_at REAL NOT NULL,
                        claimed_at REAL
                    )
                    """
                )
                con.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_run_queue_status_priority
                    ON run_queue(status, priority, sequence, id)
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
                    UPDATE run_queue
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
                    "SELECT COUNT(1) FROM run_queue WHERE status='queued'"
                ).fetchone()
                if row is None:
                    return 0
                return int(row[0])
            finally:
                con.close()

    def _db_enqueue(self, run_id: str, priority: int, sequence: int) -> None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute(
                    """
                    INSERT INTO run_queue(run_id, priority, sequence, status, enqueued_at)
                    VALUES (?, ?, ?, 'queued', ?)
                    """,
                    (run_id, priority, sequence, time.time()),
                )
                con.commit()
            finally:
                con.close()

    def _db_claim_next(self) -> _ClaimedItem | None:
        path = self._require_persist_path()
        with self._db_lock:
            con = sqlite3.connect(path)
            try:
                con.execute("BEGIN IMMEDIATE")
                row = con.execute(
                    """
                    SELECT id, run_id
                    FROM run_queue
                    WHERE status='queued'
                    ORDER BY priority ASC, sequence ASC, id ASC
                    LIMIT 1
                    """
                ).fetchone()
                if row is None:
                    con.commit()
                    return None

                row_id = int(row[0])
                run_id = str(row[1])
                con.execute(
                    """
                    UPDATE run_queue
                    SET status='running', claimed_at=?
                    WHERE id=?
                    """,
                    (time.time(), row_id),
                )
                con.commit()
                return (row_id, run_id)
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
                con.execute("DELETE FROM run_queue WHERE id=?", (row_id,))
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
                    UPDATE run_queue
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
            raise RuntimeError("SQLite scheduler backend requires a persist path")
        return path
