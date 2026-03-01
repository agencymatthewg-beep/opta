# Opta Code Desktop macOS Compatibility Contract

Last updated: 2026-02-28

This document defines what is considered macOS-compatible for `1P-Opta-Code-Universal` and what evidence is required before release.

## Scope

Target runtime:
- macOS desktop app built with Tauri v2 targeting Apple Silicon (`aarch64-apple-darwin`)
- Frontend bundle from Vite + React
- Opta daemon connectivity over HTTP/WebSocket

## Capability Matrix

| Capability | macOS status | Notes |
| --- | --- | --- |
| Desktop shell launch (`.app` bundle / DMG) | Supported | Verified by DMG smoke test in CI. Binary launched directly from `Contents/MacOS/`. |
| Daemon connection (host/port/token) | Supported | Defaults to `127.0.0.1:9999`; editable in app header form. |
| Session cockpit (create/track/stream/cancel) | Supported | Uses daemon v3 stream/events endpoints. |
| Operations page | Supported | Daemon-backed operation endpoints only. |
| Background jobs page | Supported | Daemon-backed job listing/control only. |
| Models page / LMX status display | Conditional | Works when daemon-side LMX services are reachable; otherwise UI shows unreachable/error state. |
| Token persistence security | Conditional | In Tauri runtime, token is persisted via native Keychain (`keyring` v3 / macOS Security framework). In browser/dev-only mode, fallback remains localStorage. |
| Gatekeeper bypass | Conditional | Unsigned builds will trigger Gatekeeper quarantine. Full bypass requires Developer ID Application certificate + notarization. See Known Risks. |

## Out of Scope (macOS Contract)

- Windows Credential Store, registry, or NSIS installer behaviour; those are covered by `docs/WINDOWS-COMPATIBILITY.md`.
- Guaranteeing LMX service availability; this app surfaces daemon-provided status and errors but does not provision LMX itself.
- Intel Mac (`x86_64-apple-darwin`) support in current CI pipeline; only Apple Silicon is targeted.

## Graceful Behavior Requirements

- If secure-store bridge is unavailable, app must continue with browser-compatible fallback behavior.
- If models/LMX backend is unavailable, app must show non-crashing status/error state.
- If daemon is offline, app must remain usable for connection reconfiguration and retry.

## Required CI Evidence

Release readiness for macOS requires a successful run of `.github/workflows/opta-code-macos-build.yml` with:
- `unit-tests`: success
- `macos-build`: success
- `macos-smoke`: success
- `macos-release-readiness`: success

Required artifacts:
- `opta-code-macos-dmg`
- `opta-code-macos-smoke-logs`

## Current Smoke Coverage Boundary

- `macos-smoke` mounts the DMG, locates the `.app` bundle and binary, launches it, and verifies the process stays alive for ≥5 seconds.
- It does not currently validate Gatekeeper acceptance, notarization stapling, or App Store receipt verification.
- Intel macOS is not tested in CI.

## Local Validation Gate

Before claiming macOS readiness locally, run:

```bash
npm run check:desktop
```

If touching Rust/Tauri token bridge behavior, additionally run:

```bash
cd src-tauri
cargo test connection_secrets -- --nocapture
```

## Security Notes

- **Token storage:** Bearer tokens are persisted via `keyring` v3 to the macOS Keychain (service name: `com.opta.code.desktop`). The Tauri bridge (`get_connection_secret` / `set_connection_secret` / `delete_connection_secret`) mediates all access.
- **Browser fallback:** When `window.__TAURI__` is not available (dev server, web mode), tokens fall back to `localStorage`. Acceptable for local development only.
- **No plaintext token logging:** The daemon bearer token is never logged or serialised to disk outside the OS Keychain.
- **CSP:** Tauri enforces a Content Security Policy restricting connections to `localhost` origins. Remote daemon connections require updating `tauri.conf.json`.
- **Gatekeeper:** Unsigned `.app` bundles downloaded from the internet are quarantined by macOS Gatekeeper. Users must explicitly allow the app via System Settings > Privacy & Security, or the app must be signed and notarized with a Developer ID Application certificate.

## Known Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| No Apple Developer ID certificate | Medium — Gatekeeper quarantine on downloaded DMG | Obtain a Developer ID Application certificate from Apple Developer account. Export as p12, base64-encode, store as `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` + `APPLE_SIGNING_IDENTITY` CI secrets. Add `apple-actions/import-codesign-certs@v3` step and patch `bundle.macOS.signingIdentity` in `tauri.conf.json` before the Tauri build step. Tracked as a pre-public-release blocker. |
| No notarization | Medium — Gatekeeper online check may block unsigned binaries on recent macOS | Obtain Apple ID app-specific password and Team ID. Set `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` CI secrets. Configure `tauri.conf.json` notarization settings. Requires Developer ID cert first. |
| No CI run against current main | High (for release decision) | CI path filters were broken from the 2026-02-28 domain reorg until the `opta-code-parity.yml` fix. Trigger `workflow_dispatch` on `Opta Code — macOS Build` after merging current work. |
| Intel Mac not targeted | Low | Current CI targets `aarch64-apple-darwin` only. Universal binary (`--target universal-apple-darwin`) or separate Intel build not yet configured. |
