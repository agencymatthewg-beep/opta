# SUPABASE Longevity Checklist (Opta)

Canonical scope: `1N-Opta-Cloud-Accounts` supporting `1P-Opta-Accounts`, `1D-Opta-CLI-TS`, `1M-Opta-LMX`, `1F-Opta-Life-Web`, `1E-Opta-Life-IOS`, `1L-Opta-Local`.

## Ownership + Cadence

- **Primary owner:** Matthew (Platform)
- **Secondary owner:** Opta on-call (backup responder)
- **Cadence:**
  - Daily: health + auth smoke checks (15 min)
  - Weekly: migration drift + RLS review (45 min)
  - Monthly: backup restore rehearsal + SLO review (90 min)
  - Quarterly: key rotation + incident game-day (2-3 hrs)

---

## Daily Checklist (Ops Hygiene)

- [ ] Confirm Supabase status page has no active incident.
- [ ] Run cross-app auth smoke:
  ```bash
  cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
  ./tests/cross-app-auth-smoke.sh
  ```
- [ ] Validate CLI session persistence still works (`~/.config/opta/account.json` contains `access_token`).
- [ ] Verify LMX bearer acceptance path (`/v1/models`) remains healthy with token.
- [ ] Check auth success rate and p95 API latency against SLOs (see `SUPABASE-SLOS-ALERTS.md`).

## Weekly Checklist (Data + Security)

- [ ] Ensure no migration drift:
  ```bash
  cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
  supabase link --project-ref "$OPTA_SUPABASE_PROJECT_REF"
  supabase migration list
  ```
- [ ] Review newly added tables/functions for RLS enabled + policy coverage.
- [ ] Confirm no client app has `SERVICE_ROLE_KEY` exposure in build artifacts.
- [ ] Audit latest schema changes in:
  - `supabase/migrations/`
  - `contracts/*.md`
- [ ] Confirm OAuth redirects remain valid for Web + iOS callbacks.

## Monthly Checklist (Recoverability)

- [ ] Create full logical backup and verify artifact checksum.
- [ ] Restore backup into scratch project/database and run smoke checks.
- [ ] Validate key tables row-count parity (`accounts_profiles`, `accounts_devices`, `accounts_sessions`, `api_keys`).
- [ ] Verify auth token verification in LMX (`security.supabase_jwt_*`) still matches issuer/audience/JWKS.
- [ ] Review and prune stale test users and stale provider connections.

## Quarterly Checklist (Longevity Hardening)

- [ ] Rotate service-role and JWT-related secrets (staged rollout by app order).
- [ ] Re-run incident simulation:
  - auth outage
  - bad migration rollback
  - accidental RLS lockout
- [ ] Reconfirm environment matrix consistency (`ENV-MATRIX.md`) across all apps.
- [ ] Re-baseline SLO thresholds from last 90-day error/latency data.

---

## Minimum Pass Criteria

A month is considered operationally healthy only if all are true:

1. 100% of weekly drift checks completed.
2. At least 1 successful restore rehearsal completed.
3. No unresolved Sev-1/Sev-2 incident older than 7 days.
4. SLO attainment >= 99% for auth availability and >= 95% for latency targets.

## Escalation Trigger

Escalate immediately (open incident) if any of these occur:

- Cross-app auth smoke fails for 2 consecutive runs.
- Migration mismatch between local canonical and linked project.
- RLS disabled on user-owned table.
- Backup restore rehearsal fails.
