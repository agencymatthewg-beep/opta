"""Tests for mDNS discovery advertisement lifecycle."""

from __future__ import annotations

import pytest

from opta_lmx.config import LMXConfig
from opta_lmx.discovery_mdns import _normalize_service_type, _resolve_advertise_host
from opta_lmx.main import create_app


@pytest.mark.parametrize(
    ("raw_service_type", "expected"),
    [
        ("opta-lmx", "_opta-lmx._tcp.local."),
        ("_opta-lmx._tcp", "_opta-lmx._tcp.local."),
        ("_opta-lmx._tcp.local", "_opta-lmx._tcp.local."),
        ("opta-lmx._tcp.local", "_opta-lmx._tcp.local."),
        ("  OPTA-LMX._TCP.LOCAL.  ", "_opta-lmx._tcp.local."),
        ("", "_opta-lmx._tcp.local."),
    ],
)
def test_normalize_service_type_accepts_common_inputs(raw_service_type: str, expected: str) -> None:
    """Service type normalization should accept common shorthand forms."""
    assert _normalize_service_type(raw_service_type) == expected


def test_resolve_advertise_host_resolves_hostname_to_ipv4(monkeypatch: pytest.MonkeyPatch) -> None:
    """Hostname bind values should resolve to IPv4 for zeroconf advertisement."""

    monkeypatch.setattr(
        "opta_lmx.discovery_mdns.socket.gethostbyname_ex",
        lambda _host: ("lmx-host", [], ["10.44.0.12"]),
    )
    monkeypatch.setattr(
        "opta_lmx.discovery_mdns._iter_local_ipv4_addresses",
        lambda: ["192.168.1.20"],
    )

    assert _resolve_advertise_host("lmx-host.local") == "10.44.0.12"


def test_resolve_advertise_host_falls_back_to_local_ipv4_when_unresolvable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unresolvable hostnames should still advertise using a local IPv4."""

    def _raise_lookup(_host: str) -> tuple[str, list[str], list[str]]:
        raise OSError("lookup failed")

    monkeypatch.setattr(
        "opta_lmx.discovery_mdns.socket.gethostbyname_ex",
        _raise_lookup,
    )
    monkeypatch.setattr(
        "opta_lmx.discovery_mdns._iter_local_ipv4_addresses",
        lambda: ["192.168.1.33"],
    )

    assert _resolve_advertise_host("unresolvable.local") == "192.168.1.33"


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
