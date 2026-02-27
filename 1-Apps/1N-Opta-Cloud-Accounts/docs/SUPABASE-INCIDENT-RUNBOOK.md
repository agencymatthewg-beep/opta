# SUPABASE Incident Runbook (Opta)

Applies to auth/data outages affecting `1P/1D/1M/1F/1E/1L` through shared Supabase.

## Roles

- **Incident Commander (IC):** Matthew
- **Database Lead:** Platform engineer on call
- **App Comms Lead:** owner for impacted app (CLI/LMX/Web/iOS)
- **Scribe:** whoever is not hands-on remediation

## Severity Matrix

- **Sev-1:** Total auth failure, data corruption risk, or production outage across >=2 apps.
- **Sev-2:** Partial outage, major latency regression, migration failure with workaround.
- **Sev-3:** Single-path degradation, non-critical errors, no data integrity risk.

---

## 0) First 10 Minutes (Containment)

1. Declare incident and assign IC.
2. Freeze deployments/migrations to Supabase.
3. Capture baseline signals:
   ```bash
   date
   cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
   ./tests/cross-app-auth-smoke.sh || true
   ```
4. Check if provider-wide issue (Supabase status page).
5. Triage scope:
   - Auth only?
   - API key reads/writes failing?
   - RLS/policy lockout?
   - Specific app only (1D, 1M, 1F, 1E, 1L)?

## 1) Diagnosis by Symptom

### A. Auth outage (login/session failures)

- Verify env parity:
  - `OPTA_SUPABASE_URL`
  - `OPTA_SUPABASE_ANON_KEY`
  - redirect URLs/callbacks
- Confirm JWT/JWKS settings used by LMX still valid:
  - `security.supabase_jwt_issuer`
  - `security.supabase_jwt_audience`
  - `security.supabase_jwt_jwks_url`
- Probe tokened LMX endpoint:
  ```bash
  curl -i "$OPTA_LMX_URL/v1/models"
  curl -i -H "Authorization: Bearer <access_token>" "$OPTA_LMX_URL/v1/models"
  ```

### B. Migration incident (failed/bad SQL)

- Identify last migration applied in `supabase/migrations`.
- Determine blast radius: schema, policy, function, data mutation.
- If safe and reversible, apply forward-fix migration.
- If unsafe, rollback via restore SOP (`SUPABASE-BACKUP-RESTORE-SOP.md`).

### C. RLS lockout

- Check table RLS/policy state for impacted tables (`accounts_*`, `api_keys`).
- Restore previously known-good policies from migration history.
- Re-run auth smoke and key user flows:
  - CLI login
  - LMX bearer
  - web devices/pair

---

## 2) Mitigation Playbook

1. **Stop the bleed:** freeze deploys and disable risky writes if needed.
2. **Choose path:**
   - Forward-fix migration (preferred when low-risk)
   - Restore from backup (preferred when integrity uncertain)
3. **Validate in order:**
   - Supabase auth endpoint response
   - `./tests/cross-app-auth-smoke.sh`
   - Manual app sanity checks for top journey in each surface
4. **Re-enable traffic/deploys** only after two consecutive healthy checks.

## 3) Communication Cadence

- **Sev-1:** updates every 15 min
- **Sev-2:** updates every 30 min
- **Sev-3:** hourly

Required update format:

- Current status
- Impacted apps
- Mitigation in progress
- ETA/next checkpoint

---

## 4) Exit Criteria

Incident can close only when all are true:

- Root cause identified and documented.
- Service stable for >=60 minutes.
- Cross-app auth smoke passes twice.
- Any temporary bypass is removed.
- Follow-up actions assigned with owners/dates.

## 5) Post-Incident (within 24h)

- Publish concise PIR (Problem, Impact, Root cause, Fix, Prevention).
- Add hardening item to checklist and governance docs.
- If migration-related, add preflight test to prevent recurrence.
