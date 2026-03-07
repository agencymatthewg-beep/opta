"""Persistent registry of folders watched for automatic RAG indexing.

Stores folder-to-collection mappings in a JSON file so watching survives
LMX restarts. Thread-safe via a simple in-memory lock (all access happens
on the FastAPI event loop).
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Default file patterns to index (excludes build artifacts and hidden dirs)
_DEFAULT_PATTERNS: list[str] = [
    "*.md",
    "*.txt",
    "*.py",
    "*.ts",
    "*.tsx",
    "*.js",
    "*.rs",
    "*.go",
    "*.yaml",
    "*.yml",
    "*.toml",
]

# Directories to always skip during recursive scanning
_DEFAULT_EXCLUDES: list[str] = [
    "node_modules",
    ".git",
    "__pycache__",
    ".next",
    "dist",
    "build",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    "*.egg-info",
]


@dataclass
class WatchEntry:
    """A single folder registered for automatic indexing."""

    path: str
    """Absolute path to the folder to watch."""

    collection: str
    """RAG collection name for documents ingested from this folder."""

    recursive: bool = True
    """Watch subdirectories recursively."""

    patterns: list[str] = field(default_factory=lambda: list(_DEFAULT_PATTERNS))
    """Glob patterns of files to index (relative to the folder)."""

    exclude_patterns: list[str] = field(default_factory=lambda: list(_DEFAULT_EXCLUDES))
    """Directory or file name patterns to skip."""

    auto_registered: bool = False
    """True if registered automatically at startup (not by the user)."""


class WatchRegistry:
    """Persistent registry of watched folders.

    Entries are stored as a JSON dict keyed by absolute folder path.
    Loading/saving is synchronous (fast enough for startup/shutdown).
    """

    def __init__(self, registry_path: Path) -> None:
        self._path = registry_path
        self._entries: dict[str, WatchEntry] = {}
        self._load()

    # ── Public API ──────────────────────────────────────────────────────

    def add(self, entry: WatchEntry) -> None:
        """Register a folder. Overwrites any existing entry for the same path."""
        self._entries[entry.path] = entry
        self._save()
        logger.info(
            "watch_folder_registered",
            extra={
                "path": entry.path,
                "collection": entry.collection,
                "recursive": entry.recursive,
            },
        )

    def remove(self, path: str) -> bool:
        """Unregister a folder. Returns True if it existed."""
        existed = path in self._entries
        if existed:
            del self._entries[path]
            self._save()
            logger.info("watch_folder_unregistered", extra={"path": path})
        return existed

    def get(self, path: str) -> WatchEntry | None:
        """Return the WatchEntry for a path, or None if not registered."""
        return self._entries.get(path)

    def get_all(self) -> list[WatchEntry]:
        """Return all registered entries."""
        return list(self._entries.values())

    def __len__(self) -> int:
        return len(self._entries)

    # ── Persistence ─────────────────────────────────────────────────────

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = {path: asdict(entry) for path, entry in self._entries.items()}
        with open(self._path, "w") as f:
            json.dump(data, f, indent=2)

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            with open(self._path) as f:
                data = json.load(f)
            for path, raw in data.items():
                self._entries[path] = WatchEntry(**raw)
            logger.info(
                "watch_registry_loaded",
                extra={"path": str(self._path), "count": len(self._entries)},
            )
        except Exception as e:
            logger.warning(
                "watch_registry_load_failed",
                extra={"path": str(self._path), "error": str(e)},
            )
