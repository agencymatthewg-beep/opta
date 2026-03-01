# Opta CLI Feature Test List (Systematic + Live)

Date: 2026-02-28  
Repo: `1D-Opta-CLI-TS`  
Objective: enumerate feature surface, execute live checks across every command family, debug failures, and produce evidence.

## 1) Canonical Feature Surface

### Root commands
- `onboard`, `chat`, `tui`, `do`, `embed`, `rerank`, `benchmark`, `status`, `models`, `env`, `config`, `sessions`, `init`, `diff`, `serve`, `update`, `server`, `doctor`, `completions`

### Grouped command families
- `account`: `signup`, `login`, `status`, `logout`
- `key`: `create`, `show`, `copy`
- `mcp`: `list`, `add`, `add-playwright`, `remove`, `test`
- `daemon`: `start`, `run`, `stop`, `status`, `logs`
- `keychain`: `status`, `set-anthropic`, `set-lmx`, `delete-anthropic`, `delete-lmx`

### Models family
- Top-level actions validated: `help`, `list`, `manage`, `interactive`, `ui`, `dashboard`, `aliases`, `alias`, `unalias`, `use`, `info`, `load`, `unload`, `stop`, `swap`, `history`, `download`, `delete`, `remove`, `benchmark`, `bench`, `predictor`, `helpers`, `quantize`, `agents`, `skills`, `rag`, `health`, `scan`, `browse`, `browse-local`, `library`, `browse-library`
- Nested actions validated:
  - `quantize`: `list`, `status`, `start`
  - `agents`: `list`, `start`, `status`, `events`, `cancel`
  - `skills`: `list`, `show`, `tools`, `run`, `mcp-call`, `openclaw`
  - `rag`: `collections`, `delete`, `query`, `ingest`, `context`

## 2) Automated Feature Verification

- `npm run typecheck` ✅
- `npm run lint:budget` ✅
  - Result: `362` warnings (budget cap: `365`)
- `npm run build` ✅
- `npm run check-dist` ✅
- `npm run test:parity:core-smoke` ✅
- `npm run test:parity:ws9` ✅
- `npm run test:ci` ✅
- `npm run test:run` ✅
  - Result: `211` test files passed, `2359` tests passed, `1` skipped

## 3) Live CLI Smoke Verification

Method:
- Built CLI (`dist`) invoked directly as `node dist/index.js ...`
- Systematic matrix across command surface (parser/help + safe runtime smoke)
- Evidence files:
  - `docs/evidence/feature-smoke-2026-02-28.tsv`
  - `docs/evidence/feature-smoke-2026-02-28-rerun.tsv`
- Repeatable runner: `npm run smoke:features`

Summary:
- Total live command checks: `109`
- Passed: `109`
- Failed: `0`
- Re-run result: `109` checks, `0` non-zero exits

Interpretation:
- Full command wiring and live LMX-backed checks are passing in the live environment.

## 4) Debugging and Fixes Applied

1. `chat` startup session journal regression
- File: `src/commands/chat.ts`
- Fix: treat missing `config.journal` as enabled-by-default (`journal?.enabled ?? true`) to preserve default behavior with partial config stubs.

2. Windows keychain test drift
- File: `tests/keychain/index.test.ts`
- Fix: updated assertions to match current Windows DPAPI fallback behavior (available backend + PowerShell encryption path), rather than legacy no-op behavior.

3. Session manager test mismatch (sync throw vs async reject)
- File: `tests/daemon/session-manager.test.ts`
- Fix: changed expectation to synchronous `toThrow` for `listBackgroundProcesses('nonexistent')`.

4. `doctor --json` delayed-exit/hang risk during MCP probing
- File: `src/commands/doctor.ts`
- Fixes:
  - default skip of deep stdio MCP probe in doctor mode (opt-in via `OPTA_DOCTOR_PROBE_STDIO_MCP=1`)
  - timeout cleanup hardening for MCP connect probes
- Outcome: `doctor --json` now exits promptly in live runs.

## 5) Operational Runbook

- Re-run complete feature smoke:
  - `npm run smoke:features`
- Emit to a custom evidence file:
  - `npm run smoke:features -- --output docs/evidence/feature-smoke-$(date +%F)-rerun.tsv`

## 6) Release Artifact + Install Validation

- Tag pushed: `v0.5.0-alpha.1`
- GitHub release created: `https://github.com/agencymatthewg-beep/opta/releases/tag/v0.5.0-alpha.1`
- Latest download URL verified `200`:
  - `https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz`
- Clean install from live URL validated:
  - `npm install -g https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz`
  - `opta --help` ✅
  - `opta doctor --json` ✅ (LMX connection pass; warnings only for MCP skip/account envs/git dirty tree)
  - `opta chat --help` ✅
