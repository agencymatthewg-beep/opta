# Project State: Opta Scan

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Capture anything, optimize everything — Photo/prompt → Questions → Beautiful optimized answer
**Current focus:** v2.0 Local Intelligence — On-device AI with Llama 3.2 11B Vision

## Current Position

Phase: 19 of 21 (Vision Inference) - COMPLETE
Plan: 2 of 2 complete
Status: Phase 19 complete, ready for Phase 20
Last activity: 2026-01-22 — Plan 19-02 complete (image preprocessing)

Progress: ██████░░░░ 50% milestone (Phase 19 complete)

### v2.0 Local Intelligence
| Phase | Name | Status |
|-------|------|--------|
| 17 | MLX Foundation | COMPLETE |
| 18 | Model Management | COMPLETE |
| 19 | Vision Inference | COMPLETE |
| 20 | Generation Pipeline | Not started |
| 21 | Local-First Polish | Not started |

### Phase 19 Plans
| Plan | Name | Status |
|------|------|--------|
| 19-01 | Vision Model Loading | COMPLETE |
| 19-02 | Image Preprocessing Pipeline | COMPLETE |

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
| — | Local AI (MLX) | Privacy-first, offline-capable |
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
| 17 | iOS 17.2+ for MLX | MLX Swift requires iOS 17.2 minimum |
| 17 | Conditional MLX imports | Simulator compatibility with #if canImport |
| 17 | OptaModelConfiguration naming | Avoids conflict with MLXLLM ModelConfiguration |
| 17 | UserDefaults for provider pref | Keychain reserved for sensitive data only |
| 17-02 | Remove LLMProvider protocol | Simplified single-provider architecture |
| 17-02 | Static model init function | SwiftUI App struct is value type |
| 17-02 | Privacy descriptions emphasize local | Reinforce privacy messaging |
| 18-01 | !targetEnvironment(simulator) for MLX | Prevents simulator build failures |
| 18-01 | UserDefaults for download state | Lightweight, non-sensitive data |
| 18-01 | Auto-select after download | Reduces user friction |
| 18-01 | 20% storage buffer | Prevents edge-case storage issues |
| 18-02 | StorageManager singleton | Central storage tracking and cleanup |
| 18-02 | Conditional clear button | Only show when models are downloaded |
| 18-02 | Swipe-to-delete on model cards | Native iOS deletion pattern |
| 18-02 | Confirmation dialog for clear all | Prevent accidental data loss |
| 19-01 | Temp file for image input | UserInput.Image uses .url() not .data() |
| 19-01 | Token ID callback | MLX generate callback receives [Int], decode after |
| 19-01 | CancellationToken pattern | Thread-safe cross-boundary cancellation |
| 19-01 | Dynamic GPU cache 100MB/20MB | Based on model size for 11B vs smaller |
| 19-02 | Target sizes 560/448/336px | Quality tier adaptive sizing |
| 19-02 | JPEG compression 0.9/0.85/0.8 | Quality tier adaptive compression |
| 19-02 | Max dimension 2048px | Memory safety for large photos |
| 19-02 | Aspect-fill center crop | Consistent 1:1 model input |

### Deferred Issues

None.

### Pending Todos

- App Store screenshots
- Privacy policy URL

### Blockers/Concerns

- MLX entitlements require provisioning profile update (increased-memory-limit)
- Physical device required for model download/inference testing

### Roadmap Evolution

- v1.0 MVP created: Core feature, 6 phases (Phase 1-6) — Shipped 2026-01-21
- v1.1 Polish created: App Store prep, 2 phases (Phase 7-8) — Shipped 2026-01-21
- v1.2 Premium Polish created: Gestures + graphics, 8 phases (Phase 9-16) — Shipped 2026-01-21
- v2.0 Local Intelligence created: On-device Llama 3.2 11B Vision, 5 phases (Phase 17-21)

## Session Continuity

Last session: 2026-01-22
Status: Phase 19 complete (Vision Inference)
Next action: Plan Phase 20 (Generation Pipeline)

---
*Opta Scan — capture anything, optimize everything*
