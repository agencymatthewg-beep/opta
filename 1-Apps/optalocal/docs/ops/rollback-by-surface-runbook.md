# Rollback by Surface Runbook (Alias-Target Restore)

Last updated: 2026-03-06 (Australia/Melbourne)  
Owner: OptaLocal Ops

## Purpose

Restore a single failing surface quickly without rolling back unrelated surfaces.

## Surface Map

| Surface | Project | Production Domain |
| --- | --- | --- |
| Home | `web` | `optalocal.com` |
| Init | `opta-init` | `init.optalocal.com` |
| LMX Dashboard | `opta-lmx-dashboard` | `lmx.optalocal.com` |
| Accounts | `accounts` | `accounts.optalocal.com` |
| Status | `status-fix` | `status.optalocal.com` |
| Help | `opta-help` | `help.optalocal.com` |
| Learn | `opta-learn` | `learn.optalocal.com` |
| Admin | `opta-admin` | `admin.optalocal.com` |

## Trigger Conditions

Run this rollback when one surface shows:
- sustained 5xx/timeouts, or
- broken core UX after deploy, or
- policy/config regression (for example CSP breakage) requiring immediate restore.

## Rollback Procedure (Per Surface)

1. Identify impacted surface and freeze deploys for that surface.
2. Identify last known good deployment target for the same project.
3. Re-point only the impacted domain alias to the known-good deployment.
4. Verify HTTP and synthetic health for that surface.
5. Keep elevated monitoring for 30 minutes.
6. Record incident timeline and deployment IDs.

Optional CLI alias restore pattern:

```bash
vercel alias set <known-good-deployment-url> <domain>
```

## Fast Verification Commands

```bash
curl -sSI https://<domain> | head -n 20
curl -sS https://<domain> >/dev/null
```

Expected:
- no TLS/DNS error
- status code is `2xx` or expected redirect `3xx`

Cross-surface sanity check:

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
./scripts/ops/verify-web-deploy-slo.sh
```

## Decision Boundaries

- Roll back one surface first when blast radius is isolated.
- Roll back multiple surfaces only if shared dependency/config is confirmed.
- If rollback does not restore service in 10 minutes, escalate SEV and switch to diagnosis matrix.

## Incident Logging (Minimum)

Capture:
- failing domain
- bad deployment ID/url
- restored deployment ID/url
- alias change time (UTC + local)
- verification output link/path
