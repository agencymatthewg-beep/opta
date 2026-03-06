# Mono512 Autonomous Benchmark Prep (2026-03-06)

## Scope

Prepare Opta CLI on MacBook to target Mono512 LMX for autonomous benchmarking, validate Peekaboo host readiness, and document current blockers for full autonomous execution.

## Environment snapshot

- Timestamp (UTC): `2026-03-05T14:52:03Z`
- Host: `Mono512` (`Apple M3 Ultra`, 32 logical CPU, 512 GB unified memory)
- Mono512 data volume: `1.8Ti total`, `1.7Ti used`, `106Gi free`, `95% used`
- LMX revision/version:
  - Repo SHA: `443a772c` (`main`, clean)
  - `opta_lmx_version=0.1.0`
- CLI doctor on MacBook:
  - LMX connection: pass (`Mono512.local:1234`, 1 model loaded)
  - LMX discovery: pass (2 servers found)
  - Failures: `0`

## Implementation completed in CLI

### 1) `ceo-bench` remote targeting + provider override

Updated command registration to support remote benchmark execution directly:

- Added options:
  - `--device <host[:port]>`
  - `--remote`
  - `--provider <name>`
  - `--autonomy-level <1-5>`
- Wired `ceo-bench` through the same device-target env flow used by other commands.

Files:

- `src/index.ts`
- `src/benchmark/ceo/runner.ts`

### 2) Benchmark workspace hardening

Added deterministic workspace seeding and prompt tightening:

- Seeds `APP.md` + `INDEX.md` per temporary benchmark workspace.
- Adds explicit benchmark prompt constraints to reduce planning drift.
- Returns explicit error when filter matches zero tasks.

Files:

- `src/benchmark/ceo/runner.ts`
- `tests/benchmark/ceo-runner.test.ts` (new)

Validation:

- `npm run -s test:run -- tests/benchmark/ceo-runner.test.ts` passed (`2/2`)
- `npm run -s typecheck` passed
- `npm run -s build` passed

### 3) Global CLI bootstrap hardening (`opta` debugability fix)

Fixed `bin/opta.js` startup behavior so linked/global CLI commands do not exit before async command execution completes.

- Root cause: bootstrap called `process.exit(0)` immediately after dynamic import of `dist/index.js`.
- Effect: commands like `opta status --json` could return no output, making production debugging impossible.
- Fix: only failure paths call `process.exit(...)`; success path now lets the imported CLI own process lifecycle.

File:

- `bin/opta.js`

## MacBook runtime prep for Mono512

Active config store was validated at:

- `~/Library/Preferences/opta-nodejs/config.json`

Configured for benchmark routing:

- `connection.host = Mono512.local`
- `connection.port = 1234`
- `provider.active = lmx`
- `model.default = mlx-community/MiniMax-M2.5-4bit`
- `connection.apiKey` set to Mono512 inference key (masked)

Confirmed via:

- `opta status --json` -> remote execution context on `Mono512.local`
- `opta update --dry-run --json` -> no module/bootstrap failures

## Peekaboo readiness

Configured:

- `computerControl.background.enabled = true` (already true)
- `computerControl.background.allowBrowserSessionHosting = true` (already true)
- `computerControl.background.allowScreenStreaming = true` (already true)
- `computerControl.foreground.enabled = true` (set)
- `computerControl.foreground.allowScreenActions = true` (set)

`browser host start --screen peekaboo --json` reports `screenActionsEnabled: true` when started in-process.

Important behavior:

- Browser live host is process-local; start/keep it in the same active CLI session during autonomous runs.
- A separate process calling `browser host status` will show `running: false` unless that same process is hosting.

## Benchmark outcomes (current)

Smoke benchmarks were executed against `mlx-community/MiniMax-M2.5-4bit` on Mono512.

### Autonomy level 1

- Result: failed
- Symptom: stream protocol error
- Error observed:
  - `Stream inference failed: Message has tool role, but there was no previous assistant message with a tool call!`
- Verification did not pass (`math-function`)
- Command path itself is now stable and observable (no silent bootstrap exit).

### Autonomy level 5

- Result: failed
- Symptom: repetitive loop / stagnation abort
- Pattern: repeated `list_dir` calls, no stable task completion path
- Verification did not pass (`math-function`)

## Research synthesis (cross-analysis)

### CEO benchmark command model

- Bench relies on current provider/host credentials loaded from config/environment.
- Runtime depends on healthy inference + shell verification execution.
- JSON mode emits task-level payload (`id`, `passed`, `turns`, `durationMs`, `error`).

### Peekaboo observability gap

Current gap is not startup; it is diagnostics depth:

- No persistent structured logs for screen action failures.
- Peekaboo action stderr/stdout is not surfaced with enough detail for postmortem.
- Queue/backpressure metrics for serialized Peekaboo actions are missing.

### Mono512 LMX risk deltas

- Stabilized: launch reliability and snapshot integrity checks are improved vs previous incidents.
- Residual risk remains high for disk pressure (`95%` used) and large model loads.
- GLM/Kimi paths still require fresh March validation before production routing.

## Residual hardening gap

`ceo-bench` still does not complete reliably on current MiniMax profile, even after runner and targeting hardening.

Primary remaining work:

1. Add a benchmark-safe tool protocol guard:
   - Detect/repair invalid assistant/tool message ordering before next inference call.
2. Add loop-control policy in benchmark mode:
   - Stop repeating identical tool plans after N repeats, then force direct verify step.
3. Add structured benchmark trace artifact:
   - Persist per-turn tool and error timeline under `docs/evidence/` for reproducible debugging.
4. Add Peekaboo action telemetry:
   - Log action input, duration, stderr/stdout, and queue depth.

## Recommended next execution run

Use one dedicated terminal for live host and one for benchmark:

1. Terminal A (keep running):
   - `opta browser host start --screen peekaboo`
2. Terminal B:
   - `opta status --json`
   - `opta ceo-bench --device Mono512.local:1234 --provider lmx --autonomy-level 1 --filter math-function --json`
   - `opta ceo-bench --device Mono512.local:1234 --provider lmx --autonomy-level 5 --filter math-function --json`
3. If failure persists, capture `--debug` output and map failure type to the 4 residual hardening items above.
