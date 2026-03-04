---
title: Knowledge
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Knowledge Base (Workspace Level)

## Canonical Naming

- Use full app directory names exactly as they exist on disk.
- Primary app registry source is `apps.registry.json`.
- Avoid retired aliases in canonical docs.

## Taxonomy

- Product taxonomy source: `docs/PRODUCT-MODEL.md`.
- Website surfaces and local runtime apps are distinct categories.

## Synergy Memory Anchors (2026-03-04)

For any cross-app/content-impacting change, treat these as mandatory context:

1. `docs/content-sync-map/registry/apps.yaml` (canonical app identity set)
2. `docs/content-sync-map/registry/content-nodes.yaml` (what content describes what)
3. `docs/content-sync-map/workflow/change-impact.md` (ripple-effect checklist workflow)
4. `docs/audit/2026-03-system-map.md` (runtime coupling and drift hotspots)
5. `docs/reports/OPTALOCAL-DOCS-STATUS.md` (current domain -> app -> project mapping)

Use this order:
- classify affected app IDs from `apps.yaml`
- enumerate stale content nodes from `content-nodes.yaml`
- generate MUST/SHOULD/CONSIDER update checklist via `change-impact.md`

## Documentation Source-of-Truth Hierarchy

1. App-local `APP.md` / `README.md`
2. Workspace canonical docs (`docs/*.md` Tier 1)
3. Historical audits/reports (`docs/audit`, dated report files)

## Frequent Engineering Tasks (and docs to update)

- Runtime/daemon contract changes:
  - `docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, impacted app docs
- Distribution/init changes:
  - `docs/PRODUCT-MODEL.md`, `docs/reports/OPTALOCAL-DOCS-STATUS.md`, `1O` docs
- Domain/deployment changes:
  - `docs/reports/OPTALOCAL-DOCS-STATUS.md`
- App matrix changes:
  - `README.md`, `APP.md`, `docs/INDEX.md`, `apps.registry.json`
