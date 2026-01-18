# Gemini Deep Research Prompt: Apple Silicon CPU Architecture

## Research Mission

You are conducting deep research to build an optimization knowledge base for Apple Silicon CPUs. The goal is understanding exactly how P-cores and E-cores behave under gaming/productivity workloads, what can be optimized, and by how much.

## Core Questions to Explore

### Architecture Fundamentals
1. **Core Configurations**
   - Exact P-core and E-core counts for each variant:
     - M1: 4P+4E, M1 Pro: 8P+2E or 6P+2E, M1 Max: 8P+2E, M1 Ultra: 16P+4E
     - Same breakdown for M2, M3, M4 generations
   - Clock speeds: P-core boost, E-core max, sustained frequencies
   - How does binning affect core quality?

2. **Performance/Efficiency Core Behavior**
   - What triggers P-core vs E-core scheduling?
   - Thread affinity: Can apps request specific core types?
   - QoS (Quality of Service) classes in macOS and their core affinity
   - How does macOS handle single-threaded vs multi-threaded workloads?

3. **Cache Hierarchy**
   - L1, L2, L3 cache sizes per generation
   - Shared vs per-core cache architecture
   - Cache latency and bandwidth numbers
   - When does cache pressure become a bottleneck?

### Performance Curves (CRITICAL)
4. **Single-Thread Performance**
   - Geekbench/Cinebench single-thread scores by chip
   - Real-world IPC (instructions per clock) comparisons
   - Single-thread performance vs Intel/AMD equivalents
   - Games that are single-thread limited on Apple Silicon

5. **Multi-Thread Scaling**
   - How well do workloads scale from 1 to N threads?
   - P-core only vs P+E mixed workload performance
   - At what thread count do E-cores start being used?
   - Multi-thread efficiency: M1 vs M2 vs M3 vs M4 progression

6. **Sustained Performance**
   - Single-thread sustained vs burst (over 1, 5, 10 minutes)
   - Multi-thread sustained vs burst
   - How does device form factor affect CPU sustained performance?
   - Power consumption curves under different loads

### Optimization Levers
7. **Process Priority & Scheduling**
   - How does macOS schedule game processes?
   - Background process impact on game performance
   - Can we influence core affinity through process priority?
   - App Nap and related power management behaviors

8. **Rosetta 2 Translation**
   - CPU overhead of Rosetta 2 translation
   - Which instruction patterns translate poorly?
   - JIT compilation behavior and warmup effects
   - Native ARM vs translated x86 performance delta (typical ranges)

9. **Game-Specific CPU Patterns**
   - CPU-intensive game genres (strategy, simulation, MMO)
   - Draw call overhead on Apple Silicon
   - Physics simulation performance
   - AI/pathfinding workload characteristics

### Cross-Domain Interactions
10. **CPU <-> Memory Interactions**
    - Memory latency impact on CPU-bound workloads
    - Memory bandwidth saturation scenarios
    - Unified memory: CPU and GPU competing for bandwidth

11. **CPU <-> Thermal Interactions**
    - At what temperatures do P-cores throttle?
    - E-core throttle points vs P-core throttle points
    - Thermal headroom by device type

## Output Format Requirements

Structure your findings as:

1. **Executive Summary** - Key CPU optimization insights (1 page max)
2. **Core Configuration Tables** - All generations, all variants, exact numbers
3. **Performance Curves** - Single-thread, multi-thread, sustained
4. **Scheduling Behavior** - How macOS assigns work to cores
5. **Optimization Opportunities** - What Opta can actually influence
6. **Cross-Reference Matrix** - CPU interactions with GPU/Memory/Thermals

## Research Depth Guidance

- Prioritize real benchmark data over theoretical specifications
- Include Rosetta 2 performance considerations for games
- Focus on gaming/real-time workloads, not just synthetic benchmarks
- Flag uncertain data with confidence levels
- Distinguish between what apps can control vs OS-level behavior
