---
phase: 04-app-controls
plan: 01
subsystem: services
requires: [app-registry, process-monitor, polished-ui]
provides: [app-launch, app-stop, bulk-actions]
affects: [05-preferences]
tags: [nsworkspace, nsrunningapplication, app-lifecycle]
key-decisions:
  - "0.5s delay in restart() for clean termination"
  - "Control buttons replace status text on hover"
key-files:
  - OptaMini/Models/OptaApp.swift
  - OptaMini/Services/ProcessMonitor.swift
  - OptaMini/ContentView.swift
tech-stack:
  added: [NSWorkspace.openApplication, NSRunningApplication.terminate]
  patterns: [app-lifecycle-control, hover-action-buttons]
---

# Phase 04-01 Summary: App Controls

## Accomplishments

### Task 1: Add appURL to OptaApp model
- Added `import AppKit` to OptaApp.swift
- Added `appURL` computed property
- Uses `NSWorkspace.shared.urlForApplication(withBundleIdentifier:)`
- Returns nil for apps not installed

### Task 2: Add control methods to ProcessMonitor
- Added `launch(_ app:)` — Opens app via `NSWorkspace.openApplication(at:configuration:)`
- Added `stop(_ app:)` — Finds running app and calls `terminate()`
- Added `restart(_ app:)` — Stops then launches after 0.5s delay
- Added `stopAll()` — Iterates all running Opta apps and stops each

### Task 3: Add control buttons to app rows
- Updated `AppRowView` with `onLaunch` and `onStop` closures
- Play button (▶) appears on hover for stopped apps
- Stop button (■) appears on hover for running apps
- Added `contentShape(Rectangle())` for full row tap detection
- Click row launches stopped apps

### Task 4: Add Quit All to footer
- Updated `FooterView` with `runningCount` and `onQuitAll` parameters
- "Quit All" button appears only when `runningCount > 0`
- Red text color (`.red.opacity(0.8)`) for destructive action
- Calls `processMonitor.stopAll()`

## Issues Encountered

None — straightforward API usage.

## Deviations from Plan

None.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 0.5s delay in restart | Allow clean app termination before relaunch | — Pending validation |
| Buttons on hover only | Keep UI clean, show controls when needed | — Pending validation |

## Next Phase Readiness

**Ready for Phase 5: Preferences**

Prerequisites met:
- [x] App launch functionality working
- [x] App stop functionality working
- [x] Quit All bulk action working
- [x] UI updates in real-time

No blockers identified.

## Commits

1. `feat(04-01): add appURL to OptaApp model for launching`
2. `feat(04-01): add launch, stop, restart methods to ProcessMonitor`
3. `feat(04-01): add control buttons and Quit All`

## Verification

- [x] `xcodebuild build` succeeds
- [x] Play button appears on hover for stopped apps
- [x] Stop button appears on hover for running apps
- [x] "Quit All" appears only when apps are running
- [x] Click row launches stopped app
