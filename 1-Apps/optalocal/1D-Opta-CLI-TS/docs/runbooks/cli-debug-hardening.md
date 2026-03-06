# Opta CLI Debug Hardening Runbook

Updated: 2026-03-06

## Scope

This runbook covers backend-side debugging for the hardened Opta CLI paths:

- Bootstrap recovery when `dist/index.js` is missing.
- Tool-protocol repair before provider calls.
- Peekaboo action/frame telemetry and redacted failure logs.
- CEO benchmark loop detection and trace artifacts.

## 1) Fast Triage

Run from `1D-Opta-CLI-TS`:

```bash
node bin/opta.js --help
npm run -s build
npm run -s start
```

Expected:

- `node bin/opta.js --help` exits `0` and prints commands.
- `npm run -s start` opens TUI (it may show provider/model warnings, but should not crash).

## 2) Missing `dist/index.js` / MODULE_NOT_FOUND

`bin/opta.js` now attempts self-heal:

1. `npm run -s build`
2. If build fails, `npm install --no-fund --no-audit`
3. Retry `npm run -s build`
4. Fallback to `tsx src/index.ts ...` if available

If still failing:

```bash
npm install
npm run -s build
node bin/opta.js --help
```

## 3) Model Fetch / Auth Failure in TUI

Symptoms:

- Status line shows 401/connection failures.
- Model picker fails to load hosts/models.

Check:

```bash
opta status
opta doctor
```

If host is reachable but auth fails, verify local/remote key config and retry.

## 4) Peekaboo Debugging (Screen Actions + Frames)

Telemetry emits structured JSON lines prefixed with:

- `[peekaboo.telemetry]`

Key events:

- `peekaboo.queue.enqueued|started|completed|failed|depth`
- `peekaboo.screen_action.succeeded|failed`
- `peekaboo.frame.cache_hit|capture_failed`
- `peekaboo.screen_request.http_error|unhandled_error`

Runtime status now includes live counters under `peekabooMetrics` (queue depth, failures, frame cache hits, per-action counts).

Sensitive values in telemetry are redacted (token/bearer/auth patterns).

## 5) CEO Bench Loop-Control Debugging

When repetitive autonomous loops are detected, benchmark run aborts with a loop-control error and writes a trace artifact:

```text
docs/evidence/ceo-bench/<timestamp>-<task>.json
```

Trace artifact includes:

- Per-turn tool calls and durations
- Per-turn errors
- Loop signal (`repeatCount`, `repeatThreshold`, signature, turn index)

Use this to tune autonomy level, prompt strategy, or model selection before re-running.

## Residual Gap

Two hardening gaps remain intentionally deferred:

1. Peekaboo telemetry is console-streamed only (no persisted rotating log sink yet).
2. CEO loop detection is tool-call-signature based; assistant-only repetitive text loops are not yet independently classified.
