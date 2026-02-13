---
phase: 90-visual-cohesion-launch
plan: 01
subsystem: ui
tags: [swiftui, color-temperature, environment, theming]

# Dependency graph
requires:
  - phase: 89-color-temperature-refinement
    provides: ColorTemperature.swift, ColorTemperatureEnvironment.swift, @Environment(\.colorTemperature) pattern
provides:
  - All remaining view files converted from hardcoded Color(hex: "8B5CF6") to colorTemp environment
  - SparklineView optional color parameter API
  - CircularMenuNavigation uses ColorTemperatureState.active.violetColor
  - Zero remaining hardcoded 8B5CF6 in view layer (only source-of-truth definitions remain)
affects: [90-02-visual-cohesion-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: [optional-color-parameter-with-environment-fallback, max-glowOpacity-for-dormant-visibility]

key-files:
  modified:
    - opta-native/OptaApp/OptaApp/Views/Games/GameDetailView.swift
    - opta-native/OptaApp/OptaApp/Views/Games/GamesLibraryView.swift
    - opta-native/OptaApp/OptaApp/Views/Settings/ProfileManagerView.swift
    - opta-native/OptaApp/OptaApp/Views/Settings/KeyboardShortcutsView.swift
    - opta-native/OptaApp/OptaApp/Views/SettingsView.swift
    - opta-native/OptaApp/OptaApp/MenuBar/MenuBarView.swift
    - opta-native/OptaApp/OptaApp/MenuBar/MenuBarIcon.swift
    - opta-native/OptaApp/OptaApp/Views/Components/SparklineView.swift
    - opta-native/OptaApp/OptaApp/Navigation/CircularMenuNavigation.swift

key-decisions:
  - "SparklineView color parameter changed from Color to Color? with nil default resolving via colorTemp.violetColor"
  - "MenuBar views use max(colorTemp.glowOpacity, 0.4) ensuring minimum visibility in dormant state"
  - "CircularMenuDestination enum uses ColorTemperatureState.active.violetColor since enums cannot use @Environment"
  - "ProfileEditorSheet and ShortcutRecorderSheet receive their own @Environment declarations as separate View structs"
  - "Stroke/border opacities normalized to colorTemp.glowOpacity * factor pattern (0.2 for subtle, 0.3 for medium)"

patterns-established:
  - "Optional color with environment fallback: init(color: Color? = nil), var resolvedColor: Color { color ?? colorTemp.violetColor }"
  - "Dormant visibility floor: max(colorTemp.glowOpacity, 0.4) ensures menu bar elements visible at all temperature states"
  - "Enum color via static state: ColorTemperatureState.active.violetColor for non-View contexts that need temperature-aware color"

issues-created: []

# Metrics
duration: 12min
completed: 2026-01-24
---

# Plan 90-01: Color Temperature Conversion Summary

**Eliminated all remaining hardcoded Color(hex: "8B5CF6") references across 9 view files, establishing full color temperature environment coverage with dormant-visibility floor for menu bar elements**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-24T10:05:00Z
- **Completed:** 2026-01-24T10:17:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- All 51 hardcoded `Color(hex: "8B5CF6")` references converted across games, settings, menu bar, and utility views
- SparklineView API improved with optional color parameter that falls back to color temperature environment
- Menu bar views maintain minimum visibility via `max(glowOpacity, 0.4)` floor in dormant state
- Build succeeds with zero compilation warnings related to these changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Games Views** - `5269d7a` (refactor) - GameDetailView (16 refs), GamesLibraryView (8 refs)
2. **Task 2: Settings Views** - `f5cd5a0` (refactor) - ProfileManagerView (10 refs), KeyboardShortcutsView (6 refs), SettingsView (2 refs)
3. **Task 3: Menu Bar & Utilities** - `a78b69d` (refactor) - MenuBarView (4 refs), MenuBarIcon (1 ref), SparklineView (3 refs), CircularMenuNavigation (1 ref)

## Files Modified
- `opta-native/OptaApp/OptaApp/Views/Games/GameDetailView.swift` - Section headers, strokes, fills, chart colors, ProfileEditorSheet buttons
- `opta-native/OptaApp/OptaApp/Views/Games/GamesLibraryView.swift` - Scan button, search stroke, platform pills, empty/no-results states
- `opta-native/OptaApp/OptaApp/Views/Settings/ProfileManagerView.swift` - Create button tint, ProfileRowView icon/stroke/badges
- `opta-native/OptaApp/OptaApp/Views/Settings/KeyboardShortcutsView.swift` - Shortcut badge stroke, recorder icon/border/modifier/save
- `opta-native/OptaApp/OptaApp/Views/SettingsView.swift` - SettingsRowView icon stroke and foreground
- `opta-native/OptaApp/OptaApp/MenuBar/MenuBarView.swift` - Agent text, eye icon, AGENT badge text/background with dormant floor
- `opta-native/OptaApp/OptaApp/MenuBar/MenuBarIcon.swift` - Agent ring gradient colors
- `opta-native/OptaApp/OptaApp/Views/Components/SparklineView.swift` - Optional color parameter, resolvedColor computed property
- `opta-native/OptaApp/OptaApp/Navigation/CircularMenuNavigation.swift` - Enum color via ColorTemperatureState.active.violetColor

## Decisions Made
- SparklineView color parameter made `Color?` (nil) default instead of hardcoded hex, with internal `resolvedColor` computed property
- MenuBar elements use `max(colorTemp.glowOpacity, 0.4)` floor matching 89-03 pattern for dormant state visibility
- CircularMenuDestination enum references `ColorTemperatureState.active.violetColor` since enums cannot use `@Environment`
- Separate View structs (ProfileEditorSheet, ShortcutRecorderSheet, ProfileRowView, SettingsRowView) each get their own `@Environment(\.colorTemperature)` declaration
- Stroke/border opacities use `colorTemp.glowOpacity * normalized_factor` pattern consistently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness
- All view-layer files now consume color temperature environment
- Remaining 8B5CF6 references are source-of-truth definitions (ColorTemperature.swift, OptaTextStyle.swift), model data (Game.swift), theme customization options (ThemeCustomizationView.swift), and comments
- Ready for 90-02 (visual cohesion verification and launch polish)

---
*Phase: 90-visual-cohesion-launch*
*Completed: 2026-01-24*
