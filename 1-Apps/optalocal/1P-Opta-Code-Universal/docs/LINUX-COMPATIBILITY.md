# Opta Code Desktop Linux Compatibility Contract

Last updated: 2026-03-02

This document defines what is considered Linux-compatible for `1P-Opta-Code-Universal` and what evidence is required before release.

## Scope

Target runtime:
- Linux desktop app built with Tauri v2 (`x86_64-unknown-linux-gnu`)
- Frontend bundle from Vite + React
- Opta daemon connectivity over HTTP/WebSocket

## Capability Matrix

| Capability | Linux status | Notes |
| --- | --- | --- |
| Desktop shell launch (AppImage/deb) | Supported | Verified by Linux build + artifact checks in CI. |
| Daemon connection (host/port/token) | Supported | Endpoint is bootstrapped from native daemon metadata and secure-store state; editable in app header form. |
| Session cockpit (create/track/stream/cancel) | Supported | Uses daemon v3 stream/events endpoints. |
| Operations page | Supported | Daemon-backed operation endpoints only. |
| Background jobs page | Supported | Requires a valid daemon session ID for background job starts. |
| Models page / LMX status display | Conditional | Works when daemon-side LMX services are reachable; otherwise UI shows unreachable/error state. |
| Token persistence security | Conditional | In Tauri runtime, token is persisted via native keyring backend (`keyring` v3). In browser/dev-only mode, fallback remains localStorage. |

## Out of Scope (Linux Contract)

- Distribution-specific packaging/signing policy beyond generated AppImage/deb artifacts.
- Guaranteeing LMX service availability; this app surfaces daemon-provided status and errors but does not provision LMX itself.
- ARM Linux packaging/signing in current CI pipeline (`x86_64` only).

## Runtime and Packaging Notes

- Supported display backends: X11 and Wayland, subject to system WebKitGTK compatibility.
- CI installs system dependencies required by Tauri/WebKitGTK builds:
  - `libwebkit2gtk-4.1-dev`
  - `libgtk-3-dev`
  - `libayatana-appindicator3-dev`
  - `librsvg2-dev`
  - `patchelf`
- Native daemon/session persistence now resolves config roots using the same cross-platform convention as Opta CLI:
  - Linux: `$XDG_CONFIG_HOME/opta` (fallback: `~/.config/opta`)

## Graceful Behavior Requirements

- If secure-store bridge is unavailable, app must continue with browser-compatible fallback behavior.
- If models/LMX backend is unavailable, app must show non-crashing status/error state.
- If daemon is offline, app must remain usable for connection reconfiguration and retry.
- If daemon drops mid-session, app must show reconnect overlay and auto-recover when daemon returns.

## Required CI Evidence

Release readiness for Linux requires a successful run of `.github/workflows/opta-code-linux-build.yml` with:
- `unit-tests`: success
- `linux-build`: success
- `linux-smoke`: success
- `linux-release-readiness`: success

Required artifacts:
- `opta-code-linux-bundle`
- `opta-code-linux-smoke-logs`

## Local Validation Gate

Before claiming Linux readiness locally, run:

```bash
npm run check:desktop
```

If touching Rust/Tauri token bridge behavior, additionally run:

```bash
cd src-tauri
cargo test connection_secrets -- --nocapture
```

## Known Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| WebKitGTK version mismatch on end-user distro | Medium | Distribute AppImage/deb and document runtime dependencies; validate on Ubuntu LTS baseline. |
| No ARM Linux CI coverage | Low | Add `aarch64-unknown-linux-gnu` matrix when ARM support becomes release requirement. |
| Native keyring backend differences across distros/desktop environments | Low | Keep secure-store fallback path and surface recoverable errors in settings/runtime panel. |
