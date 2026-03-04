---
title: Workflows
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Workflows

## Daily Dev Workflow

1. Verify app inventory:

```bash
npm run apps:list
npm run apps:verify
```

2. Run app-specific dev command:

```bash
npm run dev:1d
npm run dev:1m
npm run dev:1o
```

3. Run checks/builds as needed:

```bash
npm run check:all
npm run build:all
```

## Docs Workflow

When architecture, naming, release policy, or domain mapping changes:

1. Update affected app docs (`APP.md`/`README.md`).
2. Update workspace canonical docs in `docs/`.
3. Update status snapshot if deploy/domain changed:
   - `docs/reports/OPTALOCAL-DOCS-STATUS.md`
4. Validate docs:

```bash
npm run docs:check
```

## Release-Prep Workflow (Init)

```bash
npm run release:opta-init:prepare
```

This validates release contracts and syncs desktop manifests/updater metadata/redirect metadata for Opta Init.
