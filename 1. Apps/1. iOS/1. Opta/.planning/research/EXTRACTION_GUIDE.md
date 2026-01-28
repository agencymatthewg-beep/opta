# Knowledge Extraction Guide

This guide documents the methodology for extracting optimization knowledge from research sources into Opta's 5-tier knowledge hierarchy.

---

## Overview

The Knowledge Architecture System organizes extracted research into 5 tiers based on information stability. This guide explains how to categorize, format, and validate knowledge entries.

---

## The 5-Tier Hierarchy

| Tier | Name | Stability | Verification | Examples |
|------|------|-----------|--------------|----------|
| **T1** | Physics/Math | Immutable | Never | Laws of thermodynamics, mathematical formulas |
| **T2** | Architecture | Decade-stable | Rare | UMA, TBDR rendering, heterogeneous CPU design |
| **T3** | Hardware Specs | Generation-stable | Per-release | M4 core counts, bandwidth values, transistor counts |
| **T4** | Benchmarks | Year-stable | Quarterly | FPS numbers, Geekbench scores, thermal behavior |
| **T5** | Rankings/Trends | Month-stable | On-access | "Best GPU for gaming", software recommendations |

---

## Extraction Process

### Step 1: Read Source Material

Read the research report completely before extracting. Identify:
- Key facts and claims
- Performance numbers
- Architectural concepts
- Recommendations

### Step 2: Categorize by Tier

For each fact, ask:
1. **Is it mathematically/physically immutable?** → T1
2. **Is it a fundamental architectural concept that won't change for ~10 years?** → T2
3. **Is it a specific hardware specification?** → T3
4. **Is it a performance measurement or benchmark?** → T4
5. **Is it a recommendation or ranking that could change soon?** → T5

### Step 3: Format as JSON Entry

```json
{
  "id": "kebab-case-unique-id",
  "fact": "Clear, concise statement of the knowledge",
  "details": "Extended explanation if needed (optional)",
  "confidence": "high|medium|low",
  "source": "Source reference",
  "verificationRequired": true|false,
  "tags": ["relevant", "searchable", "tags"],
  "applicableTo": ["M3", "M3 Pro", "M3 Max"]  // For hardware-specific facts
}
```

### Step 4: Determine Confidence Level

| Confidence | Criteria |
|------------|----------|
| **high** | Official documentation, verified measurements, mathematical facts |
| **medium** | Reputable benchmarks, consistent community reports |
| **low** | Single source, user reports, extrapolated data |

### Step 5: Set Verification Requirements

- T1-T2: `verificationRequired: false` (stable facts)
- T3: `verificationRequired: false` (verify manually on new chip releases)
- T4: `verificationRequired: true` (quarterly verification cycle)
- T5: `verificationRequired: true` (verify on-access via LLM)

---

## File Organization

```
.planning/research/knowledge/
├── t1-physics/           # Immutable facts
│   └── fundamentals.json
├── t2-architecture/      # Decade-stable concepts
│   ├── apple-silicon.json
│   └── optimization-software.json
├── t3-specs/             # Hardware specifications
│   └── m-series.json
├── t4-benchmarks/        # Performance data
│   └── game-performance.json
└── t5-dynamic/           # Recommendations and trends
    └── recommendations.json
```

### File Naming Conventions

- Domain-specific: `apple-silicon.json`, `optimization-software.json`
- Hardware-specific: `m-series.json`, `rtx-series.json`
- Topic-specific: `game-performance.json`, `thermal-behavior.json`

---

## Entry ID Conventions

Use kebab-case with descriptive prefixes:

| Pattern | Example |
|---------|---------|
| `{chip}-{property}` | `m4-max-bandwidth`, `m3-pro-specs` |
| `{concept}-{detail}` | `tbdr-rendering`, `uma-architecture-principle` |
| `{game}-{chip}-{resolution}` | `cyberpunk-m3max-1080p-metalfx` |
| `{tool}-{feature}` | `reflex-latency-reduction`, `hags-architecture` |

---

## Tags Convention

Use consistent tags for searchability:

**Hardware Tags:** `m1`, `m2`, `m3`, `m4`, `m3-pro`, `m4-max`, etc.
**Domain Tags:** `gpu`, `cpu`, `memory`, `thermal`, `storage`
**Feature Tags:** `uma`, `tbdr`, `metalfx`, `game-mode`, `rosetta`
**Type Tags:** `benchmark`, `specs`, `architecture`, `optimization`

---

## Archiving Processed Reports

After extraction, copy reports to archive:

```
.planning/research/archive/gemini-{date}-{topic}.md
```

Example: `gemini-2025-01-apple-mac-capabilities.md`

---

## Quality Checklist

Before adding entries, verify:

- [ ] ID is unique and follows conventions
- [ ] Fact is clear and self-contained
- [ ] Tier is correctly assigned
- [ ] Confidence level is appropriate
- [ ] Tags are relevant and consistent
- [ ] `applicableTo` is set for hardware-specific facts
- [ ] `verificationRequired` matches tier guidelines

---

## Example Extractions

### T2 Example (Architecture)

```json
{
  "id": "unified-memory-architecture",
  "fact": "Apple Silicon uses Unified Memory Architecture (UMA) where CPU, GPU, and Neural Engine share the same memory pool",
  "details": "Eliminates the CPU-GPU memory copy bottleneck by sharing a single pool of high-bandwidth memory.",
  "confidence": "high",
  "source": "Apple Silicon Architecture",
  "verificationRequired": false,
  "tags": ["memory", "uma", "architecture", "zero-copy"]
}
```

### T4 Example (Benchmarks)

```json
{
  "id": "cyberpunk-m3max-1080p-metalfx",
  "fact": "M3 Max (48GB) achieves 104.46 FPS in Cyberpunk 2077 at 1080p with MetalFX Quality",
  "details": "MetalFX Quality mode provides +33% FPS improvement",
  "confidence": "high",
  "source": "Technetbooks",
  "verificationRequired": true,
  "tags": ["cyberpunk", "fps", "1080p", "metalfx", "m3-max", "benchmark"],
  "applicableTo": ["M3 Max"]
}
```

---

## Integration with Opta

The knowledge base feeds into Opta's Configuration Calculator (Phase 47):

1. **T1-T2** loaded at startup as stable context
2. **T3** queried for hardware-specific optimization rules
3. **T4** used for performance predictions
4. **T5** verified via Cloud LLM before presenting recommendations

---

## Maintenance

- **Monthly:** Review T5 entries for staleness
- **Quarterly:** Verify T4 benchmark data
- **Per-release:** Update T3 specs when new chips announced
- **Rare:** Update T2 only for major architectural shifts
