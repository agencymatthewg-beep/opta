# Documentation System Standard

Last updated: 2026-03-04

## Standard

All OptaLocal docs follow a three-tier model:
1. Canonical (always current)
2. Operational maps/standards (maintained)
3. Historical records (date-scoped, immutable)

## Canonical Quality Gates

Canonical docs must:
- include a freshness marker (`Last updated:` or `Updated:`)
- avoid HTML template placeholder comment blocks
- use current app identifiers from `apps.registry.json`

## Cross-App Change Minimum Set

For changes affecting app boundaries, routing, or distribution:
- update `APP.md` (workspace) and root `README.md`
- update `docs/INDEX.md`
- update `docs/ARCHITECTURE.md` and/or `docs/ECOSYSTEM.md`
- update `docs/reports/OPTALOCAL-DOCS-STATUS.md`
- update app-local docs in impacted app directories

## Enforcement

Run:

```bash
npm run docs:check
```

This check is expected in local pre-merge verification for docs-impacting changes.
