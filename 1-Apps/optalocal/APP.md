---
title: OptaLocal
type: workspace
status: active
last_updated: 2026-03-04
---

# OptaLocal Workspace

Canonical workspace for Opta Local apps at `<optalocal-root>`.

## Purpose

This workspace hosts the end-to-end Opta Local ecosystem:
- runtime/control apps (CLI, LMX, Init, Code)
- website surfaces (Home, Help, Learn, Status, Accounts, Admin)
- shared docs, release metadata, and operating standards

## Core App Matrix

| ID | App | Path | Role |
|---|---|---|---|
| 1D | Opta CLI | `1D-Opta-CLI-TS` | Runtime engine + daemon control plane |
| 1L | Opta LMX Dashboard | `1L-Opta-LMX-Dashboard` | Dashboard for LMX runtime operations |
| 1M | Opta LMX | `1M-Opta-LMX` | Inference service |
| 1O | Opta Init | `1O-Opta-Init` | Distribution + lifecycle manager |
| 1P | Opta Code Universal | `1P-Opta-Code-Universal` | Desktop/web operator client |
| 1R | Opta Accounts | `1R-Opta-Accounts` | Auth and account services |
| 1S | Opta Status | `1S-Opta-Status` | Status/incident visibility |
| 1T | Opta Home | `1T-Opta-Home` | Homepage/brand surface |
| 1U | Opta Help | `1U-Opta-Help` | Product documentation site |
| 1V | Opta Learn | `1V-Opta-Learn` | Guides/learning surface |
| 1X | Opta Admin | `1X-Opta-Admin` | Internal website operations surface |

## Canonical References

- Workspace README: `README.md`
- Docs index: `docs/INDEX.md`
- Product taxonomy: `docs/PRODUCT-MODEL.md`
- Documentation system: `docs/README.md`
- Current status snapshot: `docs/reports/OPTALOCAL-DOCS-STATUS.md`

## Working Rule

When app architecture, naming, ownership, or distribution changes:
1. Update app-local `APP.md`/`README.md`.
2. Update `docs/INDEX.md` and `docs/PRODUCT-MODEL.md`.
3. Update `docs/reports/OPTALOCAL-DOCS-STATUS.md`.
4. Run `npm run docs:check`.
