"""Memory monitoring for unified memory on Apple Silicon."""

from __future__ import annotations

import logging
import time

import psutil

from opta_lmx.inference.schema import MemoryStatus

logger = logging.getLogger(__name__)

# Cache psutil.virtual_memory() for this many seconds to reduce syscall overhead.
# Memory stats don't change fast enough to warrant per-call polling.
_CACHE_TTL_SEC = 1.0


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
        self._cached_vm: psutil._common.svmem | None = None  # type: ignore[name-defined]
        self._cache_time: float = 0.0

    def _vm(self) -> psutil._common.svmem:  # type: ignore[name-defined]
        """Get virtual memory stats, cached for _CACHE_TTL_SEC."""
        now = time.monotonic()
        if self._cached_vm is None or (now - self._cache_time) > _CACHE_TTL_SEC:
            self._cached_vm = psutil.virtual_memory()
            self._cache_time = now
        return self._cached_vm

    def total_memory_gb(self) -> float:
        """Total unified memory in GB (e.g., 512 for Mac Studio M3 Ultra)."""
        return float(self._vm().total) / (1024**3)

    def available_memory_gb(self) -> float:
        """Currently available memory in GB."""
        return float(self._vm().available) / (1024**3)

    def used_memory_gb(self) -> float:
        """Currently used memory in GB."""
        return float(self._vm().used) / (1024**3)

    def usage_percent(self) -> float:
        """Current memory usage as percentage (0-100)."""
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
            used_gb=round(vm.used / (1024**3), 2),
            available_gb=round(vm.available / (1024**3), 2),
            usage_percent=round(vm.percent, 1),
            threshold_percent=self.threshold_percent,
        )
