"""Discovery helpers for zero-config Opta-LMX client pairing."""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Iterable
from typing import Any

from opta_lmx.config import LMXConfig
from opta_lmx.hardware_probe import probe as _hw_probe

_WILDCARD_HOSTS = {"0.0.0.0", "::", "[::]"}
_LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _normalize_host(value: str) -> str:
    return value.strip().lower()


def _is_ipv6(host: str) -> bool:
    return ":" in host and not host.startswith("[")


def _to_http_url(host: str, port: int) -> str:
    if _is_ipv6(host):
        return f"http://[{host}]:{port}"
    return f"http://{host}:{port}"


def _to_ws_url(host: str, port: int, path: str) -> str:
    if _is_ipv6(host):
        return f"ws://[{host}]:{port}{path}"
    return f"ws://{host}:{port}{path}"


def _iter_local_ipv4_addresses() -> Iterable[str]:
    seen: set[str] = set()
    try:
        hostname = socket.gethostname()
        for _name, _aliases, addresses in socket.gethostbyname_ex(hostname):
            for candidate in addresses:
                if candidate in seen:
                    continue
                try:
                    ip = ipaddress.ip_address(candidate)
                except ValueError:
                    continue
                if not isinstance(ip, ipaddress.IPv4Address):
                    continue
                if ip.is_loopback:
                    continue
                seen.add(candidate)
                yield candidate
    except Exception:
        return


def _candidate_hosts(config: LMXConfig) -> list[str]:
    host = _normalize_host(config.server.host)
    candidates: list[str] = []

    def add(value: str) -> None:
        normalized = _normalize_host(value)
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    if host in _WILDCARD_HOSTS:
        add("localhost")
        add("127.0.0.1")
        machine = _normalize_host(socket.gethostname())
        if machine:
            add(machine)
            add(f"{machine}.local")
        for ipv4 in _iter_local_ipv4_addresses():
            add(ipv4)
        return candidates

    add(host)
    if host in _LOCAL_HOSTS:
        add("localhost")
        add("127.0.0.1")
    return candidates


def _pick_preferred_host(hosts: list[str]) -> str:
    if not hosts:
        return "127.0.0.1"
    for host in hosts:
        if host.endswith(".local"):
            return host
    for host in hosts:
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            continue
        if ip.is_private:
            return host
    for host in hosts:
        if host not in _LOCAL_HOSTS:
            return host
    return hosts[0]


def _build_hardware_summary() -> dict:
    """Return a lightweight hardware summary for discovery documents."""
    try:
        hw = _hw_probe()
        return {
            "chip": hw.get("chip_name"),
            "memory_gb": hw.get("memory_gb"),
            "metal": hw.get("metal_available", False),
        }
    except Exception:
        return {"chip": None, "memory_gb": None, "metal": False}


def build_discovery_document(
    *,
    config: LMXConfig,
    version: str,
    loaded_models: list[str],
    in_flight_requests: int,
) -> dict[str, Any]:
    """Build a discovery payload that clients can use for zero-config pairing."""
    hosts = _candidate_hosts(config)
    preferred_host = _pick_preferred_host(hosts)
    base_urls = [_to_http_url(host, config.server.port) for host in hosts]
    preferred_base_url = _to_http_url(preferred_host, config.server.port)
    expose_model_ids = config.security.profile == "lan"
    inference_auth_required = (
        config.security.inference_api_key is not None or config.security.supabase_jwt_require
    )
    return {
        "service": "opta-lmx",
        "version": version,
        "security_profile": config.security.profile,
        "ready": bool(loaded_models),
        "loaded_models": loaded_models if expose_model_ids else [],
        "loaded_model_count": len(loaded_models),
        "in_flight_requests": in_flight_requests,
        "auth": {
            "admin_key_required": config.security.admin_key is not None,
            "inference_key_required": inference_auth_required,
            "supabase_jwt_enabled": config.security.supabase_jwt_enabled,
        },
        "endpoints": {
            "preferred_base_url": preferred_base_url,
            "base_urls": base_urls,
            "openai_base_url": f"{preferred_base_url}/v1",
            "admin_base_url": f"{preferred_base_url}/admin",
            "websocket_url": (
                _to_ws_url(preferred_host, config.server.port, "/v1/chat/stream")
                if config.server.websocket_enabled
                else None
            ),
        },
        "client_probe_order": [
            "/.well-known/opta-lmx",
            "/v1/discovery",
            "/healthz",
            "/v1/models",
        ],
        "hardware_summary": _build_hardware_summary(),
    }
