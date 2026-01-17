# Roadmap: Opta

## Overview

Opta transforms from an empty Tauri scaffold into a full-featured AI-powered PC optimization orchestrator. Built on three pillars—**Unified Optimization**, **Adaptive Intelligence**, and **Educational Empowerment**—the journey starts with core infrastructure, builds through system management, integrates AI, then delivers personalized, understandable optimization with measurable results.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-10 (shipped 2026-01-16)
- ✅ **v1.1 macOS Refinement** - Phases 11-15 (shipped 2026-01-16)
- 📋 **v2.0 Social, Chess & Windows** - Phases 16-18 (planned)
- 📋 **v3.0 Native Platforms** - Phase 19 (planned)
- 📋 **v4.0 Rich Features** - Phases 20-23 (planned)

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
- [x] **Phase 10: Polish, Education & Launch** - Cross-platform testing, Learn Mode, visual explanations, UX refinement
- [x] **Phase 11: Foundation & Stability** - Critical bug fixes, error boundaries, design system compliance
- [x] **Phase 12: UX Flow Polish** - Navigation fixes, loading states, session flow improvements
- [x] **Phase 13: Core Features** - Opta Text Zone, Communication Style, Preference Presets, Pinpoint Mode
- [x] **Phase 14: Educational Enhancement** - Expertise-adaptive explanations, learning visibility, rollback
- [x] **Phase 15: Performance & Launch** - Performance optimization, macOS polish, launch preparation
- [x] **Phase 16: Social Features** - Score sharing and export (v2.0)
- [ ] **Phase 17: Chess Integration** - Ambient chess, three modes, AI opponents (v2.0)
- [ ] **Phase 18: Windows Platform** - Windows-specific testing, installer, conflict tools (v2.0)
- [ ] **Phase 19: Native macOS** - Full native Swift/SwiftUI build for maximum hardware utilization (v3.0)
- [ ] **Phase 20: Rich Interactions** - Command palette, drag-drop, gestures, shortcuts, haptics, accessibility (v4.0)
- [ ] **Phase 21: Advanced Visualizations** - ECharts telemetry, flame graphs, treemaps, deep glow effects (v4.0)
- [ ] **Phase 22: AI/ML Intelligence** - Time series forecasting, anomaly detection, smart recommendations (v4.0)
- [ ] **Phase 23: Cross-Device Sync** - ElectricSQL cloud sync, P2P LAN sync, offline-first (v4.0)

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
- [x] 10-01: Cross-platform testing (Windows, macOS, Linux)
- [x] 10-02: UX polish and performance optimization
- [x] 10-03: Documentation and launch materials
- [x] 10-04: Learn Mode implementation (explains actions in real-time)
- [x] 10-05: Visual explanation components (diagrams/animations for concepts)
- [x] 10-06: Investigation mode for power users (deep-dive analysis)
- [x] 10-07: Expertise-level detection (adjust tip complexity)

### ✅ v1.1 macOS Refinement (Complete)

**Milestone Goal:** Polish aesthetic, complete core features, fix foundations, improve UX flow for a polished macOS experience.

#### Phase 11: Foundation & Stability
**Goal**: Fix critical bugs, add error handling, ensure stability
**Depends on**: Phase 10 (v1.0 complete)
**Research**: Unlikely (bug fixes and error handling)

Plans:
- [x] 11-01: Critical bug fixes (memory leak, error boundaries)
- [x] 11-02: Design system compliance audit
- [x] 11-03: State persistence improvements

#### Phase 12: UX Flow Polish
**Goal**: Remove dead-ends, improve navigation, add loading states
**Depends on**: Phase 11
**Research**: Unlikely (UX improvements)

Plans:
- [x] 12-01: Navigation fixes (dead-ends, mobile)
- [ ] 12-02: Loading & error states
- [ ] 12-03: Session flow improvements

#### Phase 13: Core Features
**Goal**: Implement critical missing features from MUST_HAVE
**Depends on**: Phase 12
**Research**: Likely (UX patterns for text zone)

Plans:
- [x] 13-01: Opta Text Zone implementation
- [x] 13-02: Communication style preference
- [x] 13-03: Preference presets system
- [x] 13-04: Pinpoint optimization mode

#### Phase 14: Educational Enhancement
**Goal**: Deepen Learn Mode and personalized learning visibility
**Depends on**: Phase 13
**Research**: Unlikely (building on existing Learn Mode)

Plans:
- [x] 14-01: Expertise-adaptive explanations
- [x] 14-02: Learning visibility (callouts, summaries)
- [x] 14-03: Smart error recovery (rollback)

#### Phase 15: Performance & Launch
**Goal**: Optimize performance, test thoroughly, prepare release
**Depends on**: Phase 14
**Research**: Unlikely (optimization and testing)

Plans:
- [x] 15-01: Performance optimization
- [x] 15-02: macOS-specific polish
- [x] 15-03: Launch preparation

### 📋 v2.0 Social, Chess & Windows (Planned)

**Milestone Goal:** Add social features, integrate chess, then expand to Windows platform.

#### Phase 16: Social Features
**Goal**: Simple score sharing and export - no backend, no accounts
**Depends on**: Phase 15 (v1.1 complete)
**Research**: Complete (16-RESEARCH.md)

Plans:
- [x] 16-01: Score sharing (ShareCard, export, Twitter/Discord)

#### Phase 17: Chess Integration
**Goal**: Ambient chess experience with three modes and AI opponents
**Depends on**: Phase 16
**Research**: Likely (chess engines, UI patterns)

Plans:
- [x] 17-01: Chess foundation - dependencies and TypeScript types
- [x] 17-02: Chess hooks - useChessGame and useStockfish
- [x] 17-03: Chess UI components - ChessBoard, GameControls, MoveHistory
- [x] 17-04: ChessPage integration - three-mode architecture and navigation

#### Phase 18: Windows Platform
**Goal**: Windows-specific testing, installer improvements, and platform-native conflict detection
**Depends on**: Phase 17
**Research**: Likely (Windows installer, registry patterns)
**Research topics**: Tauri Windows installer customization, Windows registry conflict detection, UAC handling, Windows-specific process signatures

Plans:
- [ ] 18-01: Windows installer customization (NSIS hooks and branding)
- [ ] 18-02: Registry-based conflict detection (installed programs scanning)
- [ ] 18-03: Windows build and verification (checkpoint on real hardware)

### 📋 v3.0 Native Platforms (Planned)

**Milestone Goal:** Create fully native platform builds for maximum hardware utilization and performance.

#### Phase 19: Native macOS
**Goal**: Full native Swift/SwiftUI build with direct hardware access for maximum Apple Silicon utilization
**Depends on**: Phase 18 (v2.0 complete)
**Research**: Complete (19-RESEARCH.md)
**Research topics**: Swift/SwiftUI, IOKit, SMC sensor access, privileged helpers, menu bar apps, NSVisualEffectView

Plans:
- [ ] 19-01: Xcode project foundation with SwiftUI template and SPM dependencies
- [ ] 19-02: SMC module integration with chip detection and sensor key mapping
- [ ] 19-03: UI foundation with glass effects (NSVisualEffectView) and design system
- [ ] 19-04: Privileged helper tool for process termination via SMJobBless
- [ ] 19-05: Hardware telemetry services with @Observable pattern
- [ ] 19-06: Menu bar integration with live stats popup
- [ ] 19-07: Main window dashboard with process management

*Note: Native Windows phase will follow after macOS native is complete.*

### 📋 v4.0 Rich Features (Planned)

**Milestone Goal:** Add cutting-edge interactions, visualizations, intelligence, and cross-device sync for competitive differentiation.

#### Phase 20: Rich Interactions
**Goal**: Command palette, drag-drop, trackpad gestures, global shortcuts, haptics, accessibility
**Depends on**: Phase 19 (v3.0 complete) or can start earlier
**Research**: Complete (20-RESEARCH.md)

Plans:
- [ ] 20-01: Command palette (cmdk, Cmd+K pattern)
- [ ] 20-02: Drag-drop process management (dnd-kit)
- [ ] 20-03: Trackpad gestures (@use-gesture)
- [ ] 20-04: Global shortcuts & haptics (Tauri plugins)
- [ ] 20-05: Accessibility audit (reduced motion, high contrast, ARIA)

#### Phase 21: Advanced Visualizations
**Goal**: Real-time ECharts telemetry, flame graphs, treemaps, deep glow effects
**Depends on**: Phase 20
**Research**: Complete (20-RESEARCH.md)

Plans:
- [ ] 21-01: ECharts real-time telemetry (Canvas, 10K+ points)
- [ ] 21-02: CPU attribution flame graph (Visx)
- [ ] 21-03: Disk space treemap (Visx)
- [ ] 21-04: Deep glow microinteractions (2025 design trends)

#### Phase 22: AI/ML Intelligence
**Goal**: Time series forecasting, anomaly detection, smart recommendations
**Depends on**: Phase 21
**Research**: Complete (20-RESEARCH.md)

Plans:
- [ ] 22-01: Time series forecasting (Python MCP + Kats/Darts)
- [ ] 22-02: Anomaly detection (CPU spikes, memory pressure)
- [ ] 22-03: Content-based recommendation engine
- [ ] 22-04: Behavior pattern detection (gaming hours, work hours)

#### Phase 23: Cross-Device Sync
**Goal**: ElectricSQL cloud sync, P2P LAN sync, offline-first architecture
**Depends on**: Phase 22
**Research**: Complete (20-RESEARCH.md)

Plans:
- [ ] 23-01: SQLite local storage foundation
- [ ] 23-02: ElectricSQL cloud sync (settings/profiles)
- [ ] 23-03: P2P LAN sync via WebRTC
- [ ] 23-04: Offline-first queue with optimistic updates

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5 → 6 → 7 → 8 → 8.1 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-01-15 |
| 2. Hardware Telemetry | v1.0 | 3/3 | Complete | 2026-01-15 |
| 3. Process Management | v1.0 | 2/2 | Complete | 2026-01-15 |
| 3.1 Design System | v1.0 | 3/3 | Complete | 2026-01-15 |
| 4. Conflict Detection | v1.0 | 2/2 | Complete | 2026-01-15 |
| 5. Local LLM Integration | v1.0 | 3/3 | Complete | 2026-01-15 |
| 6. Cloud LLM Integration | v1.0 | 3/3 | Complete | 2026-01-15 |
| 7. Game Detection & Profiles | v1.0 | 3/3 | Complete | 2026-01-15 |
| 8. Optimization Engine | v1.0 | 4/4 | Complete | 2026-01-16 |
| 8.1 Adaptive Intelligence | v1.0 | 4/4 | Complete | 2026-01-16 |
| 9. Optimization Score | v1.0 | 3/3 | Complete | 2026-01-16 |
| 10. Polish, Education & Launch | v1.0 | 7/7 | Complete | 2026-01-16 |
| 11. Foundation & Stability | v1.1 | 3/3 | Complete | 2026-01-16 |
| 12. UX Flow Polish | v1.1 | 3/3 | Complete | 2026-01-16 |
| 13. Core Features | v1.1 | 4/4 | Complete | 2026-01-16 |
| 14. Educational Enhancement | v1.1 | 3/3 | Complete | 2026-01-16 |
| 15. Performance & Launch | v1.1 | 3/3 | Complete | 2026-01-16 |
| 16. Social Features | v2.0 | 1/1 | Complete | 2026-01-16 |
| 17. Chess Integration | v2.0 | 4/4 | Complete | 2026-01-17 |
| 18. Windows Platform | v2.0 | 0/3 | Planned | - |
| 19. Native macOS | v3.0 | 0/7 | Planned | - |
| 20. Rich Interactions | v4.0 | 0/5 | Planned | - |
| 21. Advanced Visualizations | v4.0 | 0/4 | Planned | - |
| 22. AI/ML Intelligence | v4.0 | 0/4 | Planned | - |
| 23. Cross-Device Sync | v4.0 | 0/4 | Planned | - |
