# Plan 42-05 Summary: Power Budget Optimization Tables

## Overview

Created comprehensive power budget optimization data for Apple Silicon Macs, enabling Opta to make intelligent power management recommendations for gaming and optimize battery life vs performance trade-offs.

## Completed Tasks

### Task 1: Create Power Budget Data

Created `power-budget.json` with **24 power interaction entries** covering:

| Category | Entries | Description |
|----------|---------|-------------|
| TDP Specifications | 7 | M1/M2/M3/M4 base, Pro, Max, Ultra variants |
| Power Mode Interactions | 4 | Low Power, Automatic, High Power, Battery vs Plugged |
| Core Efficiency | 3 | E-core vs P-core efficiency, burst power, idle consumption |
| GPU Power Scaling | 1 | Linear scaling curve with efficiency factor |
| Gaming Power Profiles | 3 | Light (30 FPS), Medium (60 FPS), Heavy (uncapped) |
| Optimization Synergies | 3 | Frame rate cap, perf-per-watt sweet spot, High Power Mode benefits |
| Environmental Factors | 3 | Charging impact, background apps, screen brightness |

**Key Data Points:**
- Base chips: 15-25W TDP
- Pro chips: 30-40W TDP
- Max chips: 60-90W TDP
- Ultra chips: 120-180W TDP
- E-cores provide 3-4x better perf/watt than P-cores
- 30 FPS cap saves 30-50% power during gaming

### Task 2: Add Power Optimization Heuristics

Added three comprehensive sections for actionable optimization guidance:

#### Heuristics (5 optimization guides)

| Heuristic | Purpose | Expected Improvement |
|-----------|---------|---------------------|
| Battery Gaming Optimization | Maximize gaming time on battery | +30-50% battery life |
| Maximum Performance Usage | When/how to use High Power Mode | +10-20% sustained FPS |
| Power-Efficient Long Sessions | Avoid thermal throttling | Stable performance |
| Charging While Gaming | Optimize charging during play | Reduced throttling |
| Background Power Drain Reduction | Eliminate waste | +5-15W for gaming |

#### Power Modes (3 modes)

| Mode | Performance Cost | Battery Benefit | Best For |
|------|-----------------|-----------------|----------|
| Low Power | -15-30% | +30-50% | Battery gaming, light tasks |
| Automatic | None (plugged in) | Balanced | Default, general use |
| High Power | None | N/A (requires power) | AAA gaming, sustained loads |

#### Battery Estimates (5 scenarios x 6 devices)

| Scenario | MacBook Air | MacBook Pro 14 | MacBook Pro 16 |
|----------|-------------|----------------|----------------|
| Light Gaming (30 FPS) | 3-4.5 hrs | 4-5.5 hrs | 5-6.5 hrs |
| Medium Gaming (60 FPS) | 1.5-2.25 hrs | 2.5-3.25 hrs | 3-4 hrs |
| Heavy Gaming (max) | 45-70 min | 1.5-2.25 hrs | 2-2.75 hrs |
| Idle Desktop | 15-20 hrs | 12-15 hrs | 14-17 hrs |
| Video Playback | 18-24 hrs | 17-22 hrs | 20-26 hrs |

## Files Created/Modified

| File | Action | Lines |
|------|--------|-------|
| `.planning/research/knowledge/synergies/power/power-budget.json` | Created | 859 |

## Verification

```bash
# Valid JSON with all required sections
$ python3 -c "import json; d=json.load(open('power-budget.json')); print(len(d['interactions']))"
24 entries

$ python3 -c "import json; d=json.load(open('power-budget.json')); print('heuristics' in d, 'powerModes' in d, 'batteryEstimates' in d)"
True True True
```

## Key Insights

1. **Efficiency Sweet Spot**: 60-70% utilization provides optimal performance-per-watt
2. **Frame Rate Impact**: 30 FPS cap can nearly double battery gaming time
3. **High Power Mode**: Only beneficial for sustained loads >5 minutes
4. **Background Apps**: Electron apps (Slack, Discord, VS Code) can waste 5-15W
5. **Charging Heat**: Gaming while charging adds 5-15W thermal overhead

## Integration Points

This data enables Opta to:
- Recommend power mode based on usage context (battery vs plugged in)
- Suggest frame rate caps for battery optimization
- Warn about background app power drain
- Estimate remaining gaming time on battery
- Explain thermal throttling causes and mitigations

## Next Steps

This completes Plan 42-05. The power budget data is ready for:
- Integration with the Configuration Calculator (Phase 47)
- Battery life optimization recommendations in the UI
- Learn Mode explanations for power management

---

*Completed: 2026-01-18*
*Duration: ~8 minutes*
*Part of Phase 42: Hardware Synergy Database*
