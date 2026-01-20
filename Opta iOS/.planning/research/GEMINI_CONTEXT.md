# Gemini Research Context: Opta Optimization Intelligence

**Use this document at the start of each Gemini Deep Research session to establish context.**

---

## What is Opta?

Opta is an AI-powered PC/Gaming optimization orchestrator — a desktop application that helps users maximize their gaming and system performance. Think of it as "one tool to replace them all" — eliminating the chaos of multiple conflicting optimizers (GeForce Experience, Razer Cortex, MSI Afterburner, etc.).

**Core capabilities:**
- Real-time hardware telemetry (CPU, GPU, memory, thermals, storage)
- Game detection and profile management
- Intelligent optimization recommendations
- Conflict detection between optimization tools
- Educational explanations of what optimizations do and why

**Tech stack:**
- Frontend: React + TypeScript + Tauri (cross-platform desktop)
- Backend: Rust (Tauri) + Python MCP server
- AI: Hybrid LLM (local Llama for routine queries, Claude for complex reasoning)
- Native: Swift/SwiftUI for macOS-specific features

**Current version:** v5.0 (Premium Visual Experience) — featuring 3D ring visualization, particle systems, glass effects, and Apple-level polish.

---

## What We're Building: The Optimization Intelligence Core (v6.0)

v6.0 transforms Opta from a visual optimizer into a **true optimization intelligence system**. The goal is not just understanding hardware — it's **calculating optimal configurations** where all settings work in perfect synergy.

### Knowledge Architecture (Phase 41.1 - COMPLETE)

We've established a **5-tier knowledge hierarchy** stored in `.planning/research/knowledge/`:

| Tier | Name | Stability | Storage |
|------|------|-----------|---------|
| T1 | Physics/Math | Immutable | `t1-physics/` |
| T2 | Architecture | Decade-stable | `t2-architecture/` |
| T3 | Hardware Specs | Generation-stable | `t3-specs/` |
| T4 | Benchmarks | Year-stable | `t4-benchmarks/` |
| T5 | Rankings/Trends | Month-stable | `t5-dynamic/` |

**Your research feeds directly into these tiers.** Provide data that maps to these categories.

### The Vision

Instead of generic "turn shadows to medium" advice, Opta will:
1. Know your exact hardware (M3 Pro with 18GB, MacBook Pro 14")
2. Understand the game you're playing (Baldur's Gate 3, Divinity Engine)
3. Calculate the mathematically optimal settings considering:
   - Your hardware's capabilities and limitations
   - How settings interact with each other
   - Thermal constraints of your device
   - Your priorities (max FPS vs visual quality vs battery life)

### The Pipeline

```
Phase 41: Knowledge Research Foundation (YOU ARE HERE)
    ↓
Phase 42: Hardware Synergy Database
    ↓
Phase 43: Settings Interaction Engine
    ↓
Phase 44: macOS Optimization Core
    ↓
Phase 47: Configuration Calculator
```

**Your research feeds directly into the Configuration Calculator** — a mathematical optimization model that computes ideal configurations based on real performance curves and hardware relationships.

---

## Phase 41: What You're Researching

Phase 41 is the **knowledge foundation**. We need comprehensive data across 5 domains:

| Domain | Focus | Key Deliverable |
|--------|-------|-----------------|
| **GPU** | Apple Silicon GPU architecture, Metal, TBDR | Performance curves by resolution/settings |
| **CPU** | P-core/E-core behavior, scheduling, Rosetta 2 | Workload scaling curves, bottleneck patterns |
| **Memory** | Unified memory, VRAM equivalence, pressure | Memory → performance mapping tables |
| **Thermal** | Throttling, form factors, sustained performance | Device-specific thermal profiles |
| **Storage** | SSD speeds, loading times, streaming | Storage impact on gaming experience |

### Research Philosophy

**Optimization-focused, not academic.**

Every piece of research should answer: "What can Opta actually optimize, and by how much?"

- **Good:** "Reducing shadows from Ultra to High saves 15% GPU load on M3, gaining ~8 FPS at 1440p"
- **Bad:** "Apple's GPU uses a tile-based deferred rendering architecture" (academic, no actionable insight)

**Real numbers over theory.**

We need actual performance curves, not theoretical specifications:
- FPS at different resolutions
- Settings impact percentages
- Thermal throttle thresholds
- Memory pressure cliffs

**Apple Silicon mastery first.**

Go extremely deep on M1/M2/M3/M4 before touching Windows/PC hardware. Make macOS optimization world-class before expanding.

---

## Hardware Context

Opta's primary developer uses:
- **Mac Studio M2 Ultra** (192GB unified memory) — primary workstation
- **MacBook Pro 14" M3 Pro** (18GB) — portable development
- **Gaming PC** (RTX 4090, i9-13900K) — Windows testing
- **Home Server** — backend services

The research should cover the full Apple Silicon range:
- M1, M1 Pro, M1 Max, M1 Ultra
- M2, M2 Pro, M2 Max, M2 Ultra
- M3, M3 Pro, M3 Max (M3 Ultra not yet released)
- M4, M4 Pro (Max/Ultra coming)

Form factors matter enormously for thermal behavior:
- MacBook Air (fanless, severely thermal-limited)
- MacBook Pro 14"/16" (active cooling, good thermal headroom)
- Mac Mini (compact, decent cooling)
- Mac Studio (excellent cooling, rarely throttles)
- Mac Pro (maximum thermal capacity)

---

## Output Format Guidelines

Structure research findings for downstream consumption:

### 1. Executive Summary (1 page max)
Key optimization insights — what matters most for Opta to know.

### 2. Data Tables
Formatted for programmatic parsing:
```markdown
| Chip | GPU Cores | Memory BW | Max Texture Size |
|------|-----------|-----------|------------------|
| M1   | 7-8       | 68 GB/s   | 4096px           |
| M1 Pro | 14-16   | 200 GB/s  | 8192px           |
```

### 3. Performance Curves
Quantified relationships:
```markdown
### Resolution Scaling (M3 Pro, Typical Game)
| Resolution | Relative FPS | GPU Load |
|------------|--------------|----------|
| 1080p      | 100%         | 45%      |
| 1440p      | 72%          | 68%      |
| 4K         | 38%          | 95%      |
```

### 4. Optimization Decision Trees
```markdown
IF gpu_load > 90% AND thermal_headroom < 10°C:
  → Reduce resolution scale first (biggest impact)
  → Then reduce shadow quality
  → Then reduce draw distance
```

### 5. Cross-Domain Interactions
How domains affect each other:
```markdown
### GPU ↔ Thermal
- M3 Pro throttles GPU at 98°C junction temp
- Throttled state: 70% of peak performance
- Recovery time: 30-60 seconds after load reduction
```

### 6. Confidence Levels
Flag uncertainty:
```markdown
| Finding | Confidence | Source |
|---------|------------|--------|
| M3 GPU cores: 10 | High | Apple spec sheet |
| Throttle temp: 98°C | Medium | User reports, not official |
| FPS curve slope | Low | Extrapolated from limited benchmarks |
```

---

## What Happens After Research

1. **You deliver research findings** structured per the output format
2. **Findings populate knowledge templates** (already created)
3. **Phase 42 builds Hardware Synergy Database** from your data
4. **Phase 47 Configuration Calculator** uses the database to compute optimal settings
5. **Opta recommends configurations** to users with full explanations

Your research directly enables Opta to say:
> "For Baldur's Gate 3 on your M3 Pro MacBook Pro at 1440p targeting 60fps:
> - Shadows: High (not Ultra, saves 12% GPU)
> - Textures: Ultra (you have 18GB, no VRAM pressure)
> - Anti-aliasing: TAA (MSAA too expensive on TBDR)
> - Expected: 58-65 FPS, stable thermals"

---

## Quick Reference: Apple Silicon Generations

| Gen | CPU Cores | GPU Cores | Memory | Key Feature |
|-----|-----------|-----------|--------|-------------|
| **M1** | 4P+4E | 7-8 | 8-16GB | First Apple Silicon |
| **M1 Pro** | 6-8P+2E | 14-16 | 16-32GB | Pro workflows |
| **M1 Max** | 8P+2E | 24-32 | 32-64GB | Maximum GPU |
| **M1 Ultra** | 16P+4E | 48-64 | 64-128GB | Two M1 Max fused |
| **M2** | 4P+4E | 8-10 | 8-24GB | Efficiency gains |
| **M2 Pro** | 6-8P+4E | 16-19 | 16-32GB | More E-cores |
| **M2 Max** | 8P+4E | 30-38 | 32-96GB | Larger GPU |
| **M2 Ultra** | 16P+8E | 60-76 | 64-192GB | Two M2 Max fused |
| **M3** | 4P+4E | 10 | 8-24GB | 3nm, ray tracing |
| **M3 Pro** | 5-6P+6E | 14-18 | 18-36GB | More E-cores |
| **M3 Max** | 10-12P+4E | 30-40 | 36-128GB | More P-cores |
| **M4** | 4P+6E | 10 | 16-32GB | Latest efficiency |
| **M4 Pro** | 10P+4E | 20 | 24-64GB | Pro performance |

---

---

## Already Established Knowledge (Do Not Duplicate)

We have extracted extensive knowledge from prior research. Focus on **gaps and deeper data**, not these topics:

### Architecture (T2) - Already Documented
- **UMA**: Zero-copy pipelines, CPU/GPU/Neural Engine shared memory pool
- **TBDR**: Apple's Tile-Based Deferred Rendering, tile binning, deferred shading
- **P/E Cores**: Heterogeneous design, E-cores matching older P-core performance (M4)
- **Dynamic Caching**: M3+ GPU memory allocation on-demand
- **MetalFX**: Temporal upscaling via ML reconstruction
- **Game Mode**: P-core pinning, E-core background offload, 2x Bluetooth polling
- **High Power Mode**: Aggressive fan curve, sustained boost clocks
- **UltraFusion**: Two Max dies fused via silicon interposer

### Specs (T3) - Already Documented
- M1/M2/M3/M4 core counts, GPU cores, memory configurations
- Memory bandwidth by variant (68GB/s to 800GB/s)
- Neural Engine TOPS (M3: 18, M4: 38)

### Benchmarks (T4) - Partial Data
- Game FPS on M3/M4 (Cyberpunk, Resident Evil, Valheim, etc.)
- Geekbench scores by variant
- Some thermal throttle observations

### GAPS TO FILL (Focus Your Research Here)
1. **Quantified Settings Impact**: FPS cost of shadow/AA/RT quality tiers
2. **Memory Pressure Curves**: Performance at 70/80/90/95% utilization
3. **Thermal Throttle Timing**: Minutes to throttle by form factor
4. **Cross-Domain Interactions**: GPU load vs thermal headroom tables
5. **Game-Specific Bottlenecks**: CPU vs GPU limited games list

---

## Begin Research

With this context established, proceed with the specific research prompt for the domain you're investigating (GPU, CPU, Memory, Thermal, or Storage).

Remember: **Optimization-focused, real numbers, Apple Silicon depth.**
