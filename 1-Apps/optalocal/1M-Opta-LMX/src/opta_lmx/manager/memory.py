"""Memory monitoring for unified memory on Apple Silicon."""

from __future__ import annotations

import logging
import platform
import re
import subprocess
import time
from typing import Protocol

import psutil

from opta_lmx.inference.schema import MemoryStatus

logger = logging.getLogger(__name__)

# Cache psutil.virtual_memory() for this many seconds to reduce syscall overhead.
# Memory stats don't change fast enough to warrant per-call polling.
_CACHE_TTL_SEC = 1.0


class _VirtualMemorySnapshot(Protocol):
    total: int
    used: int
    available: int
    percent: float


def _parse_vm_stat_pages(vm_stat_text: str) -> dict[str, int]:
    pages: dict[str, int] = {}
    for raw_line in vm_stat_text.splitlines():
        line = raw_line.strip()
        if ":" not in line:
            continue
        key, rest = line.split(":", 1)
        m = re.search(r"(\d+)", rest.replace(".", ""))
        if not m:
            continue
        pages[key.strip().lower()] = int(m.group(1))
    return pages


class MemoryMonitor:
    """Track unified memory usage and enforce the 90% cap.

    On Apple Silicon, CPU and GPU share unified memory. This monitor
    uses psutil to track total system memory and enforce thresholds
    to prevent OOM crashes.

    Caches psutil results for 1 second to avoid repeated syscalls during
    burst request handling (4+ psutil calls per request add up).

    GUARDRAIL G-LMX-01: Never exceed 90% of unified memory.
    """

    def __init__(self, max_percent: int = 90) -> None:
        self.threshold_percent = max_percent
        self._cached_vm: _VirtualMemorySnapshot | None = None
        self._cache_time: float = 0.0
        self._cached_activity_used_bytes: int | None = None
        self._cached_activity_available_bytes: int | None = None
        self._cached_activity_percent: float | None = None

    def _vm(self) -> _VirtualMemorySnapshot:
        """Get virtual memory stats, cached for _CACHE_TTL_SEC."""
        now = time.monotonic()
        if self._cached_vm is None or (now - self._cache_time) > _CACHE_TTL_SEC:
            self._cached_vm = psutil.virtual_memory()
            self._cache_time = now
            self._refresh_activity_memory(self._cached_vm)
        return self._cached_vm

    def _refresh_activity_memory(self, vm: _VirtualMemorySnapshot) -> None:
        """Best-effort macOS Activity Monitor-style memory usage snapshot.

        Activity Monitor's "Memory Used" aligns much better with user expectations
        than psutil's `used` on macOS (which often under-reports by excluding large
        inactive/file-backed regions). We approximate it as:

            used = total - free - file_backed

        where `file_backed` corresponds to Cached Files.
        """
        self._cached_activity_used_bytes = None
        self._cached_activity_available_bytes = None
        self._cached_activity_percent = None

        if platform.system() != "Darwin":
            return

        try:
            out = subprocess.check_output(["vm_stat"], text=True)
            pages = _parse_vm_stat_pages(out)
            page_size = 4096
            m = re.search(r"page size of\s+(\d+)\s+bytes", out)
            if m:
                page_size = int(m.group(1))

            free_pages = pages.get("pages free", 0)
            cached_pages = pages.get("file-backed pages", 0)

            free_bytes = free_pages * page_size
            cached_bytes = cached_pages * page_size
            used_bytes = int(vm.total) - free_bytes - cached_bytes
            if used_bytes < 0:
                used_bytes = int(vm.used)

            self._cached_activity_used_bytes = used_bytes
            self._cached_activity_available_bytes = max(int(vm.total) - used_bytes, 0)
            self._cached_activity_percent = round((used_bytes / int(vm.total)) * 100, 1)
        except Exception:
            # Fall back silently to psutil if vm_stat is unavailable/parsing fails.
            return

    def total_memory_gb(self) -> float:
        """Total unified memory in GB (e.g., 512 for Mac Studio M3 Ultra)."""
        return float(self._vm().total) / (1024**3)

    def available_memory_gb(self) -> float:
        """Currently available memory in GB."""
        self._vm()
        if self._cached_activity_available_bytes is not None:
            return float(self._cached_activity_available_bytes) / (1024**3)
        return float(self._vm().available) / (1024**3)

    def used_memory_gb(self) -> float:
        """Currently used memory in GB."""
        self._vm()
        if self._cached_activity_used_bytes is not None:
            return float(self._cached_activity_used_bytes) / (1024**3)
        return float(self._vm().used) / (1024**3)

    def usage_percent(self) -> float:
        """Current memory usage as percentage (0-100)."""
        self._vm()
        if self._cached_activity_percent is not None:
            return float(self._cached_activity_percent)
        return float(self._vm().percent)

    def can_load(self, estimated_size_gb: float) -> bool:
        """Check if loading a model of given size would exceed threshold.

        Args:
            estimated_size_gb: Estimated memory the model will consume.

        Returns:
            True if safe to load, False if it would exceed threshold.
        """
        current = self.usage_percent()
        if estimated_size_gb > 0:
            # Apply 15% safety margin: MLX allocates in chunks and OS buffers
            # consume additional memory beyond the raw model weight estimate.
            buffered = estimated_size_gb * 1.15
            additional = (buffered / self.total_memory_gb()) * 100
        else:
            additional = 0
        would_be = current + additional
        safe = would_be < self.threshold_percent

        if not safe:
            logger.warning(
                "memory_threshold_exceeded",
                extra={
                    "current_percent": round(current, 1),
                    "additional_percent": round(additional, 1),
                    "would_be_percent": round(would_be, 1),
                    "threshold_percent": self.threshold_percent,
                },
            )

        return safe

    def get_status(self) -> MemoryStatus:
        """Return full memory status for API responses."""
        vm = self._vm()
        return MemoryStatus(
            total_gb=round(vm.total / (1024**3), 2),
            used_gb=round(self.used_memory_gb(), 2),
            available_gb=round(self.available_memory_gb(), 2),
            usage_percent=round(self.usage_percent(), 1),
            threshold_percent=self.threshold_percent,
        )
