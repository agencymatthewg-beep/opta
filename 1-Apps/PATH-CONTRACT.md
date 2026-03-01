# Opta Path Contract (Canonical)

Updated: 2026-02-28

## Rule
Each app has **one canonical source path** under domain folders in `1-Apps/` (`optalocal/`, `optamize/`, `shared/`).
Top-level `1-Apps/1X-*` entries are compatibility aliases/symlinks only.

## Canonical App Paths
- `optalocal/1D-Opta-CLI-TS` — Opta CLI (runtime/TUI/daemon)
- `optalocal/1L-Opta-Local` — Opta Local web/iOS dashboard
- `optalocal/1M-Opta-LMX` — Opta LMX inference service
- `optalocal/1O-Opta-Init` — Opta Init
- `optalocal/1P-Opta-Code-Desktop` — Opta Code Desktop (UI client for Opta CLI daemon)
- `optalocal/1R-Opta-Accounts` — Opta Accounts (SSO/accounts portal)
- `optalocal/1S-Opta-Status` — Opta Status (status and health dashboard)
- `optalocal/1T-Opta-Home` — Opta Home (optalocal.com landing)
- `optalocal/1U-Opta-Help` — Opta Help (help.optalocal.com docs)
- `optamize/1E-Opta-Life-IOS` — Opta Life iOS
- `optamize/1F-Opta-Life-Web` — Opta Life Web
- `optamize/1G-Opta-Mini-MacOS` — Opta Mini macOS
- `optamize/1H-Opta-Scan-IOS` — Opta Scan iOS
- `optamize/1J-Optamize-MacOS` — Optamize macOS
- `shared/1A-AI-Components` — Shared AI components (includes legacy AICompare merge)
- `shared/1I-OptaPlus` — OptaPlus design system
- `shared/1N-Opta-Cloud-Accounts` — Auth/contracts spec

## Product Boundary
- **Opta CLI** is the execution engine.
- **Opta Code Desktop** is a separate app and must consume daemon APIs, not reimplement runtime logic.

## Alias Policy
- Aliases/symlinks may exist for backward compatibility.
- All docs/build tooling must point to canonical paths.
- New work must not be started in alias locations.

## Sync-Conflict Policy
- `*.sync-conflict-*` files are never allowed in source directories.
- Quarantine path: `8-Project/8A-Reorganization-Docs/sync-conflict-quarantine/`
