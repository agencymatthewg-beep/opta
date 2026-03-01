# SOT + Opta Operating Model

_Last updated: 2026-03-01_

## Objective
Keep operational governance and product execution cleanly separated, while still tightly linked.

## Canonical split
- **SOT (`~/Synced/AI26/1-SOT`)** = operational authority (credentials, infra config, governance, cross-bot state)
- **Opta (`~/Synced/Opta`)** = product authority (code, app docs, release procedures, architecture)

## Where to document what

### Put in SOT
- Credentials, keys, account ownership
- Domain authority and routing truth
- Bot config/runtime state and machine inventory
- Cross-project high-level status + ownership
- Compliance rules and audit actions

### Put in Opta
- App-specific implementation docs
- Product roadmaps and architecture
- Build/release/deploy runbooks
- Integration details tied to codebase
- Package/channel distribution instructions

## Established canonical docs
- This model: `2-Docs/Operations/SOT-OPTA-OPERATING-MODEL.md`
- Software/service registry: `2-Docs/Operations/SOFTWARE-STATE-REGISTRY.md`
- Opta CLI release plan: `2-Docs/Operations/OPTACLI-RELEASE-PLAN-2026-03-01.md`
- SOT boundary policy mirror: `~/Synced/AI26/1-SOT/docs/OPTA-SOT-BOUNDARY.md`

## Decision test (fast)
If a document answers **"How this app is built/released"** → Opta.
If a document answers **"What is officially true across bots/infra"** → SOT.

## Maintenance protocol
1. Update canonical doc only.
2. Add cross-link in counterpart index/README.
3. Never duplicate full truth blocks unless needed for snapshots.
4. If snapshot is necessary, include source path and timestamp.

