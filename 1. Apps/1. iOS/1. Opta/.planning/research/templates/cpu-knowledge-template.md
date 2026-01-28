# Apple Silicon CPU Knowledge Base

## Document Metadata
- **Generated:** [Date]
- **Source:** Gemini 2.5 Pro Deep Research
- **Domain:** CPU Architecture & Optimization
- **Confidence:** [High/Medium/Low per section]

---

## 1. Hardware Specifications

### Core Configurations by Generation

| Chip | P-Cores | E-Cores | P-Core Clock | E-Core Clock |
|------|---------|---------|--------------|--------------|
| M1 | 4 | 4 | X GHz | X GHz |
| M1 Pro | 6-8 | 2 | X GHz | X GHz |
| M1 Max | 8 | 2 | X GHz | X GHz |
| M1 Ultra | 16 | 4 | X GHz | X GHz |
| M2 | ... | ... | ... | ... |
| M2 Pro | ... | ... | ... | ... |
| M2 Max | ... | ... | ... | ... |
| M2 Ultra | ... | ... | ... | ... |
| M3 | ... | ... | ... | ... |
| M3 Pro | ... | ... | ... | ... |
| M3 Max | ... | ... | ... | ... |
| M4 | ... | ... | ... | ... |
| M4 Pro | ... | ... | ... | ... |
| M4 Max | ... | ... | ... | ... |

### Cache Hierarchy

| Chip | L1 I-Cache | L1 D-Cache | L2 (P-Core) | L2 (E-Core) | SLC (System Level Cache) |
|------|------------|------------|-------------|-------------|--------------------------|
| M1 | X KB | X KB | X MB | X MB | X MB |
| M2 | ... | ... | ... | ... | ... |
| M3 | ... | ... | ... | ... | ... |
| M4 | ... | ... | ... | ... | ... |

### Cache Latency & Bandwidth

| Metric | M1 | M2 | M3 | M4 |
|--------|-----|-----|-----|-----|
| L1 Latency | X ns | ... | ... | ... |
| L2 Latency | X ns | ... | ... | ... |
| SLC Latency | X ns | ... | ... | ... |
| Memory Latency | X ns | ... | ... | ... |
| L1 Bandwidth | X GB/s | ... | ... | ... |
| L2 Bandwidth | X GB/s | ... | ... | ... |

---

## 2. Performance Curves

### Single-Thread Performance (Relative, M1 = 100%)

| Chip | Relative ST | Geekbench ST | Cinebench ST | Notes |
|------|-------------|--------------|--------------|-------|
| M1 | 100% | ~1700 | ~X | Baseline |
| M2 | X% | ~X | ~X | ... |
| M3 | X% | ~X | ~X | ... |
| M4 | X% | ~X | ~X | ... |

### Multi-Thread Scaling (Geekbench Multi-Core)

| Chip | 1T | 2T | 4T | 8T | All P-Cores | All Cores |
|------|-----|-----|-----|-----|-------------|-----------|
| M1 | 100% | X% | X% | X% | X% | X% |
| M1 Pro | ... | ... | ... | ... | ... | ... |
| M1 Max | ... | ... | ... | ... | ... | ... |
| M2 | ... | ... | ... | ... | ... | ... |
| M3 | ... | ... | ... | ... | ... | ... |
| M4 | ... | ... | ... | ... | ... | ... |

### Sustained vs Burst Performance (% of Peak After Time)

| Chip/Device | 10s | 1min | 5min | 10min | 30min |
|-------------|-----|------|------|-------|-------|
| M1 MacBook Air | 100% | X% | X% | X% | X% |
| M1 MacBook Pro | 100% | X% | X% | X% | X% |
| M1 Mac mini | 100% | X% | X% | X% | X% |
| M1 Mac Studio | 100% | X% | X% | X% | X% |
| M2 MacBook Air | 100% | X% | X% | X% | X% |
| M2 MacBook Pro | 100% | X% | X% | X% | X% |
| M3 MacBook Air | 100% | X% | X% | X% | X% |
| M3 MacBook Pro | 100% | X% | X% | X% | X% |
| M4 MacBook Pro | 100% | X% | X% | X% | X% |
| M4 Mac mini | 100% | X% | X% | X% | X% |

### Power Consumption Curves

| Load Level | M1 | M2 | M3 | M4 |
|------------|-----|-----|-----|-----|
| Idle | X W | ... | ... | ... |
| Light (25%) | X W | ... | ... | ... |
| Medium (50%) | X W | ... | ... | ... |
| Heavy (75%) | X W | ... | ... | ... |
| Max (100%) | X W | ... | ... | ... |

---

## 3. Scheduling Behavior

### QoS Class Core Affinity

| QoS Class | Typical Core Assignment | Priority Level | Use Case |
|-----------|------------------------|----------------|----------|
| User Interactive | P-cores strongly preferred | Highest | UI, game main thread, input handling |
| User Initiated | P-cores preferred | High | Game loading, response to user action |
| Default | Mixed | Normal | General application work |
| Utility | Mixed, E-cores when possible | Low | Background processing, indexing |
| Background | E-cores strongly preferred | Lowest | System maintenance, updates |

### Thread Count Thresholds

- **E-cores activated when:** Thread count exceeds [X] active threads
- **Mixed P+E scheduling begins at:** [X] threads
- **P-core saturation point:** [X] threads (all P-cores busy)
- **Typical game main thread behavior:** [description]
- **macOS thread migration behavior:** [description]

### Process Scheduling Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| QoS Class | High | Explicit priority hint from application |
| Thread Priority | Medium | POSIX thread priority (nice value) |
| CPU Time Usage | Medium | Threads using CPU heavily get P-cores |
| Recency | Low | Recently run threads get slight preference |

---

## 4. Rosetta 2 Translation

### Performance Overhead by Workload Type

| Workload Type | Native ARM | Rosetta 2 | Overhead | Notes |
|---------------|------------|-----------|----------|-------|
| Integer-heavy | 100% | X% | -X% | ... |
| Float-heavy | 100% | X% | -X% | ... |
| SIMD/AVX | 100% | X% | -X% | ... |
| Mixed typical | 100% | X% | -X% | ... |
| Typical x86 game | 100% | X% | -X% | ... |

### Translation Patterns

**Well-translated patterns:**
- [Pattern 1]
- [Pattern 2]
- [Pattern 3]

**Poorly-translated patterns:**
- [Pattern 1]
- [Pattern 2]
- [Pattern 3]

### JIT Warmup Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Initial translation overhead | X% | First run penalty |
| Warmup period duration | X seconds | Time to reach steady state |
| Translation cache location | ~/Library/... | Persistent across runs |
| Cache invalidation | On app update | ... |

---

## 5. Optimization Opportunities

### What Opta Can Influence

| Lever | Potential Impact | Method | Confidence |
|-------|------------------|--------|------------|
| Background process management | X-X% FPS improvement | Identify and suggest closing heavy background processes | High |
| Process priority hints | X-X% improvement | Recommend QoS class settings | Medium |
| Pre-warm Rosetta cache | X-X% faster game launch | Run game briefly before play session | Medium |
| Thermal headroom advice | X-X% sustained performance | Alert user to cooling conditions | Medium |
| Memory pressure reduction | X-X% improvement | Identify memory-hungry background apps | High |

### What's Outside Opta's Control

| Factor | Reason | Workaround |
|--------|--------|------------|
| Core scheduling | OS kernel decides, no API | Indirect influence via QoS hints |
| Clock frequency | Automatic, thermal-based | Optimize thermal conditions |
| Thread affinity | macOS doesn't expose | Use QoS appropriately |
| P-core reservation | OS manages | Reduce background load |

### Optimization Priority Matrix

| Game Type | CPU Bottleneck Likelihood | Primary Optimization Focus |
|-----------|---------------------------|---------------------------|
| FPS/Action | Low (usually GPU-bound) | Background process cleanup |
| RTS/4X Strategy | High (AI, pathfinding) | Maximum P-core availability |
| MMO | Medium (networking, entities) | Memory pressure, background |
| Open World | Medium (streaming, physics) | Thermal management |
| Simulation | High (calculations) | P-core availability, cooling |
| Indie/2D | Low | Minimal optimization needed |

---

## 6. Cross-Domain Interactions

### CPU <-> GPU Interactions

| Interaction | Impact | Detection | Mitigation |
|-------------|--------|-----------|------------|
| Draw call overhead | X ms per 1000 calls | High CPU, low GPU util | Game settings (draw distance) |
| GPU driver overhead | X% CPU overhead | ... | ... |
| Command buffer submission | X ms latency | ... | ... |
| Unified memory contention | X% bandwidth reduction | ... | ... |

### CPU <-> Memory Interactions

| Scenario | Impact | Indicators |
|----------|--------|------------|
| Memory latency bottleneck | X% performance loss | High CPU stalls |
| Bandwidth saturation | X% throughput cap | Memory pressure high |
| CPU-GPU bandwidth competition | X% reduction each | Both high util, lower perf |
| Cache pressure | X% performance loss | High L3 miss rate |

### CPU <-> Thermal Interactions

| Condition | P-Core Behavior | E-Core Behavior | Observed Temperatures |
|-----------|-----------------|-----------------|----------------------|
| Cool (< 60C) | Full boost | Full speed | Typical idle/light use |
| Warm (60-80C) | Full boost | Full speed | Normal gaming |
| Hot (80-95C) | Reduced boost | Full speed | Heavy sustained load |
| Throttling (> 95C) | Significant reduction | Slight reduction | Poor cooling scenario |

**Device-Specific Thermal Headroom:**

| Device | Passive Cooling Limit | Active Cooling Boost | Notes |
|--------|----------------------|---------------------|-------|
| MacBook Air (any) | X W | N/A (fanless) | Throttles under sustained load |
| MacBook Pro 14" | X W | +X W | Fan ramps at X% load |
| MacBook Pro 16" | X W | +X W | Better cooling, less throttle |
| Mac mini | X W | +X W | Good cooling, small form |
| Mac Studio | X W | +X W | Best sustained performance |

---

## 7. Game-Specific Patterns

### CPU-Intensive Game Genres

| Genre | Typical CPU Load | Thread Pattern | Bottleneck Characteristics |
|-------|------------------|----------------|---------------------------|
| RTS/4X Strategy | High (60-80%) | Multi-threaded AI | Pathfinding, unit management |
| MMO | High (50-70%) | Mixed | Network processing, entity count |
| Open World | Medium-High (40-60%) | Streaming threads | Asset loading, physics |
| FPS/Shooter | Medium (30-50%) | Main + physics | Usually GPU-bound |
| Simulation | High (70-90%) | Highly parallel | Pure calculation |
| Racing | Medium (30-40%) | Physics focused | AI cars, physics |
| Indie/2D | Low (10-30%) | Usually single-thread | Rarely CPU-bound |

### CPU Overhead Sources in Games

| Source | Typical Overhead | Mitigation |
|--------|------------------|------------|
| Draw call preparation | X ms/1000 calls | Reduce draw distance |
| Physics simulation | X ms per X objects | Lower physics quality |
| AI computation | X ms per X units | Reduce AI quality/count |
| Audio processing | X ms | Lower audio quality |
| Script/Lua execution | Variable | Game-specific |

---

## 8. Confidence Notes

| Section | Confidence | Data Sources | Notes |
|---------|------------|--------------|-------|
| Core configurations | High | Official Apple specs, die analysis | Verified |
| Clock speeds | High | Apple specs, benchmark measurements | Verified |
| Cache hierarchy | Medium-High | Die analysis, performance testing | Some inference |
| Performance curves | Medium | Benchmark aggregation | Varies by workload |
| Scheduling behavior | Medium | Observed behavior, Apple docs | Not fully documented |
| Rosetta overhead | Medium | Benchmark comparisons | Varies significantly |
| Optimization opportunities | Medium | Testing, community reports | Needs validation |
| Cross-domain interactions | Medium-Low | Inference, limited testing | Complex system behavior |
| Game-specific patterns | Medium | Community benchmarks, testing | Game-dependent |

---

## 9. Research Gaps & Future Investigation

| Gap | Priority | Investigation Method |
|-----|----------|---------------------|
| [Gap 1] | High/Medium/Low | [Method] |
| [Gap 2] | ... | ... |
| [Gap 3] | ... | ... |

---

## 10. Key Takeaways for Opta

1. **Primary optimization lever:** [Summary]
2. **Secondary optimization lever:** [Summary]
3. **Most impactful user-facing recommendation:** [Summary]
4. **What NOT to promise users:** [Summary]
5. **Integration with Phase 47 Configuration Calculator:** [How this data feeds into optimization recommendations]
