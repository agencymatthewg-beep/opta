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

Run these SQL files in the Supabase SQL editor:

1. `accounts_control_plane_preflight_apply_verify.sql`
2. `accounts_control_plane_schema.sql`
3. `accounts_control_plane_preflight_apply_verify.sql` (again)

What to check on the second helper run:

- anomaly counts are `0` for all non-`*_table_missing` checks
- expected constraints/indexes/policies are listed for all `accounts_*` tables

After SQL apply, verify app health:

```bash
curl -s http://localhost:3002/api/health/supabase | jq
```
