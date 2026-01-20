# Settings Interaction Database

This directory contains game settings interaction data for Opta's optimization intelligence. It models how settings affect each other - dependencies, conflicts, and performance trade-offs.

## Purpose

The Settings Interaction Database enables Opta to:

1. **Detect Dependencies** - Know when Setting A requires Setting B
2. **Identify Conflicts** - Recognize mutually exclusive settings
3. **Quantify Trade-offs** - Calculate when Setting A makes Setting B expensive
4. **Find Synergies** - Discover settings that work well together
5. **Power Phase 47** - Provide data for the Configuration Calculator

## Schema Reference

All settings files must conform to: `../schema/settings-schema.json`

Key schema elements:
- **settingInteraction** - A single settings relationship record
- **settingReference** - Reference format for settings (category:setting:value)
- **direction** - How settings relate: requires, excludes, affects, enhances
- **impactMetrics** - Effects on performance/quality/power/vram/latency

## Directory Structure

```
settings/
  README.md              # This file
  conflicts/             # Mutual exclusion and conflict data
  synergies/             # Settings that work well together
  tradeoffs/             # Performance vs quality trade-offs
```

## File Naming Conventions

Use descriptive kebab-case names that indicate the settings domain:

| Pattern | Example | Description |
|---------|---------|-------------|
| `resolution-upscaling.json` | Resolution and upscaling interactions | DLSS/FSR/MetalFX vs native resolution |
| `ray-tracing.json` | RT feature cascades | RT reflections, shadows, GI interactions |
| `apple-silicon.json` | macOS/Apple Silicon specific | Metal API, ProMotion, High Power Mode |
| `general-graphics.json` | Common graphics settings | Shadows, AA, texture quality, etc. |
| `{game}-specific.json` | Game-specific interactions | Unique to a particular game |

## Relationship Types

### 1. Dependency (`requires`)

Setting A requires Setting B to function.

**Example:** Ray Tracing reflections require a minimum shadow quality level.

```json
{
  "id": "rt-reflections-shadow-dependency",
  "type": "dependency",
  "direction": "requires",
  "settings": [
    { "category": "rt", "setting": "reflections", "value": "on" },
    { "category": "graphics", "setting": "shadows", "value": "medium" }
  ],
  "relationship": "RT Reflections require at least Medium shadow quality for proper reflection data"
}
```

### 2. Conflict (`excludes`)

Setting A and Setting B cannot be enabled simultaneously.

**Example:** DLSS and native resolution are mutually exclusive.

```json
{
  "id": "dlss-native-resolution-conflict",
  "type": "conflict",
  "direction": "excludes",
  "bidirectional": true,
  "settings": [
    { "category": "upscaling", "setting": "dlss", "value": "on" },
    { "category": "graphics", "setting": "render-scale", "value": "100" }
  ],
  "relationship": "DLSS renders at lower resolution then upscales; cannot use with native resolution"
}
```

### 3. Trade-off (`affects`)

Setting A at a certain value makes Setting B expensive/cheap.

**Example:** 4K resolution makes Ultra shadows significantly more expensive.

```json
{
  "id": "4k-ultra-shadows-tradeoff",
  "type": "tradeoff",
  "direction": "affects",
  "settings": [
    { "category": "graphics", "setting": "resolution", "value": "3840x2160" },
    { "category": "graphics", "setting": "shadows", "value": "ultra" }
  ],
  "relationship": "At 4K, Ultra shadows have 3x the shadow map resolution, causing significant GPU overhead",
  "impact": {
    "performance": { "value": -35, "min": -25, "max": -45 }
  }
}
```

### 4. Synergy (`enhances`)

Settings that work particularly well together.

**Example:** DLSS Quality mode + Ray Tracing provides good balance.

```json
{
  "id": "dlss-quality-rt-synergy",
  "type": "synergy",
  "direction": "enhances",
  "settings": [
    { "category": "upscaling", "setting": "dlss", "value": "quality" },
    { "category": "rt", "setting": "reflections", "value": "on" }
  ],
  "relationship": "DLSS Quality mode recovers performance lost to RT while maintaining visual quality"
}
```

## Setting Reference Format

Settings are referenced using a structured object:

```json
{
  "category": "graphics",     // Required: Category enum
  "setting": "resolution",    // Required: Setting identifier
  "value": "3840x2160"        // Optional: Specific value that triggers interaction
}
```

### Categories

| Category | Description | Example Settings |
|----------|-------------|------------------|
| `graphics` | General graphics | resolution, shadows, textures, aa |
| `rt` | Ray tracing | reflections, shadows, gi |
| `upscaling` | Upscaling tech | dlss, fsr, metalfx, xess |
| `display` | Display settings | vsync, refresh-rate, hdr |
| `power` | Power modes | high-power-mode, battery-saver |
| `metal` | Metal API specific | triple-buffering, async-compute |
| `quality` | Quality presets | preset, lod-bias |
| `performance` | Performance modes | frame-gen, dynamic-resolution |
| `audio` | Audio settings | spatial-audio, quality |

## Impact Metrics

All impact values use a -100 to +100 scale:

| Metric | Negative Means | Positive Means |
|--------|----------------|----------------|
| `performance` | Worse FPS | Better FPS |
| `quality` | Worse visuals | Better visuals |
| `power` | More power draw | Less power draw |
| `vram` | More VRAM usage | Less VRAM usage |
| `latency` | Higher input lag | Lower input lag |

### Impact Value Example

```json
{
  "impact": {
    "performance": { "value": -25, "min": -15, "max": -35, "unit": "percent" },
    "quality": { "value": 10 },
    "vram": { "value": -20, "unit": "MB", "typical": 200 }
  }
}
```

## Querying Interactions

### Forward Query
"If I enable DLSS, what else is affected?"

1. Find all interactions where DLSS appears in `settings[0]`
2. Return the affected settings and relationship type

### Backward Query
"What do I need to enable/disable to use RT Reflections?"

1. Find all interactions where RT Reflections appears in `settings[1]` (as target)
2. Filter by `type: "dependency"` or `type: "conflict"`
3. Return required settings (dependencies) and blocked settings (conflicts)

### Platform-Specific Query
"What interactions apply to Apple Silicon?"

1. Filter by `platforms: ["macos"]` or `platforms: ["all"]`
2. Optionally filter by `hardware: ["M3", "M4"]`

## Complete Example Entry

```json
{
  "id": "metalfx-temporal-upscaling-motion-blur",
  "type": "tradeoff",
  "direction": "affects",
  "settings": [
    { "category": "upscaling", "setting": "metalfx", "value": "temporal" },
    { "category": "graphics", "setting": "motion-blur", "value": "on" }
  ],
  "relationship": "MetalFX Temporal uses motion vectors which can conflict with motion blur, potentially causing artifacts",
  "conditions": [
    {
      "parameter": "motion_blur_strength",
      "operator": "gt",
      "value": 50,
      "unit": "percent"
    }
  ],
  "impact": {
    "quality": { "value": -15, "min": -5, "max": -25 }
  },
  "confidence": "medium",
  "platforms": ["macos"],
  "hardware": ["M3", "M3 Pro", "M3 Max", "M4", "M4 Pro", "M4 Max"],
  "tags": ["metalfx", "upscaling", "motion-blur", "artifacts"],
  "source": "Gemini Deep Research - Apple Silicon Gaming",
  "sourceDate": "2026",
  "recommendations": [
    "Reduce motion blur strength when using MetalFX Temporal",
    "Consider MetalFX Spatial if motion blur is important"
  ]
}
```

## Confidence Levels

| Level | Meaning | When to Use |
|-------|---------|-------------|
| **high** | Verified through multiple sources or game testing | Official docs, consistent across games |
| **medium** | Single reliable source or extrapolated | Gemini research, single game test |
| **low** | Theoretical or limited data | User reports, inferred behavior |

## Priority Domains

The following domains are prioritized for Phase 43:

1. **Resolution + Upscaling** - Native vs DLSS/FSR/MetalFX interactions
2. **Ray Tracing Cascades** - RT feature interdependencies and costs
3. **Apple Silicon Specifics** - Metal API, ProMotion, High Power Mode

## Integration with Opta

This settings data will be used by:

1. **Phase 47: Configuration Calculator** - Compute optimal settings combinations
2. **Conflict Detection** - Warn users of conflicting settings
3. **Recommendation System** - Suggest compatible setting changes
4. **Learn Mode** - Explain why certain settings conflict

## Maintenance

- **Updates**: Add new entries when games/features release
- **Verification**: Test interactions in actual games
- **Game-Specific**: Add `{game}-specific.json` for unique interactions
- **Platform Updates**: Validate when new macOS/drivers release

---

*Part of Opta's Knowledge Architecture System (Phase 43)*
*Schema: settings-schema.json v1.0*
