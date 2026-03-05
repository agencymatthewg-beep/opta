# OptaLocal Fast-Lane Contract Drift Mini-Audit
Date: 2026-03-05
Scope: `1D-Opta-CLI-TS`, `1M-Opta-LMX`, `1P-Opta-Code-Universal`
Focus: P0/P1 only (production-impacting contract drift + stale config refs)

## Verdict
No new P0 breakage found.

Found **5 P1 items** worth immediate patching (1 active contract mismatch in app code, 4 stale production-facing references / guardrail gaps that can cause wrong operator actions and avoidable outages).

---

## P1 Findings (Prioritized)

### 1) Active daemon operation mismatch in Opta Code account sync flow
- **Severity:** P1
- **Impact:** Vault sync can fail in production UI path because operation ID no longer exists in daemon contract.
- **Evidence:**
  - `1P-Opta-Code-Universal/src/pages/AccountControlPage.tsx` uses `account.vault.pull`
  - `1D-Opta-CLI-TS/src/protocol/v3/operations.ts` + `src/daemon/operations/registry.ts` expose `vault.pull` (no `account.vault.pull`)
- **Fix:** Replace operation ID to canonical `vault.pull` and keep fallback messaging.

### 2) No CI guard preventing future 1P→1D operation-id drift
- **Severity:** P1
- **Impact:** Future renames can silently ship and break specific UI features at runtime.
- **Evidence:** Static diff shows 1 missing op usage (`account.vault.pull`) before runtime.
- **Fix:** Add a contract test/check that all `runOperation("...")` IDs used in `1P` are a subset of `OPERATION_IDS` from `1D` protocol package.

### 3) Stale LMX migration doc points health checks to wrong port/path combo
- **Severity:** P1
- **Impact:** Operators following docs can probe invalid endpoint and misdiagnose healthy LMX as down.
- **Evidence:** `1M-Opta-LMX/docs/OPTA-CLI-MIGRATION.md` still references `http://lmx:1235/admin/health` while project standard is `:1234`.
- **Fix:** Update stale port/path references to current canonical LMX endpoint contract (`:1234` + current health/discovery paths).

### 4) API spec examples still use legacy localhost:8000 endpoints
- **Severity:** P1
- **Impact:** Integrators copy wrong base URL, causing immediate connection failures / false incident reports.
- **Evidence:** `1M-Opta-LMX/docs/plans/API-SPEC.md` contains curl examples on `localhost:8000` despite product contract defaulting to `1234`.
- **Fix:** Normalize examples to `http://localhost:1234` and call out override mechanism (`LMX_SERVER__PORT`) separately.

### 5) Opta Code daemon connectivity error text suggests internal command (`daemon run`)
- **Severity:** P1
- **Impact:** Support friction + wrong remediation steps for users; increases recovery time during outages.
- **Evidence:** `1P-Opta-Code-Universal/src/lib/daemonClient.ts` error: "Ensure 'opta daemon run' is active." (`run` is internal/foreground command; operator command is `opta daemon start`).
- **Fix:** Replace recommendation with `opta daemon start` / `opta daemon status`.

---

## Top 5 Fixes (Impact / Effort)

1. **Patch `account.vault.pull` → `vault.pull`**  
   - **Impact:** High (restores broken account vault sync path)  
   - **Effort:** XS (single-line code fix + targeted test update)
   - **Files:**
     - `1P-Opta-Code-Universal/src/pages/AccountControlPage.tsx`
     - `1P-Opta-Code-Universal/src/pages/AccountControlPage.test.tsx` (if operation ID asserted)

2. **Add operation-contract drift test in 1P CI**  
   - **Impact:** High (prevents repeat runtime drift across releases)  
   - **Effort:** S
   - **Files:**
     - `1P-Opta-Code-Universal/tests/contracts/daemon-operation-ids.test.ts` (new)
     - `1P-Opta-Code-Universal/package.json` (wire script)
     - `.github/workflows/opta-code-parity.yml` (ensure gate runs)

3. **Fix stale daemon remediation message in desktop client**  
   - **Impact:** Medium-High (faster incident recovery, less false troubleshooting)  
   - **Effort:** XS
   - **Files:**
     - `1P-Opta-Code-Universal/src/lib/daemonClient.ts`

4. **Normalize stale migration endpoint docs (1235 → 1234)**  
   - **Impact:** Medium (prevents operator misconfig during rollout/migration)  
   - **Effort:** XS
   - **Files:**
     - `1M-Opta-LMX/docs/OPTA-CLI-MIGRATION.md`

5. **Normalize API spec curl base URLs (8000 → 1234)**  
   - **Impact:** Medium (prevents integration misfires and onboarding failures)  
   - **Effort:** S (multi-occurrence doc sweep)
   - **Files:**
     - `1M-Opta-LMX/docs/plans/API-SPEC.md`

---

## Notes
- Fast-lane scan was intentionally scoped to P0/P1 production risk. Lower-severity doc hygiene and architectural opportunities were excluded.
- Recommended execution order: **#1 → #2 → #3/#4/#5**.
