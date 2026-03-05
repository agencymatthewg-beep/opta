# OptaLocal Documentation and Deployment Status

Updated: 2026-03-05
Scope: `1-Apps/optalocal/*`

## Canonical app set

- `1D-Opta-CLI-TS` — runtime/TUI/daemon
- `1L-Opta-LMX-Dashboard` — LMX dashboard surface
- `1M-Opta-LMX` — inference service (Mono512 host)
- `1O-Opta-Init` — init website + desktop manager distribution stack
- `1P-Opta-Code-Universal` — desktop/web daemon client
- `1R-Opta-Accounts` — auth/accounts portal
- `1S-Opta-Status` — status dashboard
- `1T-Opta-Home` — brand homepage
- `1U-Opta-Help` — docs/help website
- `1V-Opta-Learn` — guides/learning website
- `1X-Opta-Admin` — admin website-management control plane

Canonical metadata source: `apps.registry.json`.

## Domain map (current)

| Domain | App | Vercel Project | Status |
|---|---|---|---|
| `optalocal.com` | `1T-Opta-Home` | `web` | Live |
| `www.optalocal.com` | `1T-Opta-Home` | `web` | Live |
| `lmx.optalocal.com` | `1L-Opta-LMX-Dashboard` | `opta-lmx-dashboard` | Live |
| `init.optalocal.com` | `1O-Opta-Init` | `opta-init` | Live |
| `accounts.optalocal.com` | `1R-Opta-Accounts` | `accounts` | Live |
| `status.optalocal.com` | `1S-Opta-Status` | `status-fix` | Live |
| `help.optalocal.com` | `1U-Opta-Help` | `opta-help` | Live |
| `learn.optalocal.com` | `1V-Opta-Learn` | `opta-learn` | Live |
| `admin.optalocal.com` | `1X-Opta-Admin` | `opta-admin` | Live |

## Hosting policy

- Vercel project `rootDirectory` should remain `null` for direct app-directory deployments.
- Deploy each website from its own app directory to avoid path-doubling regressions.

## Distribution policy (canonical)

- Opta websites should present **Opta Init Desktop Manager** as the distribution entrypoint.
- CLI/LMX/Code lifecycle management is driven through Opta Init Manager flows.

## Maintenance rule

When architecture/path/policy changes:
1. update app-local `APP.md`/`README.md`
2. update workspace canonical docs (`docs/INDEX.md`, `docs/ARCHITECTURE.md`, `docs/ECOSYSTEM.md`, `docs/PRODUCT-MODEL.md`)
3. update this status file
4. run `npm run docs:check`

## Known gaps

- Some dated historical reports in `docs/audit/` and `docs/reports/` reference legacy app names by design.
- Canonical docs are now maintained separately and should be used for current-state decisions.

## Supabase sync gate (accounts.optalocal.com)

- `/api/health/supabase` (2026-03-05) => `ok=true`, `schemaReady=true`, tables present: `accounts_*`, `api_keys`, `credentials`.
- Follow-up: keep `1N-Opta-Cloud-Accounts/scripts/apply-migrations.sh` wired into release cadence so schema drift is caught before deployments.
- Automation: nightly guardrail workflow at `.github/workflows/supabase-health.yml` runs migration+health checks with Supabase secrets.
