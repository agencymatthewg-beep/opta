# OptaLocal Master Implementation Tracker

Last updated: 2026-03-06 (Australia/Melbourne)
Owner: OptaLocal workspace execution
Source plan: OptaLocal Master Implementation Plan (current-worktree baseline, stability/security first, phased by surface)

## Program Baseline (Locked)

- Baseline: current in-flight worktree (no cleanup/revert of unrelated changes).
- Priority: stability + security first.
- Rollout model: phased by surface/domain.

### Baseline Evidence

- Command: `cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal && npm run check:all`
- Result: pass (previous baseline run, 2026-03-06).
- Command: `curl` probes for `optalocal.com`, `init`, `lmx`, `accounts`, `status`, `help`, `learn`, `admin`.
- Result: all primary surfaces returned HTTP `200` at baseline (2026-03-06).
- Command: `npm run gates:deterministic`
- Result: pass (all app gates + live probe checks + accounts deep health contract, 2026-03-06).
- Command: `npm run gates:phased`
- Result: pass (wave-by-wave rollout guard, 2026-03-06).
- Command: `git status --short`
- Result: heavily in-flight worktree; treated as intentional baseline.

## Execution Lanes

- Lane A: Web Security + CSP (`1T`, `1O`, `1U`, `1L`, `1R`, `1V`, `1X`)
- Lane B: Accounts Control Plane (`1R` + SQL rollout)
- Lane C: Onboarding/Activation (`1O`, `1L`, `1P`, `1D`)
- Lane D: Narrative + Docs + IA (`1T`, `1U`, `1V`, `1X`)
- Lane E: Ops + Release + SLO (workspace scripts + status/health)

## Phase Status

| Phase | Scope | Status | Evidence |
| --- | --- | --- | --- |
| Phase 0 | Baseline lock + tracker + gates | Completed | Deterministic gates and phased gates pass from workspace (`npm run gates:deterministic`, `npm run gates:phased`) with live probe coverage across all primary surfaces. |
| Phase 1A | CSP migration + regression guard | Completed | `script-src 'unsafe-inline'` removed and guarded by `scripts/check-csp-script-src.mjs`; current run: `npm run check:csp:script-src` -> PASS. |
| Phase 1B | Accounts control-plane hardening | In progress | Accounts route-level lifecycle tests added (`src/tests/control-plane-routes.test.ts`), deep health contract checker added (`scripts/ops/check-accounts-health-contract.mjs`), production Accounts redeployed and now returns `schemaReady=true`, `controlPlane.ready=true`; remaining: apply `sync_files` migration in Supabase for full optional-extension parity. |
| Phase 1C | SSO/cookie/allowlist audit | In progress | Static contract checker added at `scripts/ops/check-sso-contracts.mjs` and wired into `check:all`; live cross-domain browser verification in production profile remains pending. |
| Phase 2A-2D | Unified activation + zero-command onboarding | In progress | Canonical `ActivationState` contract in `1D-Opta-CLI-TS/src/protocol/v3/types.ts`, shared via `@opta/protocol-shared`; LMX pairing client aligned to metadata envelope. |
| Phase 3A | Home messaging + activation section render | In progress | `1T-Opta-Home/app/page.tsx` mounts `ActivationFlow`; additional narrative parity verification pending across all sections. |
| Phase 3B-3C | Help/Learn/Admin consistency + legal policy | In progress | Legal/copy governance published at `docs/standards/LEGAL-CONTENT-GOVERNANCE.md` (copyright/trademark controls + publication checklist); taxonomy checklist remains in `docs/PRODUCT-MODEL.md`; publish pipeline enforcement hook still pending. |
| Phase 4A-4C | Observability + deploy gates + rollback | In progress | Phase progression runner implemented at `scripts/ops/run-phased-release-gates.mjs`; rollback runbook + diagnosis matrix added; accounts deep-health contract now enforced in deterministic gates when Accounts is in scope. |
| Phase 5A-5B | Toolchain + performance convergence | In progress | Lighthouse CI budget config added (`lighthouserc.opta-web.json`) and workflow added (`.github/workflows/opta-web-performance-budget.yml`); version-matrix convergence still pending. |

## Hard Exit Criteria (Must All Be True)

- [ ] End-to-end zero-command activation succeeds from fresh device via UI surfaces only.
- [x] No production web surface uses `script-src 'unsafe-inline'`.
- [x] Accounts control-plane schema/policies are validated and monitored (`schemaReady=true` and lifecycle tests green).
- [ ] Home/Help/Learn/Admin narrative and activation semantics are canonical and consistent.
- [x] Release gates are deterministic and block progression on failure.
- [x] Contract drift is caught in CI before production.

## Deterministic Gate Order (Target)

1. Typecheck
2. Lint
3. Tests
4. Build
5. Live probe checks

## Immediate Next Actions

1. Apply and verify `sync_files` migration on remote Supabase (table currently optional and absent in prod: `tables.sync_files.present=false`).
2. Complete Phase 1C live SSO/admin verification run (cross-domain cookie + fail-closed browser-flow evidence).
3. Execute fresh-device zero-command activation E2E and capture evidence against canonical state machine.
4. Finish narrative parity sweep across Home/Help/Learn/Admin and wire legal/content checklist into publish gate.
5. Complete Phase 5 toolchain version matrix and enforce it in CI.
