---
phase: 85-dashboard-obsidian-refresh
plan: 01
subsystem: render
tags: [ffi, wgpu, glass-panel, branch-energy, c-abi, opaque-pointer]

# Dependency graph
requires:
  - phase: 83-obsidian-panel-system
    provides: GlassPanel component with Cook-Torrance BRDF shader
  - phase: 84-energy-branch-components
    provides: BranchMeter, BranchIndicator, BranchBorder GPU components
provides:
  - C-compatible FFI exports for GlassPanel (9 functions)
  - C-compatible FFI exports for BranchMeter (6 functions)
  - C-compatible FFI exports for BranchIndicator (5 functions)
  - C-compatible FFI exports for BranchBorder (5 functions)
  - ffi_panels.rs module wired into lib.rs
affects: [85-02, 85-03, 86-settings-obsidian-ui, swift-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [opaque-pointer FFI, repr(C) config structs, let-else null guards]

key-files:
  created:
    - opta-native/opta-render/src/ffi_panels.rs
  modified:
    - opta-native/opta-render/src/ffi.rs
    - opta-native/opta-render/src/lib.rs

key-decisions:
  - "pub(crate) surface field visibility for cross-module FFI access"
  - "let...else pattern for null-pointer guards (clippy-compliant)"
  - "Module-level clippy::cast_precision_loss allow for u32-to-f32 resolution casts"
  - "Flattened config structs (position_x/y instead of arrays) for simpler C ABI"

patterns-established:
  - "Panel FFI pattern: OptaXxxConfig (repr(C)) + OptaXxx opaque struct + create/destroy/set/update/render"
  - "Render function pattern: null guard -> surface check -> get_current_texture -> encoder -> render pass -> submit -> present"
  - "Branch component render: queue + encoder + output_view + uniforms (no device parameter)"

issues-created: []

# Metrics
duration: 25min
completed: 2026-01-23
---

# Phase 85 Plan 01: FFI Panel Exports Summary

**25 C-compatible FFI functions exposing GlassPanel and Branch energy components (BranchMeter, BranchIndicator, BranchBorder) for Swift consumption via opaque-pointer pattern**

## Performance

- **Duration:** 25 min
- **Started:** 2026-01-23
- **Completed:** 2026-01-23
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created ffi_panels.rs module with 25 FFI functions covering 4 GPU components
- GlassPanel exposed with full lifecycle: create, destroy, position/size/energy/depth/quality setters, update, render
- BranchMeter, BranchIndicator, BranchBorder each exposed with create/destroy/set/update/render
- 17 null-pointer safety tests all passing
- All 300 existing lib tests pass (no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: GlassPanel FFI exports** - `dafcf43` (feat)
2. **Task 2: Branch component FFI exports** - `dafcf43` (feat)
3. **Task 3: Wire ffi_panels module into lib.rs** - `dafcf43` (feat)

_Note: All 3 tasks committed together as single atomic commit due to tight coupling._

## Files Created/Modified
- `opta-native/opta-render/src/ffi_panels.rs` - New module with 4 config structs, 4 opaque handle structs, 25 FFI functions, 17 tests
- `opta-native/opta-render/src/ffi.rs` - Changed `surface` field to `pub(crate)` for cross-module access
- `opta-native/opta-render/src/lib.rs` - Added `pub mod ffi_panels;` with `#[allow(clippy::cast_precision_loss)]`

## Decisions Made
- Used `pub(crate)` for surface field rather than accessor method (simpler, follows Rust idiom for crate-internal access)
- Flattened config struct fields (position_x/position_y instead of [f32;2]) for simpler C ABI compatibility
- Used `let...else` pattern instead of `match` for null-pointer/error guards (clippy-compliant)
- Applied `#[allow(clippy::cast_precision_loss)]` at module declaration level in lib.rs (u32->f32 for resolution is intentional)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Private surface field access**
- **Found during:** Task 1 (GlassPanel render function)
- **Issue:** `surface` field on `OptaRenderContext` was private, ffi_panels.rs couldn't access it
- **Fix:** Changed field to `pub(crate)` in ffi.rs
- **Files modified:** opta-native/opta-render/src/ffi.rs
- **Verification:** Build succeeds, all tests pass
- **Committed in:** dafcf43

**2. [Rule 3 - Blocking] Clippy let-else warnings**
- **Found during:** Task 2 (Branch component FFI)
- **Issue:** match expressions for Option/Result triggered clippy `manual_let_else` and `single_match` warnings
- **Fix:** Converted all 8 occurrences to `let Some(...) else` and `let Ok(...) else` patterns
- **Files modified:** opta-native/opta-render/src/ffi_panels.rs
- **Verification:** `cargo clippy -p opta-render` passes clean
- **Committed in:** dafcf43

---

**Total deviations:** 2 auto-fixed (both blocking), 0 deferred
**Impact on plan:** Both fixes necessary for compilation and clippy compliance. No scope creep.

## Issues Encountered
- FFI symbols not visible in release build via `nm` due to LTO optimization - verified in debug build instead (25 symbols confirmed with `T` section). LTO doesn't prevent linking, just renames/inlines symbols.
- Pre-existing integration test error (`integration_tests.rs` unresolved `opta_core` import) - unrelated, worked around with `--lib` test flag.

## Next Phase Readiness
- All 4 GPU components now have C-compatible FFI exports ready for Swift bridging
- Plans 85-02 and 85-03 can proceed to create Swift wrappers and integrate into dashboard views
- The opaque-pointer + config struct pattern is consistent with existing ffi.rs circular menu exports

---
*Phase: 85-dashboard-obsidian-refresh*
*Plan: 01*
*Completed: 2026-01-23*
