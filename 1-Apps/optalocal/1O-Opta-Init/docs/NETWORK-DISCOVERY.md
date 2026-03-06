# Opta Init — Network Discovery Contract

## Purpose

Define how Opta Init Manager discovers Opta LMX endpoints automatically on local networks and persists the selected connection.

## Canonical Service

- mDNS service type: `_opta-lmx._tcp.local.`
- Discovery source tag: `mdns`

This aligns with the active Opta ecosystem contract used by Opta LMX and Opta Code.

## Discovery Commands (Tauri)

- `discover_lmx_mdns() -> LmxMdnsCandidate[]`
  - Browses local network via mDNS.
  - Returns normalized candidates.
  - Returns `[]` on no-network/no-service scenarios (no panic).

- `discover_and_store_lmx_connection() -> { host, port, source, stored }`
  - Selects best candidate.
  - Performs lightweight reachability probing.
  - Persists selected endpoint to the shared Opta connection store.

## Source Precedence

At startup, manager resolves endpoint in this order:

1. Stored connection from `get_lmx_connection()` (`~/.config/opta/lmx-connections.json`).
2. mDNS discovery + store (`discover_and_store_lmx_connection()`).
3. Fallback `localhost:1234`.

## Storage Contracts

- Setup config:
  - `~/.config/opta/opta-init-config.json`
- LMX connections:
  - `~/.config/opta/lmx-connections.json`
  - Canonical metadata includes:
    - `host`
    - `port`
    - `tunnelUrl` (optional)
    - `last_connected_via`: `"mdns" | "lan" | "manual"`

## Compatibility Notes

- `get_lmx_connection()` remains backward compatible (`host`, `port`, `tunnelUrl`).
- Connection entries support legacy snake_case aliases during deserialization for continuity with older files.
