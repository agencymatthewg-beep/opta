---
phase: 69-opta-core-integration
plan: 01
subsystem: ffi
tags: [uniffi, swift, rust, bindings, xcode]

# Dependency graph
requires:
  - phase: 60-wgpu-rendering
    provides: opta-render library with C FFI exports
  - phase: 63-crux-elm-architecture
    provides: opta-core with Crux model/event/effect pattern
provides:
  - UniFFI-generated Swift bindings for opta-core
  - generate-swift-bindings.sh script for binding regeneration
  - uniffi-bindgen binary in opta-core for binding generation
  - Xcode project configured for Swift/Rust FFI
affects: [69-02-shell-implementation, 70-ios-shell, macos-native-app]

# Tech tracking
tech-stack:
  added: [uniffi 0.28+ library-mode binding generation]
  patterns: [proc-macro exports with #[uniffi::export], modulemap-based C imports]

key-files:
  created:
    - opta-native/scripts/generate-swift-bindings.sh
    - opta-native/opta-core/src/bin/uniffi-bindgen.rs
    - opta-native/OptaApp/OptaApp/Generated/OptaCore.swift
    - opta-native/OptaApp/OptaApp/Generated/opta_coreFFI.h
    - opta-native/OptaApp/OptaApp/Generated/opta_coreFFI.modulemap
    - opta-native/OptaApp/OptaApp.xcodeproj/project.pbxproj
  modified:
    - opta-native/opta-core/Cargo.toml
    - opta-native/OptaApp/OptaApp/Bridge/OptaRender-Bridging-Header.h

key-decisions:
  - "UniFFI 0.28+ library-mode: Generate bindings from compiled dylib, not UDL file"
  - "Module import via modulemap: Swift imports optaFFI module for C types"
  - "Bridging header includes opta_coreFFI.h for type availability"

patterns-established:
  - "UniFFI binding regeneration: Run scripts/generate-swift-bindings.sh after opta-core API changes"
  - "Swift FFI type access: Include header in bridging header, modulemap in SWIFT_INCLUDE_PATHS"

issues-created: []

# Metrics
duration: 35min
completed: 2026-01-21
---

# Phase 69-01: Swift Bindings Setup Summary

**UniFFI-generated Swift bindings for opta-core with OptaCore class, haptic/sound enums, and Xcode project integration**

## Performance

- **Duration:** 35 min
- **Started:** 2026-01-21T11:24:56Z
- **Completed:** 2026-01-21T11:59:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Created generate-swift-bindings.sh that builds opta-core and generates Swift bindings via UniFFI library-mode
- Generated OptaCore.swift with full type-safe wrappers for processEvent, getViewModelJson, getModelJson, getModelSlice, isReady
- Generated FfiHapticPattern and FfiSoundEffect enums for shell feedback
- Configured Xcode project with SWIFT_INCLUDE_PATHS for modulemap discovery
- Verified Swift bindings compile correctly with modulemap via swiftc -typecheck

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dedicated Swift bindings generation script** - `5dcccdb` (feat)
2. **Task 2: Add generated Swift bindings to OptaApp** - `9c67af7` (feat)
3. **Task 3: Configure Xcode project for UniFFI integration** - `efe836a` (feat)

## Files Created/Modified

**Created:**
- `opta-native/scripts/generate-swift-bindings.sh` - Script to build opta-core and generate Swift bindings
- `opta-native/opta-core/src/bin/uniffi-bindgen.rs` - Binary for UniFFI binding generation
- `opta-native/OptaApp/OptaApp/Generated/OptaCore.swift` - UniFFI-generated Swift wrappers
- `opta-native/OptaApp/OptaApp/Generated/opta_coreFFI.h` - C header for FFI types
- `opta-native/OptaApp/OptaApp/Generated/opta_coreFFI.modulemap` - Module map for Swift import
- `opta-native/OptaApp/OptaApp.xcodeproj/project.pbxproj` - Xcode project file
- `opta-native/OptaApp/OptaApp/Libraries/.gitignore` - Ignore built Rust libraries

**Modified:**
- `opta-native/opta-core/Cargo.toml` - Added [[bin]] section for uniffi-bindgen
- `opta-native/OptaApp/OptaApp/Bridge/OptaRender-Bridging-Header.h` - Include opta_coreFFI.h
- `opta-native/OptaApp/OptaApp/Utilities/LaunchAtLogin.swift` - Added AppKit import

## Decisions Made

1. **UniFFI 0.28+ library-mode binding generation**: Generate bindings from compiled dylib rather than UDL file. This allows proc-macro exports (#[uniffi::export]) to be properly discovered.

2. **Module-based C import**: Use modulemap to expose optaFFI module rather than direct header import. This is the standard UniFFI pattern for Swift integration.

3. **Bridging header augmentation**: Include opta_coreFFI.h in existing OptaRender-Bridging-Header.h to make C types available to Swift without module import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Modulemap header path mismatch**
- **Found during:** Task 3 (Xcode project configuration)
- **Issue:** Generated modulemap referenced optaFFI.h but we renamed to opta_coreFFI.h
- **Fix:** Updated modulemap and script to fix header path on copy
- **Files modified:** opta_coreFFI.modulemap, generate-swift-bindings.sh
- **Verification:** swiftc -typecheck succeeds
- **Committed in:** efe836a (Task 3 commit)

**2. [Blocking] Missing AppKit import**
- **Found during:** Task 3 (Xcode build verification)
- **Issue:** LaunchAtLogin.swift used NSWorkspace without importing AppKit
- **Fix:** Added `import AppKit` to LaunchAtLogin.swift
- **Files modified:** LaunchAtLogin.swift
- **Verification:** Xcode compiles Swift sources
- **Committed in:** efe836a (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** Both fixes necessary for build success. No scope creep.

## Issues Encountered

1. **Static library vs dylib symbol exports**: UniFFI symbols are exported in the dylib but not visible in the static library. For full Xcode linking, either use dylib or ensure proper linker flags. This is a pre-existing architecture consideration, not a blocker for this plan.

2. **Pre-existing opta-render FFI mismatch**: The bridging header declares `opta_render_create` but the library exports `opta_render_init`. This is unrelated to opta-core integration and exists prior to this work.

## Next Phase Readiness

**Ready for 69-02:**
- OptaCore.swift provides type-safe Swift API
- processEvent() / getViewModelJson() methods ready for shell implementation
- FfiHapticPattern / FfiSoundEffect enums available for feedback implementation

**Prerequisites for full build:**
- Build and copy libopta_core.a to OptaApp/Libraries (run generate-swift-bindings.sh)
- Resolve opta-render FFI symbol naming (separate task)

---
*Phase: 69-opta-core-integration*
*Completed: 2026-01-21*
