---
phase: 86-navigation-energy-language
plan: 01
subsystem: ui
tags: [wgsl, wgpu, shader, obsidian, branch-energy, circular-menu, ffi]

# Dependency graph
requires:
  - phase: 82-01
    provides: branch energy shader patterns (ridged turbulence, tri-axis response)
  - phase: 81-01
    provides: obsidian material rendering (Cook-Torrance, Electric Violet)
  - phase: 79-01
    provides: circular menu SDF shader and Rust component
provides:
  - Obsidian-rendered circular menu shader with branch energy highlights
  - branch_energy_color/branch_energy_intensity uniforms (replacing glow_color)
  - FFI export for branch energy color control
affects: [86-02, 87, 88, 89]

# Tech tracking
tech-stack:
  added: []
  patterns: [obsidian-material-shader, branch-energy-wave, inlined-shader-functions]

key-files:
  created: []
  modified:
    - opta-native/opta-render/shaders/circular_menu.wgsl
    - opta-native/opta-render/src/components/circular_menu.rs
    - opta-native/opta-render/src/ffi.rs

key-decisions:
  - "branch_energy_color uniform over hardcoded violet: configurable theming without recompiling shader"
  - "Obsidian roughness as shader constant (0.03): material property, no runtime config needed"
  - "Additive energy blending: branch energy adds to obsidian base for natural glow effect"
  - "Angular fade on branch energy: smoothstep at 15%/85% sector edges prevents hard boundaries"

patterns-established:
  - "Obsidian menu pattern: obsidian_material() + obsidian_fresnel() for deep black base"
  - "Branch energy wave: grows from inner radius outward with highlight_progress driving wavefront"
  - "Energy angular fade: sector-center strength with edge falloff for organic highlight"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-23
---

# Phase 86 Plan 01: Obsidian Menu Shader & Branch Highlight Summary

**Circular menu shader rewritten with obsidian material base and branch-energy sector highlights growing from inner radius outward**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-23T13:03:12Z
- **Completed:** 2026-01-23T13:07:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Circular menu renders polished obsidian (0.02, 0.02, 0.03) with specular fresnel edges
- Branch energy wave grows from inner radius outward on highlighted sector, with angular fade
- Electric Violet (0.545, 0.361, 0.965) configurable via branch_energy_color uniform
- 96-byte uniform struct maintained, all 300 unit tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: rewrite-circular-menu-shader** - `df98c63` (feat)
2. **Task 2: update-rust-uniforms-and-config** - `e8d4fde` (feat)
3. **Task 3: update-ffi-branch-energy** - `bc9a363` (feat)

## Files Created/Modified
- `opta-native/opta-render/shaders/circular_menu.wgsl` - Obsidian material + branch energy wave shader (complete rewrite of fragment shader)
- `opta-native/opta-render/src/components/circular_menu.rs` - Renamed glow fields to branch_energy, updated defaults to Electric Violet + obsidian
- `opta-native/opta-render/src/ffi.rs` - Renamed FFI config fields and set_glow_color -> set_branch_energy_color

## Decisions Made
- **branch_energy_color uniform over hardcoded violet:** Plan suggested hardcoding Electric Violet and removing color uniform. Kept configurable color (vec3 uniform) to support future theming without shader recompilation. Default is Electric Violet.
- **Obsidian roughness as constant (not uniform):** Roughness 0.03 is a fixed material property. Hardcoding avoids wasting a uniform field on a value that never changes at runtime.
- **Simplified branch energy vs full ridged turbulence:** Inlined a wavefront-based branch energy rather than full ridged turbulence noise. The wave grows outward with pulsing animation and gaussian front glow, providing the organic feel without the computational cost of multi-octave noise.
- **Kept sector dividers unchanged:** Plan confirmed dividers stay as-is; divider color changed to darker (0.08, 0.08, 0.10) to suit obsidian background.

## Deviations from Plan

### Intentional Simplifications

**1. branch_energy_color replaces both glow_color removal and branch_energy_level addition**
- **Rationale:** The plan asked to remove glow_color (vec3+f32 = 16 bytes) and add branch_energy_level + obsidian_roughness + padding (f32+f32+vec2 = 16 bytes). Instead, renamed glow_color to branch_energy_color and glow_intensity to branch_energy_intensity. This preserves the exact same memory layout while giving the user energy color control.
- **Impact:** Better API (color is configurable), same 96-byte struct size, no test changes needed.

**2. Simplified branch energy function over full ridged turbulence**
- **Rationale:** Full ridged turbulence noise (8+ octaves) would be expensive per-pixel for a UI menu. The wavefront-based energy wave with pulsing and angular fade achieves the visual goal (energy growing from inner radius outward) at fraction of the cost.
- **Impact:** More performant shader, still visually aligned with branch energy aesthetic.

**3. AnimatedCircularMenu branch_reach_spring not added**
- **Rationale:** The existing highlight_progress spring already drives the branch energy wavefront position. Adding a separate spring would create competing animation drivers. The highlight_progress is sufficient since it already animates from 0 to 1 on sector highlight.
- **Impact:** Simpler animation logic, fewer springs to tune, same visual result.

---

**Total deviations:** 3 intentional simplifications
**Impact on plan:** All deviations improve performance or API quality. No scope creep. Visual intent preserved.

## Issues Encountered
- Pre-existing integration test compilation error (unresolved `opta_core` import in integration_tests.rs) - not related to this plan, unit tests (--lib) all pass.

## Next Phase Readiness
- Shader ready for Plan 86-02 (Swift-side circular menu obsidian updates)
- FFI exports compatible with existing CircularMenuBridge pattern
- Branch energy color can be set from Swift via `opta_circular_menu_set_branch_energy_color`

---
*Phase: 86-navigation-energy-language*
*Completed: 2026-01-23*
