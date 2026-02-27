"""Event bus for admin SSE feed — publish-subscribe for real-time monitoring."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ServerEvent:
    """A server event published to admin SSE subscribers."""

    event_type: str  # "model_loaded", "download_progress", etc.
    data: dict[str, Any]
    timestamp: float = field(default_factory=time.time)


class EventBus:
    """Publish-subscribe event bus for admin SSE feed.

    Each subscriber gets their own asyncio.Queue so slow
    consumers don't block the event bus or other subscribers.

    When a subscriber's queue is full, the subscription is dropped
    (the client's EventSource will auto-reconnect).
    """

    def __init__(self, max_queue_size: int = 100) -> None:
        self._subscribers: list[asyncio.Queue[ServerEvent]] = []
        self._max_queue_size = max_queue_size

    def subscribe(self) -> asyncio.Queue[ServerEvent]:
        """Create a new subscription queue.

        Returns:
            asyncio.Queue that receives published events.

        Raises:
            ValueError: If subscriber limit (50) is reached.
        """
        if len(self._subscribers) >= 50:
            raise ValueError("Maximum SSE subscriber limit reached")
        queue: asyncio.Queue[ServerEvent] = asyncio.Queue(maxsize=self._max_queue_size)
        self._subscribers.append(queue)
        logger.debug("sse_subscriber_added", extra={"total": len(self._subscribers)})
        return queue

    def unsubscribe(self, queue: asyncio.Queue[ServerEvent]) -> None:
        """Remove a subscription queue."""
        self._subscribers = [q for q in self._subscribers if q is not queue]
        logger.debug("sse_subscriber_removed", extra={"total": len(self._subscribers)})

    async def publish(self, event: ServerEvent) -> None:
        """Publish an event to all subscribers.

        Slow consumers (full queues) are silently dropped.
        Iterates over a copy of the subscriber list to avoid mutation
        during iteration.
        """
        dead: list[asyncio.Queue[ServerEvent]] = []
        for queue in self._subscribers[:]:  # Iterate over copy
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(queue)
                logger.warning("sse_subscriber_dropped", extra={
                    "reason": "queue_full",
                    "event_type": event.event_type,
                })
        for q in dead:
            self._subscribers.remove(q)

    @property
    def subscriber_count(self) -> int:
        """Number of active subscribers."""
        return len(self._subscribers)
