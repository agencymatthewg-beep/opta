"""Tests for background health check loop."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.helpers.circuit_breaker import CircuitBreaker, CircuitState
from opta_lmx.helpers.health import health_check_loop


@pytest.mark.asyncio
async def test_health_check_calls_clients() -> None:
    """Health check loop calls health_check() on each client."""
    client1 = AsyncMock()
    client1.health_check = AsyncMock(return_value=True)
    client1.circuit_breaker = CircuitBreaker()
    client1.url = "http://node1"

    client2 = AsyncMock()
    client2.health_check = AsyncMock(return_value=False)
    client2.circuit_breaker = CircuitBreaker()
    client2.url = "http://node2"

    # Run one iteration then cancel
    task = asyncio.create_task(health_check_loop([client1, client2], interval_sec=0.01))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert client1.health_check.call_count >= 1
    assert client2.health_check.call_count >= 1


@pytest.mark.asyncio
async def test_health_check_success_records_on_breaker() -> None:
    """Successful health check records success on circuit breaker."""
    cb = CircuitBreaker(failure_threshold=1, reset_timeout_sec=0.0)
    cb.record_failure()  # Open the circuit
    assert cb.state == CircuitState.HALF_OPEN  # timeout=0 -> immediate half-open

    client = AsyncMock()
    client.health_check = AsyncMock(return_value=True)
    client.circuit_breaker = cb
    client.url = "http://node1"

    task = asyncio.create_task(health_check_loop([client], interval_sec=0.01))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert cb.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_health_check_failure_does_not_trip_breaker() -> None:
    """Failed health check does NOT record failure on circuit breaker.

    Only real request failures should trip the breaker. Health check
    failures are informational.
    """
    cb = CircuitBreaker(failure_threshold=1)

    client = AsyncMock()
    client.health_check = AsyncMock(return_value=False)
    client.circuit_breaker = cb
    client.url = "http://node1"

    task = asyncio.create_task(health_check_loop([client], interval_sec=0.01))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # Breaker should still be CLOSED (health check failures don't trip it)
    assert cb.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_health_check_empty_clients() -> None:
    """Health check loop handles empty client list gracefully."""
    task = asyncio.create_task(health_check_loop([], interval_sec=0.01))
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    # No crash = pass
