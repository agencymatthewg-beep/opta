# Fast Diagnosis Matrix (DNS vs CSP vs Runtime)

Last updated: 2026-03-06 (Australia/Melbourne)  
Owner: OptaLocal Ops

## Goal

Classify incident type in under 5 minutes so mitigation starts immediately.

## One-Page Matrix

| Signal | DNS | CSP | Runtime |
| --- | --- | --- | --- |
| Browser symptom | Domain not reachable / cert mismatch | Page shell loads but scripts/styles blocked | 5xx, timeout, blank/error page after request |
| `curl -I https://<domain>` | DNS/TLS failure or unexpected edge response | Returns 200/3xx with CSP header present | Returns 5xx/timeout/intermittent failures |
| Console signal | `ERR_NAME_NOT_RESOLVED` / TLS errors | "Refused to load ... because it violates Content Security Policy" | Network/API failures, server errors |
| Blast radius pattern | Often one or many domains after alias/DNS change | Usually specific route/asset class | Often app-specific, sometimes shared backend |
| First owner | Platform/domain ops | Web security/config owner | Surface app owner + backend owner |
| First mitigation | Restore alias/record | Restore last known good CSP/config | Surface rollback or service recovery |

## T+0 to T+5 Triage Steps

1. Check edge response quickly:

```bash
curl -sSI https://<domain> | head -n 20
```

2. Check DNS resolution:

```bash
dig +short <domain>
```

3. Check CSP header presence/content:

```bash
curl -sSI https://<domain> | rg -i '^content-security-policy'
```

4. Run synthetic multi-surface check:

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
npm run monitor:synthetic
```

## Routing Rule

- DNS evidence present -> run rollback-by-surface alias restore first.
- CSP violations in console/header diff -> revert CSP/policy change or rollback affected surface.
- Runtime 5xx/timeouts with healthy DNS/CSP -> treat as runtime incident; recover service or rollback deployment.

## Escalation Guardrails

- No clear classification by T+10 minutes -> escalate as SEV-1/SEV-2 and parallelize DNS + app-runtime investigation.
- Any customer-visible auth/session failure on `accounts` or `admin` -> escalate immediately.
