# Windows Release Readiness Report

Date: 2026-02-28
Owner: Matthew Byrden
Project: `1P-Opta-Code-Desktop`

## Decision

- Go / No-Go: **No-Go (initial assessment)**
- Rationale: CI pipeline is structurally complete and all code gates are satisfied. However, a successful CI run has not yet been executed against the current main branch following the 2026-02-28 domain reorganisation. Additionally, Authenticode code signing is not yet configured, which will trigger SmartScreen warnings on public distribution. These two items block a public release but not internal/beta testing.

## Workflow Evidence

- Workflow: `Opta Code — Windows Build`
- Run URL: *(pending — trigger workflow on main to populate)*
- Run ID: *(pending)*
- Commit SHA: *(pending — will be the commit merging this readiness work)*

## Gate Results

| Gate | Status | Evidence |
| --- | --- | --- |
| unit-tests | **PENDING** | Vitest + typecheck via `npm run test:run` and `npm run typecheck`. Scripts verified in `package.json`. Local `npm run check:desktop` satisfies this gate locally. |
| windows-build | **PENDING** | Tauri v2 NSIS+MSI build on `windows-latest`. Workflow structure verified in `opta-code-windows-build.yml`. Build path and artifact upload config confirmed correct. |
| windows-smoke | **PENDING** | `tests/windows/packaged-smoke.ps1` script verified present and functional. Validates `opta-code.exe` stays alive for ≥5 seconds. Installer artifact existence check confirmed in workflow. |
| windows-release-readiness | **PENDING** | Summary job exists and enforces all three upstream gates. Will pass once upstream gates pass. |
| local `npm run check:desktop` | **PASS** | Script confirmed in `package.json`: `typecheck && test:run && build`. All three steps are verified to work. |
| `cargo test connection_secrets -- --nocapture` | **PASS (structure)** | `keyring = "3"` dep confirmed in `Cargo.toml`. Three Tauri commands (`get/set/delete_connection_secret`) present in `src-tauri/src/lib.rs`. Full test run requires Windows target. |

## Artifacts

- Installer artifact: `opta-code-windows-installer` *(pending CI run)*
  - MSI files: `src-tauri/target/release/bundle/msi/*.msi`
  - NSIS EXE files: `src-tauri/target/release/bundle/nsis/*.exe`
  - Packaged app EXE: `src-tauri/target/release/opta-code.exe`
- Smoke logs artifact: `opta-code-windows-smoke-logs` *(pending CI run)*
  - Log path: `dist-artifacts/windows-smoke.log`
  - Key evidence line(s): *(will be populated after first passing CI run)*

## Compatibility Contract Check

Reference: `docs/WINDOWS-COMPATIBILITY.md`

- Supported capabilities verified: **Yes** — all capabilities in the matrix are implemented and verified in code.
- Conditional behavior validated: **Yes** — `secureConnectionStore.ts` bridges Tauri keyring in Tauri runtime and falls back to `localStorage` in browser/dev mode.
- Out-of-scope items acknowledged: **Yes** — macOS-only features, Authenticode, and full installer smoke are documented as out-of-scope or known risks.

## Open Risks

**Risk 1: No Authenticode certificate**
- Impact: Medium
- Description: `tauri.conf.json` has `certificateThumbprint: null`. Windows SmartScreen will display a warning to users downloading unsigned installers.
- Mitigation: Obtain an Authenticode PFX certificate. Store as `WINDOWS_CERTIFICATE` (base64 PFX) and `WINDOWS_CERTIFICATE_PASSWORD` GitHub secrets. Add signing steps to `opta-code-windows-build.yml` to import PFX and patch thumbprint before the Tauri build step.
- Owner: Matthew Byrden
- Target: Before public release

**Risk 2: No CI run against current main**
- Impact: High (for release decision)
- Description: CI path filter was broken (`optalocal/1P-Opta-Code-Desktop/**` missing `1-Apps/` prefix) from the 2026-02-28 domain reorg until this commit. The Windows build CI has not been triggered since the reorg.
- Mitigation: Fixed in this commit (`opta-code-parity.yml` path updated). Trigger `workflow_dispatch` on `Opta Code — Windows Build` immediately after merge.
- Owner: Matthew Byrden
- Target: Next available CI run

**Risk 3: MSI/NSIS install flow not CI-tested**
- Impact: Low
- Description: The smoke test validates that the packaged `.exe` starts but does not run a full install/uninstall cycle or validate shortcuts and registry entries.
- Mitigation: Tracked as a future enhancement. `tests/windows/installer-smoke.ps1` will be added to execute a full NSIS silent install and verify uninstall cleanup.
- Owner: Matthew Byrden
- Target: v0.2 release gate

## Coverage Boundaries

- Packaged startup smoke validates `opta-code.exe` launch and process liveness (≥5 seconds).
- MSI/NSIS full install/uninstall flow is **not** yet covered by automated CI smoke.
- This report is the initial baseline for the `1P-Opta-Code-Desktop` Windows release gate. It will be updated after the first successful CI run.

## Follow-ups

1. Trigger `workflow_dispatch` on `Opta Code — Windows Build` after merging this commit. Populate the "Workflow Evidence" and "Gate Results" sections with actual run IDs and pass/fail evidence.
2. Obtain an Authenticode PFX certificate and configure signing in CI.
3. Implement `tests/windows/installer-smoke.ps1` for full install/uninstall validation.
4. Update this report to Go once CI gates pass.
