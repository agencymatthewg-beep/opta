"""Tests for mDNS discovery advertisement lifecycle."""

from __future__ import annotations

import pytest

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


@pytest.mark.asyncio
async def test_mdns_advertiser_starts_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Lifespan should start and stop mDNS advertiser when enabled."""
    started = {"value": False}
    stopped = {"value": False}

    class FakeAdvertiser:
        def __init__(self, *, host: str, port: int, service_name: str) -> None:
            self.host = host
            self.port = port
            self.service_name = service_name

        def start(self) -> None:
            started["value"] = True

        def stop(self) -> None:
            stopped["value"] = True

    import opta_lmx.discovery_mdns as discovery_mdns

    monkeypatch.setattr(discovery_mdns, "MdnsAdvertiser", FakeAdvertiser)

    app = create_app(
        LMXConfig(
            models={"auto_load": []},
            discovery={"mdns_enabled": True},
        )
    )

    async with app.router.lifespan_context(app):
        assert started["value"] is True

    assert stopped["value"] is True
