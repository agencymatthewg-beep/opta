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
