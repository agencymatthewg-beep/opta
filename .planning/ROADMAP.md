# Roadmap: Opta

## Overview

Opta transforms from an empty Tauri scaffold into a full-featured AI-powered PC optimization orchestrator. Built on three pillars—**Unified Optimization**, **Adaptive Intelligence**, and **Educational Empowerment**—the journey starts with core infrastructure, builds through system management, integrates AI, then delivers personalized, understandable optimization with measurable results.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri app scaffold, project structure, basic UI shell
- [x] **Phase 2: Hardware Telemetry** - CPU/GPU/RAM monitoring via Python MCP server
- [x] **Phase 3: Process Management** - Process listing, "Stealth Mode" background process killer
- [x] **Phase 3.1: Design System** - INSERTED: shadcn/ui integration, restyle all components for futuristic aesthetic
- [x] **Phase 4: Conflict Detection** - Detect competing optimization tools, warn users
- [x] **Phase 5: Local LLM Integration** - Llama 3 8B setup for routine queries
- [x] **Phase 6: Cloud LLM Integration** - Claude API for complex reasoning, hybrid routing
- [x] **Phase 7: Game Detection & Profiles** - Detect installed games, community benchmark settings
- [x] **Phase 8: Optimization Engine** - Apply settings, before/after benchmarking, explain changes
- [x] **Phase 8.1: Adaptive Intelligence** - INSERTED: User profile storage, pattern learning, personalized recommendations
- [x] **Phase 9: Optimization Score** - Shareable metric, gamification, viral loop
- [ ] **Phase 10: Polish, Education & Launch** - Cross-platform testing, Learn Mode, visual explanations, UX refinement

## Phase Details

### Phase 1: Foundation
**Goal**: Establish Tauri app with project structure, basic navigation, and UI shell
**Depends on**: Nothing (first phase)
**Research**: Unlikely (Tauri patterns established)
**Plans**: TBD

Plans:
- [x] 01-01: Tauri project initialization and toolchain setup
- [x] 01-02: Basic UI shell with navigation structure
- [x] 01-03: Cross-platform build configuration

### Phase 2: Hardware Telemetry
**Goal**: Real-time CPU/GPU/RAM monitoring displayed in the app
**Depends on**: Phase 1
**Research**: Likely (cross-platform hardware APIs)
**Research topics**: psutil and alternatives, GPU monitoring (nvidia-smi, AMD equivalents), MCP server patterns for Tauri, cross-platform temperature APIs
**Plans**: TBD

Plans:
- [x] 02-01: Python MCP server for hardware telemetry
- [x] 02-02: Tauri integration with MCP server
- [x] 02-03: Real-time telemetry dashboard UI

### Phase 3: Process Management
**Goal**: List running processes and implement "Stealth Mode" to kill unnecessary background processes
**Depends on**: Phase 2
**Research**: Likely (cross-platform process control)
**Research topics**: Safe process termination patterns, process priority management, cross-platform process APIs, gaming-specific "safe to kill" process lists
**Plans**: TBD

Plans:
- [x] 03-01: Process listing and categorization
- [x] 03-02: Stealth Mode implementation with safe process termination

### Phase 3.1: Design System (INSERTED)
**Goal**: Integrate shadcn/ui component library and restyle all existing components for a futuristic, powerful, simple aesthetic
**Depends on**: Phase 3
**Research**: Unlikely (shadcn/ui well-documented)
**Plans**: TBD

Plans:
- [x] 03.1-01: Install and configure shadcn/ui with Tailwind
- [x] 03.1-02: Restyle navigation and layout components
- [x] 03.1-03: Restyle telemetry and process components

### Phase 4: Conflict Detection
**Goal**: Detect competing optimization tools and warn users about conflicts
**Depends on**: Phase 3
**Research**: Likely (competitor tool signatures)
**Research topics**: Registry/file patterns for GeForce Experience, Razer Cortex, OMEN Hub, MSI Afterburner; running process signatures; startup entry detection
**Plans**: TBD

Plans:
- [x] 04-01: Competitor tool detection engine
- [x] 04-02: Conflict warning UI and recommendations

### Phase 5: Local LLM Integration
**Goal**: Integrate Llama 3 8B for zero-cost routine queries
**Depends on**: Phase 1
**Research**: Likely (local LLM deployment)
**Research topics**: llama.cpp vs ollama, memory requirements, model download/management, prompt patterns for PC optimization, response streaming
**Plans**: TBD

Plans:
- [x] 05-01: Local LLM runtime setup (llama.cpp/ollama)
- [x] 05-02: Chat interface with streaming responses
- [x] 05-03: Optimization-focused prompt templates

### Phase 6: Cloud LLM Integration
**Goal**: Claude API integration for complex reasoning with hybrid routing
**Depends on**: Phase 5
**Research**: Likely (hybrid LLM patterns)
**Research topics**: Claude API best practices, query complexity classification, cost optimization strategies, privacy-preserving context passing
**Plans**: TBD

Plans:
- [ ] 06-01: Claude API integration
- [ ] 06-02: Hybrid routing logic (local vs cloud)
- [ ] 06-03: Privacy-preserving context anonymization

### Phase 7: Game Detection & Profiles
**Goal**: Detect installed games and apply community-sourced optimal settings
**Depends on**: Phase 4
**Research**: Likely (game detection methods)
**Research topics**: Steam/Epic/GOG game detection APIs, game config file locations, community benchmark databases (PCGamingWiki, etc.), per-game settings formats
**Plans**: TBD

Plans:
- [ ] 07-01: Game detection across launchers
- [ ] 07-02: Community settings database integration
- [ ] 07-03: Game profile management UI

### Phase 8: Optimization Engine
**Goal**: Apply optimizations with before/after benchmarking and transparency
**Depends on**: Phase 7, Phase 6
**Research**: Unlikely (building on established patterns)
**Plans**: 4

Plans:
- [x] 08-01: Optimization action framework with rollback
- [x] 08-02: Before/after benchmarking system
- [x] 08-03: Optimization explanation and transparency UI
- [x] 08-04: Human-in-the-loop approval flow

### Phase 8.1: Adaptive Intelligence (INSERTED)
**Goal**: Implement user profile storage and pattern learning for personalized recommendations
**Depends on**: Phase 8
**Research**: Likely (user modeling, local storage patterns)
**Research topics**: SQLite vs JSON for profile storage, preference learning algorithms, recommendation personalization, privacy-preserving local analytics

Plans:
- [x] 08.1-01: User profile storage system (local SQLite/JSON)
- [x] 08.1-02: Pattern learning from optimization choices
- [x] 08.1-03: Personalized recommendation engine
- [x] 08.1-04: Transparency panel (view/edit/delete learned data)

### Phase 9: Optimization Score
**Goal**: Shareable optimization metric for viral growth and gamification
**Depends on**: Phase 8
**Research**: Unlikely (internal scoring logic)
**Plans**: 3

Plans:
- [x] 09-01: Enhanced scoring algorithm with three dimensions (Performance, Experience, Competitive), wow factors (money saved, percentile), hardware tier detection
- [x] 09-02: Shareable score card UI with visualization components, timeline animation, export functionality
- [x] 09-03: Leaderboard with hardware tier filtering, milestone badges system

### Phase 10: Polish, Education & Launch
**Goal**: Cross-platform testing, educational features, UX refinement, and launch preparation
**Depends on**: Phase 9, Phase 8.1
**Research**: Likely (educational UX patterns, progressive disclosure)
**Research topics**: Interactive tutorial patterns, visual explanation libraries, progressive disclosure UX, expertise detection heuristics

Plans:
- [ ] 10-01: Cross-platform testing (Windows, macOS, Linux)
- [ ] 10-02: UX polish and performance optimization
- [x] 10-03: Documentation and launch materials
- [ ] 10-04: Learn Mode implementation (explains actions in real-time)
- [ ] 10-05: Visual explanation components (diagrams/animations for concepts)
- [ ] 10-06: Investigation mode for power users (deep-dive analysis)
- [ ] 10-07: Expertise-level detection (adjust tip complexity)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5 → 6 → 7 → 8 → 8.1 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-15 |
| 2. Hardware Telemetry | 3/3 | Complete | 2026-01-15 |
| 3. Process Management | 2/2 | Complete | 2026-01-15 |
| 3.1 Design System | 3/3 | Complete | 2026-01-15 |
| 4. Conflict Detection | 2/2 | Complete | 2026-01-15 |
| 5. Local LLM Integration | 3/3 | Complete | 2026-01-15 |
| 6. Cloud LLM Integration | 3/3 | Complete | 2026-01-15 |
| 7. Game Detection & Profiles | 3/3 | Complete | 2026-01-15 |
| 8. Optimization Engine | 4/4 | Complete | 2026-01-16 |
| 8.1 Adaptive Intelligence | 4/4 | Complete | 2026-01-16 |
| 9. Optimization Score | 3/3 | Complete | 2026-01-16 |
| 10. Polish, Education & Launch | 1/7 | In progress | - |
