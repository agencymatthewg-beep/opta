# Opta Code Desktop Windows Compatibility Contract

Last updated: 2026-02-28

This document defines what is considered Windows-compatible for `1P-Opta-Code-Universal` and what evidence is required before release.

## Scope

Target runtime:
- Windows desktop app built with Tauri v2 (`x86_64-pc-windows-msvc`)
- Frontend bundle from Vite + React
- Opta daemon connectivity over HTTP/WebSocket

## Capability Matrix

| Capability | Windows status | Notes |
| --- | --- | --- |
| Desktop shell launch (`opta-code.exe`) | Supported | Verified by packaged startup smoke test in CI. |
| Daemon connection (host/port/token) | Supported | Defaults to `127.0.0.1:9999`; editable in app header form. |
| Session cockpit (create/track/stream/cancel) | Supported | Uses daemon v3 stream/events endpoints. |
| Operations page | Supported | Daemon-backed operation endpoints only. |
| Background jobs page | Supported | Daemon-backed job listing/control only. |
| Models page / LMX status display | Conditional | Works when daemon-side LMX services are reachable; otherwise UI shows unreachable/error state. |
| Token persistence security | Conditional | In Tauri runtime, token is persisted via native secure store (`keyring`). In browser/dev-only mode, fallback remains local storage. |

## Out of Scope (Windows Contract)

- Bundling or managing macOS-only local model/runtime installation flows in the Windows desktop shell.
- Guaranteeing LMX service availability; this app surfaces daemon-provided status and errors but does not provision LMX itself.

## Graceful Behavior Requirements

- If secure-store bridge is unavailable, app must continue with browser-compatible fallback behavior.
- If models/LMX backend is unavailable, app must show non-crashing status/error state.
- If daemon is offline, app must remain usable for connection reconfiguration and retry.

## Required CI Evidence

Release readiness for Windows requires a successful run of `.github/workflows/opta-code-windows-build.yml` with:
- `unit-tests`: success
- `windows-build`: success
- `windows-smoke`: success
- `windows-release-readiness`: success

For release-candidate/public-release validation runs (`workflow_dispatch` or tag push `refs/tags/v*`), also require:
- `windows-installer-smoke`: success

Nightly scheduled runs also execute `windows-installer-smoke` for regression detection.

Required artifacts:
- `opta-code-windows-installer`
- `opta-code-windows-smoke-logs`
- `opta-code-installer-smoke-logs` (`workflow_dispatch`, `schedule`, and tag runs)

## Current Smoke Coverage Boundary

- `windows-smoke` validates packaged app launch from `opta-code.exe` and installer artifact presence on PR/push/workflow-dispatch.
- `windows-installer-smoke` performs a full NSIS install/liveness/uninstall smoke flow on `workflow_dispatch`, nightly `schedule`, and tag runs.
- Full installer smoke is not currently enforced for every PR/push run.

## Local Validation Gate

Before claiming Windows readiness locally, run:

```bash
npm run check:desktop
```

If touching Rust/Tauri token bridge behavior, additionally run:

```bash
cd src-tauri
cargo test connection_secrets -- --nocapture
```

## Security Notes

- **Token storage:** Bearer tokens are persisted via `keyring` v3 to the Windows Credential Store (entry name: `opta-code/daemon-token`). The Tauri bridge (`get_connection_secret` / `set_connection_secret` / `delete_connection_secret`) mediates all access.
- **Browser fallback:** When `window.__TAURI__` is not available (dev server, web mode), tokens fall back to `localStorage`. Acceptable for local development only.
- **No plaintext token logging:** The daemon bearer token is never logged or serialised to disk outside the OS credential store.
- **CSP:** Tauri enforces a Content Security Policy restricting connections to `localhost` origins. Remote daemon connections require updating `tauri.conf.json`.

## Known Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| No Authenticode certificate | Medium — SmartScreen warnings on first run | Obtain a PFX, set `certificateThumbprint` in `tauri.conf.json`, store PFX as `WINDOWS_CERTIFICATE` CI secret. Tracked as a pre-public-release blocker. |
| WebView2 not pre-installed | Low — bootstrapper handles it | NSIS installer bundles a WebView2 bootstrapper. Silent install is disabled so the user sees the WebView2 installation prompt. |
| Full installer smoke not enforced on every PR/push | Low | `windows-installer-smoke` executes install/uninstall validation for `workflow_dispatch`, nightly schedule, and tag runs; run release cut through tag/workflow-dispatch gates. |
