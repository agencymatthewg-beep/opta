# Opta v1.1 Release Notes

## macOS Refinement Release

This release focuses on polishing the macOS experience with new core features, improved UX, and stability enhancements. v1.1 delivers on the "macOS Refinement" milestone with 16 completed plans across 5 phases.

### Highlights

#### Opta Text Zone
A new central status area that keeps you informed about what's happening. Color-coded feedback, animated indicators, and contextual hints make it easy to understand Opta's state at a glance. Four message types (info, success, warning, error) with glow effects for instant recognition.

#### Pinpoint Optimization
New wizard-style optimization for when you want to focus on a single goal. "Maximize FPS in Valorant" walks you through every relevant setting with predicted impact for each change. Six-step flow: Goal selection, Game selection, Analysis, Review, Apply, Results.

#### Learning Transparency
Opta now shows you exactly what it has learned about your preferences. View, edit, or delete any learned preference. See monthly summaries of what Opta discovered about your optimization style. Full control over your data.

#### Smart Rollback
Every optimization creates a rollback point. If something doesn't work, one click undoes all changes. Opta even auto-detects performance drops (20% FPS threshold) and offers to roll back automatically. 60-second quick rollback window for immediate regrets.

#### Communication Styles
Choose how Opta explains things. Informative mode gives detailed explanations with technical context. Concise mode cuts to the chase with 100-character summaries. Switch anytime in Settings.

#### Preference Presets
Save your optimization settings as profiles. Switch between "Max FPS", "Quiet Mode", or "Battery Saver" with one click. Built-in presets included, create unlimited custom presets.

### macOS Polish

- Native window controls with Overlay titleBarStyle
- Enhanced backdrop blur for WebKit vibrancy (20px glass, 12px subtle, 32px strong)
- Transparent window for true glassmorphic effects
- 28px titlebar drag region for native feel
- Tested on both Intel and Apple Silicon

### Performance Improvements

- React.memo on ProcessRow, CategoryBadge, GameCard, TelemetryCard
- LazyMotion with domAnimation feature set for smaller bundle
- Lazy-loaded all pages with React.lazy()
- Vendor chunk splitting (react, motion, radix) for better caching
- Dev-only performance logging with 16ms render threshold warnings

### Bug Fixes

- Memory leak in GameSessionTracker component fixed
- Games detail panel animation on mobile corrected
- Launcher colors now use design system CSS variables
- Error handling in LaunchConfirmationModal improved
- Score page buttons properly disabled when incomplete
- Navigation dead-ends from empty Optimize page resolved

### Known Issues

- Windows platform not yet tested (deferred to v2.0)
- Linux builds not verified on this release
- Social features not yet implemented (planned for v2.0)

### Upgrade Notes

- Settings and preferences from v1.0 are preserved
- New features enabled automatically
- Rollback history starts fresh with this release
- No breaking changes to existing functionality

### Technical Details

- 51 total plans completed across v1.0 and v1.1
- 7.03 hours total execution time
- Average plan duration: 9 minutes
- Phase 15 focused on performance and launch preparation

---

**Version:** 1.1.0
**Released:** 2026-01-16
**Platform:** macOS (Intel and ARM)
**Milestone:** macOS Refinement
