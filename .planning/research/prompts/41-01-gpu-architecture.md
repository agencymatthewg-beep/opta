# Gemini Deep Research Prompt: Apple Silicon GPU Architecture

## Research Mission

You are conducting deep research to build an optimization knowledge base for Apple Silicon GPUs. The goal is understanding exactly what can be optimized and by how much — not academic concepts, but measurable impacts.

## Core Questions to Explore

### Architecture Fundamentals
1. **Tile-Based Deferred Rendering (TBDR)**
   - How does Apple's TBDR implementation differ from traditional immediate-mode renderers?
   - What are the tile sizes for each generation (M1, M2, M3, M4)?
   - How does tile memory bandwidth affect performance?
   - What rendering patterns benefit most from TBDR? What patterns hurt it?

2. **GPU Core Configurations**
   - Exact GPU core counts: M1 (7-8), M1 Pro (14-16), M1 Max (24-32), M1 Ultra (48-64)
   - Same breakdown for M2, M3, M4 generations
   - How do GPU cores scale with binning (full vs partial configurations)?
   - Clock speeds and boost behavior under different thermal conditions

3. **Unified Memory GPU Access**
   - Memory bandwidth available to GPU: M1 (68.25 GB/s) through M4 Ultra (expected)
   - How does GPU memory bandwidth compare to dedicated VRAM?
   - Texture streaming patterns that optimize unified memory
   - When does GPU memory pressure cause performance cliffs?

### Performance Curves (CRITICAL)
4. **Resolution Scaling Impact**
   - FPS curves at 1080p, 1440p, 4K, 5K for each chip variant
   - At what resolution does each chip become GPU-limited?
   - Resolution scaling efficiency (% performance per resolution step)

5. **Graphics Settings Impact**
   - Shadow quality: FPS cost per quality tier (off/low/medium/high/ultra)
   - Anti-aliasing: TAA vs FXAA vs MSAA performance costs
   - Post-processing: Bloom, DoF, motion blur — individual costs
   - Ray tracing (M3+): Performance impact on supported titles

6. **Thermal Throttling Curves**
   - At what temperature does GPU throttle on each device form factor?
   - MacBook Air vs MacBook Pro vs Mac Studio thermal headroom
   - Sustained vs burst GPU performance over time

### Optimization Levers
7. **Metal-Specific Optimizations**
   - Metal Performance Shaders (MPS) advantages
   - Argument buffers and indirect command encoding benefits
   - Tile shading optimizations specific to Apple GPUs
   - What DirectX/Vulkan patterns translate poorly to Metal?

8. **Game-Specific Patterns**
   - Common bottlenecks in games running via Rosetta 2 + translation layers
   - CrossOver/Parallels GPU overhead
   - Native Metal games vs ported games performance delta

## Output Format Requirements

Structure your findings as:

1. **Executive Summary** - Key optimization insights (1 page max)
2. **Hardware Specifications Tables** - All generations, all variants, exact numbers
3. **Performance Curves** - Formatted as data tables that can become charts
4. **Optimization Decision Trees** - "If X, then optimize Y"
5. **Cross-Reference Matrix** - How GPU settings interact with CPU/Memory/Thermals

## Research Depth Guidance

- Prioritize real benchmark data over theoretical specifications
- Include sources for all numerical claims
- Flag uncertain data with confidence levels
- Focus on what Opta can actually change vs. hardware limits
