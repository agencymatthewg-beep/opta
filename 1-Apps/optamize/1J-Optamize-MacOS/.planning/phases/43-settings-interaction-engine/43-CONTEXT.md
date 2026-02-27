# Phase 43: Settings Interaction Engine - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<vision>
## How This Should Work

A dependency graph where game settings have explicit relationships to each other. When you change one setting, the engine knows what else is affected — what's required, what conflicts, and what becomes expensive.

This is foundational infrastructure, not user-facing. The graph models three relationship types:
1. **Hard dependencies** — Setting A requires Setting B (Ray Tracing requires certain shadow levels)
2. **Mutual exclusions** — Setting A conflicts with Setting B (TAA vs DLSS)
3. **Performance trade-offs** — Setting A at HIGH makes Setting B expensive (4K + Ultra shadows = GPU bottleneck)

The engine doesn't make recommendations — it provides the relationship data that Phase 47 (Configuration Calculator) uses to compute optimal configurations.

</vision>

<essential>
## What Must Be Nailed

- **Complete relationship modeling** — All three relationship types (dependencies, conflicts, performance) in one unified graph structure
- **Foundation for Phase 47** — Data must be in the right format for the Configuration Calculator to query and reason about
- **Accurate interaction rules** — Wrong rules = wrong recommendations downstream

</essential>

<specifics>
## Specific Ideas

Three priority areas for settings interactions:

1. **Resolution + Upscaling**
   - Native resolution vs DLSS/FSR/MetalFX
   - How upscaling interacts with render resolution
   - Performance vs quality trade-offs at different scales

2. **Ray Tracing Cascades**
   - RT Reflections, RT Shadows, RT Global Illumination
   - How enabling one affects cost of others
   - Total performance budget for RT features combined

3. **Apple Silicon Specifics**
   - Metal API settings interactions
   - ProMotion (120Hz) implications
   - High Power Mode interactions with other settings
   - How these differ from Windows/discrete GPU patterns

</specifics>

<notes>
## Additional Context

This phase builds directly on Phase 42's hardware synergy data (85 entries). The hardware data tells us what the hardware can do; this phase tells us how settings interact on top of that.

The dependency graph needs to work both ways:
- Forward: "If I enable this, what else changes?"
- Backward: "What do I need to enable/disable to use this?"

</notes>

---

*Phase: 43-settings-interaction-engine*
*Context gathered: 2026-01-18*
