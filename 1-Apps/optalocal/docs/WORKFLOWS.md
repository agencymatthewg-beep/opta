---
title: Workflows
type: workspace-docs
status: active
last_updated: 2026-03-06
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

## Copy/Content Publish Workflow

When publishing copy changes across Home/Help/Learn/Admin:

1. Validate taxonomy in `docs/PRODUCT-MODEL.md` under `Terminology Alignment (Home / Help / Learn / Admin)`.
2. Complete legal publication checks in `docs/standards/LEGAL-CONTENT-GOVERNANCE.md`.
3. Ensure activation language is consistent with canonical contract in `@opta/protocol-shared` (`ActivationState`).
4. Run docs and synthetic health validation:

```bash
npm run docs:check
npm run monitor:synthetic
```

## Security Contract Workflow

Run security contract checks before release:

```bash
npm run check:csp:script-src
npm run check:sso:contracts
```

## Release-Prep Workflow (Init)

```bash
npm run release:opta-init:prepare
```

This validates release contracts and syncs desktop manifests/updater metadata/redirect metadata for Opta Init.

## Deterministic Gate Workflow (All Surfaces)

Enforce gate order:

1. `typecheck`
2. `lint`
3. `test` (when defined)
4. `build`
5. live probes (synthetic checks)

Run for all node apps:

```bash
npm run gates:deterministic
```

Run for a subset:

```bash
node scripts/ops/run-deterministic-gates.mjs --apps 1r,1s
```

## Phased Release Gate Workflow (Production Progression)

Progression order is hard-coded to block advancement on first failed wave:

1. Accounts + Status
2. Init + LMX Dashboard
3. Home + Help + Learn
4. Admin

Run full sequence:

```bash
npm run gates:phased
```

Run a subset:

```bash
node scripts/ops/run-phased-release-gates.mjs --from wave-2-onboarding --to wave-3-narrative
```
