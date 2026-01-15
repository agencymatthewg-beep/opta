"""Optimization-focused prompt templates for Opta AI assistant.

Provides system prompts and quick action templates for common optimization
questions, making the AI assistant useful out-of-the-box.
"""

from typing import Any, Optional


SYSTEM_PROMPT = """You are Opta's AI optimization assistant, specialized in PC and gaming performance.

Your expertise includes:
- Windows, macOS, and Linux system optimization
- GPU settings (NVIDIA, AMD, Intel)
- Game-specific performance tuning
- Background process management
- Hardware monitoring and diagnostics

Guidelines:
- Be concise and actionable
- Provide specific steps, not vague advice
- Warn about risks for system modifications
- Recommend safe optimizations first
- Ask clarifying questions if needed

You have access to the user's system information when relevant context is provided.
"""


QUICK_PROMPTS = {
    "boost_fps": {
        "label": "Boost FPS",
        "prompt": "What are the top 5 things I can do right now to boost my FPS in games?",
        "icon": "zap"
    },
    "reduce_stuttering": {
        "label": "Fix Stuttering",
        "prompt": "My games are stuttering. What should I check and how do I fix it?",
        "icon": "activity"
    },
    "startup_cleanup": {
        "label": "Faster Startup",
        "prompt": "How can I make my PC start up faster? What programs should I disable?",
        "icon": "rocket"
    },
    "gpu_optimize": {
        "label": "GPU Settings",
        "prompt": "What GPU driver settings should I adjust for better gaming performance?",
        "icon": "cpu"
    },
    "memory_management": {
        "label": "Free Up RAM",
        "prompt": "How can I free up RAM and reduce memory usage for gaming?",
        "icon": "database"
    }
}


def get_system_context(snapshot: Optional[dict[str, Any]] = None) -> str:
    """Build context string from telemetry data for LLM consumption.

    Args:
        snapshot: System snapshot dict with cpu, memory, disk, gpu keys.
                  If None, returns empty string.

    Returns:
        Formatted string with system information for LLM context.
    """
    if not snapshot:
        return ""

    lines = []

    # CPU info
    cpu = snapshot.get("cpu", {})
    if cpu.get("percent") is not None:
        lines.append(f"CPU: {cpu.get('percent')}% usage")
        if cpu.get("cores") and cpu.get("threads"):
            lines.append(f"  - {cpu.get('cores')} cores, {cpu.get('threads')} threads")
        if cpu.get("frequency_mhz"):
            lines.append(f"  - Current frequency: {cpu.get('frequency_mhz')} MHz")

    # Memory info
    mem = snapshot.get("memory", {})
    if mem.get("total_gb") is not None:
        used = mem.get("used_gb", 0)
        total = mem.get("total_gb", 0)
        percent = mem.get("percent", 0)
        lines.append(f"Memory: {used:.1f} GB / {total:.1f} GB ({percent}% used)")
        available = mem.get("available_gb")
        if available:
            lines.append(f"  - {available:.1f} GB available")

    # GPU info
    gpu = snapshot.get("gpu", {})
    if gpu.get("available"):
        name = gpu.get("name", "Unknown GPU")
        lines.append(f"GPU: {name}")
        if gpu.get("utilization_percent") is not None:
            lines.append(f"  - Utilization: {gpu.get('utilization_percent')}%")
        if gpu.get("temperature_c") is not None:
            lines.append(f"  - Temperature: {gpu.get('temperature_c')}C")
        if gpu.get("memory_used_gb") is not None and gpu.get("memory_total_gb") is not None:
            lines.append(
                f"  - VRAM: {gpu.get('memory_used_gb'):.1f} GB / {gpu.get('memory_total_gb'):.1f} GB"
            )
    else:
        lines.append("GPU: Not detected or no data available")

    # Disk info
    disk = snapshot.get("disk", {})
    if disk.get("total_gb") is not None:
        used = disk.get("used_gb", 0)
        total = disk.get("total_gb", 0)
        free = disk.get("free_gb", 0)
        lines.append(f"Disk: {used:.1f} GB / {total:.1f} GB ({free:.1f} GB free)")

    return "\n".join(lines)


def get_quick_prompts() -> dict[str, dict[str, str]]:
    """Get the quick prompts dictionary.

    Returns:
        Dictionary of quick prompts with id as key.
    """
    return QUICK_PROMPTS
