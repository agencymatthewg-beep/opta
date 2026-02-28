# Accounts Capability + Device Policy Model (Permanent Solution)

Status: Proposed → Ready for implementation
Owner: Matthew + Opta
Scope: accounts.optalocal.com, Opta CLI, Opta LMX, Playwright, Peekaboo, iOS/web clients

## 1) Core Principle

Auth answers **who**. Capability policy answers **what is allowed**. Device trust answers **where/with what risk**.

Execution rule for every sensitive action:
1. Validate session
2. Validate device trust state
3. Validate capability scope
4. Evaluate risk policy
5. Log immutable audit event

---

## 2) Capability Scopes (v1)

### Identity/Auth scopes
- `account.read`
- `account.write`
- `session.revoke`
- `device.manage`

### AI provider scopes
- `provider.connect.google`
- `provider.connect.apple`
- `provider.connect.openai`
- `provider.connect.anthropic`
- `provider.connect.gemini`
- `provider.key.read_metadata`
- `provider.key.rotate`

### Automation scopes
- `browser.automate` (Playwright)
- `desktop.automate` (Peekaboo)
- `automation.high_risk`

### CLI/LMX scopes
- `cli.login`
- `cli.run`
- `lmx.inference`
- `lmx.admin`
- `lmx.skills.invoke`
- `lmx.agents.run`

---

## 3) Device Trust Model

States:
- `trusted`
- `restricted`
- `quarantined`
- `revoked`

Policy effects:
- `trusted`: full scopes granted per role
- `restricted`: destructive/high-risk scopes blocked
- `quarantined`: read-only + logout prompt + no automation
- `revoked`: deny all, force token/session invalidation

Risk signals for auto-downgrade:
- impossible travel/IP anomaly
- repeated auth failures
- state mismatch in CLI callback
- high-risk action burst from new device

---

## 4) Data Model (Supabase)

## 4.1 Tables

### `accounts_profiles`
- `id uuid pk` (auth.users.id)
- `email text`
- `display_name text`
- `role text` (`owner`, `admin`, `member`)
- `created_at timestamptz`
- `updated_at timestamptz`

### `accounts_devices`
- `id uuid pk`
- `user_id uuid fk -> auth.users.id`
- `device_label text`
- `platform text` (`macos`, `ios`, `web`, `windows`, `linux`, `bot`)
- `fingerprint_hash text`
- `trust_state text` (`trusted`, `restricted`, `quarantined`, `revoked`)
- `last_seen_at timestamptz`
- `last_ip inet`
- `created_at timestamptz`
- `updated_at timestamptz`

### `accounts_sessions`
- `id uuid pk`
- `user_id uuid fk`
- `device_id uuid fk`
- `session_type text` (`web`, `cli`, `api`)
- `expires_at timestamptz`
- `revoked_at timestamptz null`
- `created_at timestamptz`

### `accounts_capability_grants`
- `id uuid pk`
- `user_id uuid fk`
- `device_id uuid fk null` (null = user-global)
- `scope text`
- `granted boolean`
- `granted_by uuid fk`
- `reason text`
- `expires_at timestamptz null`
- `created_at timestamptz`

### `accounts_provider_connections`
- `id uuid pk`
- `user_id uuid fk`
- `provider text` (`google`, `apple`, `openai`, `anthropic`, `gemini`)
- `status text` (`connected`, `revoked`, `error`)
- `meta jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

### `accounts_audit_events`
- `id uuid pk`
- `user_id uuid fk null`
- `device_id uuid fk null`
- `event_type text`
- `risk_level text` (`low`, `medium`, `high`, `critical`)
- `decision text` (`allow`, `deny`, `step_up`, `revoke`)
- `details jsonb`
- `created_at timestamptz`

## 4.2 RLS baseline
- Users can only read/update their own profile/devices/sessions/connections
- Capability grants writable only by owner/admin role
- Audit events append-only; write by trusted service role only

---

## 5) API Contract (minimum)

### Device/session management
- `GET /api/devices`
- `POST /api/devices/:id/trust-state`
- `POST /api/sessions/:id/revoke`
- `POST /api/sessions/revoke-all`

### Capability checks
- `POST /api/capabilities/evaluate`
  - input: `{ scope, deviceId, context }`
  - output: `{ allow, reason, risk, requiredStepUp? }`

### Provider connection
- `POST /api/providers/:provider/connect`
- `POST /api/providers/:provider/disconnect`
- `GET /api/providers`

### CLI callback hardening
- `GET /cli/callback?port=&state=`
  - enforce: port range 1024-65535
  - enforce: state format/length + one-time use nonce table
  - enforce: short TTL for callback nonce

---

## 6) Integration Requirements by Surface

### Opta CLI
- Must fetch capability evaluation before high-risk actions
- Must bind session to registered device
- Must deny if device trust != trusted/restricted policy allows

### Opta LMX
- API key/token requests must map to account + device
- Admin endpoints require `lmx.admin`
- Skills/agents require scope checks (`lmx.skills.invoke`, `lmx.agents.run`)

### Playwright/Peekaboo
- Always require capability preflight:
  - `browser.automate` / `desktop.automate`
- High-risk actions require:
  - `automation.high_risk`
  - trusted device

---

## 7) Rollout Plan

### Phase 1 (1-2 days)
- Create tables + RLS
- Add device registration/session listing/revocation
- Add audit event writer

### Phase 2 (2-3 days)
- Capability evaluator endpoint + policy engine
- Integrate checks in CLI and LMX critical paths

### Phase 3 (2 days)
- Provider connection center in accounts UI
- Show scopes, trust status, and recent audit events

### Phase 4 (1-2 days)
- Add anomaly auto-downgrade and safety automation
- Add regression tests + red-team checks

---

## 8) Success Criteria
- 100% sensitive actions pass capability evaluator
- 0 high-risk automation allowed on non-trusted devices
- Session revoke propagates across all clients < 30s
- Full audit trail for auth + capability + automation decisions
