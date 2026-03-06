# Control-Plane Verification

## Purpose

Provide deterministic, non-destructive checks after control-plane schema rollout.

## Read-only SQL verifier (canonical)

Run this in Supabase SQL editor after applying migrations:

1. `accounts_control_plane_post_migration_verify.sql`

This checks:

- required control-plane tables
- required hardening view + RPC functions
- updated-at triggers
- key constraints, indexes, policies, and RLS
- anomaly counts (expected to be `0`)

A final summary row returns:

- `ready = true` when all checks pass
- `failed_check_names` for any missing/broken checks

## CLI verifier (automation)

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
npm run verify:control-plane:schema
```

This uses safe read-only HTTP probes:

- `HEAD/GET ...?limit=0` for table/view existence
- `OPTIONS /rest/v1/rpc/<name>` for RPC route presence

It also checks key-readiness relations used by account/device/key flows.

## API smoke (non-destructive)

Requires the app running (default `http://127.0.0.1:3002`):

```bash
npm run dev
# in another shell
npm run smoke:api:control-plane
```

Smoke checks only use invalid identifiers or unauthenticated calls, so they do not create or mutate control-plane data.

## Check workflow integration

`npm run check` now includes `npm run check:control-plane`, which runs:

- `verify:control-plane:schema -- --optional`
- `smoke:api:control-plane -- --optional`

Optional mode is skip-safe when local env/server prerequisites are missing.

For CI or release gates, run strict commands (without `--optional`).
