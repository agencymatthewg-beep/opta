# 1R-Opta-Accounts

Canonical path: `1-Apps/optalocal/1R-Opta-Accounts`
Legacy alias: `1-Apps/1P-Opta-Accounts`

## Purpose

Accounts, identity, sessions, and device-policy UX for the Opta ecosystem.

## Local Development

```bash
cd <optalocal-root>/1R-Opta-Accounts
npm install
npm run dev
```

## Validation

```bash
npm run check
```

## Production Build

```bash
npm run build
npm run start
```

## Control Plane Schema Rollout (Supabase)

Run these SQL files in the Supabase SQL editor (canonical sequence):

1. `accounts_control_plane_preflight_apply_verify.sql`
2. `accounts_control_plane_schema.sql`
3. `accounts_control_plane_hardening_v2.sql`
4. `accounts_control_plane_post_migration_verify.sql` (read-only verification)
5. `1N-Opta-Cloud-Accounts/supabase/migrations/20260306_sync_files.sql` (vault sync table + RLS)

What to check on the final verification run:

- summary row reports `ready = true`
- `failed_checks = 0`
- `failed_check_names = {}`

Automated schema verification (read-only PostgREST probes):

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
npm run verify:control-plane:schema
```

This verifies:

- control-plane tables
- hardening view (`accounts_device_command_queue_health`)
- RPC routes (`claim_device_commands_for_delivery`, `cleanup_control_plane_data`)
- key-readiness relations (`accounts_devices`, `accounts_capability_grants`, `api_keys`, `sync_files`, `credentials`)

After SQL apply, verify app health:

```bash
curl -s http://localhost:3002/api/health/supabase | jq
```

Expected control-plane readiness:

- `"schemaReady": true`
- every table in `requiredTables` reports ready

Run API-level non-destructive smoke checks (pairing/bridge/commands):

```bash
npm run smoke:api:control-plane
```

`npm run check` now includes `check:control-plane` in optional mode, so local checks stay reproducible even when Supabase/app prereqs are not available.

## Replay Protection Mode

Strict replay mode blocks fallback/non-durable relay paths unless durable replay storage is available.

- Enable in production with:
  - `OPTA_ACCOUNTS_REQUIRE_DURABLE_REPLAY=true`
- Verify behavior via:
  - `npm run test -- src/tests/cli-handoff.test.ts src/tests/cli-token-relay.test.ts`
