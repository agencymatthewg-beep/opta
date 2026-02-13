# Plan 43-05 Summary: Optimal Setting Combination Solver

## Overview

**Plan:** 43-05
**Phase:** 43-settings-interaction-engine
**Wave:** 3
**Status:** Complete
**Duration:** ~12 minutes

## Objective

Create the optimal setting combination solver data for Phase 47 integration, including hardware-indexed recommendations and solver rules that combine conflicts, synergies, and trade-offs into actionable queries.

## Deliverables

### 1. Hardware Recommendations (`hardware-recommendations.json`)

Created a comprehensive hardware tier system with 4 tiers:

| Tier | Hardware | Memory | Capabilities |
|------|----------|--------|--------------|
| **Entry** | M1, M2, M3, M4 | 8GB | 1080p max, no RT, MetalFX |
| **Mid** | M1-M4 Pro | 16-18GB | 1440p/4K MetalFX, selective RT |
| **High** | M1-M4 Max | 32-48GB | 4K native, full RT stack |
| **Ultra** | M1-M2 Ultra, M4 Max | 48GB+ | No compromises |

Each tier includes 4 optimization goals:
- **maxFps**: Competitive/high-framerate optimized settings
- **balanced**: Quality/performance sweet spot
- **quality**: Maximum visual fidelity
- **battery**: Power efficiency for portables

**Total:** 4 tiers x 4 goals = 16 recommendation sets

### 2. Solver Rules (`solver-rules.json`)

Created 30 solver rules across 5 categories:

| Category | Rules | Purpose |
|----------|-------|---------|
| **Constraint** | 9 | Hard rules (conflicts, dependencies, hardware requirements) |
| **Optimization** | 6 | Synergies, diminishing returns, bottleneck detection |
| **Goal** | 4 | maxFps, quality, battery, competitive priorities |
| **Platform** | 6 | macOS/MetalFX/UMA/power mode handling |
| **Evaluation** | 5 | Impact calculation, conflict resolution, uncertainty |

**Key Constraint Rules:**
- Upscaler mutual exclusion (DLSS/FSR/MetalFX cannot coexist)
- Memory budget enforcement (8GB limits textures to Medium)
- RT hardware requirements (M3+ only)
- TAA/DLSS redundancy detection

**Key Optimization Rules:**
- RT BVH sharing synergy (RT Reflections + Shadows efficient together)
- Bottleneck detection (CPU/GPU imbalance, memory pressure)
- Diminishing returns (Ultra shadows vs High)

## Technical Details

### File Locations
```
.planning/research/knowledge/settings/solver/
├── hardware-recommendations.json (616 lines, 4 tiers, 16 goal configs)
└── solver-rules.json (771 lines, 30 rules)
```

### Schema Compliance
- Both files reference `settings-schema.json`
- All setting references use `category:setting:value` format
- Impact values use -100 to +100 scale

### Execution Order
Solver rules execute in 6 phases:
1. Hardware Validation
2. Conflict Detection
3. Goal Application
4. Platform Optimization
5. Synergy Enhancement
6. Runtime Adjustment

## Phase 47 Integration Points

The Configuration Calculator will:
1. Use `tierMapping` to determine user's hardware tier
2. Apply goal-specific recommendation preset from tier
3. Execute solver rules in `executionOrder` phases
4. Cross-reference with conflict/synergy/tradeoff data
5. Return optimized settings configuration

## Verification

```bash
# Hardware recommendations validation
cat hardware-recommendations.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Valid JSON with {len(d[\"tiers\"])} tiers')"
# Output: Valid JSON with 4 hardware tiers

# Solver rules validation
cat solver-rules.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Valid JSON with {len(d[\"rules\"])} rules')"
# Output: Valid JSON with 30 solver rules
```

## Commits

1. `64335f3` - feat(43-05): add hardware-indexed recommendations for Phase 47
2. `add0678` - feat(43-05): add solver rules for Phase 47 Configuration Calculator

## Dependencies Satisfied

- **43-02**: Conflict data referenced by solver rules
- **43-03**: Dependency rules integrated into constraint handling
- **43-04**: Trade-off data used for impact calculations

## Next Steps

Phase 43 complete. Next phases in v6.0:
- Phase 44: macOS Optimization Core
- Phase 47: Configuration Calculator (will consume this solver data)
