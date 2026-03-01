"""Hardware identity probe for Apple Silicon (Metal/MLX)."""

from __future__ import annotations

import os
import socket
import time
from typing import Any

# Cache so repeated API calls don't re-probe
_cache: dict[str, Any] | None = None
_cache_at: float = 0.0
_CACHE_TTL = 300.0  # 5 minutes


def probe() -> dict[str, Any]:
    """Return hardware identity dict. Cached for 5 minutes."""
    global _cache, _cache_at
    now = time.monotonic()
    if _cache is not None and (now - _cache_at) < _CACHE_TTL:
        return _cache

    result: dict[str, Any] = {
        "hostname": socket.gethostname(),
        "chip_name": None,
        "architecture": None,
        "memory_gb": None,
        "max_working_set_gb": None,
        "cpu_cores": os.cpu_count(),
        "metal_available": False,
        "gpu_family": None,
    }

    # MLX device info (best source on Apple Silicon)
    try:
        import mlx.core as mx

        result["metal_available"] = mx.metal.is_available()
        if result["metal_available"]:
            info = mx.device_info()
            result["chip_name"] = info.get("device_name")
            result["architecture"] = info.get("architecture")
            mem = info.get("memory_size", 0)
            wset = info.get("max_recommended_working_set_size", 0)
            result["memory_gb"] = round(mem / 1_073_741_824, 0) if mem else None
            result["max_working_set_gb"] = round(wset / 1_073_741_824, 1) if wset else None
            # GPU family from architecture string (e.g. applegpu_g15d -> g15d)
            arch = result["architecture"] or ""
            if "_" in arch:
                result["gpu_family"] = arch.split("_", 1)[-1]
    except Exception:
        pass

    # Fallback: sysctl for chip name
    if not result["chip_name"]:
        try:
            import subprocess

            out = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            brand = out.stdout.strip()
            if brand:
                result["chip_name"] = brand
        except Exception:
            pass

    _cache = result
    _cache_at = now
    return result
