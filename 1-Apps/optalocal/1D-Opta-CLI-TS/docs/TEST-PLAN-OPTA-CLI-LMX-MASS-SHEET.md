# Test Plan — Opta CLI + Opta LMX (Mass Feature Data Sheet)

Updated: 2026-02-28 17:34 AEST
Owner: Matthew + Opta
Scope: `1D-Opta-CLI-TS` + `1M-Opta-LMX`
Goal: Test every feature, capture measurable outcomes, and score optimization quality.

---

## 1) Testing Objectives

1. Verify every feature path works end-to-end.
2. Measure quality quantitatively (latency, success rate, resource use, reliability).
3. Detect architectural weaknesses early (contract drift, policy bypasses, regression hotspots).
4. Produce one **mass data sheet** as the canonical evidence base for optimization decisions.

---

## 2) Scoring Model (Optimization Index)

Each feature gets a weighted score out of 100:

- Correctness (30)
- Reliability / Flake resistance (20)
- Performance (20)
- UX/Dev Ergonomics (10)
- Security/Policy Compliance (10)
- Observability/Debuggability (10)

### Grade bands
- 90–100: Production-optimal
- 75–89: Good, needs targeted optimization
- 60–74: Functional but significant debt
- <60: Blocker quality

---

## 3) Mass Data Sheet Structure

Use CSV (or Google Sheet) with these columns:

```csv
suite,feature_id,app,feature_name,category,test_case_id,environment,build_sha,run_id,started_at,ended_at,duration_ms,status,error_type,error_summary,attempts,success_rate_pct,p50_ms,p95_ms,p99_ms,cpu_peak_pct,ram_peak_mb,disk_io_mb,tool_calls,policy_gate,security_pass,observability_score,ux_score,optimization_score,notes,owner,next_action
```

### Canonical paths
- Raw results: `1D-Opta-CLI-TS/tests/results/`
- Aggregated sheet CSV: `1D-Opta-CLI-TS/tests/results/opta-cli-lmx-mass-sheet.csv`
- Summary report: `1D-Opta-CLI-TS/tests/results/opta-cli-lmx-summary.md`

---

## 4) Feature Inventory Coverage Matrix

## A) Opta CLI (1D)

### A1. Core CLI
- help, version, status, doctor, config, env
- expected: deterministic output + valid exit codes

### A2. Chat/Do/TUI
- `chat`, `tui`, `do`
- with/without daemon
- with `--device`
- with capability enforcement enabled/disabled

### A3. Models Command Surface
- list, load, unload, use, swap, alias, unalias, download, delete
- predictor/helpers/benchmark/scan/dashboard/browse
- `--remote` behavior and fallback behavior

### A4. Daemon Lifecycle
- daemon start/stop/status
- contract version compatibility check
- mismatch handling and diagnostics

### A5. Tools + Ops
- process/tool execution flows
- safety gates (dangerous ops, policy eval, fail-open/fail-closed)

### A6. Update System
- `opta update` target modes (`auto/local/remote/both`)
- dry-run, no-build, no-pull

---

## B) Opta LMX (1M)

### B1. Health/Ready/Admin
- `/healthz`, `/readyz`, `/admin/*`
- auth requirements and policy hooks

### B2. Model Management
- load/unload/list/download progress
- free-space preflight
- concurrent download cap
- incomplete sweep startup + loop behavior

### B3. Inference APIs
- chat/generate/stream
- throughput + latency + failure recovery

### B4. Skills + Agents
- invocation/cancel/list
- policy hook integration (audit vs enforce)
- header-derived context behavior

### B5. Security
- inference key checks
- websocket auth
- admin key gates
- priority lane controls (no bypass)

### B6. Storage/Policy on Opta48
- no-local-model guard behavior
- override env behavior (`OPTA48_ALLOW_LOCAL_MODELS`) explicitly tested

---

## 5) Test Environments

1. **Opta48 local client mode** (no local model hosting)
2. **Mono512 inference host mode**
3. **LAN degraded mode** (latency injected)
4. **Policy strict mode** (fail-closed)

Each test row must record `environment` and `build_sha`.

---

## 6) Execution Plan (3 Waves)

### Wave 1 — Correctness Baseline
- Run all feature tests once
- Capture pass/fail + defects
- No optimization scoring yet beyond preliminary

### Wave 2 — Reliability + Performance
- Repeat critical tests 20x for flake rate
- Collect p50/p95/p99 latency and resource metrics

### Wave 3 — Optimization Scoring + Prioritization
- Compute per-feature optimization score
- Rank top 20 optimization opportunities by impact x effort

---

## 7) Automation Commands (Starter)

```bash
# CLI quality gate
cd ~/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS
npm run quality:gate

# LMX focused checks
cd ~/Synced/Opta/1-Apps/optalocal/1M-Opta-LMX
.venv/bin/pytest -q tests/test_model_manager.py tests/test_security_hardening.py tests/test_endpoint_policy_hooks.py

# Create results dir
mkdir -p ~/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/tests/results
```

---

## 8) Defect Taxonomy (for consistent logging)

- `contract_drift`
- `type_safety`
- `policy_bypass`
- `auth_failure`
- `latency_regression`
- `resource_leak`
- `ux_confusion`
- `docs_mismatch`

---

## 9) Done Criteria

A feature is “optimal-ready” only when:
1. Success rate >= 99% over repeated runs
2. No critical security/policy bypass
3. p95 latency within target
4. Observability score >= 8/10
5. Optimization score >= 85/100

---

## 10) Immediate Next Actions

1. Build the initial CSV with one row per feature-case (skeleton).
2. Run Wave 1 for all CLI + LMX feature groups.
3. Produce first ranked optimization backlog from measured data (not assumptions).

