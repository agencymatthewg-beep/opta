# Plan 42-02 Summary: GPU-CPU Bottleneck Data

**Phase:** 42 - Hardware Synergy Database
**Plan:** 02 of 05
**Status:** COMPLETE
**Duration:** ~10 minutes

## Objective

Create GPU-CPU bottleneck calculation models for the Hardware Synergy Database, enabling Opta to predict and explain performance limitations across Apple Silicon configurations.

## Deliverables

### Primary Output
- `.planning/research/knowledge/synergies/bottlenecks/gpu-cpu-bottlenecks.json`

### Contents

#### Interaction Entries (18 total)

**CPU-Bound Scenarios (5 entries):**
| ID | Description | Confidence |
|----|-------------|------------|
| cpu-bound-draw-call-overhead | Draw calls overwhelming CPU command encoding | high |
| cpu-bound-physics-simulation | Physics consuming CPU cycles, delaying GPU work | medium |
| cpu-bound-ai-game-logic | AI pathfinding and game logic processing delays | medium |
| cpu-bound-asset-decompression | Asset streaming causing CPU load and stutter | medium |
| cpu-bound-single-thread-limitation | Single P-core bottleneck in poorly threaded games | high |

**GPU-Bound Scenarios (6 entries):**
| ID | Description | Confidence |
|----|-------------|------------|
| gpu-bound-shader-complexity | Complex shaders saturating GPU ALUs | high |
| gpu-bound-resolution-fillrate | High resolution exceeding fill rate/bandwidth | high |
| gpu-bound-post-processing | Heavy post-processing consuming GPU time | medium |
| gpu-bound-ray-tracing | Hardware ray tracing overhead (M3+) | high |
| gpu-bound-vram-pressure | GPU memory allocation exceeding UMA budget | high |
| tbdr-geometry-amplification | TBDR geometry re-processing overhead | medium |

**Memory/Bandwidth Scenarios (1 entry):**
| ID | Description | Confidence |
|----|-------------|------------|
| unified-memory-contention | CPU+GPU saturating unified memory bandwidth | high |

**Synergies (3 entries):**
| ID | Description | Confidence |
|----|-------------|------------|
| balanced-optimal-utilization | Optimal CPU/GPU utilization ranges | high |
| e-core-background-benefit | E-cores freeing P-cores for game logic | medium |
| dynamic-caching-benefit | M3+ dynamic caching for geometry workloads | medium |

**Special Cases (3 entries):**
| ID | Description | Confidence |
|----|-------------|------------|
| p-core-saturation-spillover | Game threads spilling to E-cores | medium |
| translation-layer-cpu-overhead | GPTK/CrossOver translation overhead | high |
| high-refresh-cpu-demand | 120Hz+ CPU frame preparation demands | medium |

#### Heuristics (6 detection rules)

| Heuristic | Purpose |
|-----------|---------|
| cpu-bottleneck-detection | Detect when CPU limits GPU performance |
| gpu-bottleneck-detection | Detect when GPU is the performance limiter |
| memory-bandwidth-bottleneck-detection | Detect unified memory bandwidth saturation |
| thermal-throttling-detection | Detect performance loss from thermal management |
| translation-overhead-detection | Detect DirectX-to-Metal translation overhead |
| balanced-system-detection | Confirm system is well-optimized |

Each heuristic includes:
- Observable indicators (what to look for)
- Numeric thresholds for detection
- Remediation steps (what Opta can suggest)
- Related interaction IDs for cross-reference

## Technical Details

### Schema Compliance
- Follows `synergy-schema.json` structure
- Domain: `gpu-cpu`
- Sub-domain: `bottleneck-calculations`
- Confidence: `medium` (overall file)

### Applicable Chips
All entries specify applicable chips including:
- M1, M1 Pro, M1 Max
- M2, M2 Pro, M2 Max
- M3, M3 Pro, M3 Max
- M4, M4 Pro, M4 Max

Ray tracing entries limited to M3+ only.

### Impact Formulas
Several entries include mathematical formulas:
- `(100 - gpu_utilization) * 0.8` for draw call overhead
- `base_fps * (1 - rt_penalty)` for ray tracing impact
- `((cpu_bw + gpu_bw) / max_bw) * penalty` for bandwidth contention

## Commits

1. `c7a37fd` - feat(42-02): add GPU-CPU bottleneck interaction data
2. `16765a8` - feat(42-02): add bottleneck detection heuristics

## Verification

```bash
# Verify JSON validity and entry count
cat gpu-cpu-bottlenecks.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Valid JSON with {len(d[\"interactions\"])} interactions and {len(d[\"heuristics\"])} heuristics')"
# Output: Valid JSON with 18 interactions and 6 heuristics
```

## Integration Points

This data will be consumed by:
- **Phase 47** - Configuration Calculator (bottleneck prediction)
- **Phase 49** - Real-Time Adaptation (dynamic optimization)
- **Opta UI** - Learn Mode explanations of bottlenecks

## Next Steps

- Plan 42-03: Thermal Interaction Profiles
- Plan 42-04: Power Efficiency Data
- Plan 42-05: Synergy Calculation Engine
