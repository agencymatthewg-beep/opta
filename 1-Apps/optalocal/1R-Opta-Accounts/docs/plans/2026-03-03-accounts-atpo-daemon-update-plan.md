# Opta Accounts — Capability Update Plan (ATPO + Daemon Supervisor)

**Date:** 2026-03-03
**Status:** Ready for implementation
**Owner:** opta-core-team

## Context
Recent ecosystem updates (2026-03-03) introduced powerful new background orchestration tools:
1. **ATPO Supervisor (CLI):** An autonomous background bot that actively monitors log loops, hallucinatory states, and code generation issues, forcing real-time trajectory corrections.
2. **Daemon Supervisor Drawer (Init):** An out-of-band background process manager living in the Desktop Manager (`init.optalocal.com`) that allows stopping/restarting CLI daemon processes.
3. **Per-Turn Overrides (CLI/Code):** The ability to elevate autonomy to "Level 4 (Dangerous Mode)" instantly via inline UI/CLI flags.

## The Gap
The `accounts.optalocal.com` capability evaluator (`/api/capabilities/evaluate`) must explicitly define, authorize, and track these new high-risk execution primitives so that a compromised session cannot silently spawn invisible ATPO bots or elevate to CEO mode without authorization.

## Implementation Plan

### 1. Update Capability Scopes (`docs-ACCOUNTS-CAPABILITY-MODEL.md`)
We need to register three new canonical scopes to the ecosystem contract:
*   `cli.run.atpo`: Grants permission to run the ATPO background supervisor (requires specific device trust since it runs an unmonitored evaluation loop).
*   `cli.run.elevated`: Grants permission to use Per-Turn overrides to bypass normal `ask`/`allow` tool permissions (Dangerous/CEO mode).
*   `daemon.manage`: Grants permission to the Opta Init Desktop app to remotely manage, list, and kill background processes via the new supervisor drawer.

### 2. Update the API Evaluator (`src/app/api/capabilities/evaluate/route.ts`)
*   Add the new scopes to the `VALID_SCOPES` array.
*   Add `cli.run.elevated` and `daemon.manage` to the `HIGH_RISK_SCOPES` constant, enforcing a strict check that `trust_state === 'trusted'` (i.e. 'restricted' devices cannot use CEO mode).

### 3. Database Schema Verification
*   We must apply the pending migration (`20260228_accounts_capability_device_policy.sql`) so that the `accounts_capability_grants` table actually exists in the Supabase instance to hold these new scopes.

### 4. Supabase Client Integration
*   Ensure that the CLI and Init App provide their registered `device_id` when pinging `/api/capabilities/evaluate` so the Accounts portal can accurately enforce the new `cli.run.elevated` constraint.