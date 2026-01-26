---
phase: 02-app-detection
plan: 01
subsystem: services
requires: [menu-bar-app, popover-infrastructure]
provides: [app-registry, process-monitor, app-status]
affects: [03-menu-ui, 04-app-controls]
tags: [nsworkspace, process-monitoring, combine]
key-decisions:
  - "Event-driven monitoring (no polling) for minimal CPU usage"
  - "Combine publishers for SwiftUI reactivity"
key-files:
  - OptaMini/Models/OptaApp.swift
  - OptaMini/Services/ProcessMonitor.swift
  - OptaMini/ContentView.swift
  - OptaMini/AppDelegate.swift
tech-stack:
  added: [NSWorkspace, Combine, NSRunningApplication]
  patterns: [ObservableObject, @Published, notification-subscription]
---

# Phase 02-01 Summary: App Detection

## Accomplishments

### Task 1: Create OptaApp model for ecosystem apps
- Created `OptaMini/Models/OptaApp.swift`
- Defined `OptaApp` struct with `Identifiable` and `Hashable` conformance
- Registered 3 Opta ecosystem apps:
  - Opta MacOS (`com.opta.OptaNative`)
  - Opta LM (`com.opta.OptaLM`)
  - Opta Scan (`com.opta.OptaScan`)
- Each app has: id, name, bundleIdentifier, icon (SF Symbol)

### Task 2: Create ProcessMonitor service with NSWorkspace
- Created `OptaMini/Services/ProcessMonitor.swift`
- `@MainActor` class with `ObservableObject` conformance
- `@Published appStatus` dictionary tracks running state per bundle ID
- Subscribed to `NSWorkspace.didLaunchApplicationNotification`
- Subscribed to `NSWorkspace.didTerminateApplicationNotification`
- Event-driven updates (no polling) for minimal resource usage

### Task 3: Integrate ProcessMonitor with ContentView
- Updated `ContentView` to accept `ProcessMonitor` via `@ObservedObject`
- Added `AppRowView` component showing:
  - Color-coded status indicator (green=running, gray=stopped)
  - App icon (SF Symbol)
  - App name
  - Status text ("Running" / "Stopped")
- Header shows running count: "X of Y apps running"
- Updated `AppDelegate` to inject `ProcessMonitor` into `ContentView`

### Task 4: Update Xcode project references
- Added `Models` group with `OptaApp.swift`
- Added `Services` group with `ProcessMonitor.swift`
- Both files added to Sources build phase

## Issues Encountered

None - implementation followed standard macOS patterns.

## Deviations from Plan

None.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Event-driven (no polling) | Minimize CPU/battery impact | — Pending validation |
| Combine publishers | SwiftUI reactivity, automatic UI updates | — Pending validation |
| @MainActor for ProcessMonitor | Thread safety for UI updates | — Pending validation |

## Next Phase Readiness

**Ready for Phase 3: Menu UI**

Prerequisites met:
- [x] App registry model defined
- [x] Process monitoring service operational
- [x] Real-time status updates working
- [x] UI displays app list with status

No blockers identified.

## Commits

1. `feat(02-01): add OptaApp model for ecosystem apps`
2. `feat(02-01): add ProcessMonitor service with NSWorkspace`
3. `feat(02-01): integrate ProcessMonitor with ContentView`
4. `feat(02-01): update Xcode project references`

## Verification

- [x] `xcodebuild build` succeeds
- [x] App list displays all 3 Opta ecosystem apps
- [x] Running apps show green indicator
- [x] Stopped apps show gray indicator
- [x] Status text updates appropriately
