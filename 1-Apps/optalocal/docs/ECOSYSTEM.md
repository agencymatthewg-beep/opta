---
title: Ecosystem
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Ecosystem

## Internal Components

- Runtime stack: `1D`, `1L`, `1M`, `1O`, `1P`
- Customer/admin web stack: `1R`, `1S`, `1T`, `1U`, `1V`, `1X`

Canonical app metadata source: `apps.registry.json`.

## External Services

- **Vercel**: web app hosting/deployments for public surfaces
- **GitHub Actions**: CI/CD pipelines, release manifests, cross-platform build checks
- **Supabase**: account/auth backends (accounts/admin surfaces)
- **Anthropic (optional)**: cloud fallback provider for CLI workflows

## Domains

See `docs/reports/OPTALOCAL-DOCS-STATUS.md` for current domain -> app mapping and deployment status.

## Package and Workspace System

- Workspace orchestration script: `scripts/opta-local-workspace.mjs`
- App/task registry: `apps.registry.json`
- Root scripts: `package.json`

## Documentation and Content Sync System

- Content ownership/ripple map: `docs/content-sync-map/`
- Docs governance: `docs/README.md`
- Docs quality gates: `docs/standards/DOCUMENTATION-SYSTEM.md`
