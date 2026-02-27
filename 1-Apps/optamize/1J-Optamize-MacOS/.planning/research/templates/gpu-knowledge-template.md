# Apple Silicon GPU Knowledge Base

## Document Metadata
- **Generated:** [Date]
- **Source:** Gemini 2.5 Pro Deep Research
- **Domain:** GPU Architecture & Optimization
- **Confidence:** [High/Medium/Low per section]

---

## 1. Hardware Specifications

### GPU Core Counts by Generation

| Chip | Base | Pro | Max | Ultra |
|------|------|-----|-----|-------|
| M1 | 7-8 | 14-16 | 24-32 | 48-64 |
| M2 | 8-10 | 16-19 | 30-38 | 60-76 |
| M3 | 10 | 14-18 | 30-40 | TBD |
| M4 | 10 | TBD | TBD | TBD |

### Memory Bandwidth (GPU Available)

| Chip | Bandwidth | Notes |
|------|-----------|-------|
| M1 | 68.25 GB/s | Shared with CPU |
| M1 Pro | 200 GB/s | ... |
| M1 Max | 400 GB/s | ... |
| M1 Ultra | 800 GB/s | ... |
| M2 | 100 GB/s | ... |
| M2 Pro | 200 GB/s | ... |
| M2 Max | 400 GB/s | ... |
| M2 Ultra | 800 GB/s | ... |
| M3 | 100 GB/s | ... |
| M3 Pro | 150 GB/s | ... |
| M3 Max | 400 GB/s | ... |
| M4 | 120 GB/s | ... |
| M4 Pro | 273 GB/s | ... |
| M4 Max | 546 GB/s | ... |

### TBDR Tile Configuration

| Generation | Tile Size | Tile Buffer Size | Notes |
|------------|-----------|------------------|-------|
| M1 | [size] | [buffer] | [notes] |
| M2 | [size] | [buffer] | [notes] |
| M3 | [size] | [buffer] | [notes] |
| M4 | [size] | [buffer] | [notes] |

---

## 2. Performance Curves

### Resolution Scaling (Relative FPS, 1080p = 100%)

| Chip | 1080p | 1440p | 4K | 5K |
|------|-------|-------|-----|-----|
| M1 | 100% | X% | X% | X% |
| M1 Pro | 100% | X% | X% | X% |
| M1 Max | 100% | X% | X% | X% |
| M2 | 100% | X% | X% | X% |
| M2 Pro | 100% | X% | X% | X% |
| M2 Max | 100% | X% | X% | X% |
| M3 | 100% | X% | X% | X% |
| M3 Pro | 100% | X% | X% | X% |
| M3 Max | 100% | X% | X% | X% |
| M4 | 100% | X% | X% | X% |
| M4 Pro | 100% | X% | X% | X% |
| M4 Max | 100% | X% | X% | X% |

### Settings Impact (FPS Cost)

| Setting | Off→Low | Low→Med | Med→High | High→Ultra |
|---------|---------|---------|----------|------------|
| Shadows | -X% | -X% | -X% | -X% |
| AA (FXAA) | -X% | - | - | - |
| AA (TAA) | -X% | - | - | - |
| AA (MSAA 2x) | -X% | - | - | - |
| AA (MSAA 4x) | -X% | - | - | - |
| Texture Quality | -X% | -X% | -X% | -X% |
| Draw Distance | -X% | -X% | -X% | -X% |
| Post Processing | -X% | -X% | -X% | -X% |
| Ambient Occlusion | -X% | -X% | -X% | -X% |
| Reflections | -X% | -X% | -X% | -X% |
| Ray Tracing (M3+) | -X% | -X% | -X% | -X% |

### GPU-Limited Resolution Thresholds

| Chip | Becomes GPU-Limited At | Notes |
|------|------------------------|-------|
| M1 | [resolution] | [notes] |
| M1 Pro | [resolution] | [notes] |
| M1 Max | [resolution] | [notes] |
| M2 | [resolution] | [notes] |
| M3 | [resolution] | [notes] |
| M4 | [resolution] | [notes] |

---

## 3. Thermal Behavior

### Throttle Points by Form Factor

| Device | Throttle Temp | Sustained Performance | Notes |
|--------|---------------|----------------------|-------|
| MacBook Air M1 | X°C | X% of peak | No fan |
| MacBook Air M2 | X°C | X% of peak | No fan |
| MacBook Air M3 | X°C | X% of peak | No fan |
| MacBook Pro 14" M1 Pro | X°C | X% of peak | Active cooling |
| MacBook Pro 14" M3 Pro | X°C | X% of peak | Active cooling |
| MacBook Pro 16" M1 Max | X°C | X% of peak | Active cooling |
| MacBook Pro 16" M3 Max | X°C | X% of peak | Active cooling |
| Mac mini M1 | X°C | X% of peak | Small fan |
| Mac mini M2 | X°C | X% of peak | Small fan |
| Mac mini M4 | X°C | X% of peak | Small fan |
| Mac Studio M1 Max | X°C | X% of peak | Large heatsink |
| Mac Studio M2 Ultra | X°C | X% of peak | Large heatsink |
| Mac Pro M2 Ultra | X°C | X% of peak | Server cooling |

### Performance Over Time (Gaming Load)

| Device | 0-5 min | 5-15 min | 15-30 min | 30+ min |
|--------|---------|----------|-----------|---------|
| MacBook Air | 100% | X% | X% | X% |
| MacBook Pro 14" | 100% | X% | X% | X% |
| MacBook Pro 16" | 100% | X% | X% | X% |
| Mac mini | 100% | X% | X% | X% |
| Mac Studio | 100% | X% | X% | X% |

---

## 4. Optimization Decision Matrix

### When to Reduce Settings

| Symptom | Primary Cause | Optimization |
|---------|---------------|--------------|
| FPS drops at 4K | GPU-limited | Reduce resolution scale |
| Stutter in open worlds | VRAM pressure | Reduce texture quality |
| Frame pacing issues | TBDR bottleneck | Reduce overdraw (transparent objects) |
| Thermal throttling | Sustained load | Enable V-Sync, cap framerate |
| High GPU utilization, low FPS | Shader complexity | Reduce post-processing |
| Consistent low FPS | Insufficient GPU cores | Lower resolution + settings preset |

### Resolution Recommendation by Chip

| Chip | Target 60 FPS | Target 30 FPS | Notes |
|------|---------------|---------------|-------|
| M1 | [res] | [res] | [notes] |
| M1 Pro | [res] | [res] | [notes] |
| M1 Max | [res] | [res] | [notes] |
| M2 | [res] | [res] | [notes] |
| M3 | [res] | [res] | [notes] |
| M4 | [res] | [res] | [notes] |

### Settings Priority Order (Reduce First)

1. **Resolution Scale** - Highest impact, least visual loss
2. **Shadows** - High cost, acceptable at medium
3. **Anti-aliasing** - TAA preferred over MSAA
4. **Post-processing** - Bloom/DoF often unnecessary
5. **Draw Distance** - Reduce if open-world
6. **Texture Quality** - Only if VRAM-limited
7. **Ray Tracing** - Disable on M3 for performance

---

## 5. Metal-Specific Insights

### Performance Patterns

- **Pattern 1: Tile Memory Optimization**
  - [Explanation + quantified impact]
  - Opta action: [what to recommend]

- **Pattern 2: Argument Buffer Usage**
  - [Explanation + quantified impact]
  - Opta action: [what to recommend]

- **Pattern 3: Indirect Command Encoding**
  - [Explanation + quantified impact]
  - Opta action: [what to recommend]

### Anti-Patterns to Avoid

- **Anti-pattern 1: Excessive Overdraw**
  - Why it hurts Apple Silicon: TBDR must process all fragments per tile
  - Impact: [quantified]

- **Anti-pattern 2: Immediate-Mode Rendering Assumptions**
  - Why it hurts Apple Silicon: Bypasses TBDR benefits
  - Impact: [quantified]

- **Anti-pattern 3: Excessive State Changes**
  - Why it hurts Apple Silicon: Metal optimized for batching
  - Impact: [quantified]

### Translation Layer Overhead

| Layer | Overhead | Notes |
|-------|----------|-------|
| Native Metal | 0% | Baseline |
| MoltenVK (Vulkan→Metal) | X% | [notes] |
| GPTK (DirectX 12→Metal) | X% | [notes] |
| CrossOver/Wine (DirectX→Vulkan→Metal) | X% | [notes] |
| Parallels (full VM) | X% | [notes] |

---

## 6. Cross-Domain Interactions

### GPU ↔ Memory

- **Unified Memory Contention**
  - When CPU and GPU compete for bandwidth: [impact]
  - Mitigation: [recommendation]

- **VRAM Equivalent Limits**
  - M1 (8GB): Effective GPU VRAM ~5GB
  - M1 Pro (16GB): Effective GPU VRAM ~10GB
  - M1 Max (32GB): Effective GPU VRAM ~20GB
  - [Continue for other chips]

### GPU ↔ Thermal

- **Thermal Budget Sharing**
  - CPU intensive + GPU intensive = [combined impact]
  - Strategy: [recommendation]

- **Form Factor Thermal Hierarchy**
  - Mac Pro > Mac Studio > MacBook Pro 16" > MacBook Pro 14" > Mac mini > MacBook Air

### GPU ↔ CPU

- **Draw Call Bottlenecks**
  - When CPU-bound (high draw calls): [symptoms]
  - Mitigation: [recommendation]

- **Rosetta 2 + GPU Combination**
  - x86 emulation overhead on CPU affects GPU feeding: [impact]

---

## 7. Confidence Notes

| Section | Confidence | Notes |
|---------|------------|-------|
| Core counts | High | Official Apple specs |
| Memory bandwidth | High | Official Apple specs |
| Resolution scaling | Medium | Benchmark aggregation |
| Settings impact | Medium | Game-dependent variation |
| Thermal behavior | Medium | Varies by environment, chip binning |
| Translation overhead | Medium | Varies by game complexity |
| Cross-domain interactions | Low | Complex interactions, limited data |

---

## 8. Source References

1. [Source 1 - URL or publication]
2. [Source 2 - URL or publication]
3. [Source 3 - URL or publication]
...

---

## 9. Update Log

| Date | Section | Change | Reason |
|------|---------|--------|--------|
| [date] | [section] | [change] | [reason] |
