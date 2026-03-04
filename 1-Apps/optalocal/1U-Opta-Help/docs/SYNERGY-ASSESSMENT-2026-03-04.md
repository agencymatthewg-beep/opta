# Opta Help Synergy Coverage Assessment (2026-03-04)

## Scope

Assess Opta Help coverage against new cross-app synergy documentation that maps
how runtime apps, management websites, and content nodes affect each other.

## Inputs Used

- `../docs/ECOSYSTEM.md`
- `../docs/audit/2026-03-system-map.md`
- `../docs/reports/OPTALOCAL-DOCS-STATUS.md`
- `../docs/content-sync-map/registry/apps.yaml`
- `../docs/content-sync-map/registry/content-nodes.yaml`
- `../docs/content-sync-map/workflow/change-impact.md`

## Coverage Snapshot

After this implementation pass, Opta Help now includes dedicated sections for:

- `ecosystem` (`/docs/ecosystem/*`)
- `accounts` (`/docs/accounts/*`)
- `status` (`/docs/status/*`)
- `support` FAQ (`/docs/support/faq/`)

This closes the original P0 surface-coverage gap and aligns Help with the
runtime + web-surface model used by workspace canonical docs.

## Immediate Findings

1. Navigation contains `/docs/support/faq/`, but the route did not exist (now fixed in this change set).
2. Docs taxonomy is mostly runtime-centric; cross-surface dependencies are under-documented.
3. Canonical docs identify a two-layer architecture (runtime + web surfaces), but Help primarily documents runtime.

## Remaining Additions

### P1 (next)

1. **Opta Learn integration docs**
   - Difference between Help (reference) vs Learn (guided workflows).
   - Guide promotion lifecycle (draft -> verified) and ownership.

2. **Opta Init lifecycle docs**
   - Release channels and manifest-driven component lifecycle.
   - Relationship between Init Manager and CLI/LMX/Code versions.

3. **LMX Dashboard docs**
   - Separate from raw LMX API docs; operational dashboard usage and limits.

### P2 (as needed)

1. **Opta Admin docs (public-safe subset)**
   - High-level behavior only (fleet health + guide promotion), no private ops detail.

2. **Content freshness policy page**
   - Map `stale_when` triggers to docs maintenance expectations.
   - Link to status and release docs update responsibilities.

## Suggested Delivery Sequence

1. Add `Learn` + `Init lifecycle` + `LMX Dashboard`.
2. Add public-safe `Admin` overview and freshness policy.
