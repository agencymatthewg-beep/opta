# Changelog

All notable changes to Opta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
