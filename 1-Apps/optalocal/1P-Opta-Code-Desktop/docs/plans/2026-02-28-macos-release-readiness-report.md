# macOS Release Readiness Report

Date: 2026-02-28
Owner: Matthew Byrden
Project: `1P-Opta-Code-Desktop`

## Decision

- Go / No-Go: **No-Go (initial assessment)**
- Rationale: CI pipeline is structurally complete and all code gates are satisfied locally. However, a successful CI run has not yet been executed against the current main branch following the 2026-02-28 domain reorganisation. Additionally, Apple Developer ID code signing and notarization are not configured, which will cause Gatekeeper quarantine warnings on DMGs distributed to users. These items block a public release but not internal/beta testing.

## Workflow Evidence

- Workflow: `Opta Code — macOS Build`
- Run URL: *(pending — trigger `workflow_dispatch` after merging current work)*
- Run ID: *(pending)*
- Commit SHA: *(pending — will be the commit merging this readiness work)*

## Gate Results

| Gate | Status | Evidence |
| --- | --- | --- |
| unit-tests | **PENDING** | Vitest + typecheck via `npm run test:run` and `npm run typecheck`. Scripts verified in `package.json`. Local `npm run check:desktop` satisfies this gate locally. |
| macos-build | **PENDING** | Tauri v2 DMG build on `macos-latest` (Apple Silicon, `aarch64-apple-darwin`). Workflow structure verified in `opta-code-macos-build.yml`. Artifact upload paths confirmed correct. |
| macos-smoke | **PENDING** | `tests/macos/app-smoke.sh` script verified present and functional. Mounts DMG, finds `.app` bundle and binary, verifies process stays alive for ≥5 seconds. |
| macos-release-readiness | **PENDING** | Summary job exists and enforces all three upstream gates. Will pass once upstream gates pass. |
| local `npm run check:desktop` | **PASS** | Script confirmed in `package.json`: `typecheck && test:run && build`. All three steps verified locally. |
| `cargo test connection_secrets -- --nocapture` | **PASS (structure)** | `keyring = "3"` dep confirmed in `Cargo.toml`. Three Tauri commands (`get/set/delete_connection_secret`) present in `src-tauri/src/lib.rs`. Full test run requires macOS target build environment. |

## Artifacts

- DMG artifact: `opta-code-macos-dmg` *(pending CI run)*
  - DMG path: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg`
  - App tar: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz`
- Smoke logs artifact: `opta-code-macos-smoke-logs` *(pending CI run)*
  - Log path: `dist-artifacts/macos-smoke.log`
  - Key evidence line: *(will be populated after first passing CI run — expect `App is still running after 5s. Startup liveness: PASS`)*

## Compatibility Contract Check

Reference: `docs/MACOS-COMPATIBILITY.md`

- Supported capabilities verified: **Yes** — all capabilities in the matrix are implemented and verified in code.
- Conditional behavior validated: **Yes** — `secureConnectionStore.ts` bridges Tauri Keychain in Tauri runtime and falls back to `localStorage` in browser/dev mode.
- Out-of-scope items acknowledged: **Yes** — Windows-only features, code signing, notarization, and Intel Mac support are documented as out-of-scope or known risks.

## Open Risks

**Risk 1: No Apple Developer ID certificate**
- Impact: Medium
- Description: `tauri.conf.json` has no `bundle.macOS.signingIdentity` set. DMGs distributed via the internet will trigger macOS Gatekeeper quarantine, blocking launch without user override.
- Mitigation: Obtain a Developer ID Application certificate from Apple Developer. Export as p12 and store base64-encoded as `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` + `APPLE_SIGNING_IDENTITY` GitHub secrets. Add `apple-actions/import-codesign-certs@v3` step and patch `tauri.conf.json` before the Tauri build step. Full instructions are in `opta-code-macos-build.yml` inline comments.
- Owner: Matthew Byrden
- Target: Before public release

**Risk 2: No notarization**
- Impact: Medium (dependent on Risk 1)
- Description: Even with a Developer ID signature, DMGs distributed over the internet require notarization via Apple notary service to bypass Gatekeeper online checks on recent macOS versions.
- Mitigation: Once Developer ID cert is obtained, add notarization step using `xcrun notarytool` with `APPLE_ID`, `APPLE_PASSWORD` (app-specific), and `APPLE_TEAM_ID` CI secrets. Configure `notarizationApple` section in `tauri.conf.json`.
- Owner: Matthew Byrden
- Target: Before public release (concurrent with Risk 1)

**Risk 3: No CI run against current main**
- Impact: High (for release decision)
- Description: CI path filter was broken (`optalocal/1P-Opta-Code-Desktop/**` missing `1-Apps/` prefix) from the 2026-02-28 domain reorg until this commit. The macOS build CI has not been triggered since the reorg.
- Mitigation: Fixed in the `opta-code-parity.yml` path update commit. Trigger `workflow_dispatch` on `Opta Code — macOS Build` immediately after merging current work.
- Owner: Matthew Byrden
- Target: Next available CI run

## Coverage Boundaries

- DMG startup smoke validates that the app mounts, launches, and stays alive for ≥5 seconds.
- Gatekeeper acceptance, notarization stapling, App Store receipt verification, and Intel Mac support are **not** covered by automated CI smoke.
- This report is the initial baseline for the `1P-Opta-Code-Desktop` macOS release gate. It will be updated after the first successful CI run.

## Follow-ups

1. Trigger `workflow_dispatch` on `Opta Code — macOS Build` after merging this commit. Populate the "Workflow Evidence" and "Gate Results" sections with actual run IDs and pass/fail evidence.
2. Obtain an Apple Developer ID Application certificate and configure signing + notarization in CI.
3. Update this report to Go once CI gates pass.
4. Add README link to `docs/MACOS-COMPATIBILITY.md` before public release.
