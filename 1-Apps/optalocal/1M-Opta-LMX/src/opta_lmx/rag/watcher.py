"""Autonomous file watcher for zero-configuration RAG indexing.

Watches registered folders for file changes and automatically re-indexes
affected files into the vector store. Uses watchdog for cross-platform
FSEvents (macOS) / inotify (Linux) support.

Architecture:
    - watchdog Observer runs in its own daemon thread
    - File events are debounced (1 second) to coalesce rapid editor saves
    - Ingestion is scheduled back onto the asyncio event loop via
      run_coroutine_threadsafe(), keeping the VectorStore single-threaded
    - Each file is deleted from the store before re-ingesting to prevent
      duplicate chunks accumulating across edits

Usage:
    watcher = WorkspaceWatcher(registry, store, embedding_engine, rag_config)
    await watcher.start()   # called from FastAPI lifespan
    await watcher.stop()    # called on shutdown
"""

from __future__ import annotations

import asyncio
import fnmatch
import logging
import math
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from opta_lmx.rag.chunker import chunk_code, chunk_markdown, chunk_text
from opta_lmx.rag.processors import detect_processor, process_file
from opta_lmx.rag.watch_registry import WatchEntry, WatchRegistry

if TYPE_CHECKING:
    from opta_lmx.config import RAGConfig
    from opta_lmx.inference.embedding_engine import EmbeddingEngine
    from opta_lmx.rag.store import VectorStore

logger = logging.getLogger(__name__)


@dataclass
class ReindexResult:
    """Summary of a manual folder re-index operation."""

    folder: str
    collection: str
    files_indexed: int
    files_skipped: int
    chunks_created: int
    duration_sec: float
    errors: list[str]


class WorkspaceWatcher:
    """Autonomous file watcher that keeps the RAG store in sync with the filesystem.

    Integrates watchdog (optional dep) for real-time file system notifications.
    Falls back gracefully if watchdog is not installed — manual re-index still works.
    """

    def __init__(
        self,
        registry: WatchRegistry,
        store: "VectorStore",
        embedding_engine: "EmbeddingEngine | None",
        rag_config: "RAGConfig",
    ) -> None:
        self._registry = registry
        self._store = store
        self._embedding_engine = embedding_engine
        self._rag_config = rag_config
        self._observer: Any = None  # watchdog Observer
        self._loop: asyncio.AbstractEventLoop | None = None
        self._debounce_timers: dict[str, threading.Timer] = {}
        self._debounce_lock = threading.Lock()
        self._running = False

    # ── Lifecycle ────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Start watching all registered folders."""
        if self._running:
            return
        self._loop = asyncio.get_running_loop()
        self._running = True

        if not self._try_start_observer():
            logger.warning(
                "watchdog_not_available",
                extra={"reason": "Install watchdog for real-time file watching: pip install watchdog"},
            )
            return

        entries = self._registry.get_all()
        for entry in entries:
            self._watch_entry(entry)

        logger.info(
            "workspace_watcher_started",
            extra={"watched_folders": len(entries)},
        )

    async def stop(self) -> None:
        """Gracefully stop the file watcher."""
        self._running = False

        # Cancel all pending debounce timers
        with self._debounce_lock:
            for timer in self._debounce_timers.values():
                timer.cancel()
            self._debounce_timers.clear()

        if self._observer is not None:
            self._observer.stop()
            self._observer.join(timeout=5.0)
            self._observer = None

        logger.info("workspace_watcher_stopped")

    async def register(self, entry: WatchEntry) -> None:
        """Add a new folder to the registry and start watching it."""
        self._registry.add(entry)
        if self._observer is not None and self._running:
            self._watch_entry(entry)
        logger.info(
            "watch_folder_added",
            extra={"path": entry.path, "collection": entry.collection},
        )

    async def unregister(self, path: str, purge_index: bool = False) -> bool:
        """Stop watching a folder and optionally remove its documents from the store."""
        existed = self._registry.remove(path)
        # watchdog doesn't support un-scheduling individual paths cleanly —
        # full restart would be needed. Rare enough to not bother.
        if purge_index:
            # Remove all documents sourced from files under this path
            prefix = path.rstrip("/") + "/"
            for collection in list(self._store._collections.keys()):
                docs = self._store._collections.get(collection, [])
                before = len(docs)
                self._store._collections[collection] = [
                    d for d in docs
                    if not (d.metadata.get("file_path", "") or "").startswith(prefix)
                ]
                deleted = before - len(self._store._collections[collection])
                if deleted:
                    self._store._rebuild_indexes(collection)
                    logger.info(
                        "purged_index_for_folder",
                        extra={"folder": path, "collection": collection, "count": deleted},
                    )
        return existed

    async def reindex_folder(self, path: str) -> ReindexResult:
        """Trigger a full re-index of all matching files in a folder.

        Safe to call while the watcher is running — uses the same
        incremental (delete + re-ingest) strategy as real-time events.
        """
        entry = self._registry.get(path)
        if entry is None:
            return ReindexResult(
                folder=path,
                collection="",
                files_indexed=0,
                files_skipped=0,
                chunks_created=0,
                duration_sec=0.0,
                errors=[f"Folder '{path}' is not registered"],
            )

        start = time.monotonic()
        files_indexed = 0
        files_skipped = 0
        chunks_created = 0
        errors: list[str] = []

        folder = Path(path)
        if not folder.exists():
            return ReindexResult(
                folder=path,
                collection=entry.collection,
                files_indexed=0,
                files_skipped=0,
                chunks_created=0,
                duration_sec=0.0,
                errors=[f"Folder '{path}' does not exist on disk"],
            )

        for file_path in self._iter_files(folder, entry):
            if not self._should_index(file_path):
                files_skipped += 1
                continue
            try:
                chunks = await self._ingest_file(str(file_path), entry.collection)
                chunks_created += chunks
                files_indexed += 1
            except Exception as e:
                errors.append(f"{file_path}: {e}")
                files_skipped += 1

        if files_indexed > 0:
            self._store.save()

        return ReindexResult(
            folder=path,
            collection=entry.collection,
            files_indexed=files_indexed,
            files_skipped=files_skipped,
            chunks_created=chunks_created,
            duration_sec=round(time.monotonic() - start, 2),
            errors=errors,
        )

    # ── Internal: watchdog integration ──────────────────────────────────

    def _try_start_observer(self) -> bool:
        """Attempt to import watchdog and start the Observer thread."""
        try:
            from watchdog.observers import Observer  # type: ignore[import-untyped]
            self._observer = Observer()
            self._observer.start()
            return True
        except ImportError:
            return False

    def _watch_entry(self, entry: WatchEntry) -> None:
        """Schedule a WatchEntry with the watchdog Observer."""
        if self._observer is None:
            return
        folder = Path(entry.path)
        if not folder.exists():
            logger.warning("watch_folder_missing", extra={"path": entry.path})
            return
        try:
            from watchdog.events import FileSystemEventHandler  # type: ignore[import-untyped]

            class _Handler(FileSystemEventHandler):
                def __init__(self_, watcher: "WorkspaceWatcher", wentry: WatchEntry) -> None:
                    self_._watcher = watcher
                    self_._entry = wentry

                def on_created(self_, event: Any) -> None:
                    if not event.is_directory:
                        self_._watcher._schedule_file_change(event.src_path, "modified", self_._entry)

                def on_modified(self_, event: Any) -> None:
                    if not event.is_directory:
                        self_._watcher._schedule_file_change(event.src_path, "modified", self_._entry)

                def on_deleted(self_, event: Any) -> None:
                    if not event.is_directory:
                        self_._watcher._schedule_file_change(event.src_path, "deleted", self_._entry)

                def on_moved(self_, event: Any) -> None:
                    if not event.is_directory:
                        self_._watcher._schedule_file_change(event.src_path, "deleted", self_._entry)
                        self_._watcher._schedule_file_change(event.dest_path, "modified", self_._entry)

            handler = _Handler(self, entry)
            self._observer.schedule(handler, str(folder), recursive=entry.recursive)
            logger.info("watchdog_scheduled", extra={"path": entry.path})
        except Exception as e:
            logger.warning("watchdog_schedule_failed", extra={"path": entry.path, "error": str(e)})

    def _schedule_file_change(self, file_path: str, event_type: str, entry: WatchEntry) -> None:
        """Debounce file change events — collapse rapid saves into one ingest."""
        if not self._matches_patterns(file_path, entry):
            return

        key = file_path
        debounce_sec = self._rag_config.watcher_debounce_sec

        with self._debounce_lock:
            existing = self._debounce_timers.pop(key, None)
            if existing is not None:
                existing.cancel()

            timer = threading.Timer(
                debounce_sec,
                self._fire_file_event,
                args=(file_path, event_type, entry.collection),
            )
            timer.daemon = True
            self._debounce_timers[key] = timer
            timer.start()

    def _fire_file_event(self, file_path: str, event_type: str, collection: str) -> None:
        """Called from timer thread — schedules coroutine on the asyncio event loop."""
        with self._debounce_lock:
            self._debounce_timers.pop(file_path, None)

        if self._loop is None or not self._running:
            return

        if event_type == "deleted":
            coro = self._handle_delete(file_path)
        else:
            coro = self._handle_change(file_path, collection)

        asyncio.run_coroutine_threadsafe(coro, self._loop)

    # ── Internal: indexing ───────────────────────────────────────────────

    async def _handle_change(self, file_path: str, collection: str) -> None:
        """Re-index a file that was created or modified."""
        if not self._should_index(file_path):
            return
        try:
            chunks = await self._ingest_file(file_path, collection)
            self._store.save()
            logger.info(
                "file_indexed",
                extra={"path": file_path, "collection": collection, "chunks": chunks},
            )
        except Exception as e:
            logger.warning("file_index_failed", extra={"path": file_path, "error": str(e)})

    async def _handle_delete(self, file_path: str) -> None:
        """Remove a deleted file's chunks from the store."""
        deleted = self._store.delete_by_source(file_path)
        if deleted:
            self._store.save()
            logger.info("file_unindexed", extra={"path": file_path, "chunks_removed": deleted})

    async def _ingest_file(self, file_path: str, collection: str) -> int:
        """Process, chunk, embed, and store a single file. Returns chunk count."""
        if self._embedding_engine is None:
            raise RuntimeError("No embedding engine available for file indexing")

        path = Path(file_path)
        doc = process_file(path)
        if not doc.text.strip():
            return 0

        processor_type = detect_processor(path.name)
        chunk_size = self._rag_config.default_chunk_size
        chunk_overlap = self._rag_config.default_chunk_overlap

        if processor_type == "code":
            chunks = chunk_code(doc.text, chunk_size, chunk_overlap)
        elif processor_type == "markdown":
            chunks = chunk_markdown(doc.text, chunk_size, chunk_overlap)
        else:
            chunks = chunk_text(doc.text, chunk_size, chunk_overlap)

        if not chunks:
            return 0

        chunk_texts = [c.text for c in chunks]

        # Remove old chunks for this file before re-ingesting
        self._store.delete_by_source(file_path)

        embeddings = await self._embedding_engine.embed(chunk_texts, model_id=None)

        metadata_list = [
            {
                **doc.metadata,
                "source": file_path,
                "file_path": file_path,
                "chunk_index": c.index,
                "start_char": c.start_char,
                "end_char": c.end_char,
            }
            for c in chunks
        ]

        self._store.add(collection, chunk_texts, embeddings, metadata_list)
        return len(chunks)

    # ── Internal: helpers ────────────────────────────────────────────────

    def _should_index(self, file_path: str) -> bool:
        """Return True if the file should be indexed (size, encoding guards)."""
        path = Path(file_path)
        if not path.is_file():
            return False
        max_bytes = int(self._rag_config.watcher_max_file_size_mb * 1024 * 1024)
        try:
            if path.stat().st_size > max_bytes:
                logger.debug("file_too_large_skipped", extra={"path": file_path})
                return False
        except OSError:
            return False
        return True

    def _matches_patterns(self, file_path: str, entry: WatchEntry) -> bool:
        """Check if a file path matches the entry's include/exclude patterns."""
        name = Path(file_path).name
        # Check excludes first
        for excl in entry.exclude_patterns:
            if fnmatch.fnmatch(name, excl):
                return False
        parts = Path(file_path).parts
        for excl in entry.exclude_patterns:
            if any(fnmatch.fnmatch(part, excl) for part in parts):
                return False
        # Check include patterns
        return any(fnmatch.fnmatch(name, pat) for pat in entry.patterns)

    def _iter_files(self, folder: Path, entry: WatchEntry) -> list[Path]:
        """Yield all matching files in a folder, respecting recursive + exclude patterns."""
        results: list[Path] = []
        walk_fn = folder.rglob("*") if entry.recursive else folder.glob("*")
        for path in walk_fn:
            if not path.is_file():
                continue
            if self._matches_patterns(str(path), entry):
                results.append(path)
        return results

    # ── Status ───────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        """Return current watcher status for the admin API."""
        entries = self._registry.get_all()
        return {
            "running": self._running,
            "watchdog_available": self._observer is not None,
            "watched_folders": len(entries),
            "folders": [
                {
                    "path": e.path,
                    "collection": e.collection,
                    "recursive": e.recursive,
                    "auto_registered": e.auto_registered,
                    "exists_on_disk": Path(e.path).exists(),
                }
                for e in entries
            ],
        }


def apply_recency_boost(
    results: list[Any],
    decay_days: float,
    weight: float,
) -> list[Any]:
    """Apply a time-decay recency boost to search results.

    Documents with a recent ``file_modified_at`` (Unix timestamp) in their
    metadata receive a score multiplier. Score decays exponentially:

        boosted = score * (1 + weight * exp(-age_days * ln(2) / decay_days))

    Args:
        results: List of SearchResult objects.
        decay_days: Half-life in days (score boost halves every N days).
        weight: Maximum boost multiplier (0.15 = up to 15% boost on new files).

    Returns:
        Results list with updated scores, sorted descending by score.
    """
    now = time.time()
    ln2 = math.log(2)
    seconds_per_day = 86400.0

    for result in results:
        mod_time = result.document.metadata.get("file_modified_at")
        if mod_time is None:
            continue
        age_days = max(0.0, (now - float(mod_time)) / seconds_per_day)
        decay = math.exp(-age_days * ln2 / max(decay_days, 0.01))
        result.score = result.score * (1.0 + weight * decay)

    results.sort(key=lambda r: r.score, reverse=True)
    return results
