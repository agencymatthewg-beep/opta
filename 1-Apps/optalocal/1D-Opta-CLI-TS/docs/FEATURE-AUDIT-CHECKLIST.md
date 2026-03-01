# Opta CLI - Full Feature Audit Checklist

Use this checklist before any public upload/release. If any required item fails, release is blocked.

## Release Rule

- No upload until all required checks below are green.
- Any flaky or non-deterministic behavior is treated as a fail.
- Capture command output for each section in release evidence.

## A. Foundation Gates (Required)

- [x] `npm run typecheck`
- [x] `npm run lint:budget`
- [x] `npm run build`
- [x] `npm run check-dist`
- [x] `npm run test:parity:core-smoke`
- [x] `npm run test:parity:ws9`
- [x] `npm run test:run`
- [x] `npm run smoke:features`
- [x] `npm run test:ci`
- Evidence captured:
  - 2026-02-28 local verification run in `1D-Opta-CLI-TS`
  - `docs/evidence/feature-smoke-2026-02-28.tsv`
  - `docs/evidence/feature-smoke-2026-02-28-rerun.tsv`

## B. CLI Command Surface Audit

Verify each command family has both automated coverage and at least one manual smoke validation.

### 1) Session and Execution

- [x] `opta chat` / `opta tui` / `opta do` behavior validated
- [x] Resume, mode flags, JSON mode, and dangerous/auto flags validated
- [x] Tests: `tests/commands/chat-startup.test.ts`, `tests/commands/chat-json.test.ts`, `tests/commands/do.test.ts`, `tests/commands/do-runtime.test.ts`

### 2) Model and Inference Controls

- [x] `opta models` command paths validated (list/manage/load/swap/dashboard/helpers/health/rag)
- [x] `opta status`, `opta serve`, `opta update` validated
- [x] Tests: `tests/commands/models.test.ts`, `tests/commands/slash-lmx.test.ts`, `tests/commands/update.test.ts`, `tests/lmx/*.test.ts`

### 3) Environment and Configuration

- [x] `opta env`, `opta config`, `opta doctor`, `opta init`, `opta diff` validated
- [x] Tests: `tests/commands/env.test.ts`, `tests/commands/config.test.ts`, `tests/commands/doctor.test.ts`, `tests/commands/init.test.ts`, `tests/commands/diff.test.ts`

### 4) Accounts, Keys, and Keychain

- [x] `opta account`, `opta key`, `opta keychain` validated
- [x] Tests: `tests/commands/account.test.ts`, `tests/commands/key.test.ts`, `tests/keychain/*.test.ts`

### 5) Integrations and Tooling

- [x] `opta mcp`, `opta embed`, `opta rerank`, `opta benchmark`, `opta server`, `opta completions` validated
- [x] Tests: `tests/commands/mcp.test.ts`, `tests/commands/embed.test.ts`, `tests/commands/rerank.test.ts`, `tests/commands/benchmark.test.ts`, `tests/commands/server.test.ts`, `tests/commands/completions.test.ts`

## C. Runtime Behavior Audit

### 1) Daemon / Transport / Multi-client

- [x] HTTP + WS daemon paths validated
- [x] Reconnect and cancellation semantics validated
- [x] Tests: `tests/daemon/*.test.ts`, `tests/integration/daemon-multi-client.test.ts`

### 2) Browser Runtime + Policy

- [x] Browser session spawn/reuse/approval flow validated
- [x] Policy deny/gate/allow behavior validated
- [x] Tests: `tests/browser/*.test.ts`, `tests/integration/browser-session-full-flow.test.ts`, `tests/integration/browser-autonomous-flow.test.ts`

### 3) TUI Stability

- [x] Rendering integrity, interaction fuzzing, and menu navigation validated
- [x] Tests: `tests/tui/*.test.tsx`, especially `App.test.tsx`, `menus-navigation.test.tsx`, `interaction-fuzz.test.tsx`

## D. Quality and Security Audit

- [x] No P0/P1 defects open for current release (GitHub issue query on 2026-02-28 returned none)
- [x] Shell command safety and host policy enforcement validated
- [x] Tests: `tests/security/*.test.ts`, `tests/core/permissions.test.ts`, `tests/core/agent-permissions.browser-session.test.ts`
- [x] Lint policy decision recorded:
  - [ ] Either zero warnings achieved, or
  - [x] warnings triaged and explicitly accepted for this release (`lint:budget` cap `365`, current `362`)

## E. Packaging and Install Audit (Release Blocking)

- [x] Release artifact created with canonical name: `opta-cli-npm.tgz`
- [x] GitHub latest download URL resolves with HTTP 200
- [x] Clean-machine install validation passed:
  - [x] `opta --help`
  - [x] `opta doctor`
  - [x] `opta chat --help`

## F. Opta Init Readiness Handoff

- [x] `1O-Opta-Init` download link points to verified artifact URL
- [x] Install docs reflect real runtime defaults and setup path
- [x] Release notes include known constraints and fallback guidance

## Final Sign-off

- [x] Engineering sign-off (CLI owner)
- [ ] Product/operator sign-off (Matthew)
- [x] Upload/publish approved
