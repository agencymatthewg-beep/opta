# Opta Admin Features

Opta Admin (`1X-Opta-Admin`) is the private control plane for managing Opta Local websites and website-adjacent operational workflows.

## Purpose

- [x] Private internal workspace for website operations
- [x] Fleet visibility across management websites (Home, Init, Accounts, Status, Help, Learn, Admin)
- [x] Surface Opta Learn guide readiness + promotion controls
- [ ] Restricted access controls and role-based operations
- [ ] Audit trail export and incident context
- [ ] Hardened private admin auth boundary

## Evidence / Integrations

- [x] Dashboard shell (`1X-Opta-Admin`)
- [ ] Website fleet health probes (local + production parity)
- [x] Learn guide draft -> verified promotion endpoint
- [ ] Status + feature-registry integration
- [x] `/api/health` endpoint reachable in production for status polling

## Current state (2026-03-04)

- `admin.optalocal.com` exists and is now the canonical website-management cockpit.
- The admin dashboard now includes:
  - managed-website fleet cards with local/prod reachability
  - guide promotion pipeline for Opta Learn content readiness
- Workspace integration now includes `1x` app registration (`apps.registry.json`) for shared run/check/build orchestration.
- Production note: Admin `/api/health` is reachable (200) and consumed by Status health probes.
