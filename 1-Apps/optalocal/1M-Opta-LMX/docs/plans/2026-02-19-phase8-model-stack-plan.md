# Phase 8 Implementation Plan: Model Stack & Distributed Inference

**Date:** 2026-02-19
**Status:** Ready
**Research:** `docs/research/2026-02-19-phase8-distributed-inference.md`
**Design:** `docs/plans/2026-02-17-model-stack-design.md`

---

## Scope

Six deliverables, ordered by priority. Each task is 2-5 minutes of work, TDD-driven.

| # | Deliverable | New/Changed Files | Est. Lines |
|---|-------------|-------------------|------------|
| 1 | Circuit breaker | `helpers/circuit_breaker.py`, `helpers/client.py` | ~55 |
| 2 | Background health check loop | `helpers/health.py`, `main.py` | ~35 |
| 3 | Admin endpoint: `GET /admin/stack` enhancement | `api/admin.py` | ~15 |
| 4 | Stack presets (named configs mapping roles to models) | `config.py`, YAML | ~20 |
| 5 | Config wiring: `backends` section parsed by LMXConfig | `config.py` | ~25 |
| 6 | Multi-endpoint support per helper role (low priority) | deferred to Phase 9 |

**Out of scope:** mDNS auto-discovery, tensor parallelism, EXO integration.

---

## Deliverable 1: Circuit Breaker for HelperNodeClient

### Task 1.1 -- Test: CircuitBreaker state transitions

**File:** `tests/test_circuit_breaker.py` (new)

```python
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
        cb = CircuitBreaker(failure_threshold=1, reset_timeout_sec=0.0)
        cb.record_failure()
        assert cb.state == CircuitState.HALF_OPEN
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
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_circuit_breaker.py -v` -- expect all FAIL (module not found).

### Task 1.2 -- Implement: CircuitBreaker class

**File:** `src/opta_lmx/helpers/circuit_breaker.py` (new)

```python
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
        """Record a failed request. May trip to OPEN."""
        self._failure_count += 1
        self._last_failure_at = time.monotonic()
        if self._failure_count >= self._failure_threshold:
            self._state = CircuitState.OPEN

    def reset(self) -> None:
        """Manually reset to CLOSED state."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_at = 0.0
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_circuit_breaker.py -v` -- expect all PASS.

**Commit:** `feat(lmx): add circuit breaker for helper node connections`

---

### Task 1.3 -- Test: HelperNodeClient integrates circuit breaker

**File:** `tests/test_circuit_breaker.py` (append)

```python
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
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_circuit_breaker.py::TestClientCircuitBreaker -v` -- expect FAIL.

### Task 1.4 -- Implement: Wire circuit breaker into HelperNodeClient

**File:** `src/opta_lmx/helpers/client.py`

**Changes:**

1. Add import at top:
```python
from opta_lmx.helpers.circuit_breaker import CircuitBreaker, CircuitState
```

2. In `__init__`, add after `self._last_error`:
```python
self.circuit_breaker = CircuitBreaker()
```

3. In `embed()`, add circuit breaker check at the start (after `self._total_requests += 1`):
```python
if not self.circuit_breaker.allows_request:
    self._failure_count += 1
    raise HelperNodeError(
        f"Circuit open for {self._config.url} — skipping request",
        fallback=self._config.fallback,
    )
```

4. In `embed()` success path, add:
```python
self.circuit_breaker.record_success()
```

5. In `embed()` except path, add:
```python
self.circuit_breaker.record_failure()
```

6. Mirror the same pattern in `rerank()`: circuit check at start, `record_success()` on success, `record_failure()` on failure.

7. In `get_health_stats()`, add to the returned dict:
```python
"circuit_state": self.circuit_breaker.state.value,
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_circuit_breaker.py -v && python -m pytest tests/test_helper_nodes.py -v` -- expect all PASS.

**Commit:** `feat(lmx): integrate circuit breaker into HelperNodeClient`

---

## Deliverable 2: Background Health Check Loop

### Task 2.1 -- Test: health check loop calls clients periodically

**File:** `tests/test_health_check_loop.py` (new)

```python
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
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_health_check_loop.py -v` -- expect FAIL (module not found).

### Task 2.2 -- Implement: health_check_loop function

**File:** `src/opta_lmx/helpers/health.py` (new)

```python
"""Background health check loop for helper nodes.

Periodically pings each helper node's health endpoint. Successful checks
record success on the node's circuit breaker (enabling recovery from HALF_OPEN).
Failed checks do NOT trip the breaker -- only real request failures do.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opta_lmx.helpers.client import HelperNodeClient

logger = logging.getLogger(__name__)


async def health_check_loop(
    clients: list[HelperNodeClient],
    interval_sec: float = 30.0,
) -> None:
    """Periodically probe helper nodes and update circuit breakers.

    Args:
        clients: List of helper node clients to monitor.
        interval_sec: Seconds between health check rounds.
    """
    while True:
        for client in clients:
            try:
                is_up = await client.health_check()
                if is_up:
                    client.circuit_breaker.record_success()
                    logger.debug("health_check_ok", extra={"url": client.url})
                else:
                    logger.debug("health_check_down", extra={"url": client.url})
                # Do NOT record_failure on health check -- only real requests trip the breaker
            except Exception as e:
                logger.warning("health_check_error", extra={
                    "url": client.url, "error": str(e),
                })
        await asyncio.sleep(interval_sec)
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_health_check_loop.py -v` -- expect all PASS.

**Commit:** `feat(lmx): add background health check loop for helper nodes`

---

### Task 2.3 -- Wire health check loop into app lifespan

**File:** `src/opta_lmx/main.py`

**Changes in the `lifespan()` function:**

1. After the block that sets `app.state.remote_embedding` and `app.state.remote_reranking` (around line 163), add:

```python
    # Start background health check loop for helper nodes
    from opta_lmx.helpers.health import health_check_loop

    health_clients: list[HelperNodeClient] = []
    if remote_embedding:
        health_clients.append(remote_embedding)
    if remote_reranking:
        health_clients.append(remote_reranking)

    health_task: asyncio.Task[None] | None = None
    if health_clients:
        health_task = asyncio.create_task(health_check_loop(health_clients, interval_sec=30.0))
        logger.info("health_check_loop_started", extra={
            "client_count": len(health_clients),
            "interval_sec": 30,
        })
```

2. In the cleanup section (after `yield`), add before `if remote_embedding:`:

```python
    # Cleanup: cancel health check loop
    if health_task is not None:
        health_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await health_task
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/ -v -k "not integration"` -- expect all PASS.

**Commit:** `feat(lmx): wire health check loop into app lifespan`

---

## Deliverable 3: Enhance `GET /admin/stack` with Circuit Breaker State

The endpoint already exists (see `api/admin.py` line 848). Enhance it to include circuit breaker state.

### Task 3.1 -- Test: /admin/stack includes circuit_state

**File:** `tests/test_helper_nodes.py` (append to existing)

```python
async def test_stack_endpoint_shows_circuit_state(client: AsyncClient) -> None:
    """Stack endpoint includes circuit breaker state for helper nodes."""
    from opta_lmx.helpers.circuit_breaker import CircuitBreaker
    app = client._transport.app  # type: ignore[union-attr]

    mock_remote = MagicMock()
    mock_remote.url = "http://192.168.188.20:1234"
    mock_remote.model = "nomic-embed-text-v1.5"
    mock_remote.is_healthy = True
    mock_remote.fallback = "local"
    mock_remote.circuit_breaker = CircuitBreaker()
    app.state.remote_embedding = mock_remote

    resp = await client.get("/admin/stack")
    assert resp.status_code == 200
    data = resp.json()

    helper = data["helper_nodes"]["embedding"]
    assert helper["circuit_state"] == "closed"
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_helper_nodes.py::test_stack_endpoint_shows_circuit_state -v` -- expect FAIL (no `circuit_state` key).

### Task 3.2 -- Implement: Add circuit_state to /admin/stack response

**File:** `src/opta_lmx/api/admin.py`

**Change in `stack_status()` (around line 880):** Add `circuit_state` to each helper node dict.

Replace:
```python
    if remote_embedding is not None:
        helpers["embedding"] = {
            "url": remote_embedding.url,
            "model": remote_embedding.model,
            "healthy": remote_embedding.is_healthy,
            "fallback": remote_embedding.fallback,
        }
    if remote_reranking is not None:
        helpers["reranking"] = {
            "url": remote_reranking.url,
            "model": remote_reranking.model,
            "healthy": remote_reranking.is_healthy,
            "fallback": remote_reranking.fallback,
        }
```

With:
```python
    if remote_embedding is not None:
        helpers["embedding"] = {
            "url": remote_embedding.url,
            "model": remote_embedding.model,
            "healthy": remote_embedding.is_healthy,
            "fallback": remote_embedding.fallback,
            "circuit_state": remote_embedding.circuit_breaker.state.value,
        }
    if remote_reranking is not None:
        helpers["reranking"] = {
            "url": remote_reranking.url,
            "model": remote_reranking.model,
            "healthy": remote_reranking.is_healthy,
            "fallback": remote_reranking.fallback,
            "circuit_state": remote_reranking.circuit_breaker.state.value,
        }
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_helper_nodes.py -v` -- expect all PASS.

**Commit:** `feat(lmx): show circuit breaker state in /admin/stack`

---

## Deliverable 4: Stack Presets (Named Configurations)

Stack presets map named roles to model preferences. The existing preset system (`presets/manager.py`) already supports `routing_alias` and `auto_load`. This deliverable formalizes "stack presets" as a named group of presets applied together.

### Task 4.1 -- Test: StackPresetsConfig parsed from YAML

**File:** `tests/test_stack_presets.py` (new)

```python
"""Tests for stack presets in config."""

from __future__ import annotations

import pytest

from opta_lmx.config import LMXConfig, StackPresetConfig


class TestStackPresetConfig:
    """Stack presets map preset names to role->model configurations."""

    def test_default_no_stack_presets(self) -> None:
        config = LMXConfig()
        assert config.stack_presets == {}

    def test_parse_stack_preset(self) -> None:
        config = LMXConfig(
            stack_presets={
                "standard": StackPresetConfig(
                    description="Standard 4-model stack",
                    roles={
                        "coding": "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit",
                        "reasoning": "mlx-community/QwQ-32B-4bit",
                        "chat": "mlx-community/Qwen3-30B-A3B-4bit",
                        "vision": "mlx-community/Qwen2.5-VL-32B-Instruct-4bit",
                    },
                ),
            },
        )
        assert "standard" in config.stack_presets
        preset = config.stack_presets["standard"]
        assert preset.roles["coding"] == "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
        assert preset.description == "Standard 4-model stack"

    def test_stack_preset_from_yaml_dict(self) -> None:
        """Validates that YAML-style nested dict is parsed correctly."""
        raw = {
            "stack_presets": {
                "minimax": {
                    "description": "MiniMax single-model stack",
                    "roles": {
                        "coding": "mlx-community/MiniMax-M2.5-5bit",
                        "chat": "mlx-community/MiniMax-M2.5-4bit",
                    },
                },
            },
        }
        config = LMXConfig.model_validate(raw)
        assert "minimax" in config.stack_presets
        assert config.stack_presets["minimax"].roles["chat"] == "mlx-community/MiniMax-M2.5-4bit"
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_stack_presets.py -v` -- expect FAIL (StackPresetConfig not found).

### Task 4.2 -- Implement: StackPresetConfig in config.py

**File:** `src/opta_lmx/config.py`

1. Add new model after `PresetsConfig`:

```python
class StackPresetConfig(BaseModel):
    """A named stack configuration mapping roles to specific models.

    Used to quickly switch between different model combinations.
    Example: 'standard' preset maps coding -> Coder-32B, reasoning -> QwQ-32B.
    """

    description: str = ""
    roles: dict[str, str] = Field(
        default_factory=dict,
        description="Map of role name -> model ID (e.g. coding -> Qwen2.5-Coder-32B)",
    )
```

2. Add to `LMXConfig` class, after `security`:

```python
    stack_presets: dict[str, StackPresetConfig] = Field(
        default_factory=dict,
        description="Named stack configurations mapping roles to models",
    )
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_stack_presets.py -v` -- expect all PASS.

**Commit:** `feat(lmx): add stack presets config for named role-to-model mappings`

---

## Deliverable 5: Config Wiring -- Parse `backends` Section

The `backends` section in `mono512-current.yaml` is currently documentation-only (Pydantic silently drops it). Wire it into LMXConfig so it's validated and accessible.

### Task 5.1 -- Test: BackendConfig parsed from YAML

**File:** `tests/test_backends_config.py` (new)

```python
"""Tests for backends config section."""

from __future__ import annotations

import pytest

from opta_lmx.config import BackendConfig, LMXConfig


class TestBackendConfig:
    """Backends section maps names to external mlx_lm.server endpoints."""

    def test_default_no_backends(self) -> None:
        config = LMXConfig()
        assert config.backends == {}

    def test_parse_backend(self) -> None:
        config = LMXConfig(
            backends={
                "m2.5-4bit": BackendConfig(
                    url="http://localhost:10001/v1",
                    model="mlx-community/MiniMax-M2.5-4bit",
                ),
            },
        )
        assert "m2.5-4bit" in config.backends
        backend = config.backends["m2.5-4bit"]
        assert backend.url == "http://localhost:10001/v1"
        assert backend.model == "mlx-community/MiniMax-M2.5-4bit"
        assert backend.status == "active"

    def test_parse_backend_inactive(self) -> None:
        config = LMXConfig(
            backends={
                "test": BackendConfig(
                    url="http://localhost:10003/v1",
                    model="test-model",
                    status="inactive",
                ),
            },
        )
        assert config.backends["test"].status == "inactive"

    def test_mono512_yaml_format(self) -> None:
        """Validates the exact format used in mono512-current.yaml."""
        raw = {
            "backends": {
                "m2.5-4bit": {
                    "url": "http://localhost:10001/v1",
                    "model": "mlx-community/MiniMax-M2.5-4bit",
                    "status": "active",
                },
                "m2.5-5bit": {
                    "url": "http://localhost:10002/v1",
                    "model": "mlx-community/MiniMax-M2.5-5bit",
                    "status": "active",
                },
            },
        }
        config = LMXConfig.model_validate(raw)
        assert len(config.backends) == 2
        assert config.backends["m2.5-4bit"].url == "http://localhost:10001/v1"
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_backends_config.py -v` -- expect FAIL (BackendConfig not found).

### Task 5.2 -- Implement: BackendConfig in config.py

**File:** `src/opta_lmx/config.py`

1. Add new model after `SecurityConfig`:

```python
class BackendConfig(BaseModel):
    """External mlx_lm.server backend endpoint.

    Backends are independently-running mlx_lm.server instances that
    Opta-LMX can route to. Currently parsed for reference/admin display;
    active routing to backends is planned for a future phase.
    """

    url: str = Field(..., description="Base URL of the backend (e.g. http://localhost:10001/v1)")
    model: str = Field(..., description="Model ID served by this backend")
    status: str = Field("active", pattern="^(active|inactive)$", description="Whether to route to this backend")
```

2. Add to `LMXConfig`, after `stack_presets`:

```python
    backends: dict[str, BackendConfig] = Field(
        default_factory=dict,
        description="External mlx_lm.server backend endpoints (parsed, not yet routed)",
    )
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_backends_config.py -v` -- expect all PASS.

### Task 5.3 -- Test: /admin/stack shows backends

**File:** `tests/test_backends_config.py` (append)

```python
async def test_stack_endpoint_shows_backends(client: AsyncClient) -> None:
    """Stack endpoint includes configured backends."""
    from opta_lmx.config import BackendConfig
    from httpx import AsyncClient

    app = client._transport.app  # type: ignore[union-attr]
    app.state.config.backends = {
        "m2.5-4bit": BackendConfig(
            url="http://localhost:10001/v1",
            model="mlx-community/MiniMax-M2.5-4bit",
        ),
    }

    resp = await client.get("/admin/stack")
    assert resp.status_code == 200
    data = resp.json()
    assert "backends" in data
    assert "m2.5-4bit" in data["backends"]
    assert data["backends"]["m2.5-4bit"]["url"] == "http://localhost:10001/v1"
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_backends_config.py::test_stack_endpoint_shows_backends -v` -- expect FAIL.

### Task 5.4 -- Implement: Add backends to /admin/stack response

**File:** `src/opta_lmx/api/admin.py`

In the `stack_status()` function, add before the return statement:

```python
    # Backends (external mlx_lm.server instances)
    backends_status: dict[str, dict[str, Any]] = {}
    for name, backend in config.backends.items():
        backends_status[name] = {
            "url": backend.url,
            "model": backend.model,
            "status": backend.status,
        }
```

And add `"backends": backends_status,` to the return dict (alongside `"roles"`, `"helper_nodes"`, etc.).

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_backends_config.py -v` -- expect all PASS.

**Commit:** `feat(lmx): parse backends config and expose in /admin/stack`

---

### Task 5.5 -- Update mono512-current.yaml comment

**File:** `config/mono512-current.yaml`

Remove the warning comment about backends being documentation-only:

Replace:
```yaml
# Backend servers (mlx_lm.server instances)
# These run independently; Opta-LMX routes to them
# NOTE: backends section is for documentation/reference only.
# LMX does not currently route to external mlx_lm.server instances.
# LMXConfig has no 'backends' field -- Pydantic silently drops this section.
# Backend routing support is planned for a future release.
```

With:
```yaml
# Backend servers (mlx_lm.server instances)
# These run independently; Opta-LMX parses and displays them in /admin/stack.
# Active routing to backends is planned for a future phase.
```

**Commit:** `docs(lmx): update backends config comment after wiring`

---

## Deliverable 6: Multi-Endpoint Support Per Helper Role

**Deferred to Phase 9.** The research recommends this (Section 4.3) but assigns it Medium effort / Low impact. A single helper node per role is sufficient for the current 3-5 machine LAN topology. The config schema extension (multiple `endpoints` per role) can be added when a second helper node is physically available.

---

## Update helpers/__init__.py

After all deliverables, update the package exports.

**File:** `src/opta_lmx/helpers/__init__.py`

```python
"""Helper node client for distributed embedding and reranking on LAN devices."""

from opta_lmx.helpers.circuit_breaker import CircuitBreaker, CircuitState
from opta_lmx.helpers.client import HelperNodeClient
from opta_lmx.helpers.health import health_check_loop

__all__ = ["CircuitBreaker", "CircuitState", "HelperNodeClient", "health_check_loop"]
```

**Commit:** `refactor(lmx): export circuit breaker and health loop from helpers package`

---

## Full Test Run

After all deliverables:

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
python -m pytest tests/ -v -k "not integration" --tb=short
```

Expected: All existing tests pass, plus new tests:
- `tests/test_circuit_breaker.py` (9 tests)
- `tests/test_health_check_loop.py` (4 tests)
- `tests/test_stack_presets.py` (3 tests)
- `tests/test_backends_config.py` (5 tests)

---

## Commit Summary

| # | Commit Message | Files Changed |
|---|---------------|---------------|
| 1 | `feat(lmx): add circuit breaker for helper node connections` | `helpers/circuit_breaker.py`, `tests/test_circuit_breaker.py` |
| 2 | `feat(lmx): integrate circuit breaker into HelperNodeClient` | `helpers/client.py`, `tests/test_circuit_breaker.py` |
| 3 | `feat(lmx): add background health check loop for helper nodes` | `helpers/health.py`, `tests/test_health_check_loop.py` |
| 4 | `feat(lmx): wire health check loop into app lifespan` | `main.py` |
| 5 | `feat(lmx): show circuit breaker state in /admin/stack` | `api/admin.py`, `tests/test_helper_nodes.py` |
| 6 | `feat(lmx): add stack presets config for named role-to-model mappings` | `config.py`, `tests/test_stack_presets.py` |
| 7 | `feat(lmx): parse backends config and expose in /admin/stack` | `config.py`, `api/admin.py`, `tests/test_backends_config.py` |
| 8 | `docs(lmx): update backends config comment after wiring` | `config/mono512-current.yaml` |
| 9 | `refactor(lmx): export circuit breaker and health loop from helpers package` | `helpers/__init__.py` |

Total: 9 commits, ~21 tests added, ~150 lines of production code, ~200 lines of test code.
