# Phase 41: Knowledge Research Foundation

## Research Purpose

This phase uses Gemini to conduct deep research across all major optimization domains. The goal is not just to understand these topics, but to extract actionable knowledge that Opta can use to **calculate** optimal configurations.

## Research Domains

### 1. GPU Architecture Deep Dive (41-01)

**NVIDIA Architecture**
- CUDA cores: How they scale, optimal workloads
- RT cores: Ray tracing cost/benefit analysis
- Tensor cores: DLSS/FSR impact on performance
- Memory bandwidth: GDDR6/GDDR6X characteristics
- Driver settings: Which actually impact performance

**AMD Architecture**
- RDNA 3: Compute units, ray accelerators
- Infinity Cache: Impact on effective bandwidth
- FSR vs DLSS: Quality/performance trade-offs
- Driver settings: Anti-lag, Radeon Boost, etc.

**Apple Silicon GPU**
- Unified memory architecture implications
- Tile-based deferred rendering
- Metal shader optimizations
- Apple GPU vs discrete GPU differences
- ProMotion and display sync

**Intel Arc**
- Xe cores: Architecture differences
- XeSS: Intel's upscaling technology
- Driver maturity considerations

**Research Questions:**
- What settings have the highest performance impact per GPU architecture?
- How does VRAM usage affect performance at different thresholds?
- What are the optimal settings for different GPU generations?
- How do upscaling technologies compare across vendors?

---

### 2. CPU Optimization Research (41-02)

**Thread Scheduling**
- P-cores vs E-cores (Intel hybrid, Apple Silicon)
- Core parking: When to enable/disable
- Thread affinity for gaming workloads
- SMT/Hyperthreading impact on games

**Frequency Scaling**
- Boost behavior under different workloads
- Thermal throttling patterns
- Power limit impacts
- All-core vs single-core optimization

**Cache Hierarchies**
- L1/L2/L3 cache impact on gaming
- Cache-sensitive vs cache-insensitive games
- AMD 3D V-Cache considerations

**Branch Prediction**
- How game engines affect CPU efficiency
- Instruction-level parallelism
- Prefetching optimization

**Research Questions:**
- When should E-cores be disabled for gaming?
- What process priority settings actually help?
- How does cache size affect different game engines?
- What's the optimal core count for different genres?

---

### 3. Memory Subsystem Research (41-03)

**VRAM Management**
- Texture streaming: Memory pressure patterns
- VRAM overflow to system RAM: Performance cliffs
- Optimal texture quality per VRAM tier
- Memory compression technologies

**System RAM**
- XMP/EXPO profiles: Stability vs performance
- Dual-channel vs single-channel impact
- RAM speed vs latency trade-offs
- Page file optimization

**Unified Memory (Apple)**
- Memory pressure monitoring
- Swap usage patterns
- Optimal allocation strategies
- GPU memory reservation

**Research Questions:**
- What VRAM headroom should be maintained?
- How much does RAM speed actually matter for gaming?
- What are the symptoms of memory bottlenecks?
- How should unified memory systems be optimized?

---

### 4. Thermal and Power Research (41-04)

**Thermal Throttling**
- TDP vs actual power consumption
- Throttling thresholds by manufacturer
- Cooling solution efficiency curves
- Ambient temperature impacts

**Power Delivery**
- GPU power limits: Stock vs unlocked
- CPU power limits: PL1, PL2, tau
- Undervolt stability margins
- Power supply overhead requirements

**Efficiency Curves**
- Performance per watt optimization
- Sweet spots for different hardware
- Mobile vs desktop considerations
- Battery optimization strategies

**Research Questions:**
- What temperatures trigger throttling on different hardware?
- What's the performance/power sweet spot?
- How to detect thermal issues from software?
- What cooling improvements provide best ROI?

---

### 5. Storage Optimization Research (41-05)

**NVMe Optimization**
- Queue depths: Optimal settings for gaming
- Block sizes: Impact on different workloads
- Direct Storage / GPU decompression
- Over-provisioning effects

**File System Optimization**
- APFS optimization for gaming
- NTFS vs ReFS considerations
- Defragmentation necessity
- Trim scheduling

**Caching Strategies**
- Write caching: Performance vs data safety
- Read caching: Effectiveness for games
- Shader cache management
- Asset streaming optimization

**Research Questions:**
- Does drive speed matter for game loading?
- What's the minimum SSD tier for gaming?
- How should shader caches be managed?
- What storage settings have measurable impact?

---

## Research Output Format

For each research domain, produce:

1. **Knowledge Base Document** (`.planning/knowledge/`)
   - Structured facts and relationships
   - Performance impact estimates (low/medium/high)
   - Hardware tier applicability
   - Confidence levels

2. **Settings Matrix**
   - Setting name → Impact → Conditions → Recommendation
   - Example: `shadow_quality → high → VRAM<4GB → medium`

3. **Interaction Rules**
   - Setting A affects Setting B under condition C
   - Example: `DLSS:Quality → allows higher base_resolution`

4. **Calculation Formulas**
   - Mathematical models for predicting impact
   - Example: `FPS_impact = base_fps * (1 - shadow_cost * shadow_level)`

---

## Research Tools

- **Gemini 2.0 Flash** - Primary research LLM with deep search
- **PCGamingWiki** - Community benchmark data
- **Hardware Unboxed** - Benchmark methodology reference
- **Digital Foundry** - Technical analysis reference
- **AnandTech** - Hardware architecture deep dives
- **Apple Developer Documentation** - Metal and Apple Silicon specifics

---

## Success Criteria

Phase 41 is complete when:

1. [ ] GPU architecture knowledge base created with per-vendor settings matrices
2. [ ] CPU optimization rules documented with P-core/E-core guidance
3. [ ] Memory management guidelines established with VRAM tier thresholds
4. [ ] Thermal/power profiles mapped per hardware generation
5. [ ] Storage optimization rules documented with measurable impacts

Each knowledge base should enable Opta to make **calculated recommendations**, not just generic advice.
