"""Runtime state persistence — save/restore loaded models across restarts.

Writes to ~/.opta-lmx/runtime-state.json on model load/unload events.
On startup, checks for unclean shutdown and restores models.
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class RuntimeState:
    """Persist and restore runtime state across process restarts."""

    def __init__(self, state_path: Path | None = None) -> None:
        self._path = state_path or (Path.home() / ".opta-lmx" / "runtime-state.json")

    def save(
        self,
        loaded_models: list[str],
        clean: bool = False,
    ) -> None:
        """Write current state to disk.

        Args:
            loaded_models: List of currently loaded model IDs.
            clean: True if this is a clean shutdown save.
        """
        existing = self.load() or {}
        data = {
            "loaded_models": loaded_models,
            "last_clean_shutdown": clean,
            "pid": os.getpid(),
            "saved_at": time.time(),
            "startup_count": existing.get("startup_count", 0),
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, indent=2))
        logger.debug("runtime_state_saved", extra={
            "models": loaded_models, "clean": clean,
        })

    def load(self) -> dict[str, Any] | None:
        """Load state from disk.

        Returns:
            State dict or None if file doesn't exist.
        """
        if not self._path.exists():
            return None
        try:
            return json.loads(self._path.read_text())
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("runtime_state_load_failed", extra={"error": str(e)})
            return None

    def record_startup(self) -> None:
        """Increment the startup counter (called at process start)."""
        data = self.load() or {
            "loaded_models": [],
            "last_clean_shutdown": True,
            "pid": os.getpid(),
            "saved_at": time.time(),
            "startup_count": 0,
        }
        data["startup_count"] = data.get("startup_count", 0) + 1
        data["last_startup_at"] = time.time()
        data["pid"] = os.getpid()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, indent=2))

    def is_crash_loop(self, threshold: int = 3, window_sec: float = 60.0) -> bool:
        """Detect crash loop: 3+ startups within 60 seconds means safe mode.

        Args:
            threshold: Number of startups within the window to trigger safe mode.
            window_sec: Time window in seconds to check for rapid restarts.

        Returns:
            True if the process is in a crash loop (safe mode should be enabled).
        """
        data = self.load()
        if data is None:
            return False
        count = data.get("startup_count", 0)
        last_startup = data.get("last_startup_at", 0)
        if count >= threshold and (time.time() - last_startup) < window_sec:
            return True
        return False

    def clear(self) -> None:
        """Remove state file."""
        if self._path.exists():
            self._path.unlink()
