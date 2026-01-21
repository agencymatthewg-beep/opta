# Roadmap: Opta Scan

## Overview

Opta Scan is a focused iOS app: **capture anything, optimize everything**. Photo or prompt → Questions → Optimized visual answer.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (core feature complete, shipped 2026-01-21)
- ✅ **v1.1 Polish** - Phases 7-8 (App Store ready, shipped 2026-01-21)
- ✅ **v1.2 Premium Polish** - Phases 9-16 (gestures + graphics, shipped 2026-01-21)
- 🚧 **v2.0 Local Intelligence** - Phases 17-21 (on-device AI with Llama 3.2 11B Vision)

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

### ✅ v1.2 Premium Polish (SHIPPED 2026-01-21)

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

#### Phase 11: Physics Animations ✅
**Goal**: Natural, physics-based motion throughout
**Depends on**: Phase 10
**Research**: Unlikely (SwiftUI animation system)
**Status**: Complete (2026-01-21)

- Spring physics with customizable parameters
- Momentum-based scrolling effects
- Rubber-band bounce animations
- Gravity and velocity-based transitions
- Interactive drag with physics response

Plans:
- [x] 11-01: Spring Physics System
- [x] 11-02: Momentum Physics
- [x] 11-03: Interactive Physics

#### Phase 12: Visual Effects ✅
**Goal**: Premium visual polish with blur, vibrancy, particles
**Depends on**: Phase 11
**Research**: Likely (particle systems, advanced compositing)
**Research topics**: SwiftUI particle effects, CAEmitterLayer, advanced blend modes
**Status**: Complete (2026-01-21)

- Ambient particle effects (subtle floating particles)
- Dynamic blur intensity based on scroll
- Vibrancy overlays for glass effects
- Glow and bloom effects
- Animated gradients and color shifts

Plans:
- [x] 12-01: Particle System
- [x] 12-02: Dynamic Blur and Glow Effects

#### Phase 13: 3D Transforms ✅
**Goal**: Depth and perspective effects
**Depends on**: Phase 12
**Research**: Unlikely (SwiftUI 3D transforms)
**Status**: Complete (2026-01-21)

- Card flip animations with perspective
- Parallax scrolling effects
- 3D rotation on interaction
- Depth-based shadows
- Layer separation effects

Plans:
- [x] 13-01: 3D Card Transforms (flip, rotation, perspective)
- [x] 13-02: Parallax and Depth Effects (scrolling, shadows, layers)

#### Phase 14: Motion Design ✅
**Goal**: Choreographed micro-interactions and state transitions
**Depends on**: Phase 13
**Research**: Unlikely (animation composition)
**Status**: Complete (2026-01-21)

- Staggered list animations with precise timing
- State transition choreography
- Loading state micro-interactions
- Success/error celebration animations
- Navigation transition polish

Plans:
- [x] 14-01: Staggered Animations and Choreography
- [x] 14-02: State Transitions and Micro-Interactions

#### Phase 15: Performance Tuning ✅
**Goal**: Buttery smooth 120fps with thermal and battery optimization
**Depends on**: Phase 14
**Research**: Applied (Gemini Deep Research integration)
**Research sources**: `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md`, `iOS/AI-ML/AI Optimization for iOS Apps.md`
**Status**: Complete (2026-01-21)

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
- [x] 15-01: Thermal & Battery Optimization (PerformanceManager, Battery Profiling)
- [x] 15-02: GPU Profiling & Frame Rate Optimization

#### Phase 16: Premium Polish Pass ✅
**Goal**: App Store compliance verification and final quality assurance
**Depends on**: Phase 15
**Research**: Applied (Gemini Deep Research integration)
**Research sources**: `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md`
**Status**: Complete (2026-01-21)

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
- [x] 16-01: App Store Compliance & Final Polish (Privacy, Accessibility, Guidelines)
- [x] 16-02: Final Visual Consistency Audit

### 🚧 v2.0 Local Intelligence (In Progress)

**Milestone Goal:** Replace Claude API with on-device Llama 3.2 11B Vision for complete privacy and offline operation. No cloud dependencies — fully local AI.

#### Phase 17: MLX Foundation ✅
**Goal**: Add MLX Swift framework and establish local-only architecture
**Depends on**: v1.2 complete
**Research**: Complete (MLX Swift explored - iOS 17.2+, 11B Vision needs 12GB RAM)
**Research topics**: MLX Swift package setup, model loading patterns, memory management
**Status**: Complete (2026-01-21)

- Add MLX Swift and MLX Swift LM packages via SPM
- Create MLXService with real model loading
- Remove ClaudeService and cloud dependencies
- Configure entitlements (increased memory limit, network client)
- Update iOS deployment target to 17.2

Plans:
- [x] 17-01: MLX Package Integration (6 tasks)
- [x] 17-02: Remove Claude Dependencies (9 tasks)

#### Phase 18: Model Management
**Goal**: Download, store, and manage Llama 3.2 11B Vision model
**Depends on**: Phase 17
**Research**: Complete (LLMModelFactory API, HubApi caching)
**Research topics**: HF Hub download API, MLX formats, iOS file storage limits
**Status**: Planning complete

- ModelDownloadManager with progress tracking via LLMModelFactory
- ModelCache actor for in-memory model containers
- StorageManager for space validation and cleanup
- Model selection cards with download/delete actions
- Storage info UI with clear all option

Plans:
- [ ] 18-01: Model Download System (6 tasks)
- [ ] 18-02: Storage and Cache Management (6 tasks)

#### Phase 19: Vision Inference
**Goal**: Load Llama 3.2 11B Vision and process images for optimization
**Depends on**: Phase 18
**Research**: Likely (multimodal LLM image handling)
**Research topics**: MLX vision model loading, image preprocessing, token limits
**Status**: Not started

- Load Llama 3.2 11B Vision model with MLX
- Image preprocessing pipeline (resize, normalize, encode)
- Multimodal prompt construction (image + text)
- Memory management for large model + image
- Thermal throttling integration

Plans:
- [ ] 19-01: Vision Model Loading
- [ ] 19-02: Image Preprocessing Pipeline

#### Phase 20: Generation Pipeline
**Goal**: Stream text generation and parse optimization responses
**Depends on**: Phase 19
**Research**: Unlikely (internal patterns, architecture exists)
**Status**: Not started

- Async token streaming with MLX generate()
- JSON response parsing for questions format
- Optimization result parsing (markdown, highlights, rankings)
- Error handling and generation recovery
- Cancel/interrupt support for long generations

Plans:
- [ ] 20-01: Streaming Text Generation
- [ ] 20-02: Response Parsing and Error Handling

#### Phase 21: Local-First Polish
**Goal**: Optimize UX for fully local, offline operation
**Depends on**: Phase 20
**Research**: Unlikely (SwiftUI patterns)
**Status**: Not started

- Update SettingsView (remove API key, add model management)
- Model download progress UI with cancel support
- Offline indicator and model status badges
- First-run model download flow
- Performance optimization for 11B model on various devices
- Battery usage optimization

Plans:
- [ ] 21-01: Settings and Model Management UI
- [ ] 21-02: Offline UX and Performance Polish

### 📋 v2.1+ Future

**Potential future phases:**
- Saved preferences (dietary restrictions, budget defaults)
- Template prompts for common scenarios
- Result comparison across scans
- iPad optimization with multi-column
- Widget for recent scans
- Shortcuts integration

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
| 11. Physics Animations | v1.2 | 3/3 | Complete | 2026-01-21 |
| 12. Visual Effects | v1.2 | 2/2 | Complete | 2026-01-21 |
| 13. 3D Transforms | v1.2 | 2/2 | Complete | 2026-01-21 |
| 14. Motion Design | v1.2 | 2/2 | Complete | 2026-01-21 |
| 15. Performance Tuning | v1.2 | 2/2 | Complete | 2026-01-21 |
| 16. Premium Polish Pass | v1.2 | 2/2 | Complete | 2026-01-21 |
| 17. MLX Foundation | v2.0 | 2/2 | Complete | 2026-01-21 |
| 18. Model Management | v2.0 | 0/2 | Planning complete | - |
| 19. Vision Inference | v2.0 | 0/2 | Not started | - |
| 20. Generation Pipeline | v2.0 | 0/2 | Not started | - |
| 21. Local-First Polish | v2.0 | 0/2 | Not started | - |

---
*Last updated: 2026-01-21 — Phase 17 MLX Foundation complete (local-only architecture established)*
