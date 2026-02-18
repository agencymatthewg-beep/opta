"""Tests for hand-rolled circuit breaker."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from opta_lmx.helpers.circuit_breaker import CircuitBreaker, CircuitState


class TestCircuitBreakerInit:
    """Default state is CLOSED with zero failures."""

    def test_initial_state_closed(self) -> None:
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED

    def test_initial_allows_requests(self) -> None:
        cb = CircuitBreaker()
        assert cb.allows_request is True

    def test_custom_thresholds(self) -> None:
        cb = CircuitBreaker(failure_threshold=5, reset_timeout_sec=120.0)
        assert cb.state == CircuitState.CLOSED


class TestCircuitBreakerTransitions:
    """State machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED."""

    def test_stays_closed_below_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.allows_request is True

    def test_opens_at_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allows_request is False

    def test_open_to_half_open_after_timeout(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, reset_timeout_sec=10.0)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Simulate time passing beyond reset_timeout_sec
        with patch("opta_lmx.helpers.circuit_breaker.time") as mock_time:
            mock_time.monotonic.return_value = time.monotonic() + 11.0
            assert cb.state == CircuitState.HALF_OPEN
            assert cb.allows_request is True

    def test_half_open_success_closes(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, reset_timeout_sec=0.0)
        cb.record_failure()
        # reset_timeout_sec=0 means it immediately transitions to HALF_OPEN
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_failure_reopens(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, reset_timeout_sec=10.0)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Simulate time passing to enter HALF_OPEN
        with patch("opta_lmx.helpers.circuit_breaker.time") as mock_time:
            mock_time.monotonic.return_value = time.monotonic() + 11.0
            assert cb.state == CircuitState.HALF_OPEN

        # Record failure from HALF_OPEN — should re-open
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        cb.record_failure()
        # Only 1 failure after reset, not 3
        assert cb.state == CircuitState.CLOSED

    def test_manual_reset(self) -> None:
        cb = CircuitBreaker(failure_threshold=1)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        cb.reset()
        assert cb.state == CircuitState.CLOSED
        assert cb.allows_request is True


class TestClientCircuitBreaker:
    """HelperNodeClient uses circuit_breaker attribute."""

    def test_client_has_circuit_breaker(self) -> None:
        from opta_lmx.config import HelperNodeEndpoint
        from opta_lmx.helpers.client import HelperNodeClient

        endpoint = HelperNodeEndpoint(
            url="http://10.0.0.1:1234", model="test-model",
        )
        client = HelperNodeClient(endpoint)
        assert hasattr(client, "circuit_breaker")
        assert client.circuit_breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_embed_records_success(self) -> None:
        from unittest.mock import AsyncMock
        import httpx
        from opta_lmx.config import HelperNodeEndpoint
        from opta_lmx.helpers.client import HelperNodeClient

        endpoint = HelperNodeEndpoint(
            url="http://10.0.0.1:1234", model="test-model",
        )
        client = HelperNodeClient(endpoint)

        mock_response = httpx.Response(
            200,
            json={"data": [{"embedding": [0.1], "index": 0}], "model": "test"},
            request=httpx.Request("POST", "http://test"),
        )
        client._client = AsyncMock()
        client._client.post = AsyncMock(return_value=mock_response)

        await client.embed(["hello"])
        assert client.circuit_breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_embed_records_failure(self) -> None:
        from unittest.mock import AsyncMock
        import httpx
        from opta_lmx.config import HelperNodeEndpoint
        from opta_lmx.helpers.client import HelperNodeClient, HelperNodeError

        endpoint = HelperNodeEndpoint(
            url="http://10.0.0.1:1234", model="test-model",
        )
        client = HelperNodeClient(endpoint)
        client._client = AsyncMock()
        client._client.post = AsyncMock(
            side_effect=httpx.ConnectError("refused"),
        )

        with pytest.raises(HelperNodeError):
            await client.embed(["hello"])
        # After 1 failure (threshold=3), still CLOSED
        assert client.circuit_breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_embed_blocked_when_circuit_open(self) -> None:
        from unittest.mock import AsyncMock
        import httpx
        from opta_lmx.config import HelperNodeEndpoint
        from opta_lmx.helpers.client import HelperNodeClient, HelperNodeError

        endpoint = HelperNodeEndpoint(
            url="http://10.0.0.1:1234", model="test-model",
        )
        client = HelperNodeClient(endpoint)
        # Force circuit open
        client.circuit_breaker._state = CircuitState.OPEN
        client.circuit_breaker._last_failure_at = time.monotonic()

        with pytest.raises(HelperNodeError) as exc_info:
            await client.embed(["hello"])
        assert "circuit open" in str(exc_info.value).lower()
