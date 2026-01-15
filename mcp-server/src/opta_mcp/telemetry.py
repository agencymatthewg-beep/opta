"""Hardware telemetry functions using psutil.

Provides CPU, memory, disk, and GPU monitoring with graceful error handling.
"""

import psutil
from typing import Optional


def get_cpu_info() -> dict:
    """Get CPU telemetry.

    Returns:
        dict with keys:
        - percent: Current CPU usage (0-100)
        - cores: Number of physical cores
        - threads: Number of logical processors
        - frequency_mhz: Current frequency (if available, else None)
        - per_core_percent: List of per-core usage percentages
    """
    try:
        # Get CPU percentage (blocking call, 0.1s interval for accuracy)
        percent = psutil.cpu_percent(interval=0.1)

        # Get core counts
        cores = psutil.cpu_count(logical=False) or 0
        threads = psutil.cpu_count(logical=True) or 0

        # Get frequency if available
        freq = psutil.cpu_freq()
        frequency_mhz: Optional[float] = None
        if freq:
            frequency_mhz = round(freq.current, 2)

        # Get per-core usage
        per_core_percent = psutil.cpu_percent(interval=0.1, percpu=True)

        return {
            "percent": percent,
            "cores": cores,
            "threads": threads,
            "frequency_mhz": frequency_mhz,
            "per_core_percent": per_core_percent,
        }
    except Exception as e:
        return {
            "error": str(e),
            "percent": None,
            "cores": None,
            "threads": None,
            "frequency_mhz": None,
            "per_core_percent": None,
        }


def get_memory_info() -> dict:
    """Get memory (RAM) telemetry.

    Returns:
        dict with keys:
        - total_gb: Total RAM in GB
        - used_gb: Used RAM in GB
        - available_gb: Available RAM in GB
        - percent: Usage percentage
    """
    try:
        mem = psutil.virtual_memory()

        # Convert bytes to GB
        bytes_to_gb = 1024**3

        return {
            "total_gb": round(mem.total / bytes_to_gb, 2),
            "used_gb": round(mem.used / bytes_to_gb, 2),
            "available_gb": round(mem.available / bytes_to_gb, 2),
            "percent": mem.percent,
        }
    except Exception as e:
        return {
            "error": str(e),
            "total_gb": None,
            "used_gb": None,
            "available_gb": None,
            "percent": None,
        }


def get_disk_info() -> dict:
    """Get disk telemetry for the primary disk (root partition).

    Returns:
        dict with keys:
        - total_gb: Total disk space in GB
        - used_gb: Used space in GB
        - free_gb: Free space in GB
        - percent: Usage percentage
    """
    try:
        # Use root partition (/ on Unix, C:\ on Windows)
        import platform

        if platform.system() == "Windows":
            root = "C:\\"
        else:
            root = "/"

        disk = psutil.disk_usage(root)

        # Convert bytes to GB
        bytes_to_gb = 1024**3

        return {
            "total_gb": round(disk.total / bytes_to_gb, 2),
            "used_gb": round(disk.used / bytes_to_gb, 2),
            "free_gb": round(disk.free / bytes_to_gb, 2),
            "percent": disk.percent,
        }
    except Exception as e:
        return {
            "error": str(e),
            "total_gb": None,
            "used_gb": None,
            "free_gb": None,
            "percent": None,
        }


def get_gpu_info() -> dict:
    """Get GPU telemetry with graceful fallback.

    Placeholder - will be implemented in Task 3.

    Returns:
        dict with keys:
        - available: boolean (GPU detected or not)
        - name: GPU name (if available)
        - memory_total_gb: Total VRAM
        - memory_used_gb: Used VRAM
        - memory_percent: VRAM usage percentage
        - temperature_c: GPU temp (if available)
        - utilization_percent: GPU compute usage (if available)
    """
    # Placeholder - GPU implementation in Task 3
    return {
        "available": False,
        "name": "GPU detection not yet implemented",
        "memory_total_gb": None,
        "memory_used_gb": None,
        "memory_percent": None,
        "temperature_c": None,
        "utilization_percent": None,
    }


def get_system_snapshot() -> dict:
    """Get complete system telemetry snapshot.

    Returns:
        dict with keys: cpu, memory, disk, gpu
        Each containing the respective telemetry data.
    """
    return {
        "cpu": get_cpu_info(),
        "memory": get_memory_info(),
        "disk": get_disk_info(),
        "gpu": get_gpu_info(),
    }
