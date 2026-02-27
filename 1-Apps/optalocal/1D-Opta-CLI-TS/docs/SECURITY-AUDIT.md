# Opta CLI Security Audit

**Date:** 2026-02-27
**Status:** COMPLETE

## 1. Shell Injection Prevention

### Scope
`src/daemon/background-manager.ts` — `parseShellCommand()` function
`src/core/tools/executors.ts` — `run_command` executor

### Findings

| Path | Pattern | Risk | Status |
|------|---------|------|--------|
| `background-manager.ts:parseShellCommand()` | Direct tokenizer → `spawn(exe, args)` | None | Safe |
| Shell metacharacters (`;`, `|`, `` ` ``, `$()`) | Treated as literal characters | None | Safe |
| Quoted strings | Single/double quotes handled correctly | None | Safe |

### Verification
`tests/security/shell-injection.test.ts` — 8 tests covering semicolons, backticks, pipes, `$()`, quoting, and real `spawn` injection attempt.

---

## 2. API Key Handling

### Scope
`src/keychain/index.ts`, `src/keychain/api-keys.ts`, `src/core/config.ts`

### Findings

| Concern | Status |
|---------|--------|
| API keys stored in OS keychain (macOS `security(1)`) | Safe |
| Fallback to config file (`~/.config/opta/config.json`) when keychain unavailable | Acceptable |
| Keys masked in logs via `maskKey()` | Safe |
| Keys not printed to stdout | Safe |
| `--password` CLI flag replaced with `promptPassword()` | Safe |

---

## 3. Browser Policy Engine

### Scope
`src/browser/policy-engine.ts` — `evaluateBrowserPolicyAction()`

### Findings

| Concern | Default | Status |
|---------|---------|--------|
| High-risk actions require explicit approval | `requireApprovalForHighRisk: true` | Safe |
| Blocked origins denied outright | `blockedOrigins: []` (user-configurable) | Safe |
| Allowed hosts wildcard by default | `allowedHosts: ['*']` | Acceptable |
| Sensitive action detection | `auth_submit`, `post`, `checkout`, `delete` | Safe |
| Adaptive risk escalation | Triggered by quality regression metrics | Safe |
| Low-risk observation tools (screenshot/snapshot/close) | Always allowed | Safe |
| Navigate with missing/invalid URL | Denied | Safe |

### Verification
`tests/security/browser-policy.test.ts` — 18 tests covering origin blocking, host allowlists, risk classification, keyword detection, adaptive escalation, and pre-approval flow.

---

## 4. Daemon Process Resilience

### Scope
`src/daemon/main.ts`, `src/daemon/session-manager.ts`

### Findings

| Concern | Status |
|---------|--------|
| `uncaughtException` handler logs and continues | Safe |
| `unhandledRejection` handler logs and continues | Safe |
| Session-level errors isolated via try-catch in `processSessionQueue()` | Safe |
| Turn errors emitted as `turn.error` events, not propagated | Safe |
| `SIGTERM`/`SIGINT` trigger graceful shutdown | Safe |

### Verification
`tests/daemon/crash-recovery.test.ts` — 5 tests covering session lifecycle, stats isolation, and graceful shutdown.

---

## 5. Autonomy Level Resolution

### Scope
`src/tui/menu/helpers.ts` — `autonomySlider()`

### Findings
Autonomy levels use `Math.floor` (not `Math.round`) to prevent accidental permission escalation from fractional values. A value of 3.9 resolves to level 3, not level 4.

---

## Summary

All audited areas are secure with appropriate defaults. No critical vulnerabilities found.
