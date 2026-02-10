# Opta

## What This Is

Opta is an AI-powered PC/Gaming optimization orchestrator that replaces the fragmented mess of competing optimization tools with ONE unified solution. It scans hardware, detects conflicts, and delivers measurable FPS gains through intelligent, context-aware settings optimization. Built for PC gamers who want real performance improvements without the guesswork.

## Core Value

**One tool to replace them all.** Opta eliminates the chaos of multiple conflicting optimizers (GeForce Experience, Razer Cortex, OMEN Hub, manual registry tweaks) that often interfere with each other and make things worse without you knowing. It detects conflicts, explains what it's doing, and delivers measurable, verifiable performance gains.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time hardware telemetry (CPU/GPU temps, RAM, processes)
- [ ] One-click game optimization with measurable FPS gains
- [ ] Conflict detection - warn about competing optimization tools
- [ ] "Stealth Mode" - kill unnecessary background processes
- [ ] Game-specific optimal settings from community benchmarks
- [ ] Optimization Score - shareable metric for viral loop
- [ ] Explain WHY each optimization is applied (transparency)
- [ ] Cross-platform support (Windows, macOS, Linux)
- [ ] Local-first AI (Llama 3 8B) for routine queries
- [ ] Cloud AI (Claude) for complex reasoning when needed

### Out of Scope

- Health & Wellness tab — v2+ (focus on gaming first)
- Business & Workflow tab — v2+ (focus on gaming first)
- Purchases & Recommendations tab — v2+ (focus on gaming first)
- Custom trained model — use existing LLMs first, train after traction with user data
- Mobile apps — desktop only (Windows/macOS/Linux), mobile is future scope
- Automatic disabling of other tools — detect and warn only, user decides
- Enterprise features — bootstrapped/solo, consumer focus first

## Context

**Market Gap:** Existing PC optimization tools are:
1. **Vendor-locked** - GeForce Experience only for NVIDIA, OMEN Hub only for HP hardware
2. **Conflicting** - Multiple tools trying to optimize the same things, causing interference
3. **Black box** - Change settings without explaining why or what
4. **Generic** - Don't account for specific hardware + game combinations

**Unique Value:** Opta is:
- Hardware-agnostic (works with any PC)
- Conflict-aware (detects and warns about other tools)
- Transparent (explains every optimization)
- Measurable (benchmarks before/after, shareable scores)
- AI-powered (adapts to specific user context)

**Technical Approach:**
- Desktop app built with Tauri (Rust + WebView) - cross-platform, small, fast
- Python MCP servers for hardware telemetry and system optimization
- Hybrid LLM: Local Llama 3 8B for routine queries (zero cost), Claude API for complex reasoning
- Local ChromaDB for user preferences and optimization knowledge
- Human-in-the-loop for all system-modifying actions

**Prior Research:** Three comprehensive documents created with Gemini cover:
- Architectural validation and MCP integration strategy
- Cost-efficient hybrid AI deployment
- Feature ideation, competitive landscape, and monetization

## Constraints

- **Cross-platform**: Must work on Windows, macOS, and Linux from v1 — Tauri enables this
- **Privacy-first**: Sensitive hardware/usage data stays local, cloud AI only sees anonymized context
- **Low ongoing costs**: Bootstrapped project — maximize local inference, minimize API spend
- **Human-in-the-loop**: All system-modifying actions require explicit user approval

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gaming/PC first, other domains later | Viral hook, easiest to demo, clearest value prop | — Pending |
| Tauri over Electron | Smaller, faster, Rust-based, better for performance tool | — Pending |
| Hybrid LLM (local + cloud) | Zero cost for routine, quality for complex, privacy preserved | — Pending |
| MCP for all integrations | Standardized, modular, future-proof | — Pending |
| Detect conflicts, warn only | Automatic disabling too aggressive, let user decide | — Pending |
| Shareable Optimization Score | Viral loop for growth, gamification for retention | — Pending |

---
*Last updated: 2026-01-15 after initialization*
