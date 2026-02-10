# Plan 43-03 Summary: Synergy Calculation Data

## Status: COMPLETE

## Execution Time
- Started: 2026-01-18
- Completed: 2026-01-18

## Files Created

### 1. optimal-combinations.json
**Path:** `.planning/research/knowledge/settings/synergies/optimal-combinations.json`

**Content:** 25 goal-oriented synergy entries covering:

| Goal Category | Entries | Description |
|---------------|---------|-------------|
| **Maximum FPS** | 4 | DLSS/FSR + render scale, frame cap + vsync, Apple Silicon core routing |
| **Visual Quality** | 4 | TAA + sharpening, RT combos, film grain masking, native HUD |
| **Battery Life** | 4 | Low power modes, ProMotion 60Hz, Metal triple buffering |
| **Balanced Performance** | 4 | DLSS Balanced combos, 1440p-to-4K upscaling, 60fps + high quality |
| **Competitive Gaming** | 4 | Low settings + high refresh, disabled blur effects, NVIDIA Reflex |
| **Platform-Specific** | 5 | MetalFX, Apple Silicon power modes, VRAM efficiency, HDR |

### 2. quality-profiles.json
**Path:** `.planning/research/knowledge/settings/synergies/quality-profiles.json`

**Content:** 20 quality tier synergy entries covering:

| Profile Category | Entries | Description |
|-----------------|---------|-------------|
| **Low Profile** | 3 | Minimal impact disables, scale-down order, texture exceptions |
| **Medium Profile** | 3 | Sweet spot combos, FSR efficiency, keep vs reduce guide |
| **High Profile** | 3 | Coherent lighting settings, RT complements, expensive skips |
| **Ultra Profile** | 3 | Stacking RT effects, diminishing returns, path tracing |
| **Custom Profiles** | 5 | High textures + medium rest, matching rules, resolution priority |
| **Hardware Tier** | 3 | Entry/mid/high-end GPU recommendations |

## Verification Results

```
optimal-combinations.json: Valid JSON with 25 synergy entries
quality-profiles.json: Valid JSON with 20 profile synergy entries
```

## Checklist

- [x] optimal-combinations.json is valid JSON
- [x] Contains 25 goal-oriented synergy entries (exceeds 20+ requirement)
- [x] quality-profiles.json is valid JSON
- [x] Contains 20 quality profile entries (exceeds 15+ requirement)
- [x] Synergies cover FPS, quality, battery, balanced, competitive goals
- [x] Each entry includes goal/profile context and combinedEffect/recommendations

## Key Synergy Patterns Documented

1. **Upscaling Synergies**
   - DLSS/FSR modes pair with specific quality settings
   - MetalFX Temporal optimal with medium preset
   - Native AA disabled when using reconstruction upscalers

2. **Lighting Coherence**
   - Shadows, lighting, and reflections should match tiers
   - RT effects complement high rasterized settings
   - AO can be reduced when RT shadows provide contacts

3. **Platform-Specific**
   - Apple Silicon: E-core routing, Low Power Mode, ProMotion
   - Windows: NVIDIA Reflex, DLSS Ray Reconstruction
   - Universal: FSR works everywhere, frame pacing

4. **Hardware-Aware Profiles**
   - Entry GPU: Low + FSR Performance @ 60fps
   - Mid GPU: High + DLSS Balanced @ 1440p
   - High-end: Ultra + RT + DLSS Quality @ 4K

## Dependencies Satisfied

- Built upon 43-01 schema (settings-schema.json)
- Ready for Phase 47 optimal recommendation computation
- Can be consumed by Settings Interaction Engine

## Next Steps

- Plan 43-04: Settings tradeoff documentation
- Plan 43-05: Conflict detection data
