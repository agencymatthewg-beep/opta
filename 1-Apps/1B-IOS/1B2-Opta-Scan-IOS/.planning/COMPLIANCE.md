# App Store Compliance - Opta Scan

*Compliance documentation for v1.2 Premium Polish release*

---

## Privacy Manifest

**File:** `Opta Scan/PrivacyInfo.xcprivacy`

### Privacy Nutrition Labels

| Setting | Value | Notes |
|---------|-------|-------|
| NSPrivacyTracking | false | No user tracking |
| NSPrivacyTrackingDomains | [] | No tracking domains |
| NSPrivacyCollectedDataTypes | [] | No data collection beyond device |

### Required Reason APIs

| API Category | Reason Code | Justification |
|--------------|-------------|---------------|
| NSPrivacyAccessedAPICategoryUserDefaults | CA92.1 | App stores onboarding state and user preferences locally |

**Not Used:**
- System boot time (NSPrivacyAccessedAPICategorySystemBootTime) - not accessed
- File timestamps (NSPrivacyAccessedAPICategoryFileTimestamp) - not accessed
- Disk space (NSPrivacyAccessedAPICategoryDiskSpace) - not accessed

---

## Accessibility Compliance

### Dynamic Type Support

**Status:** Implemented (Phase 16)

All typography uses Dynamic Type text styles:

| Style | Text Style | Scales |
|-------|-----------|--------|
| optaDisplay | .largeTitle | Yes |
| optaTitle | .title2 | Yes |
| optaHeadline | .headline | Yes |
| optaBody | .body | Yes |
| optaCaption | .caption | Yes |
| optaLabel | .caption2 | Yes |

**File:** `Opta Scan/Design/OptaTypography.swift`

### Reduce Motion

**Status:** Implemented (Phases 10, 12, 15)

Files respecting `UIAccessibility.isReduceMotionEnabled`:

1. `Opta Scan/Design/ShaderEffects.swift` - `OptaShaderEffects.isEnabled`
2. `Opta Scan/Design/ObsidianGlassModifiers.swift` - Glass animations
3. `Opta Scan/Views/Effects/ParticleEmitterView.swift` - Particle effects
4. `Opta Scan/Views/Effects/AmbientParticleView.swift` - Ambient particles
5. `Opta Scan/Services/PerformanceManager.swift` - Quality cascade to `.low`

**Quality Cascade:**
When Reduce Motion is enabled:
- PerformanceManager sets `currentQuality = .low`
- QualityTier.low disables: animations, particles, complex effects
- All TimelineView animations stop
- Shader effects disabled

### VoiceOver Labels

**Status:** Implemented (39 accessibility labels across 9 files)

| View | Labels |
|------|--------|
| OnboardingView.swift | 4 |
| QuestionsView.swift | 9 |
| ResultView.swift | 10 |
| ScanFlowView.swift | 5 |
| HistoryView.swift | 3 |
| OptaTabBar.swift | 2 |
| ProcessingView.swift | 1 |
| ZoomableImageView.swift | 1 |
| GestureModifiers.swift | 4 |

---

## App Store Guidelines Compliance

### Guideline 4.2.2 - Minimum Functionality

**Status:** Compliant

App provides substantial value:
- Camera capture for real-world optimization
- AI-powered analysis via Claude API
- History persistence for reference
- Visual result presentation

### Guideline 5.1.1 - Data Collection & Storage

**Status:** Compliant

- Photos processed via Claude API (not stored on servers)
- Local storage only (Core Data)
- No user accounts required
- No personal data collected
- Privacy policy URL required (pending)

### Guideline 2.5.1 - Software Requirements

**Status:** Compliant

- Uses only public iOS APIs
- SwiftUI native framework
- No private APIs accessed
- No deprecated APIs with known replacements

### Guideline 5.1.2 - Data Use and Sharing

**Status:** Compliant

- Photos sent to Claude API for processing
- API interactions use HTTPS
- No data sharing with third parties beyond API
- Clear usage description in app

---

## Pre-Submission Checklist

### Required Items

- [x] Privacy Manifest (PrivacyInfo.xcprivacy) included
- [x] Camera usage description in Info.plist
- [x] Photo library usage description in Info.plist
- [x] All animations respect Reduce Motion
- [x] VoiceOver labels on all controls (39 labels)
- [x] Dynamic Type support implemented
- [x] Build succeeds without errors

### Recommended Items

- [ ] Privacy policy URL configured
- [ ] App Store screenshots prepared
- [ ] Claude API key configuration in Settings
- [ ] TestFlight beta testing complete

---

## Build Verification

```bash
# Verify Privacy Manifest
plutil -lint "Opta Scan/PrivacyInfo.xcprivacy"

# Build project
xcodebuild -project "Opta Scan.xcodeproj" -scheme "w" -destination "generic/platform=iOS" build

# Check for reduce motion compliance
grep -r "isReduceMotionEnabled\|reduceMotionEnabled" "Opta Scan/"

# Count accessibility labels
grep -r "accessibilityLabel" "Opta Scan/" | wc -l
```

---

*Last updated: 2026-01-21 - Phase 16 Premium Polish Pass*
