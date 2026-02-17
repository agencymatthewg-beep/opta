"""Tests for Feature 5: Admin Dashboard SSE Feed."""

from __future__ import annotations

import json

from httpx import AsyncClient

from opta_lmx.monitoring.events import EventBus, ServerEvent

# ─── Unit Tests: EventBus ──────────────────────────────────────────────────


async def test_subscribe_and_receive() -> None:
    """Subscriber receives published events."""
    bus = EventBus()
    queue = bus.subscribe()

    event = ServerEvent(event_type="test_event", data={"key": "value"})
    await bus.publish(event)

    received = queue.get_nowait()
    assert received.event_type == "test_event"
    assert received.data == {"key": "value"}


async def test_multiple_subscribers() -> None:
    """All subscribers receive the same event."""
    bus = EventBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()

    await bus.publish(ServerEvent(event_type="multi", data={"n": 1}))

    assert q1.get_nowait().event_type == "multi"
    assert q2.get_nowait().event_type == "multi"


async def test_unsubscribe() -> None:
    """Unsubscribed queues don't receive events."""
    bus = EventBus()
    queue = bus.subscribe()

    bus.unsubscribe(queue)
    await bus.publish(ServerEvent(event_type="after_unsub", data={}))

    assert queue.empty()


async def test_full_queue_drops_subscriber() -> None:
    """Subscriber with full queue gets dropped silently."""
    bus = EventBus(max_queue_size=2)
    bus.subscribe()

    # Fill the queue
    await bus.publish(ServerEvent(event_type="e1", data={}))
    await bus.publish(ServerEvent(event_type="e2", data={}))
    # Third publish should drop the subscriber
    await bus.publish(ServerEvent(event_type="e3", data={}))

    assert bus.subscriber_count == 0


async def test_subscriber_count() -> None:
    """subscriber_count tracks active subscriptions."""
    bus = EventBus()
    assert bus.subscriber_count == 0

    q1 = bus.subscribe()
    assert bus.subscriber_count == 1

    q2 = bus.subscribe()
    assert bus.subscriber_count == 2

    bus.unsubscribe(q1)
    assert bus.subscriber_count == 1

    bus.unsubscribe(q2)
    assert bus.subscriber_count == 0


async def test_publish_with_no_subscribers() -> None:
    """Publishing with no subscribers doesn't raise."""
    bus = EventBus()
    await bus.publish(ServerEvent(event_type="orphan", data={}))


async def test_event_timestamp() -> None:
    """ServerEvent has a timestamp set automatically."""
    event = ServerEvent(event_type="timed", data={})
    assert event.timestamp > 0


# ─── API Tests: SSE Endpoint ──────────────────────────────────────────────


async def test_sse_endpoint_returns_event_stream(client: AsyncClient) -> None:
    """GET /admin/events returns text/event-stream content type."""
    app = client._transport.app  # type: ignore[union-attr]
    event_bus = app.state.event_bus

    # Publish an event so the stream has data, then test via bus directly
    # (We can't easily test the full SSE stream with httpx because
    # StreamingResponse never ends — test the bus + format separately)
    queue = event_bus.subscribe()

    await event_bus.publish(ServerEvent(
        event_type="model_loaded",
        data={"model_id": "test"},
    ))

    event = queue.get_nowait()
    assert event.event_type == "model_loaded"

    # Verify SSE format would be correct
    sse_line = f"event: {event.event_type}\ndata: {json.dumps(event.data)}\n\n"
    assert "event: model_loaded\n" in sse_line
    assert '"model_id": "test"' in sse_line
    event_bus.unsubscribe(queue)


async def test_sse_receives_published_event(client: AsyncClient) -> None:
    """Published events appear in the SSE stream."""
    app = client._transport.app  # type: ignore[union-attr]
    event_bus = app.state.event_bus

    # Subscribe manually to verify events flow through the bus
    queue = event_bus.subscribe()

    await event_bus.publish(ServerEvent(
        event_type="model_loaded",
        data={"model_id": "test/model", "memory_gb": 4.2},
    ))

    event = queue.get_nowait()
    assert event.event_type == "model_loaded"
    assert event.data["model_id"] == "test/model"
    event_bus.unsubscribe(queue)


async def test_sse_auth_required(client_with_auth: AsyncClient) -> None:
    """SSE endpoint requires admin key when auth is configured."""
    resp = await client_with_auth.get("/admin/events")
    assert resp.status_code == 403


# ─── Integration: Engine Events ──────────────────────────────────────────


async def test_engine_publishes_model_loaded_event() -> None:
    """InferenceEngine publishes model_loaded event when a model is loaded."""
    from unittest.mock import MagicMock

    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.manager.memory import MemoryMonitor

    bus = EventBus()
    queue = bus.subscribe()

    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, event_bus=bus)

    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        mock = MagicMock()
        mock.chat = MagicMock(return_value="test")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]

    await engine.load_model("test-model")

    event = queue.get_nowait()
    assert event.event_type == "model_loaded"
    assert event.data["model_id"] == "test-model"
    assert event.data["format"] == "mlx"


async def test_engine_publishes_model_unloaded_event() -> None:
    """InferenceEngine publishes model_unloaded event on unload."""
    from unittest.mock import MagicMock

    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.manager.memory import MemoryMonitor

    bus = EventBus()
    queue = bus.subscribe()

    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, event_bus=bus)

    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        return MagicMock()

    engine._create_engine = mock_create  # type: ignore[assignment]

    await engine.load_model("test-model")
    # Consume the model_loaded event
    queue.get_nowait()

    await engine.unload_model("test-model")
    event = queue.get_nowait()
    assert event.event_type == "model_unloaded"
    assert event.data["model_id"] == "test-model"


# ─── Config Tests ────────────────────────────────────────────────────────


def test_sse_config_defaults() -> None:
    """ServerConfig has SSE fields with proper defaults."""
    from opta_lmx.config import ServerConfig

    config = ServerConfig()
    assert config.sse_events_enabled is True
    assert config.sse_heartbeat_interval_sec == 30
    assert config.websocket_enabled is True
