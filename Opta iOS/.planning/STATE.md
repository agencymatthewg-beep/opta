# Project State: Opta Scan

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Capture anything, optimize everything — Photo/prompt → Questions → Beautiful optimized answer
**Current focus:** v1.2 Premium Polish

## Current Position

Phase: 11 of 16 (Physics Animations)
Plan: Not started
Status: Ready to plan
Last activity: 2026-01-21 — Phase 10 complete, 3 plans executed

Progress: ██████████░░░░░░ 63% overall (10 of 16 phases complete)

### v1.2 Premium Polish
| Phase | Name | Status |
|-------|------|--------|
| 9 | Advanced Gestures | Complete |
| 10 | Metal Shaders | Complete |
| 11 | Physics Animations | Not started |
| 12 | Visual Effects | Not started |
| 13 | 3D Transforms | Not started |
| 14 | Motion Design | Not started |
| 15 | Performance Tuning | Not started |
| 16 | Premium Polish Pass | Not started |

## The One Feature

```
[Photo/Prompt] → [Questions] → [Optimized Answer]
```

Example: Menu photo + "most calories for $10" → Visual recommendation

## Key Differentiators

- **Easy**: Photo + one sentence (not multi-step prompting)
- **Thorough**: "Optamize" slider for depth control
- **Visual**: Cards, rankings, highlights (not text walls)

## Completed Milestones

### v1.0 MVP (Phases 1-6) — Shipped 2026-01-21
- App Foundation, Capture Experience, Claude Integration
- Question Flow, Result Visualization, History & Persistence

### v1.1 Polish (Phases 7-8) — Shipped 2026-01-21
- UX Polish (haptics, animations, accessibility)
- Launch Prep (onboarding, app icon)

## Accumulated Context

### Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| — | iOS 17+ minimum | Modern SwiftUI features |
| — | Cloud AI (Claude) | Best optimization reasoning |
| — | Photo-first UX | Lowest friction |
| — | Card-based results | Scannable, shareable |
| 1 | OLED background #09090b | Prevents smear on scroll |
| 1 | Spring-only animations | Natural feel |
| 1 | Three-level glass system | Spatial hierarchy |
| 6 | Core Data over SwiftData | Broader compatibility |
| 7 | CoreHaptics with fallback | Premium feel |
| 8 | AppStorage for onboarding | Lightweight persistence |
| 9 | Custom SwipeActionsModifier | Full control over swipe UX |
| 9 | SwipeStateManager singleton | Single-card swipe enforcement |
| 9 | highPriorityGesture for zoom | Pinch takes precedence over scroll |
| 9 | Dynamic pan minimumDistance | Allows scroll at 1x, pan when zoomed |
| 9 | gestureTick at 0.5 intensity | Subtle threshold crossing feedback |
| 9 | Incremental accessibility zoom | 0.5x steps for VoiceOver users |
| 10 | iOS 17+ for Metal shaders | SwiftUI ShaderLibrary requires iOS 17 |
| 10 | [[stitchable]] Metal functions | Required for SwiftUI shader integration |
| 10 | GeometryReader for shader size | Pass view dimensions to shaders |
| 10 | TimelineView for animations | Drive continuous shader updates |
| 10 | OptaShaderEffects.isEnabled | Respect reduce motion accessibility |
| 10 | iOS 16 fallbacks | Graceful degradation for older devices |

### Deferred Issues

None.

### Pending Todos

- Add Claude API key configuration in Settings
- App Store screenshots
- Privacy policy URL

### Blockers/Concerns

None.

### Roadmap Evolution

- v1.0 MVP created: Core feature, 6 phases (Phase 1-6) — Shipped 2026-01-21
- v1.1 Polish created: App Store prep, 2 phases (Phase 7-8) — Shipped 2026-01-21
- v1.2 Premium Polish created: Gestures + graphics, 8 phases (Phase 9-16)

## Session Continuity

Last session: 2026-01-21
Status: Phase 10 (Metal Shaders) COMPLETE
Next action: Plan and execute Phase 11 (Physics Animations)

---
*Opta Scan — capture anything, optimize everything*
