---
title: Guardrails
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Guardrails

## Scope Safety

1. Treat every app directory (`1D`, `1L`, `1M`, etc.) as an owned boundary.
2. Do not silently rename app IDs/paths in canonical docs.
3. If architecture/distribution changes, update canonical docs in the same change.

## Release and Runtime Safety

1. Do not mark Windows support as complete unless CI evidence exists for the relevant app.
2. Keep LMX discovery/connection docs aligned with implemented contract (`/.well-known/opta-lmx`, `/v1/discovery`).
3. Never present legacy app names as active topology unless explicitly date-scoped as historical.

## Documentation Quality Safety

1. No template placeholders in canonical docs.
2. Canonical docs require freshness metadata (`Last updated:` or `Updated:`).
3. Historical reports remain immutable unless correcting critical factual errors.

## Verification

Run docs quality checks before merge for docs-impacting changes:

```bash
npm run docs:check
```
