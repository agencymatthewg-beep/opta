"""mDNS advertisement helpers for Opta-LMX discovery."""

from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_WILDCARD_HOSTS = {"0.0.0.0", "::", "[::]"}
_DEFAULT_MDNS_SERVICE_LABEL = "_opta-lmx"
_DEFAULT_MDNS_TRANSPORT_LABEL = "_tcp"


def _iter_local_ipv4_addresses() -> list[str]:
    addresses: list[str] = []
    try:
        hostname = socket.gethostname()
        _, _, candidates = socket.gethostbyname_ex(hostname)
        for candidate in candidates:
            try:
                ip = ipaddress.ip_address(candidate)
            except ValueError:
                continue
            if not isinstance(ip, ipaddress.IPv4Address):
                continue
            if ip.is_loopback:
                continue
            if candidate not in addresses:
                addresses.append(candidate)
    except Exception:
        pass

    # Fallback: enumerate network interfaces directly.
    try:
        import psutil

        for iface_addrs in psutil.net_if_addrs().values():
            for entry in iface_addrs:
                if entry.family != socket.AF_INET:
                    continue
                candidate = str(entry.address)
                try:
                    ip = ipaddress.ip_address(candidate)
                except ValueError:
                    continue
                if not isinstance(ip, ipaddress.IPv4Address):
                    continue
                if ip.is_loopback:
                    continue
                if candidate not in addresses:
                    addresses.append(candidate)
    except Exception:
        pass
    return addresses


def _resolve_advertise_host(host: str) -> str:
    raw_host = host.strip().strip("[]")
    normalized = raw_host.lower()
    if normalized in _WILDCARD_HOSTS or normalized in {"localhost", "::1", "127.0.0.1"}:
        candidates = _iter_local_ipv4_addresses()
        if candidates:
            return candidates[0]
        raise RuntimeError("No non-loopback IPv4 address available for mDNS advertisement.")

    # Keep explicit IPv4 literals untouched.
    try:
        parsed = ipaddress.ip_address(raw_host)
        if isinstance(parsed, ipaddress.IPv4Address):
            return str(parsed)
    except ValueError:
        pass

    # Resolve hostname/alias binds to an IPv4 address accepted by zeroconf.
    try:
        _name, _aliases, candidates = socket.gethostbyname_ex(raw_host)
        for candidate in candidates:
            try:
                ip = ipaddress.ip_address(candidate)
            except ValueError:
                continue
            if isinstance(ip, ipaddress.IPv4Address) and not ip.is_loopback:
                return candidate
        for candidate in candidates:
            try:
                ip = ipaddress.ip_address(candidate)
            except ValueError:
                continue
            if isinstance(ip, ipaddress.IPv4Address):
                return candidate
    except Exception:
        pass

    local_candidates = _iter_local_ipv4_addresses()
    if local_candidates:
        return local_candidates[0]

    raise RuntimeError(
        f"Unable to resolve advertise host '{host}' to non-loopback IPv4 address."
    )


def _normalize_service_type(service_name: str) -> str:
    raw_value = service_name.strip().rstrip(".").lower()
    if not raw_value:
        return f"{_DEFAULT_MDNS_SERVICE_LABEL}.{_DEFAULT_MDNS_TRANSPORT_LABEL}.local."

    labels = [label for label in raw_value.split(".") if label]
    if labels and labels[-1] == "local":
        labels = labels[:-1]

    service_label = labels[0] if labels else _DEFAULT_MDNS_SERVICE_LABEL
    transport_label = labels[1] if len(labels) > 1 else _DEFAULT_MDNS_TRANSPORT_LABEL

    service_label = f"_{service_label.lstrip('_')}" or _DEFAULT_MDNS_SERVICE_LABEL
    transport_label = f"_{transport_label.lstrip('_')}" or _DEFAULT_MDNS_TRANSPORT_LABEL
    return f"{service_label}.{transport_label}.local."


@dataclass
class MdnsAdvertiser:
    """Registers Opta-LMX discovery metadata on the local network via mDNS."""

    host: str
    port: int
    service_name: str = "_opta-lmx._tcp.local"

    def __post_init__(self) -> None:
        self._zeroconf: Any | None = None
        self._service_info: Any | None = None
        self._active = False

    def start(self) -> None:
        """Start service advertisement if zeroconf is available."""
        if self._active:
            return
        try:
            from zeroconf import ServiceInfo, Zeroconf
        except Exception:
            logger.warning("mdns_zeroconf_unavailable")
            return

        advertise_host = _resolve_advertise_host(self.host)
        service_type = _normalize_service_type(self.service_name)
        instance_name = socket.gethostname() or "opta-lmx"
        service_instance = f"{instance_name}.{service_type}"

        try:
            encoded_address = socket.inet_aton(advertise_host)
            info = ServiceInfo(
                type_=service_type,
                name=service_instance,
                addresses=[encoded_address],
                port=self.port,
                properties={
                    b"path": b"/.well-known/opta-lmx",
                    b"service": b"opta-lmx",
                },
                server=f"{instance_name}.local.",
            )
            zeroconf = Zeroconf()
            zeroconf.register_service(info)
        except Exception:
            logger.warning("mdns_advertisement_start_failed", exc_info=True)
            return

        self._zeroconf = zeroconf
        self._service_info = info
        self._active = True
        logger.info(
            "mdns_advertisement_started",
            extra={"host": advertise_host, "port": self.port, "service": service_type},
        )

    def stop(self) -> None:
        """Stop service advertisement and release sockets."""
        if not self._active:
            return
        try:
            if self._zeroconf is not None and self._service_info is not None:
                self._zeroconf.unregister_service(self._service_info)
        except Exception:
            logger.warning("mdns_advertisement_unregister_failed", exc_info=True)
        finally:
            try:
                if self._zeroconf is not None:
                    self._zeroconf.close()
            except Exception:
                logger.warning("mdns_advertisement_close_failed", exc_info=True)
            self._zeroconf = None
            self._service_info = None
            self._active = False
