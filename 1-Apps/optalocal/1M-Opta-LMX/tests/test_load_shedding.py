"""Tests for load shedding middleware under memory pressure."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from opta_lmx.api.load_shedding import LoadSheddingMiddleware


class _FakeMemoryMonitor:
    def __init__(self, percent: float) -> None:
        self.percent = percent
        self.calls = 0

    def usage_percent(self) -> float:
        self.calls += 1
        return self.percent


@pytest.fixture
async def shed_client() -> AsyncIterator[AsyncClient]:
    app = FastAPI()

    @app.get("/work")
    async def work() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/healthz")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.state.memory_monitor = _FakeMemoryMonitor(percent=96.0)
    app.add_middleware(LoadSheddingMiddleware, threshold_percent=95.0)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_load_shedding_uses_memory_monitor_when_available(
    shed_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Middleware should use app memory monitor and avoid direct psutil polling."""
    def fail_virtual_memory():  # type: ignore[no-untyped-def]
        raise AssertionError("psutil.virtual_memory should not be called")

    monkeypatch.setattr("opta_lmx.api.load_shedding.psutil.virtual_memory", fail_virtual_memory)

    response = await shed_client.get("/work")
    assert response.status_code == 503

    monitor = shed_client._transport.app.state.memory_monitor  # type: ignore[union-attr]
    assert monitor.calls == 1


@pytest.mark.asyncio
async def test_load_shedding_exempts_health_endpoints(
    shed_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Health routes should bypass load shedding checks."""
    def fail_virtual_memory():  # type: ignore[no-untyped-def]
        raise AssertionError("psutil.virtual_memory should not be called")

    monkeypatch.setattr("opta_lmx.api.load_shedding.psutil.virtual_memory", fail_virtual_memory)

    response = await shed_client.get("/healthz")
    assert response.status_code == 200
