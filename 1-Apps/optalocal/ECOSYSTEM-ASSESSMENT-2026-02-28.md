# Optalocal Ecosystem Assessment (2026-02-28)

## Scope
- Apps assessed: `1D-Opta-CLI-TS`, `1L-Opta-Local`, `1M-Opta-LMX`, `1O-Opta-Init`, `1P-Opta-Code-Desktop`, `1R-Opta-Accounts`, `1S-Opta-Status`
- Focus: runtime status, integration contracts, auth/session consistency, cross-app optimization gaps.
- Method: static code/config audit + interop review from dedicated app audits.

## Executive Verdict
- The ecosystem is **functionally integrated but not yet optimized end-to-end**.
- Core runtime path (`Desktop/Web -> CLI daemon -> LMX`) exists and is rich.
- Highest risk is **contract drift** across apps (auth headers, endpoint paths, websocket URLs, payload shapes) and **Accounts schema readiness gaps**.

## App Status Snapshot

| App | Current status | Runtime role | Primary contract | Readiness |
|---|---|---|---|---|
| 1D Opta CLI | Active dev v0.5.0-alpha.1 | Agent/daemon orchestrator | `/health`, `/v3/*`, LMX client | Partial |
| 1L Opta Local | Active dev v0.2 | Web control plane | LMX `/admin/*` + `/v1/*`, optional daemon `/v3/*` | Partial |
| 1M Opta LMX | Active v0.5 | Inference/runtime engine | OpenAI-compatible `/v1/*`, admin `/admin/*` | Partial |
| 1O Opta Init | Live v1.0.1 | Static setup portal | Docs/download/handoff only | Good (runtime-light) |
| 1P Code Desktop | Active desktop client | Daemon-first UX shell | Daemon `/v3/*` via shared package | Partial |
| 1R Opta Accounts | Active portal | Identity/capability plane | Supabase + `/api/health/supabase` + `/cli/callback` | Partial |
| 1S Opta Status | Active monitor | Health and feature registry | `/api/health/[service]` probes | Partial |

## Integration Topology (Observed)
1. `1M LMX` is the inference core (OpenAI-compatible + admin control plane).
2. `1D CLI` is the agentic orchestrator and daemon abstraction layer; it bridges tools, sessions, and LMX.
3. `1P Desktop` is a thin client over `1D` daemon (strong coupling by local package deps).
4. `1L Local Web` talks directly to `1M` for model/session/admin workflows and optionally to daemon `/v3` for operations/chat.
5. `1R Accounts` is the intended central auth/capability control surface (Supabase + policy APIs + CLI callback relay).
6. `1O Init` is static onboarding and download surface (no runtime API coupling).
7. `1S Status` probes LMX/daemon/local/init/accounts health endpoints and renders feature registry from markdown docs.

## What Is Already Strong
- CLI daemon exposes stable health + metrics + operations + LMX proxy routes.
- LMX has broad API coverage (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, `/v1/rerank`, `/admin/*`, discovery, WS).
- Desktop surfaces daemon/LMX runtime signals and background jobs.
- Accounts has a concrete CLI browser callback relay contract (`127.0.0.1:<port>` only) and a schema health gate endpoint.
- Status app has a clean service-probe abstraction and fallback URL strategy.

## Critical Gaps (Priority Order)

### P0 - Must fix first
1. **LMX discovery websocket URL mismatch**
- Discovery advertises `/ws/chat` while server route is `/v1/chat/stream`.
- Impact: clients consuming discovery can fail websocket features.

2. **Auth contract drift between Local Web and LMX**
- LMX inference routes enforce inference auth, while 1L is admin-key centric in several flows.
- Impact: intermittent 401/403 behavior, unclear security model.

3. **Accounts schema not fully applied (documented by Accounts plan + health route behavior)**
- Capability and provider/device/session tables are treated as expected by 1R APIs, but planned as missing/not applied.
- Impact: policy/device/provider APIs return schema-missing failures (503 paths).

4. **Secrets exposed in Local Web setup docs**
- Supabase anon/service keys are present directly in docs.
- Impact: immediate credential hygiene/security incident risk.

5. **Token in query string for daemon WS/SSE in Desktop/Web paths**
- Tokens appended in websocket/SSE URLs increase leak surface via logs/history/proxies.
- Impact: elevated credential exposure risk.

### P1 - Should fix next
6. **1L route drift for agent/skill endpoints and model load payload shape**
- 1L references `/admin/agents/*`, `/admin/skills/*`, and `model_path` payload shape in places while 1M canonical surfaces differ.
- Impact: feature breakage and maintenance burden.

7. **Desktop first-run onboarding mismatch with daemon token model**
- Flow does not reliably guide token handoff despite daemon auth expectations.
- Impact: poor first-run success and support burden.

8. **Status feature registry drift from real implementation**
- Example: docs mark some capabilities as missing while code has implemented endpoints.
- Impact: false reporting and team misalignment.

9. **Packaging/deploy path drift for LMX runtime artifacts**
- setup script vs launchd/plist path assumptions differ.
- Impact: brittle production install path.

### P2 - Alignment / polish
10. **Canonical metadata/doc drift**
- App identity files are inconsistent in format/IDs/ports (example: Init metadata port overlaps Status dev port semantics).
- Impact: operational confusion and tooling mismatch.

11. **Cross-app auth UX still fragmented**
- Accounts is intended central portal but CLI/Desktop/Local still have mixed patterns.
- Impact: inconsistent session behavior and duplicated logic.

## Ecosystem Optimization Plan

### Phase 1 (Security + Contract Integrity)
1. Fix LMX discovery websocket URL to `/v1/chat/stream` and add regression test.
2. Remove token-in-query auth for daemon WS/SSE; move to short-lived ticket or header-based pattern.
3. Rotate exposed Supabase keys and sanitize docs/examples.
4. Apply/verify Accounts schema migrations; make `/api/health/supabase` fully green.

### Phase 2 (Interop Normalization)
5. Align 1L client endpoint usage to 1M canonical routes and payload schema.
6. Normalize inference/admin auth handling across CLI/Web/Desktop flows.
7. Fix Desktop onboarding token handoff and setup wizard contract behavior.

### Phase 3 (Operational Cohesion)
8. Reconcile LMX packaging/install paths and publish stable artifacts.
9. Update Status feature docs to reflect actual capability state from source contracts.
10. Standardize APP metadata format and critical fields (status/version/port/depends_on).

## Suggested Target State
- Single canonical interop contract doc for:
  - Auth headers/tokens and scope model
  - Endpoint map and versioning per app
  - Session/device identity ownership and propagation
  - Health endpoint standards (`/health`, `/api/health`, auth requirements)
- CI contract checks that fail on:
  - Endpoint/path drift
  - Payload shape drift
  - Discovery drift
  - Doc-to-implementation mismatch for feature registry

## Key Evidence (Representative)
- CLI version/scripts: `1D-Opta-CLI-TS/package.json`
- Daemon health/metrics routes: `1D-Opta-CLI-TS/src/daemon/http-server.ts`
- Local Web app metadata and scripts: `1L-Opta-Local/APP.md`, `1L-Opta-Local/web/package.json`
- Local Web LMX client contract (agent/skills/model load): `1L-Opta-Local/web/src/lib/lmx-client.ts`
- Local Web daemon WS/SSE query token usage: `1L-Opta-Local/web/src/lib/opta-daemon-client.ts`
- LMX server port + websocket route: `1M-Opta-LMX/src/opta_lmx/config.py`, `1M-Opta-LMX/src/opta_lmx/api/websocket.py`
- LMX discovery websocket URL: `1M-Opta-LMX/src/opta_lmx/discovery.py`
- Init metadata: `1O-Opta-Init/APP.md`
- Desktop daemon package coupling: `1P-Opta-Code-Desktop/package.json`
- Accounts health gate + capability evaluator + CLI callback: `1R-Opta-Accounts/src/app/api/health/supabase/route.ts`, `1R-Opta-Accounts/src/app/api/capabilities/evaluate/route.ts`, `1R-Opta-Accounts/src/app/cli/callback/route.ts`
- Accounts optimization baseline: `1R-Opta-Accounts/PLAN-ACCOUNTS-OPTIMIZATION.md`
- Status probe contract and feature registry: `1S-Opta-Status/app/api/health/[service]/route.ts`, `1S-Opta-Status/docs/features/*.md`

## Confidence / Limits
- High confidence on code-level and contract-level findings.
- Live public endpoint verification was blocked in this environment (network calls returned `000`), so this assessment emphasizes source-of-truth code/docs.
