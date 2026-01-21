# Roadmap: Opta Scan

## Overview

Opta Scan is a focused iOS app: **capture anything, optimize everything**. Photo or prompt → Questions → Optimized visual answer.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (core feature complete, shipped 2026-01-21)
- ✅ **v1.1 Polish** - Phases 7-8 (App Store ready, shipped 2026-01-21)
- 🚧 **v1.2 Premium Polish** - Phases 9-16 (gestures + graphics, in progress)
- 📋 **v2.0 Intelligence** - Future (smart features, platform expansion)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) - SHIPPED 2026-01-21</summary>

#### Phase 1: App Foundation
**Goal**: SwiftUI app shell with navigation and design system
**Research**: Unlikely (standard SwiftUI patterns)
**Status**: Complete

#### Phase 2: Capture Experience
**Goal**: Photo capture and text prompt input
**Research**: Likely (camera best practices)
**Status**: Complete

#### Phase 3: Claude Integration
**Goal**: Connect to Claude API for optimization intelligence
**Research**: Required (Anthropic iOS SDK patterns)
**Status**: Complete

#### Phase 4: Question Flow
**Goal**: Smart clarifying questions before optimization
**Research**: Unlikely (UI implementation)
**Status**: Complete

#### Phase 5: Result Visualization
**Goal**: Beautiful, scannable optimization results
**Research**: Likely (visualization patterns)
**Status**: Complete

#### Phase 6: History & Persistence
**Goal**: Save and revisit past optimizations
**Research**: Unlikely (Core Data patterns)
**Status**: Complete

</details>

<details>
<summary>✅ v1.1 Polish (Phases 7-8) - SHIPPED 2026-01-21</summary>

#### Phase 7: UX Polish
**Goal**: Smooth animations, haptics, accessibility
**Research**: Unlikely
**Status**: Complete

#### Phase 8: Launch Prep
**Goal**: App Store submission ready
**Research**: Unlikely
**Status**: Complete

</details>

### 🚧 v1.2 Premium Polish (In Progress)

**Milestone Goal:** Elevate the app with advanced gestures, Metal shaders, physics animations, and premium visual effects that match the obsidian aesthetic.

#### Phase 9: Advanced Gestures ✅
**Goal**: Rich gesture interactions throughout the app
**Depends on**: v1.1 complete
**Research**: Unlikely (SwiftUI gesture patterns)
**Status**: Complete (2026-01-21)

- Swipe actions on history cards (delete, share, favorite)
- Pinch-to-zoom on result images
- Long-press context menus
- Custom gesture recognizers for unique interactions
- Haptic feedback coordination with gestures

Plans:
- [x] 09-01: Swipe Actions on History Cards
- [x] 09-02: Pinch-to-Zoom on Images
- [x] 09-03: Long-Press Context Menus & Haptic Coordination

#### Phase 10: Metal Shaders ✅
**Goal**: GPU-accelerated custom visual effects with App Store compliance
**Depends on**: Phase 9
**Research**: Applied (Gemini Deep Research integration)
**Research sources**: `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md`, `iOS/AI-ML/AI Optimization for iOS Apps.md`
**Status**: Complete (2026-01-21)

**Core Features**:
- Custom obsidian glass shader with depth
- Animated gradient effects
- Real-time blur with tint
- GPU-accelerated glow effects
- Shader parameter animations

**Research-Driven Additions**:
- Privacy Manifest (PrivacyInfo.xcprivacy) - Required Reason APIs declared
- ThermalMonitor - Adaptive shader quality based on device temperature
- Async shader compilation - Watchdog timer compliance (20-second limit)
- VoiceOver accessibility for custom shader views
- Reduce Motion compliance for all animations

Plans:
- [x] 10-01: Metal Shader Foundation (+ Privacy Manifest, ThermalMonitor)
- [x] 10-02: Obsidian Glass Shader (+ Accessibility, Thermal-Adaptive Quality)
- [x] 10-03: Animated Gradient & Glow Effects (+ Async Compilation, Thermal Frame Rates)

#### Phase 11: Physics Animations
**Goal**: Natural, physics-based motion throughout
**Depends on**: Phase 10
**Research**: Unlikely (SwiftUI animation system)

- Spring physics with customizable parameters
- Momentum-based scrolling effects
- Rubber-band bounce animations
- Gravity and velocity-based transitions
- Interactive drag with physics response

Plans:
- [ ] 11-01: Spring Physics System
- [ ] 11-02: Momentum Physics
- [ ] 11-03: Interactive Physics

#### Phase 12: Visual Effects
**Goal**: Premium visual polish with blur, vibrancy, particles
**Depends on**: Phase 11
**Research**: Likely (particle systems, advanced compositing)
**Research topics**: SwiftUI particle effects, CAEmitterLayer, advanced blend modes

- Ambient particle effects (subtle floating particles)
- Dynamic blur intensity based on scroll
- Vibrancy overlays for glass effects
- Glow and bloom effects
- Animated gradients and color shifts

Plans:
- [ ] 12-01: TBD

#### Phase 13: 3D Transforms
**Goal**: Depth and perspective effects
**Depends on**: Phase 12
**Research**: Unlikely (SwiftUI 3D transforms)
**Plans**: TBD

- Card flip animations with perspective
- Parallax scrolling effects
- 3D rotation on interaction
- Depth-based shadows
- Layer separation effects

Plans:
- [ ] 13-01: TBD

#### Phase 14: Motion Design
**Goal**: Choreographed micro-interactions and state transitions
**Depends on**: Phase 13
**Research**: Unlikely (animation composition)
**Plans**: TBD

- Staggered list animations with precise timing
- State transition choreography
- Loading state micro-interactions
- Success/error celebration animations
- Navigation transition polish

Plans:
- [ ] 14-01: TBD

#### Phase 15: Performance Tuning
**Goal**: Buttery smooth 120fps with thermal and battery optimization
**Depends on**: Phase 14
**Research**: Applied (Gemini Deep Research integration)
**Research sources**: `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md`, `iOS/AI-ML/AI Optimization for iOS Apps.md`

**Core Features**:
- GPU profiling and bottleneck identification
- Animation frame rate optimization
- Memory usage optimization
- Battery impact assessment
- Device-specific optimizations (older iPhones)

**Research-Driven Additions**:
- Unified PerformanceManager (thermal + battery + quality tiers)
- Ultra/High/Medium/Low quality levels with automatic switching
- Low Power Mode detection and response
- ProMotion (120Hz) optimization for Pro devices
- Battery profiling utilities
- Instruments profiling workflow documentation

Plans:
- [ ] 15-01: Thermal & Battery Optimization (PerformanceManager, Battery Profiling)
- [ ] 15-02: GPU Profiling & Frame Rate Optimization

#### Phase 16: Premium Polish Pass
**Goal**: App Store compliance verification and final quality assurance
**Depends on**: Phase 15
**Research**: Applied (Gemini Deep Research integration)
**Research sources**: `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md`

**Core Features**:
- Animation timing consistency audit
- Visual hierarchy refinement
- Edge case handling (interruptions, rotations)
- Accessibility with animations (reduce motion)
- Final quality assurance pass

**Research-Driven Additions**:
- Privacy Manifest audit and verification
- VoiceOver/Dynamic Type/Reduce Motion accessibility audit
- App Store Guidelines compliance checklist
- Metal shader compliance verification
- Pre-submission checklist with all requirements
- COMPLIANCE.md documentation

Plans:
- [ ] 16-01: App Store Compliance & Final Polish (Privacy, Accessibility, Guidelines)
- [ ] 16-02: Final Visual Consistency Audit

### 📋 v2.0 Intelligence (Future)

**Milestone Goal:** Enhanced AI features and platform expansion

#### Phase 17+: Smart Features
**Goal**: Enhanced intelligence features

- Saved preferences (dietary restrictions, budget defaults)
- Template prompts for common scenarios
- Result comparison across scans

#### Phase 18+: Platform Expansion
**Goal**: Broader platform support

- iPad optimization with multi-column
- Widget for recent scans
- Shortcuts integration
- Watch companion app

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. App Foundation | v1.0 | ✓ | Complete | 2026-01-21 |
| 2. Capture Experience | v1.0 | ✓ | Complete | 2026-01-21 |
| 3. Claude Integration | v1.0 | ✓ | Complete | 2026-01-21 |
| 4. Question Flow | v1.0 | ✓ | Complete | 2026-01-21 |
| 5. Result Visualization | v1.0 | ✓ | Complete | 2026-01-21 |
| 6. History & Persistence | v1.0 | ✓ | Complete | 2026-01-21 |
| 7. UX Polish | v1.1 | ✓ | Complete | 2026-01-21 |
| 8. Launch Prep | v1.1 | ✓ | Complete | 2026-01-21 |
| 9. Advanced Gestures | v1.2 | 3/3 | Complete | 2026-01-21 |
| 10. Metal Shaders | v1.2 | 3/3 | Complete | 2026-01-21 |
| 11. Physics Animations | v1.2 | 0/? | Not started | - |
| 12. Visual Effects | v1.2 | 0/? | Not started | - |
| 13. 3D Transforms | v1.2 | 0/? | Not started | - |
| 14. Motion Design | v1.2 | 0/? | Not started | - |
| 15. Performance Tuning | v1.2 | 1/2 | Planned | - |
| 16. Premium Polish Pass | v1.2 | 1/2 | Planned | - |

---
*Last updated: 2026-01-21 — Phase 10 plans updated with research compliance, Phases 15-16 planned*
