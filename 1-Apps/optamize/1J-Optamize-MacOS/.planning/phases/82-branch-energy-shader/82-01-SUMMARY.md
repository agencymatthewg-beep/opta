# Plan 82-01 Summary: Branch Energy Shader

## Status: COMPLETE

## What Was Done

### Task 1: branch_energy.wgsl Shader Include
- Created `opta-native/opta-render/shaders/includes/branch_energy.wgsl`
- `BranchParams` struct for controlling branch appearance
- `branch_equator_mask()` — branches strongest at tube equator (v=0.5)
- `branch_phase_offset()` — per-branch timing offset for organic pulsing
- `branch_tri_axis()` — energy drives reach/width/brightness independently
- `branch_width_mask()` — concentrates energy into narrow veins
- `branch_noise_field()` — 3D ridged turbulence with threshold revelation
- `branch_energy()` — combines all masks for final intensity
- `branch_color()` — Electric Violet base with white-hot core blending

### Task 2: Ring Shader Integration
- Updated `opta-native/opta-render/shaders/ring.wgsl`
- Added `#include "noise_hd.wgsl"` and `#include "branch_energy.wgsl"`
- Removed old `internal_plasma()` and `plasma_color()` functions
- Added 4 branch uniform fields to RingUniforms (threshold, scale, speed, count)
- `fs_main` — standard branch energy with threshold revelation
- `fs_main_hq` — domain-warped UVs + higher scale for organic detail
- `fs_main_lq` — unchanged (simple Fresnel glow, no branch computation)

### Task 3: Rust Struct and Test Updates
- `RingUniforms` extended to 192 bytes (+16 bytes for 4 branch floats)
- Fields: `branch_threshold`, `branch_scale`, `branch_speed`, `branch_count`
- `branch_threshold` is dynamically derived: `1.0 - energy * 0.7`
- `RingConfig` extended with `branch_scale`, `branch_speed`, `branch_count`
- `with_quality()` adjusts branch_count by quality level (6/8/10)
- All integration tests updated for new struct layouts
- All 13 ring integration tests pass
- All 38 ring-related unit tests pass

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Ridged turbulence over standard FBM | Creates sharp vein-like structures matching branch energy aesthetic |
| Equator-origin masking | Branches emanate from ring equator (v=0.5), fade toward tube edges |
| Threshold revelation from energy | Low energy = high threshold = few branches; high energy reveals many |
| Per-branch phase offsets | Each branch pulses independently for organic, non-synchronized feel |
| Tri-axis response | Length, width, and brightness scale independently with energy |
| Domain-warped UVs in HQ only | Organic feel without cost in standard mode |
| Dynamic branch_threshold in Rust | `1.0 - energy * 0.7` drives revelation without extra state |
| Quality-scaled branch_count | Low=6, Medium=8, High/Ultra=10 branches |

## Metrics

- Build: `cargo build --release -p opta-render` -- SUCCESS
- Tests: 13/13 integration, 38/38 unit ring tests -- ALL PASS
- Struct size: 176 -> 192 bytes (16-byte aligned, GPU-compatible)
- Commits: 3 atomic commits

## Files Changed

| File | Change |
|------|--------|
| `opta-native/opta-render/shaders/includes/branch_energy.wgsl` | NEW (154 lines) |
| `opta-native/opta-render/shaders/ring.wgsl` | Modified (plasma -> branch energy) |
| `opta-native/opta-render/src/components/ring.rs` | Modified (RingUniforms + RingConfig) |
| `opta-native/opta-render/tests/ring_test.rs` | Modified (updated struct literals) |
