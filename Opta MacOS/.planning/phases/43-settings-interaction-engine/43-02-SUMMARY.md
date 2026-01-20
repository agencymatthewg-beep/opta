# Plan 43-02 Summary: Cross-Setting Conflict Detection Rules

## Execution Status: COMPLETE

**Date**: 2026-01-18
**Wave**: 2
**Autonomous**: Yes

---

## Deliverables

### 1. Resolution/Upscaling Conflicts (`resolution-upscaling.json`)
- **Entries**: 18 conflict rules
- **Categories covered**:
  - Upscaling technology mutual exclusions (DLSS vs FSR vs XeSS vs MetalFX)
  - Upscaler vs native resolution conflicts
  - Anti-aliasing incompatibilities (TAA/MSAA with upscalers, FXAA+TAA redundancy)
  - Display mode conflicts (VRR vs fixed, V-Sync vs adaptive sync, ProMotion)
  - Scaling mode conflicts (integer vs fractional)
  - Frame generation timing conflicts (DLSS FG + V-Sync)

### 2. General Graphics Conflicts (`general-graphics.json`)
- **Entries**: 15 conflict rules
- **Categories covered**:
  - Shadow technique conflicts (RT shadows vs shadow maps)
  - Reflection technique conflicts (RT reflections vs SSR, planar vs cubemap)
  - Ambient occlusion conflicts (RTAO vs SSAO, SSAO vs HBAO+/GTAO)
  - Motion blur conflicts (per-object vs camera, motion blur + high refresh)
  - Post-processing conflicts (stacked sharpening, film grain + noise reduction)
  - Quality preset conflicts (custom settings breaking presets)
  - Overlapping effects (contact shadows + high SSAO)
  - Performance stacking conflicts (volumetrics, DOF+bokeh, tessellation+LOD)

---

## Schema Compliance

All entries follow `settings-schema.json` with:
- `type`: "conflict"
- `direction`: "excludes"
- `settings`: Array of 2+ setting references
- `relationship`: Human-readable explanation
- `confidence`: high/medium rating
- `platforms`: Applicable platforms
- `recommendations`: Optimization guidance

---

## Validation Results

```
resolution-upscaling.json: Valid JSON with 18 conflict entries
general-graphics.json: Valid JSON with 15 conflict entries
All entries have type="conflict" and direction="excludes"
All entries include relationship/reason fields
```

---

## Key Conflict Patterns Documented

1. **Mutual Exclusion**: Technologies that cannot coexist (DLSS vs FSR)
2. **Platform Exclusive**: Hardware/OS specific conflicts (DLSS vs MetalFX)
3. **Redundant Processing**: Effects that overlap wastefully (TAA + DLSS)
4. **Contradictory Effects**: Opposing post-processing (film grain + noise reduction)
5. **Performance Stacking**: Multiple expensive effects combining poorly
6. **Pipeline Incompatibility**: Rendering technique conflicts (MSAA + upscaling)

---

## Impact on Phase 47 Configuration Calculator

These conflict rules enable the Configuration Calculator to:
- Warn users before applying incompatible settings
- Auto-resolve conflicts with intelligent defaults
- Explain why certain setting combinations are problematic
- Suggest optimal alternatives based on hardware

---

## Files Modified

| File | Status |
|------|--------|
| `.planning/research/knowledge/settings/conflicts/resolution-upscaling.json` | Created |
| `.planning/research/knowledge/settings/conflicts/general-graphics.json` | Created |

---

## Next Steps

- Plan 43-03: Create dependency rules (settings that require other settings)
- Plan 43-04: Create trade-off rules (quality vs performance relationships)
- Plan 43-05: Create synergy rules (settings that work well together)
