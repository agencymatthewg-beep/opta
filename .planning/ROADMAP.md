# Roadmap: Opta

## Overview

Opta transforms from an empty Tauri scaffold into a full-featured AI-powered PC optimization orchestrator. The journey starts with core infrastructure (app shell, hardware monitoring), builds through system management capabilities (process control, conflict detection), integrates AI (local + cloud LLM), then delivers the core value proposition (game optimization with measurable gains and shareable scores).

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri app scaffold, project structure, basic UI shell
- [x] **Phase 2: Hardware Telemetry** - CPU/GPU/RAM monitoring via Python MCP server
- [ ] **Phase 3: Process Management** - Process listing, "Stealth Mode" background process killer
- [ ] **Phase 4: Conflict Detection** - Detect competing optimization tools, warn users
- [ ] **Phase 5: Local LLM Integration** - Llama 3 8B setup for routine queries
- [ ] **Phase 6: Cloud LLM Integration** - Claude API for complex reasoning, hybrid routing
- [ ] **Phase 7: Game Detection & Profiles** - Detect installed games, community benchmark settings
- [ ] **Phase 8: Optimization Engine** - Apply settings, before/after benchmarking, explain changes
- [ ] **Phase 9: Optimization Score** - Shareable metric, gamification, viral loop
- [ ] **Phase 10: Polish & Launch** - Cross-platform testing, UX refinement, documentation

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
- [ ] 03-01: Process listing and categorization
- [ ] 03-02: Stealth Mode implementation with safe process termination

### Phase 4: Conflict Detection
**Goal**: Detect competing optimization tools and warn users about conflicts
**Depends on**: Phase 3
**Research**: Likely (competitor tool signatures)
**Research topics**: Registry/file patterns for GeForce Experience, Razer Cortex, OMEN Hub, MSI Afterburner; running process signatures; startup entry detection
**Plans**: TBD

Plans:
- [ ] 04-01: Competitor tool detection engine
- [ ] 04-02: Conflict warning UI and recommendations

### Phase 5: Local LLM Integration
**Goal**: Integrate Llama 3 8B for zero-cost routine queries
**Depends on**: Phase 1
**Research**: Likely (local LLM deployment)
**Research topics**: llama.cpp vs ollama, memory requirements, model download/management, prompt patterns for PC optimization, response streaming
**Plans**: TBD

Plans:
- [ ] 05-01: Local LLM runtime setup (llama.cpp/ollama)
- [ ] 05-02: Chat interface with streaming responses
- [ ] 05-03: Optimization-focused prompt templates

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
**Research**: Likely (system modification patterns)
**Research topics**: Windows registry optimization tweaks, GPU driver settings (NVIDIA Control Panel, AMD Adrenalin), safe system modifications, benchmarking methods, rollback strategies
**Plans**: TBD

Plans:
- [ ] 08-01: Optimization action framework with rollback
- [ ] 08-02: Before/after benchmarking system
- [ ] 08-03: Optimization explanation and transparency UI
- [ ] 08-04: Human-in-the-loop approval flow

### Phase 9: Optimization Score
**Goal**: Shareable optimization metric for viral growth and gamification
**Depends on**: Phase 8
**Research**: Unlikely (internal scoring logic)
**Plans**: TBD

Plans:
- [ ] 09-01: Scoring algorithm implementation
- [ ] 09-02: Shareable score card generation
- [ ] 09-03: Leaderboard and comparison features

### Phase 10: Polish & Launch
**Goal**: Cross-platform testing, UX refinement, and launch preparation
**Depends on**: Phase 9
**Research**: Unlikely (testing and refinement)
**Plans**: TBD

Plans:
- [ ] 10-01: Cross-platform testing (Windows, macOS, Linux)
- [ ] 10-02: UX polish and performance optimization
- [ ] 10-03: Documentation and launch materials

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-15 |
| 2. Hardware Telemetry | 3/3 | Complete | 2026-01-15 |
| 3. Process Management | 0/2 | Not started | - |
| 4. Conflict Detection | 0/2 | Not started | - |
| 5. Local LLM Integration | 0/3 | Not started | - |
| 6. Cloud LLM Integration | 0/3 | Not started | - |
| 7. Game Detection & Profiles | 0/3 | Not started | - |
| 8. Optimization Engine | 0/4 | Not started | - |
| 9. Optimization Score | 0/3 | Not started | - |
| 10. Polish & Launch | 0/3 | Not started | - |
