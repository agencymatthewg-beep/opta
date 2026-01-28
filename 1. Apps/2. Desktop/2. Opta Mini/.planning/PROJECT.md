# Opta Mini

## What This Is

A lightweight macOS menu bar app that serves as the central hub for the Opta ecosystem. It provides quick access to launch Opta apps, monitors their health status, and offers unified control to start/stop/manage all apps from a single location.

## Core Value

**Ecosystem continuity** — One click access to see what's running, launch what you need, and control everything from a single, always-available menu bar icon.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Menu bar icon with status indicator (color-coded health: green/yellow/red)
- [ ] List of Opta apps with running/stopped status
- [ ] Quick launch for any Opta app
- [ ] Start/Stop/Restart controls for each running app
- [ ] "Quit All" bulk action
- [ ] Preferences panel for basic settings
- [ ] About section with version info
- [ ] Native macOS appearance matching system theme

### Out of Scope

- Notifications hub — v1 focuses on control, not aggregating notifications from other apps
- Deep settings management — Mini controls apps, doesn't configure their internals
- Auto-update mechanism — Will rely on manual updates initially

## Context

**Opta Ecosystem Apps:**
- Opta MacOS (OptaNative) — Desktop optimization/gaming app
- Opta iOS — Mobile companion
- OptaLMiOS — Life management iOS app
- opta-native — Rust core with Swift bindings

**Reference UI:** Syncthing menu bar app — clean status indicator, expandable sections, bulk controls, native macOS feel.

**Integration approach:** Will detect running Opta apps via process monitoring and potentially LaunchAgent/LaunchDaemon integration for managed lifecycle.

## Constraints

- **Tech stack**: Native Swift/SwiftUI only — no Electron, no web tech. Must be a proper macOS citizen.
- **Performance**: Minimal resource usage — menu bar apps should be invisible to system resources (<1% CPU, <50MB RAM).
- **Design**: Must match Opta design system — dark theme, subtle accents, premium feel.
- **Compatibility**: macOS 13+ (Ventura) to leverage modern SwiftUI menu bar APIs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native SwiftUI menu bar | Performance + native feel required | — Pending |
| Process monitoring for app detection | Simple, no IPC needed initially | — Pending |
| Syncthing-style UI pattern | Proven UX, user-requested reference | — Pending |

---
*Last updated: 2026-01-26 after initialization*
