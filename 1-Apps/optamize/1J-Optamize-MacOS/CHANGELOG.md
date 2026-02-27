# Changelog

All notable changes to Opta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.0.0] - 2026-01-18

### Added

**Optimization Intelligence System**
- Dynamic Profile Engine with Gaming, Productivity, Battery Saver, and Auto modes
- Profile auto-detection based on active process and hardware context
- Per-game optimization overrides with hardware-specific tuning
- Profile persistence with scheduling support

**Configuration Calculator**
- Mathematical constraint solver for conflicting settings
- SynergyScorer calculating positive/negative setting interactions
- OptimalConfigGenerator producing best configs per hardware profile
- SettingsImpactAnalyzer projecting change impacts

**Knowledge Graph**
- Visual knowledge graph UI for optimization relationships
- GraphQueryEngine for optimization path lookups
- GraphValidation for consistency checks
- Integration with settings synergies and conflicts

**Real-Time Adaptation**
- AdaptationEngine monitoring system metrics in real-time
- TelemetryThresholds defining trigger points for optimization
- AdaptationStrategies for thermal, memory, and FPS scenarios
- Automatic profile adjustments based on live telemetry

**Platform Optimization Backends**
- macOS: Process priority via nice/renice, memory pressure via vm_stat, Apple Silicon P/E core awareness, GPU Metal states, thermal throttling detection, energy saver integration
- Windows: SetPriorityClass API, SetProcessWorkingSetSize, CPU affinity, DirectX/Vulkan power states, power plan switching, Windows Game Mode integration

**Knowledge Base**
- 24 JSON knowledge files across 5 tiers (physics, architecture, specs, benchmarks, dynamic)
- Settings synergy and conflict rules
- Hardware recommendation solver rules
- Thermal, power, and bottleneck relationship data

### Technical
- useProfile hook for profile state management
- useConfigCalculator hook for optimization calculations
- useAdaptation hook for real-time metric adaptation
- useKnowledgeGraph hook for graph visualization
- ProfileEngine, ProfileMatcher, ProfileStore services
- AdaptationEngine service with strategy patterns
- ConfigCalculator, SynergyScorer, OptimalConfigGenerator services

---

## [5.0.0] - 2026-01-17

### Added

**3D Opta Ring System**
- Three.js powered glassmorphism torus ring as the app's signature element
- GLSL fresnel shader with energy glow uniforms and inner light
- 6-state machine: dormant, waking, active, processing, exploding, recovering
- Spring-physics wake-up animation (800ms) from tilted dormant to facing camera
- Spectacular explosion effect with 200+ particles, shockwave ring, and bloom
- Ring persists across all pages, follows user throughout the app

**Premium Visual Effects**
- Glass depth system with 3-level translucent panel hierarchy
- Atmospheric fog that breathes with ring state and shifts colors
- Particle environment with ambient dust motes and ring attraction
- Neon glow trails flowing through UI elements
- Deep glow effects responding to system metrics
- Chromatic aberration, scan lines, and holographic loading states

**Animation System**
- Complete spring-based animation library with 14 presets
- Staggered entry animations with ignition pattern
- Page transition choreography with ring synchronization
- Blur-back effect for modal depth perception
- Micro-interactions: tilt cards, magnetic buttons, hover shifts

**Sound Design**
- Optional sci-fi audio feedback system
- Ring state change sounds (whoosh, hum)
- UI interaction sounds (click, hover, success)
- Ambient background hum (user-configurable)

**Performance Optimization**
- Dynamic quality scaling across 4 performance tiers
- WebGL capability detection and graceful CSS fallback
- 60fps target with automatic quality reduction
- Reduced motion support with static alternatives

### Changed
- Design System updated to v5.0 with comprehensive visual guidelines
- All loading states now use branded effects (no standard spinners)
- Glass effects enhanced with noise texture and specular highlights
- Animation timing standardized with spring physics

### Technical
- React Three Fiber for 3D ring rendering
- GLSL shaders for glass, glow, chromatic, and fog effects
- Canvas 2D for particle system (lighter than WebGL)
- Framer Motion for all 2D animations

### Documentation
- Animation specification with all spring configurations
- Performance benchmarks and hardware requirements
- Showcase guide for video/GIF creation
- Updated design system with v5.0 elements

---

## [4.0.0] - 2026-01-17

### Added
- Advanced visualizations with ECharts real-time telemetry
- CPU attribution flame graphs
- Disk space treemaps
- Deep glow microinteractions
- Time series forecasting with Holt-Winters
- Anomaly detection for CPU spikes and memory pressure
- Content-based recommendation engine
- Behavior pattern detection
- Cross-device sync with ElectricSQL
- P2P LAN sync via BroadcastChannel
- Offline-first queue with optimistic updates

---

## [3.0.0] - 2026-01-17

### Added
- Native macOS Swift/SwiftUI build
- Direct SMC sensor access for Apple Silicon
- Menu bar integration with live stats popup
- Privileged helper for process termination

---

## [2.0.0] - 2026-01-17

### Added
- Social score sharing and export
- Chess integration with three modes
- AI opponents via Stockfish

---

## [1.1.0] - 2026-01-16

### Added
- **Opta Text Zone**: Central glassmorphic status area with dynamic feedback and color-coded messages
- **Communication Style Preference**: Choose between informative or concise explanations
- **Preference Presets**: Save and load optimization profiles (Max FPS, Quiet Mode, etc.)
- **Pinpoint Optimization Mode**: Wizard-style focused optimization for single goals
- **Learning Visibility**: See what Opta has learned about your preferences
- **Smart Rollback**: One-click undo with auto-detection of performance drops
- **Full Transparency Mode**: View, edit, and delete all learned data

### Fixed
- Memory leak in GameSessionTracker component
- Games detail panel animation on mobile
- Launcher colors now use design system variables
- Error handling in LaunchConfirmationModal
- Score page buttons properly disabled when incomplete
- Navigation dead-ends from empty Optimize page

### Improved
- Navigation now redirects to Games from empty Optimize page
- Loading states throughout the app with proper skeletons
- Session persistence for recommendations and game selection
- Profile deletion now requires confirmation
- Performance optimizations and bundle size reduction
- macOS native window controls and vibrancy effects

### Technical
- Added React Error Boundary for graceful error handling
- Memoized heavy components for better render performance
- Lazy-loaded all pages to reduce initial bundle size
- macOS Intel and ARM thoroughly tested
- Enhanced backdrop blur values for WebKit vibrancy

## [1.0.0] - 2026-01-16

### Added
- Initial release with full feature set
- Hardware telemetry (CPU, GPU, RAM, Temperature monitoring)
- Process management with Stealth Mode
- Conflict detection for competing optimization tools
- Local LLM integration (Ollama/Llama 3)
- Cloud LLM integration (Claude API) with hybrid routing
- Game detection across Steam, Epic, GOG
- Optimization engine with before/after benchmarking
- Adaptive intelligence with pattern learning
- Three-dimensional Optimization Score (Performance, Experience, Competitive)
- Learn Mode for educational explanations
- Investigation Mode for power users
- Expertise-level detection and adaptive tips
- Onboarding wizard
- Cross-platform support (macOS, Windows, Linux)
