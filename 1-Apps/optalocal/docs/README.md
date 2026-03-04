# OptaLocal Documentation System

Last updated: 2026-03-04
Owner: Opta Local Core

This document defines how documentation is organized and maintained for `optalocal`.

## Goal

Keep docs accurate for day-to-day engineering and release operations across all apps, without forcing every historical report to be rewritten whenever architecture changes.

## Documentation Tiers

### Tier 1: Canonical (must stay current)

These are the source of truth for active operations:
- `APP.md`
- `README.md`
- `docs/INDEX.md`
- `docs/ARCHITECTURE.md`
- `docs/ECOSYSTEM.md`
- `docs/GUARDRAILS.md`
- `docs/KNOWLEDGE.md`
- `docs/WORKFLOWS.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/PRODUCT-MODEL.md`
- `docs/reports/OPTALOCAL-DOCS-STATUS.md`

### Tier 2: Operational maps and standards (maintained)

- `docs/content-sync-map/**`
- `docs/standards/**`

### Tier 3: Historical records (immutable unless critical correction)

Date-stamped audits/reports/plans are historical artifacts.
They may reference legacy names or old paths as long as they are clearly date-scoped.

## Update Workflow

When shipping a user-visible or architecture-impacting change:

1. Update app-local docs (`APP.md`, `README.md`) for impacted app(s).
2. Update Tier 1 canonical docs in this folder.
3. Update `docs/content-sync-map/registry/content-nodes.yaml` if content ownership changed.
4. Run docs health checks:

```bash
npm run docs:check
```

5. If check fails, fix canonical docs before merge.

## Naming and freshness rules

- Use exact app directory names (for example `1L-Opta-LMX-Dashboard`, not retired aliases).
- Canonical docs must include an explicit freshness marker:
  - `Last updated: YYYY-MM-DD`, or
  - `Updated: YYYY-MM-DD`.
- Do not leave HTML template placeholder comments in canonical docs.

## Tooling

- Checker script: `scripts/docs/docs-health-check.mjs`
- Registry source: `apps.registry.json`
