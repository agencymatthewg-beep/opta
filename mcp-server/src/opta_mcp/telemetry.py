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


def _get_gpu_nvidia_gputil() -> Optional[dict]:
    """Try to get NVIDIA GPU info using GPUtil.

    Returns:
        dict with GPU info or None if not available.
    """
    try:
        import GPUtil

        gpus = GPUtil.getGPUs()
        if not gpus:
            return None

        # Use first GPU
        gpu = gpus[0]

        return {
            "available": True,
            "name": gpu.name,
            "memory_total_gb": round(gpu.memoryTotal / 1024, 2),
            "memory_used_gb": round(gpu.memoryUsed / 1024, 2),
            "memory_percent": round(gpu.memoryUtil * 100, 1),
            "temperature_c": gpu.temperature,
            "utilization_percent": round(gpu.load * 100, 1),
        }
    except ImportError:
        return None
    except Exception:
        return None


def _get_gpu_nvidia_pynvml() -> Optional[dict]:
    """Try to get NVIDIA GPU info using pynvml directly.

    Returns:
        dict with GPU info or None if not available.
    """
    try:
        import pynvml

        pynvml.nvmlInit()
        device_count = pynvml.nvmlDeviceGetCount()
        if device_count == 0:
            pynvml.nvmlShutdown()
            return None

        # Use first GPU
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode("utf-8")

        memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
        bytes_to_gb = 1024**3

        # Get temperature if available
        try:
            temperature = pynvml.nvmlDeviceGetTemperature(
                handle, pynvml.NVML_TEMPERATURE_GPU
            )
        except Exception:
            temperature = None

        # Get utilization if available
        try:
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            utilization_percent = utilization.gpu
        except Exception:
            utilization_percent = None

        pynvml.nvmlShutdown()

        return {
            "available": True,
            "name": name,
            "memory_total_gb": round(memory.total / bytes_to_gb, 2),
            "memory_used_gb": round(memory.used / bytes_to_gb, 2),
            "memory_percent": round((memory.used / memory.total) * 100, 1),
            "temperature_c": temperature,
            "utilization_percent": utilization_percent,
        }
    except ImportError:
        return None
    except Exception:
        return None


def _get_gpu_macos() -> Optional[dict]:
    """Try to get macOS GPU info using system_profiler.

    Returns:
        dict with GPU info or None if not available.
    """
    try:
        import subprocess
        import platform

        if platform.system() != "Darwin":
            return None

        # Run system_profiler to get GPU info
        result = subprocess.run(
            ["system_profiler", "SPDisplaysDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            return None

        import json

        data = json.loads(result.stdout)
        displays = data.get("SPDisplaysDataType", [])

        if not displays:
            return None

        # Get first GPU
        gpu_info = displays[0]
        gpu_name = gpu_info.get("sppci_model", "Unknown GPU")

        # macOS doesn't easily expose VRAM usage via command line
        # Try to get VRAM total from chipset_model or vendor specific info
        vram_str = gpu_info.get("spdisplays_vram", "")
        vram_total_gb = None
        if vram_str:
            # Parse strings like "16 GB" or "8192 MB"
            try:
                parts = vram_str.split()
                value = float(parts[0])
                unit = parts[1].upper() if len(parts) > 1 else "GB"
                if "MB" in unit:
                    vram_total_gb = round(value / 1024, 2)
                else:
                    vram_total_gb = round(value, 2)
            except Exception:
                pass

        return {
            "available": True,
            "name": gpu_name,
            "memory_total_gb": vram_total_gb,
            "memory_used_gb": None,  # Not available on macOS without special tools
            "memory_percent": None,
            "temperature_c": None,  # Would need iStats or similar
            "utilization_percent": None,
        }
    except ImportError:
        return None
    except Exception:
        return None


def get_gpu_info() -> dict:
    """Get GPU telemetry with graceful fallback.

    Detection strategy (tried in order):
    1. GPUtil for NVIDIA GPUs (nvidia-smi based)
    2. pynvml directly if GPUtil fails
    3. On macOS: system_profiler for basic GPU info
    4. Fallback: Return {available: false}

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
    # Try each detection method in order
    # Method 1: GPUtil (NVIDIA)
    result = _get_gpu_nvidia_gputil()
    if result:
        return result

    # Method 2: pynvml directly (NVIDIA)
    result = _get_gpu_nvidia_pynvml()
    if result:
        return result

    # Method 3: macOS system_profiler
    result = _get_gpu_macos()
    if result:
        return result

    # Fallback: No GPU detected
    return {
        "available": False,
        "name": "No GPU detected",
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
