# Runbook: Rollout

## Pre-rollout checklist

- Migrations applied from canonical `1N` folder.
- Env vars loaded per `ENV-MATRIX.md`.
- Redirect URLs registered for all app callbacks.

## Phased rollout

1. Deploy `3A` and confirm token verification health.
2. Enable web (`1F`) and run auth smoke tests.
3. Enable desktop/mobile/CLI (`1L`, `1M`, `1E`, `1D`).
4. Monitor auth error rates and failed OAuth callbacks.

## Success criteria

- All four canonical methods are functional.
- Session refresh works without forced re-login in normal use.
- No cross-user data access violations.
