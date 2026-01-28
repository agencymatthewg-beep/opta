# Hardware Synergy Database

This directory contains hardware interaction data for Opta's optimization intelligence. It captures how hardware components interact, affect each other, and create bottlenecks or synergies.

## Purpose

The Hardware Synergy Database enables Opta to:

1. **Identify Bottlenecks** - Detect when one component limits another's performance
2. **Find Synergies** - Recognize when components work well together
3. **Calculate Impact** - Quantify performance, thermal, and power effects
4. **Make Recommendations** - Suggest optimizations based on real interaction data

## Schema Reference

All synergy files must conform to: `../schema/synergy-schema.json`

Key schema elements:
- **interactionEntry** - A single hardware interaction record
- **condition** - When an interaction applies (e.g., "when memory_usage > 80%")
- **impactMetrics** - Quantified effects on performance/thermal/power
- **impactFormula** - Mathematical formula for dynamic calculation

## Directory Structure

```
synergies/
  README.md              # This file
  bottlenecks/           # GPU-CPU, memory bandwidth, PCIe limitations
  thermal/               # Thermal profiles, throttling interactions
  power/                 # Power budget, efficiency, battery impact
```

## File Naming Conventions

Use descriptive kebab-case names that indicate the interaction domain:

| Pattern | Example | Description |
|---------|---------|-------------|
| `{component1}-{component2}-{type}.json` | `gpu-cpu-bottlenecks.json` | Cross-component interactions |
| `{chip-family}-{domain}.json` | `m-series-thermal.json` | Chip-specific data |
| `{platform}-{domain}.json` | `macos-power-management.json` | Platform-specific interactions |
| `unified-memory-{aspect}.json` | `unified-memory-bandwidth.json` | Memory subsystem specifics |

## How to Add New Entries

### 1. Identify the Domain

Choose the appropriate subdirectory:
- `bottlenecks/` - Performance limitations, bandwidth constraints
- `thermal/` - Heat generation, throttling, cooling interactions
- `power/` - Power draw, efficiency, battery considerations

### 2. Create or Update File

```json
{
  "$schema": "synergy-schema.json",
  "domain": "gpu-cpu",
  "lastUpdated": "2026-01-18",
  "confidence": "high",
  "sources": [
    {
      "name": "Gemini Deep Research - GPU Architecture",
      "type": "gemini-research",
      "date": "2026-01-18"
    }
  ],
  "interactions": [
    // Add entries here
  ]
}
```

### 3. Add Interaction Entry

```json
{
  "id": "m4-pro-gpu-cpu-unified-memory-contention",
  "type": "bottleneck",
  "components": ["cpu:m4-pro", "gpu:m4-pro-gpu", "memory:unified"],
  "relationship": "High GPU and CPU concurrent memory access causes bandwidth contention on unified memory bus",
  "conditions": [
    {
      "parameter": "memory_bandwidth_usage",
      "operator": "gt",
      "value": 75,
      "unit": "percent"
    },
    {
      "parameter": "gpu_utilization",
      "operator": "gt",
      "value": 80,
      "unit": "percent"
    }
  ],
  "impact": {
    "performance": { "value": -15, "min": -5, "max": -25 },
    "thermal": { "value": 5 },
    "power": { "value": 10 }
  },
  "confidence": "medium",
  "applicableTo": ["M4 Pro", "M4 Max"],
  "tags": ["unified-memory", "bandwidth", "contention"],
  "mitigations": [
    "Reduce memory-intensive background processes",
    "Stagger GPU and CPU heavy workloads"
  ]
}
```

## Confidence Levels

| Level | Meaning | When to Use |
|-------|---------|-------------|
| **high** | Verified through multiple sources or direct measurement | Official specs, consistent benchmark data, measured behavior |
| **medium** | Single reliable source or reasonable extrapolation | Single benchmark report, Gemini research analysis |
| **low** | Theoretical or limited data | User reports, extrapolated from similar hardware |

### Guidance

- New entries should start at `medium` confidence unless backed by official docs
- Upgrade to `high` after verification from multiple sources
- Mark `low` confidence entries with `"verificationRequired": true`
- Include source references for all entries

## Interaction Types

| Type | Description | Performance Impact |
|------|-------------|-------------------|
| **bottleneck** | One component limits another | Negative |
| **synergy** | Components enhance each other | Positive |
| **neutral** | No significant interaction | Near zero |
| **dependency** | Required relationship (no direct performance impact) | Informational |

## Impact Scale

All impact values use a -100 to +100 scale:

| Value | Meaning |
|-------|---------|
| -100 | Severe degradation (e.g., complete bottleneck) |
| -50 | Significant degradation |
| -25 | Moderate degradation |
| 0 | No impact |
| +25 | Moderate improvement |
| +50 | Significant improvement |
| +100 | Maximum improvement (e.g., perfect synergy) |

## Example Entry

Here's a complete example of a unified memory bottleneck:

```json
{
  "id": "unified-memory-high-pressure-throttling",
  "type": "bottleneck",
  "components": ["memory:unified", "cpu:apple-silicon", "gpu:apple-silicon-gpu"],
  "relationship": "When unified memory approaches capacity, macOS memory compression and swap increase CPU overhead while GPU memory allocation may be throttled",
  "conditions": [
    {
      "parameter": "memory_usage",
      "operator": "gte",
      "value": 90,
      "unit": "percent"
    }
  ],
  "formula": {
    "expression": "base_impact * (memory_pressure / 100)",
    "variables": {
      "base_impact": "Maximum degradation at 100% pressure (-30)",
      "memory_pressure": "Current memory pressure percentage"
    },
    "outputUnit": "performance_impact"
  },
  "impact": {
    "performance": { "value": -20, "min": -10, "max": -30 },
    "thermal": { "value": 5 },
    "power": { "value": 15 }
  },
  "confidence": "high",
  "applicableTo": ["M1", "M1 Pro", "M1 Max", "M2", "M2 Pro", "M2 Max", "M3", "M3 Pro", "M3 Max", "M4", "M4 Pro", "M4 Max"],
  "tags": ["unified-memory", "memory-pressure", "throttling", "swap"],
  "source": "Gemini Deep Research - Memory Architecture",
  "sourceDate": "2026",
  "mitigations": [
    "Close memory-intensive applications",
    "Increase swap file size (if SSD has capacity)",
    "Upgrade to higher memory configuration"
  ]
}
```

## Integration with Opta

This synergy data will be used by:

1. **Optimization Engine** - To predict impact of optimizations
2. **Conflict Detection** - To identify when running apps cause bottlenecks
3. **Recommendation System** - To suggest hardware-aware optimizations
4. **Learn Mode** - To explain why certain bottlenecks occur

## Maintenance

- **Updates**: When new hardware releases, add applicable entries
- **Verification**: Quarterly review of `medium` confidence entries
- **Archival**: Obsolete entries (old hardware) moved to `archive/`

---

*Part of Opta's Knowledge Architecture System (Phase 41.1+)*
*Schema: synergy-schema.json v1.0*
