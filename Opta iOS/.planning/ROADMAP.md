# Roadmap: Opta Scan

## Overview

Opta Scan is a focused iOS app: **capture anything, optimize everything**. Photo or prompt → Questions → Optimized visual answer.

## Milestones

- **v1.0 MVP** - Phases 1-6 (core feature complete)
- **v1.1 Polish** - Phases 7-8 (App Store ready)
- **v2.0 Intelligence** - Phases 9-10 (future enhancements)

## Phases

### v1.0 MVP - Core Feature

#### Phase 1: App Foundation
**Goal**: SwiftUI app shell with navigation and design system
**Research**: Unlikely (standard SwiftUI patterns)

Plans:
- [x] 01-01: Xcode project + design system foundation (completed 2026-01-20)
- [ ] 01-02: Navigation structure + core views

#### Phase 2: Capture Experience
**Goal**: Photo capture and text prompt input
**Research**: Likely (camera best practices)
**Research topics**: AVFoundation vs PhotosUI, image compression, permission handling

Plans:
- [ ] 2-01: Camera capture view with real-time preview
- [ ] 2-02: Photo library picker as alternative
- [ ] 2-03: Text prompt input with suggestions
- [ ] 2-04: Unified capture interface (toggle photo/text)

#### Phase 3: Claude Integration
**Goal**: Connect to Claude API for optimization intelligence
**Research**: Required (Anthropic iOS SDK patterns)
**Research topics**: Claude API, vision capabilities, streaming responses, error handling

Plans:
- [ ] 3-01: Claude API client setup
- [ ] 3-02: Image-to-optimization prompt engineering
- [ ] 3-03: Streaming response handling
- [ ] 3-04: "Optamize" slider (quick/thorough modes)

#### Phase 4: Question Flow
**Goal**: Smart clarifying questions before optimization
**Research**: Unlikely (UI implementation)

Plans:
- [ ] 4-01: Question card UI component
- [ ] 4-02: Dynamic question generation from Claude
- [ ] 4-03: Answer collection and context building
- [ ] 4-04: Skip/customize question flow

#### Phase 5: Result Visualization
**Goal**: Beautiful, scannable optimization results
**Research**: Likely (visualization patterns)
**Research topics**: SwiftUI Charts, card layouts, image annotation

Plans:
- [ ] 5-01: Result card component system
- [ ] 5-02: Ranking/comparison visualization
- [ ] 5-03: Image overlay highlights (for menu/product photos)
- [ ] 5-04: Expandable detail sections
- [ ] 5-05: Share sheet integration

#### Phase 6: History & Persistence
**Goal**: Save and revisit past optimizations
**Research**: Unlikely (Core Data patterns)

Plans:
- [ ] 6-01: Core Data model for scans
- [ ] 6-02: History list view
- [ ] 6-03: Search and filter history
- [ ] 6-04: Delete/manage saved scans

### v1.1 Polish - App Store Ready

#### Phase 7: UX Polish
**Goal**: Smooth animations, haptics, accessibility
**Research**: Unlikely

Plans:
- [ ] 7-01: Transition animations
- [ ] 7-02: Haptic feedback integration
- [ ] 7-03: VoiceOver accessibility
- [ ] 7-04: Dynamic Type support
- [ ] 7-05: Error states and empty states

#### Phase 8: Launch Prep
**Goal**: App Store submission ready
**Research**: Unlikely

Plans:
- [ ] 8-01: App icon and launch screen
- [ ] 8-02: Onboarding flow
- [ ] 8-03: Settings screen (API key management if needed)
- [ ] 8-04: App Store screenshots and metadata

### v2.0 Intelligence (Future)

#### Phase 9: Smart Features
**Goal**: Enhanced intelligence features

Plans:
- [ ] TBD: Saved preferences (dietary restrictions, budget defaults)
- [ ] TBD: Template prompts for common scenarios
- [ ] TBD: Result comparison across scans

#### Phase 10: Platform Expansion
**Goal**: Broader platform support

Plans:
- [ ] TBD: iPad optimization
- [ ] TBD: Widget for recent scans
- [ ] TBD: Shortcuts integration

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. App Foundation | v1.0 | 1/2 | In Progress | - |
| 2. Capture Experience | v1.0 | 0/4 | Not Started | - |
| 3. Claude Integration | v1.0 | 0/4 | Not Started | - |
| 4. Question Flow | v1.0 | 0/4 | Not Started | - |
| 5. Result Visualization | v1.0 | 0/5 | Not Started | - |
| 6. History & Persistence | v1.0 | 0/4 | Not Started | - |
| 7. UX Polish | v1.1 | 0/5 | Not Started | - |
| 8. Launch Prep | v1.1 | 0/4 | Not Started | - |

---
*Last updated: 2026-01-20 — Phase 1 Plan 01 complete*
