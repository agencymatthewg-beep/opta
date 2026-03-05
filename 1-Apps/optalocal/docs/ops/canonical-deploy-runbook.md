# OptaLocal Canonical Deploy + SLO Validation Runbook

Last updated: 2026-03-05
Owner: OptaLocal Ops

## Scope
Web surfaces on Vercel:
- `web` → `optalocal.com`
- `opta-init` → `init.optalocal.com`
- `opta-lmx-dashboard` → `lmx.optalocal.com`
- `accounts` → `accounts.optalocal.com`
- `status-fix` → `status.optalocal.com`
- `opta-help` → `help.optalocal.com`
- `opta-learn` → `learn.optalocal.com`
- `opta-admin` → `admin.optalocal.com`

## Hard Invariants (must pass)
1. `rootDirectory` is `null` on all live web projects.
2. Deployment model is consistent: `framework=nextjs`, `nodeVersion=24.x`.
3. Live HTTP checks return 2xx/3xx for all production domains.

## Deterministic Validation Script (no deploy)
From repo root (`~/Synced/Opta/1-Apps/optalocal`):

```bash
./scripts/ops/verify-web-deploy-slo.sh
```

Output:
- machine-readable report: `docs/ops/evidence/deploy-validation-<timestamp>.json`
- summary in terminal including `allPassed`

## Deterministic Deploy + Validation Checklist

### Phase A — Preflight (required)
1. Confirm auth/session:
   ```bash
   vercel whoami
   ```
2. Confirm project invariant state before any deploy:
   ```bash
   ./scripts/ops/verify-web-deploy-slo.sh
   ```
3. If any `rootDirectory != null`, repair before deploy (example):
   ```bash
   printf '{"rootDirectory":null}' > /tmp/vercel-root-null.json
   vercel api /v9/projects/<project-name-or-id> -X PATCH --input /tmp/vercel-root-null.json --raw | jq '{name,rootDirectory}'
   ```

### Phase B — Deploy (only if intentionally releasing)
Deploy only changed app(s) from their app directory:

```bash
cd <app-directory>
vercel deploy --prod
```

No bulk deploy command is canonical. Deploying per-app reduces blast radius and makes rollback deterministic.

### Phase C — Post-deploy SLO gate (required)
Immediately run:

```bash
cd ~/Synced/Opta/1-Apps/optalocal
./scripts/ops/verify-web-deploy-slo.sh
```

Release is valid only when summary reports:
- `rootDirectoryNullCount == total`
- `deploymentModelOkCount == total`
- `liveHttpOkCount == total`
- `allPassed == true`

## Rollback Path
1. Find previous healthy deployment alias target in Vercel.
2. Re-point custom domain alias to previous deployment.
3. Re-run:
   ```bash
   ./scripts/ops/verify-web-deploy-slo.sh
   ```
4. Log incident + timestamp + failing app.

## Notes
- This runbook intentionally separates validation from deploy.
- Validation is safe to run continuously and should be used as the release gate.
