# Project State: Opta Scan

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Capture anything, optimize everything — Photo/prompt → Questions → Beautiful optimized answer
**Current focus:** v2.0 Local Intelligence — On-device AI with Llama 3.2 11B Vision

## Current Position

Phase: 17 of 21 (MLX Foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-01-21 — Milestone v2.0 Local Intelligence created

Progress: ░░░░░░░░░░ 0% milestone (0 of 5 phases complete)

### v2.0 Local Intelligence
| Phase | Name | Status |
|-------|------|--------|
| 17 | MLX Foundation | Not started |
| 18 | Model Management | Not started |
| 19 | Vision Inference | Not started |
| 20 | Generation Pipeline | Not started |
| 21 | Local-First Polish | Not started |

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

### v1.2 Premium Polish (Phases 9-16) — Shipped 2026-01-21
- Advanced Gestures, Metal Shaders, Physics Animations
- Visual Effects, 3D Transforms, Motion Design
- Performance Tuning, Premium Polish Pass
- App Store Compliance, Accessibility Audit

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
| 11 | PhysicsSpring real-world params | Mass/stiffness/damping for natural motion |
| 11 | MomentumConfig deceleration curves | Projected end positions for throws |
| 11 | RubberBandConfig exponential stretch | Asymptotic approach to max stretch |
| 11 | CardDismissHandler velocity thresholds | Natural dismiss vs return decisions |
| 11 | SnapPointConfig with momentum projection | Smart snap point selection |
| 12 | CAEmitterLayer for particles | GPU-accelerated performance |
| 12 | ParticleConfig presets | Consistent particle behavior |
| 12 | ScrollBlurState @Observable | Reactive scroll-driven blur |
| 12 | Multi-layer GlowConfig | Depth through layered blur |
| 12 | BlendMode.screen for bloom | Natural HDR-like effect |
| 13 | PerspectiveConfig presets | Consistent 3D depth feel |
| 13 | Rotation3DState @Observable | Gesture-driven 3D rotation |
| 13 | ParallaxConfig speed multipliers | Layer-based scroll depth |
| 13 | DepthShadowConfig elevation presets | Dynamic shadow scaling |
| 13 | LayerSeparationConfig | Tap-to-expand layer stacks |
| 14 | StaggerConfig delay increments | Cascading item animations |
| 14 | AnimationSequence choreography | Multi-element timing control |
| 14 | ChoreographyState step tracking | Orchestrated reveal sequences |
| 14 | LoadingDotsView staggered scale | Polished loading indicators |
| 14 | ConfettiBurst particles | Celebration feedback effects |
| 15 | QualityTier quality cascade | Thermal → LowPower → Battery → ReduceMotion |
| 15 | PerformanceManager singleton | Single source of truth for quality state |
| 15 | CADisplayLink for FPS monitoring | Accurate frame-by-frame timing |
| 15 | ProMotion 120Hz detection | UIScreen.maximumFramesPerSecond >= 120 |
| 15 | Animation duration multiplier | 0.8x at 120Hz, 1.0x at 60Hz, 1.2x at 30Hz |
| 16 | Privacy Manifest CA92.1 | UserDefaults for onboarding/preferences |
| 16 | Dynamic Type over fixed sizes | Font.system(.textStyle) for accessibility |
| 16 | 51 VoiceOver labels | All interactive elements covered |

### Deferred Issues

None.

### Pending Todos

- App Store screenshots
- Privacy policy URL

### Blockers/Concerns

None.

### Roadmap Evolution

- v1.0 MVP created: Core feature, 6 phases (Phase 1-6) — Shipped 2026-01-21
- v1.1 Polish created: App Store prep, 2 phases (Phase 7-8) — Shipped 2026-01-21
- v1.2 Premium Polish created: Gestures + graphics, 8 phases (Phase 9-16) — Shipped 2026-01-21
- v2.0 Local Intelligence created: On-device Llama 3.2 11B Vision, 5 phases (Phase 17-21)

## Session Continuity

Last session: 2026-01-21
Status: Milestone v2.0 Local Intelligence initialized
Next action: Plan Phase 17 (MLX Foundation)

---
*Opta Scan — capture anything, optimize everything*
