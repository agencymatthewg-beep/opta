---
phase: 03-menu-ui
plan: 01
subsystem: ui
requires: [app-registry, process-monitor, app-status]
provides: [dynamic-menu-icon, polished-ui, footer-actions]
affects: [04-app-controls, 05-preferences]
tags: [swiftui, menu-bar, ui-polish]
key-decisions:
  - "Filled vs outline icon to indicate running state"
  - "Hover highlighting for interactive feel"
key-files:
  - OptaMini/Services/ProcessMonitor.swift
  - OptaMini/AppDelegate.swift
  - OptaMini/ContentView.swift
tech-stack:
  added: []
  patterns: [EcosystemStatus-enum, hover-state, Combine-subscription]
---

# Phase 03-01 Summary: Menu UI

## Accomplishments

### Task 1: Add dynamic menu bar icon based on ecosystem status
- Added `EcosystemStatus` enum to ProcessMonitor with states:
  - `allRunning` - All apps running
  - `someRunning` - Some apps running
  - `noneRunning` - No apps running
- Icon changes based on status:
  - `circle.grid.2x2.fill` when any app is running
  - `circle.grid.2x2` (outline) when no apps running
- Added `ecosystemStatus` computed property

### Task 2: Add hover effect to app rows
- Added `@State isHovered` to AppRowView
- Subtle gray background highlight on hover
- Used `RoundedRectangle` with 6pt corner radius
- Smooth visual feedback matching native macOS behavior

### Task 3: Add footer with Quit button
- Created `FooterView` component
- Right-aligned Quit button
- Plain button style with secondary text color
- Calls `NSApplication.shared.terminate(nil)`

### Task 4: Adjust popover size and visual polish
- Reduced popover size from 300x400 to 280x300
- Refined font sizes (14pt header, 13pt app names, 11pt status)
- Improved spacing throughout layout
- Added Combine observer to update icon in real-time

## Issues Encountered

- **Main actor isolation error**: `ecosystemStatus` couldn't be accessed from non-isolated context
  - **Fix**: Added `@MainActor` annotation to `updateMenuBarIcon()` method

## Deviations from Plan

None.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Filled vs outline icon | Clear visual distinction between active/inactive | — Pending validation |
| 280x300 popover size | Compact, focused UI without wasted space | — Pending validation |

## Next Phase Readiness

**Ready for Phase 4: App Controls**

Prerequisites met:
- [x] Dynamic menu bar icon working
- [x] Polished app list with hover effects
- [x] Footer in place (ready for additional controls)
- [x] Quit functionality working

No blockers identified.

## Commits

1. `feat(03-01): add dynamic menu bar icon based on ecosystem status`
2. `feat(03-01): observe status changes and update menu bar icon`
3. `feat(03-01): add hover effects and footer with Quit button`

## Verification

- [x] `xcodebuild build` succeeds
- [x] Menu bar icon changes based on running apps
- [x] App rows highlight on hover
- [x] Quit button terminates app
- [x] UI feels native to macOS
