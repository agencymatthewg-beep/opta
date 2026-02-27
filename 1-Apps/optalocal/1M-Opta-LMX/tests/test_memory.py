"""Tests for MemoryMonitor."""

from __future__ import annotations

from opta_lmx.manager.memory import MemoryMonitor


def test_memory_monitor_reads_system_memory() -> None:
    """MemoryMonitor returns real system memory values."""
    monitor = MemoryMonitor(max_percent=90)

    total = monitor.total_memory_gb()
    assert total > 0  # Must have some memory

    available = monitor.available_memory_gb()
    assert available > 0
    assert available <= total

    used = monitor.used_memory_gb()
    assert used > 0
    assert used <= total

    percent = monitor.usage_percent()
    assert 0 < percent < 100


def test_can_load_under_threshold() -> None:
    """Can load when memory is under threshold."""
    monitor = MemoryMonitor(max_percent=99)  # Very generous threshold
    assert monitor.can_load(estimated_size_gb=0) is True


def test_can_load_refuses_when_over_threshold() -> None:
    """Refuses to load when memory would exceed threshold."""
    monitor = MemoryMonitor(max_percent=1)  # Impossibly low threshold
    # Trying to load anything should fail
    assert monitor.can_load(estimated_size_gb=1) is False


def test_get_status_returns_all_fields() -> None:
    """Status response includes all required fields."""
    monitor = MemoryMonitor(max_percent=90)
    status = monitor.get_status()

    assert status.total_gb > 0
    assert status.used_gb >= 0
    assert status.available_gb >= 0
    assert status.usage_percent >= 0
    assert status.threshold_percent == 90


def test_threshold_configurable() -> None:
    """Threshold can be set to custom value."""
    monitor = MemoryMonitor(max_percent=75)
    assert monitor.threshold_percent == 75
