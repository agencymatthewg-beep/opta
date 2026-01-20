# Plan 43-04 Summary: Impact Propagation Data

## Status: COMPLETE

## What Was Built

Created impact propagation data showing how changing one setting affects others - critical for the user's vision of understanding "if I enable this, what else changes?"

### Files Created/Modified

| File | Status | Entries |
|------|--------|---------|
| `.planning/research/knowledge/settings/tradeoffs/ray-tracing.json` | Verified | 20 entries |
| `.planning/research/knowledge/settings/tradeoffs/apple-silicon.json` | Created | 24 entries |

## Ray Tracing Cascades (20 entries)

Documents RT feature interdependencies and performance cascade effects:

### RT Reflection Chain
- Hardware RT support dependency (M3+)
- VRAM cost (+2-4GB typical)
- Resolution compounding (4K + RT = heavy)
- Quality level linear scaling

### RT Shadows Chain
- Shadow map replacement (not additive)
- Outdoor/open-world cost multiplier
- Multiple light source cost multiplication
- Contact hardening as key visual benefit

### RT Global Illumination Chain
- Most expensive RT feature (-45% performance)
- Baked lighting removal synergy
- Combined BVH efficiency with reflections
- Bounce count dramatic quality/cost scaling

### RT Budget Guidelines
- M3 Pro: ~30% GPU headroom for RT
- M3/M4 Max: Full RT suite viable with upscaling
- Upscaling (DLSS/MetalFX) essential for RT
- 16GB+ recommended for multiple RT features

## Apple Silicon Settings (24 entries)

Documents macOS/Apple Silicon specific interactions:

### Metal API (4 entries)
- MetalFX Temporal vs Spatial trade-offs
- Triple buffering latency impact
- Shader precompilation benefits
- Async compute synergies

### Power Modes (4 entries)
- High Power Mode thermal unlock (+15% performance)
- Low Power Mode dramatic reduction (-40%)
- Automatic mode detection delay
- Plugged-in vs battery implications

### ProMotion Display (4 entries)
- 120Hz GPU headroom requirements
- VRR synergy benefits
- 60Hz lock for battery/easier targets
- MetalFX + ProMotion 120fps combo

### Unified Memory (4 entries)
- No separate VRAM - texture competition
- 8GB texture limit (Medium max)
- 16GB+ enables Ultra textures
- Memory pressure as early warning

### Thermal Management (3 entries)
- MacBook Air fanless throttling
- MacBook Pro sustained high settings
- Mac Studio/Pro no thermal concerns

### Translation Layer (2 entries)
- GPTK 20-30% overhead
- Additional memory requirements

### Display Concerns (3 entries)
- External display overhead
- Notch safe area handling
- Multiple display impact

## Cascade Query Examples

### "If I enable RT Reflections, what else changes?"
1. Requires hardware RT support (M3+)
2. VRAM usage increases 15-35%
3. GPU cost 15-20% at baseline
4. Compounds with resolution (4K = 40-55% cost)
5. Benefits from enabling upscaling
6. Pairs efficiently with RT Shadows (shared BVH)

### "If I set High Power Mode on MacBook Pro, what happens?"
1. Thermal headroom unlocked
2. High/Ultra settings become sustainable
3. 10-20% performance improvement
4. Power consumption increases 25-35%
5. Fan noise increases
6. 16-inch has more headroom than 14-inch

## Verification

```bash
# Ray tracing JSON validation
cat .planning/research/knowledge/settings/tradeoffs/ray-tracing.json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Valid JSON with {len(d.get(\"interactions\", []))} RT cascade entries')"
# Output: Valid JSON with 20 RT cascade entries

# Apple Silicon JSON validation
cat .planning/research/knowledge/settings/tradeoffs/apple-silicon.json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Valid JSON with {len(d.get(\"settings\", []))} Apple Silicon entries')"
# Output: Valid JSON with 24 Apple Silicon entries
```

## Key Insights Encoded

1. **RT features have non-linear costs** - Combining RT features is cheaper than expected due to shared BVH structures

2. **Apple Silicon gaming is power-mode dependent** - High Power Mode essential for gaming on MacBook Pro

3. **Memory constraints unique to UMA** - Traditional VRAM thinking doesn't apply; system memory pressure is the constraint

4. **MetalFX is the key enabler** - Upscaling critical for both RT and 120Hz targets on Apple Silicon

5. **Thermal design dictates ceiling** - MacBook Air fundamentally limited vs MacBook Pro vs Desktop

## Integration Points

This data powers:
- **Phase 47: Configuration Calculator** - Calculate optimal settings combinations
- **Conflict Detection** - Warn users of conflicting settings
- **"What If" Queries** - Show cascading effects before applying changes
- **Learn Mode** - Explain why settings interact the way they do

## Next Steps

- Plan 43-05: Build schema validation tools
- Future: Add game-specific interaction overrides
- Future: Integrate with telemetry for real-world validation
