# AUDIT — Feature Regression (Web Stack)
**Date:** 2026-03-01 (AEDT)  
**Scope:** `1L-Opta-Local/web`, `1O-Opta-Init`, `1S-Opta-Status`  
**Goal:** Validate recent work (routes, `/init` bootstrap endpoint, build/test health, key UI/auth flows, live HTTP checks).

## Executive Summary
- ✅ Build health: all three web apps build successfully.
- ✅ Core routes present (including `1L /init`, `1S /api/health/[service]`, `1S /features`).
- ✅ Live bootstrap endpoint works: `https://optalocal.com/init` returns shell script (`200`, `text/x-shellscript`, `nosniff`).
- ✅ Live web surfaces reachable: `init.optalocal.com`, `status.optalocal.com`, `status.optalocal.com/features` return `200`.
- ⚠️ Live status API currently shows `lmx`, `daemon`, and `accounts` unhealthy from status runtime.
- ✅ Safe fixes applied: lint unblock + smoke test contract updates.

## 1L — Opta Local Web (`1L-Opta-Local/web`)
### Routes verified
`/`, `/chat`, `/chat/[id]`, `/devices`, `/pair`, `/sign-in`, `/settings`, `/settings/account`, `/settings/tunnel`, `/models`, `/operations`, `/sessions`, `/skills`, `/stack`, `/rag`, `/benchmark`, `/quantize`, `/agents`, `/arena`, `/metrics`, plus `/auth/callback` and `/init`.

### Commands + results
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:unit` ✅ (15/15)
- `npm run test:integration` ✅ (3/3)
- `npm run test:e2e:smoke` ✅ (7/7)
- `npm run build` ✅

### Safe fixes applied
1. **Lint fix**
   - File: `1L-Opta-Local/web/src/hooks/useOperations.ts`
   - Removed unused `DaemonOperationSafetyClass` import causing ESLint failure.

2. **Smoke test modernization**
   - File: `1L-Opta-Local/web/tests/e2e/smoke.spec.ts`
   - Updated assertions to current centralized auth behavior (`accounts.optalocal.com`) and current UI markers.
   - Revalidated: smoke suite now passes 7/7.

## 1O — Opta Init (`1O-Opta-Init`)
### Commands + results
- `npm run lint` ✅
- `npm run build` ✅

## 1S — Opta Status (`1S-Opta-Status`)
### Routes verified
- `/`
- `/features`
- `/api/health/[service]`

### Commands + results
- `npm run lint` ✅
- `npm run build` ✅

## Live HTTP checks
### Bootstrap
- `GET https://optalocal.com/init` → `200` (`text/x-shellscript; charset=utf-8`), expected bash payload present.

### Live apps
- `GET https://init.optalocal.com/` → `200`
- `GET https://status.optalocal.com/` → `200`
- `GET https://status.optalocal.com/features` → `200`

### Status API probes
- `/api/health/lmx` → offline (`fetch failed`)
- `/api/health/daemon` → offline (`fetch failed`)
- `/api/health/local` → degraded
- `/api/health/init` → online
- `/api/health/accounts` → offline (timeout)

## Also noticed
- ⚠️ Next.js root inference warnings in `1O` and `1S` due multiple lockfiles/root auto-detect. Recommend explicit `outputFileTracingRoot` / `turbopack.root`.
- ⚠️ `init.optalocal.com/init` returns `404` while canonical bootstrap endpoint is `optalocal.com/init`; docs should be explicit to avoid confusion.

## Final outcome
**PASS with operational caveats.** Core web feature work validated; no blocking regressions remain after safe fixes.
