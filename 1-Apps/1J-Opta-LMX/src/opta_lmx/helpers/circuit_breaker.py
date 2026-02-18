"""Circuit breaker for helper node connections.

Three-state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.
Hand-rolled (~40 lines) -- too small for a dependency.
"""

from __future__ import annotations

import time
from enum import Enum


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Three-state circuit breaker for LAN helper nodes.

    Args:
        failure_threshold: Consecutive failures before opening circuit.
        reset_timeout_sec: Seconds to wait before trying half-open.
    """

    def __init__(
        self, failure_threshold: int = 3, reset_timeout_sec: float = 60.0
    ) -> None:
        self._failure_threshold = failure_threshold
        self._reset_timeout_sec = reset_timeout_sec
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_at: float = 0.0

    @property
    def state(self) -> CircuitState:
        """Current circuit state, auto-transitioning OPEN -> HALF_OPEN."""
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_at >= self._reset_timeout_sec:
                self._state = CircuitState.HALF_OPEN
        return self._state

    @property
    def allows_request(self) -> bool:
        """Whether the circuit allows a request to pass."""
        return self.state != CircuitState.OPEN

    def record_success(self) -> None:
        """Record a successful request. Resets to CLOSED."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Record a failed request. May trip to OPEN.

        If circuit is HALF_OPEN, any failure immediately re-opens it.
        """
        self._failure_count += 1
        self._last_failure_at = time.monotonic()
        if (
            self._state == CircuitState.HALF_OPEN
            or self._failure_count >= self._failure_threshold
        ):
            self._state = CircuitState.OPEN

    def reset(self) -> None:
        """Manually reset to CLOSED state."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_at = 0.0
