"""Tests for Metal cache maintenance background task."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest


class TestMetalCacheMaintenance:
    """Metal cache maintenance loop tests (mocked — no real Metal GPU in CI)."""

    @pytest.mark.asyncio
    async def test_clears_cache_when_over_limit(self) -> None:
        """Cache is cleared when usage exceeds the configured limit."""
        from opta_lmx.maintenance.metal import metal_cache_maintenance_loop

        with patch("opta_lmx.maintenance.metal.mx") as mock_mx:
            mock_mx.metal.get_cache_memory.return_value = 3 * 1024**3  # 3GB
            mock_mx.metal.get_peak_memory.return_value = 4 * 1024**3
            mock_mx.metal.clear_cache.return_value = None

            task = asyncio.create_task(
                metal_cache_maintenance_loop(cache_limit_gb=2.0, interval_sec=0.01)
            )
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            mock_mx.metal.clear_cache.assert_called()

    @pytest.mark.asyncio
    async def test_no_clear_when_under_limit(self) -> None:
        """Cache is NOT cleared when usage is below the limit."""
        from opta_lmx.maintenance.metal import metal_cache_maintenance_loop

        with patch("opta_lmx.maintenance.metal.mx") as mock_mx:
            mock_mx.metal.get_cache_memory.return_value = 1 * 1024**3  # 1GB

            task = asyncio.create_task(
                metal_cache_maintenance_loop(cache_limit_gb=2.0, interval_sec=0.01)
            )
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            mock_mx.metal.clear_cache.assert_not_called()

    def test_config_defaults(self) -> None:
        """Metal cache maintenance config has sensible defaults."""
        from opta_lmx.config import MemoryConfig

        cfg = MemoryConfig()
        assert cfg.metal_cache_maintenance is True
        assert cfg.metal_cache_check_interval_sec == 300.0
