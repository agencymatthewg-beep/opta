# Windows Release Readiness Report

Date: 2026-02-28
Owner: Matthew Byrden
Project: `1P-Opta-Code-Desktop`

## Decision

- Go / No-Go: **No-Go (public release), Beta-Go (internal)**
- Rationale: Local gates now pass (`npm run check:desktop` and `cargo test connection_secrets -- --nocapture`) and the Windows workflow includes packaged, installer, and nightly smoke stages. Public release remains blocked until (1) we capture a fresh green Windows CI run after the 2026-02-28 reorg changes and (2) Authenticode signing secrets are configured for release-tag builds.

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
| windows-installer-smoke | **PENDING (release/nightly gate)** | `tests/windows/installer-smoke.ps1` validates NSIS install -> app liveness -> uninstall cleanup. Triggered on `workflow_dispatch`, nightly `schedule`, and tag pushes (`refs/tags/v*`). |
| windows-release-readiness | **PENDING** | Summary job enforces `unit-tests`, `windows-build`, and `windows-smoke` on all runs, and additionally enforces `windows-installer-smoke` when required (workflow-dispatch, schedule, and tags). |
| local `npm run check:desktop` | **PASS** | Script confirmed in `package.json`: `typecheck && test:run && build`. All three steps are verified to work. |
| `cargo test connection_secrets -- --nocapture` | **PASS** | Verified locally on 2026-02-28 after normalizing NSIS config fields to parser-supported keys. Result: `2 passed`, `0 failed`. |

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

**Risk 3: Installer smoke is not enforced on every PR/push**
- Impact: Low
- Description: Full NSIS install/uninstall smoke is executed on `workflow_dispatch`, nightly schedule, and tag pushes, but not every PR/push.
- Mitigation: Keep nightly coverage and enforce tag/workflow-dispatch run before release cut; promote to every main push only if regression rate justifies the extra CI cost.
- Owner: Matthew Byrden
- Target: Before release cut

## Coverage Boundaries

- Packaged startup smoke validates `opta-code.exe` launch and process liveness (≥5 seconds) on PR/push/workflow-dispatch.
- MSI/NSIS install/uninstall smoke is covered on workflow-dispatch, nightly, and tag runs (`windows-installer-smoke`).
- This report remains pre-CI-evidence until the first successful post-reorg Windows workflow run is recorded.

## Follow-ups

1. Trigger `workflow_dispatch` (or push a release tag) on `Opta Code — Windows Build` after merging this commit. Populate the "Workflow Evidence" and "Gate Results" sections with actual run IDs and pass/fail evidence.
2. Obtain an Authenticode PFX certificate and configure signing in CI.
3. Capture installer smoke evidence (`opta-code-installer-smoke-logs`) from a required installer-smoke run (`workflow_dispatch`, nightly, or tag) and link it here.
4. Update this report to Go once CI gates pass.
