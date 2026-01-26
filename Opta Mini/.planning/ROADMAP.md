# Roadmap: Opta Mini

## Overview

Build a lightweight macOS menu bar app that serves as the central hub for the Opta ecosystem. Starting with project foundation and menu bar infrastructure, then adding process detection to monitor running Opta apps, building out the menu UI with status indicators, implementing app lifecycle controls, adding preferences/about sections, and finishing with polish and performance optimization.

## Domain Expertise

None (standard macOS SwiftUI patterns)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Xcode project setup, menu bar app infrastructure
- [ ] **Phase 2: App Detection** - Process monitoring, app registry, status tracking
- [ ] **Phase 3: Menu UI** - Menu bar popover with app list and status indicators
- [ ] **Phase 4: App Controls** - Launch, stop, restart functionality for Opta apps
- [ ] **Phase 5: Preferences** - Settings panel and About section
- [ ] **Phase 6: Polish** - Design refinement, performance optimization, testing

## Phase Details

### Phase 1: Foundation
**Goal**: Working menu bar app skeleton with icon that appears in menu bar
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard Xcode/SwiftUI setup)
**Plans**: 1 (complete)

Key deliverables:
- Xcode project configured as menu bar app (no dock icon)
- Menu bar icon that shows/hides popover
- Basic SwiftUI view structure
- App runs at login capability

### Phase 2: App Detection
**Goal**: Detect and track running Opta ecosystem apps
**Depends on**: Phase 1
**Research**: Likely (NSRunningApplication, process monitoring)
**Research topics**: NSWorkspace notifications, process enumeration, bundle identifier matching
**Plans**: TBD

Key deliverables:
- AppRegistry model defining Opta ecosystem apps
- ProcessMonitor service using NSWorkspace
- Real-time detection of app launches/terminations
- Health status inference (running/stopped)

### Phase 3: Menu UI
**Goal**: Syncthing-style menu with app list and status indicators
**Depends on**: Phase 2
**Research**: Unlikely (SwiftUI patterns from Phase 1)
**Plans**: TBD

Key deliverables:
- Menu bar icon with color-coded status (green/yellow/red)
- Popover showing list of Opta apps
- Per-app status indicator (running/stopped)
- Native macOS appearance matching system theme

### Phase 4: App Controls
**Goal**: Launch, stop, restart Opta apps from menu
**Depends on**: Phase 3
**Research**: Likely (NSWorkspace open, NSRunningApplication terminate)
**Research topics**: NSWorkspace.open(), NSRunningApplication.terminate(), graceful shutdown patterns
**Plans**: TBD

Key deliverables:
- Launch button for stopped apps
- Stop/Restart controls for running apps
- "Quit All" bulk action
- Confirmation for destructive actions

### Phase 5: Preferences
**Goal**: Settings panel and About section
**Depends on**: Phase 4
**Research**: Unlikely (standard SwiftUI Settings scene)
**Plans**: TBD

Key deliverables:
- Preferences window (Settings scene)
- Launch at login toggle
- About section with version info
- Links to other Opta apps/resources

### Phase 6: Polish
**Goal**: Design refinement, performance, stability
**Depends on**: Phase 5
**Research**: Unlikely (internal refinement)
**Plans**: TBD

Key deliverables:
- Opta design system colors/typography
- Performance audit (<1% CPU, <50MB RAM)
- Menu bar icon states (normal, activity, warning)
- Final testing and bug fixes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-01-26 |
| 2. App Detection | 0/TBD | Not started | - |
| 3. Menu UI | 0/TBD | Not started | - |
| 4. App Controls | 0/TBD | Not started | - |
| 5. Preferences | 0/TBD | Not started | - |
| 6. Polish | 0/TBD | Not started | - |
