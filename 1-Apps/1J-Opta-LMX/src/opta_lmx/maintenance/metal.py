"""Metal cache maintenance background task.

Periodically checks MLX Metal buffer cache size and clears it when
it exceeds the configured limit. Prevents memory fragmentation during
long inference sessions on Apple Silicon.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Import mlx at module level so it can be mocked in tests.
try:
    import mlx.core as mx
except ImportError:
    mx: Any = None  # type: ignore[no-redef]


async def metal_cache_maintenance_loop(
    cache_limit_gb: float,
    interval_sec: float = 300.0,
) -> None:
    """Background loop that clears Metal cache when it exceeds the limit.

    Args:
        cache_limit_gb: Maximum cache size in GB before triggering a clear.
        interval_sec: Check interval in seconds (default: 5 minutes).
    """
    if mx is None:
        logger.warning("metal_cache_maintenance_disabled", extra={
            "reason": "mlx not available",
        })
        return

    cache_limit_bytes = int(cache_limit_gb * (1024 ** 3))

    logger.info("metal_cache_maintenance_started", extra={
        "cache_limit_gb": cache_limit_gb,
        "interval_sec": interval_sec,
    })

    while True:
        await asyncio.sleep(interval_sec)

        try:
            cache_bytes = mx.metal.get_cache_memory()
            if cache_bytes > cache_limit_bytes:
                peak_before = mx.metal.get_peak_memory()
                mx.metal.clear_cache()
                cache_after = mx.metal.get_cache_memory()

                logger.info("metal_cache_cleared", extra={
                    "cache_before_mb": round(cache_bytes / (1024 ** 2)),
                    "cache_after_mb": round(cache_after / (1024 ** 2)),
                    "limit_mb": round(cache_limit_bytes / (1024 ** 2)),
                    "peak_mb": round(peak_before / (1024 ** 2)),
                })
        except Exception as e:
            logger.debug("metal_cache_check_error", extra={"error": str(e)})
