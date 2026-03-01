# Windows Compatibility Operator Checklist

Date: 2026-02-28
Applies to: `1P-Opta-Code-Universal`

Use this checklist before declaring a Windows-ready release candidate.

## 1. Contract Coverage

- [x] `docs/WINDOWS-COMPATIBILITY.md` exists and is current.
- [x] Supported capabilities are explicitly listed.
- [x] Conditional capabilities are explicitly listed.
- [x] Out-of-scope/unsupported behavior is explicitly listed.
- [x] README points to the compatibility contract. *(Confirmed: `README.md` links to `docs/WINDOWS-COMPATIBILITY.md`.)*

## 2. Security and Storage

- [x] Tauri secure token bridge commands exist: `get_connection_secret`, `set_connection_secret`, `delete_connection_secret`.
- [x] `src/hooks/useDaemonSessions.ts` does not rely on plaintext token persistence in Tauri runtime. *(Token routed through `src/lib/secureConnectionStore.ts` which uses keyring in Tauri mode. Host/port stored in localStorage, which is non-sensitive.)*
- [x] Browser/dev fallback behavior remains functional when Tauri bridge is unavailable. *(`secureConnectionStore.ts` checks `window.__TAURI__` and falls back to `localStorage`.)*

## 3. CI Build and Smoke Validation

- [x] `.github/workflows/opta-code-windows-build.yml` uploads Windows installer artifacts. *(Confirmed: uploads `opta-code-windows-installer` containing MSI, NSIS EXE, and `opta-code.exe`.)*
- [x] `windows-smoke` validates installer artifacts (MSI/NSIS), not just arbitrary `.exe` files. *(Confirmed: smoke job checks for `.msi` and NSIS `.exe` with pattern matching before running startup test.)*
- [x] `tests/windows/packaged-smoke.ps1` starts packaged app and verifies it stays alive for at least 5 seconds. *(Confirmed: script uses `$MinAliveSeconds = 5` default, checks process liveness with `HasExited`.)*
- [x] Smoke logs are uploaded as `opta-code-windows-smoke-logs`. *(Confirmed in workflow.)*
- [x] Full installer smoke exists as a release/nightly gate (`windows-installer-smoke`) with uploaded logs. *(Confirmed: `tests/windows/installer-smoke.ps1` + `opta-code-installer-smoke-logs` artifact on workflow-dispatch, schedule, and tag runs.)*
- [ ] Release-tag signing gate passes with Authenticode secrets configured. *(Workflow now hard-fails tag builds if `WINDOWS_CERTIFICATE` or `WINDOWS_CERTIFICATE_PASSWORD` is missing.)*

## 4. Verification Commands

- [x] `npm run check:desktop` passes locally. *(Script exists in `package.json`: `typecheck && test:run && build`. All three steps verified.)*
- [x] `cargo test connection_secrets -- --nocapture` passes when secure bridge code changed. *(Verified locally on 2026-02-28 after normalizing NSIS config surface in `tauri.conf.json`.)*
- [ ] CI workflow has latest successful run with green readiness summary. *(Pending — first run post-reorg path fix. Trigger `workflow_dispatch` after merging.)*

## 5. Evidence Recording

- [x] `docs/plans/2026-02-28-windows-release-readiness-report.md` is completed for latest candidate. *(Completed as initial baseline; marked No-Go pending first CI run.)*
- [ ] Report includes workflow run URL/ID and artifact references. *(Placeholder pending first successful CI run. Update report after triggering `workflow_dispatch`.)*
- [x] Any open risks and mitigations are documented. *(Current open risks: Authenticode signing, no post-reorg CI evidence yet, and installer smoke not enforced on every PR/push.)*
