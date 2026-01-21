# Plan 16-01: App Store Compliance & Final Polish

## Overview

**Phase**: 16 - Premium Polish Pass
**Plan**: 01 of 02
**Goal**: Comprehensive App Store compliance verification and final quality assurance

## Research Compliance

This plan is directly informed by Gemini Deep Research documents:
- `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md` - Privacy Manifest, Metal compliance, submission requirements
- `iOS/AI-ML/AI Optimization for iOS Apps.md` - Privacy API usage, accessibility requirements

### Critical Requirements Addressed

1. **Privacy Manifest (PrivacyInfo.xcprivacy)**: Verify all Required Reason APIs declared
2. **Accessibility Audit**: VoiceOver, Dynamic Type, Reduce Motion compliance
3. **App Store Guidelines**: Review compliance checklist
4. **Metal/Shader Compliance**: No private APIs, proper capability checks

## Context

Before App Store submission, the app must pass all compliance checks. This plan creates a systematic audit and verification process.

**Current state**: Feature-complete app with all phases implemented
**Target state**: App Store-ready with verified compliance

## Dependencies

- All previous phases complete (1-15)
- Privacy Manifest created (Phase 10 Task 0)
- Accessibility features implemented
- Performance optimizations complete

## Tasks

### Task 1: Privacy Manifest Audit

**Purpose**: Verify PrivacyInfo.xcprivacy contains all required declarations.

**Audit Checklist**:

```markdown
## Privacy Manifest Audit

### Required Reason APIs Used by Opta Scan

| API Category | Reason Code | Justification | Status |
|--------------|-------------|---------------|--------|
| UserDefaults | CA92.1 | App settings persistence | ⬜ Verify |
| File Timestamp | C617.1 | Scan history modification dates | ⬜ Verify |
| System Boot Time | 35F9.1 | Animation timing reference | ⬜ Verify |

### Verification Steps

1. Open `Opta Scan/PrivacyInfo.xcprivacy` in Xcode
2. Confirm all API types are listed under `NSPrivacyAccessedAPITypes`
3. Verify each has correct `NSPrivacyAccessedAPITypeReasons` array
4. Build and check for Privacy Manifest warnings

### Third-Party SDK Privacy

| SDK | Privacy Manifest | Data Collection |
|-----|------------------|-----------------|
| None (cloud API only) | N/A | N/A |

### Data Collection Declaration

- [ ] No analytics SDK
- [ ] No tracking frameworks
- [ ] No third-party advertising
- [ ] Claude API: Processed server-side, no local storage of user content
```

**Verification Script**:

```bash
# Check Privacy Manifest exists
ls -la "Opta Scan/PrivacyInfo.xcprivacy"

# Validate XML structure
plutil -lint "Opta Scan/PrivacyInfo.xcprivacy"

# Search for undeclared API usage (grep for common patterns)
grep -r "UserDefaults" --include="*.swift" "Opta Scan/"
grep -r "fileModificationDate" --include="*.swift" "Opta Scan/"
grep -r "systemUptime" --include="*.swift" "Opta Scan/"
```

**Verification**:
- Privacy Manifest exists and is valid XML
- All used APIs have declared reasons
- No warnings in Xcode build

### Task 2: Accessibility Compliance Audit

**Purpose**: Ensure full VoiceOver, Dynamic Type, and motion accessibility support.

**Audit Checklist**:

```markdown
## Accessibility Audit

### VoiceOver Support

| Screen | Labeling | Navigation | Status |
|--------|----------|------------|--------|
| Home/Capture | All buttons labeled | Logical order | ⬜ Test |
| Camera | Capture button announced | Focus management | ⬜ Test |
| Questions | Question announced | Answer selection works | ⬜ Test |
| Results | Cards readable | Actionable items identified | ⬜ Test |
| History | List items labeled | Swipe actions announced | ⬜ Test |
| Settings | All toggles labeled | Grouped properly | ⬜ Test |

### Dynamic Type Support

| Component | Min (XS) | Max (XXXL) | Status |
|-----------|----------|------------|--------|
| Headlines | Readable | No truncation | ⬜ Test |
| Body text | Readable | Wraps properly | ⬜ Test |
| Buttons | Touch target 44pt | Text fits | ⬜ Test |
| Cards | Content visible | Scrollable if needed | ⬜ Test |

### Reduce Motion Compliance

| Animation | Reduced Behavior | Status |
|-----------|------------------|--------|
| Processing glow | Static state | ⬜ Test |
| Gradient flow | Static gradient | ⬜ Test |
| Shimmer | No shimmer | ⬜ Test |
| Page transitions | Crossfade only | ⬜ Test |
| Card springs | Instant position | ⬜ Test |

### Color Contrast

| Element | Ratio | WCAG AA (4.5:1) | Status |
|---------|-------|-----------------|--------|
| Primary text on background | X:1 | ⬜ Pass/Fail | ⬜ Test |
| Secondary text on background | X:1 | ⬜ Pass/Fail | ⬜ Test |
| Button text on purple | X:1 | ⬜ Pass/Fail | ⬜ Test |
| Error text on background | X:1 | ⬜ Pass/Fail | ⬜ Test |
```

**Testing Procedure**:

1. **VoiceOver Testing**:
   - Enable VoiceOver (Settings > Accessibility > VoiceOver)
   - Navigate entire app using swipe gestures
   - Verify all interactive elements are announced
   - Check custom controls (shader views) have labels

2. **Dynamic Type Testing**:
   - Settings > Display & Brightness > Text Size
   - Test at smallest and largest sizes
   - Verify no text truncation or overlap

3. **Reduce Motion Testing**:
   - Settings > Accessibility > Motion > Reduce Motion
   - Verify all animated effects show static state
   - Confirm transitions are immediate/crossfade

**Verification**:
- All VoiceOver elements properly labeled
- Dynamic Type scales without breaking layout
- Reduce Motion disables all animation

### Task 3: App Store Guidelines Review

**Purpose**: Verify compliance with Apple's App Review Guidelines.

**Checklist**:

```markdown
## App Store Guidelines Compliance

### 1. Safety (Section 1)

- [ ] No objectionable content generated
- [ ] User content not stored on servers
- [ ] No illegal content promotion
- [ ] Privacy policy URL provided

### 2. Performance (Section 2)

- [ ] App is complete and functional
- [ ] No crashes during review scenarios
- [ ] Accurate app description
- [ ] Screenshots reflect actual app
- [ ] No hidden features
- [ ] Works offline (graceful degradation)

### 3. Business (Section 3)

- [ ] No undisclosed in-app purchases (v1.0 has none)
- [ ] No subscriptions (v1.0 has none)
- [ ] Clear pricing (free)

### 4. Design (Section 4)

- [ ] iOS design conventions followed
- [ ] iPad layout works (if universal) OR iPhone-only declared
- [ ] Orientation support declared correctly
- [ ] Launch image/storyboard provided
- [ ] App icons for all sizes

### 5. Legal (Section 5)

- [ ] Privacy policy URL in App Store Connect
- [ ] No private API usage
- [ ] No framework misuse
- [ ] Export compliance declared
- [ ] CCPA/GDPR compliant (if applicable)

### Metal/Graphics Specific

- [ ] No private Metal APIs
- [ ] Metal capability check before use
- [ ] Graceful fallback on unsupported devices
- [ ] No excessive GPU usage (thermal compliance)

### AI/ML Specific

- [ ] AI-generated content labeled (if required)
- [ ] No deepfake generation
- [ ] User consent for AI processing
- [ ] Claude API terms compliance
```

**Verification**:
- All checklist items verified
- No guideline violations identified
- Demo account ready (if needed)

### Task 4: Metal Shader Compliance Verification

**Purpose**: Ensure Metal shaders follow App Store requirements.

**Checklist**:

```markdown
## Metal Shader Compliance

### API Usage

- [ ] Only public SwiftUI shader APIs used (.colorEffect, .distortionEffect)
- [ ] No direct MTLDevice manipulation for effects
- [ ] ShaderLibrary.default() used (not custom library loading)

### Capability Checks

```swift
// Verify this pattern is used throughout:
if #available(iOS 17.0, *) {
    // Shader code
} else {
    // Fallback
}
```

- [ ] All shader code behind iOS 17 availability check
- [ ] Fallback path for iOS 16 (if supported)
- [ ] Metal availability check at shader use site

### Resource Management

- [ ] No shader resource leaks
- [ ] Proper cleanup on view disappear
- [ ] Memory usage reasonable during extended use

### Review Build Test

1. Archive app for distribution
2. Validate with App Store Connect
3. Check for any warnings about Metal usage
```

**Verification**:
- No private API usage detected
- All availability checks in place
- Validation passes without warnings

### Task 5: Pre-Submission Checklist

**Purpose**: Final checklist before App Store submission.

```markdown
## Pre-Submission Checklist

### App Store Connect Setup

- [ ] App name reserved
- [ ] Bundle ID registered
- [ ] App description written
- [ ] Keywords selected
- [ ] Support URL provided
- [ ] Privacy Policy URL provided
- [ ] Age rating questionnaire completed
- [ ] Export compliance answered

### Screenshots & Media

- [ ] iPhone 6.7" screenshots (iPhone 17 Pro Max)
- [ ] iPhone 6.1" screenshots (iPhone 17 Pro)
- [ ] iPad screenshots (if universal)
- [ ] App Preview video (optional)
- [ ] 1024x1024 app icon uploaded

### Build Preparation

- [ ] Version number set (1.0.0)
- [ ] Build number incremented
- [ ] Release build configuration
- [ ] Bitcode enabled (if required)
- [ ] All debug code removed/disabled
- [ ] API keys not hardcoded (use secure storage)

### Testing Verification

- [ ] Tested on oldest supported device (iPhone XS if iOS 17+)
- [ ] Tested on newest device (iPhone 17 Pro)
- [ ] All features work without crashes
- [ ] Network error handling verified
- [ ] Offline mode tested

### Privacy & Legal

- [ ] PrivacyInfo.xcprivacy included in bundle
- [ ] NSCameraUsageDescription set
- [ ] NSPhotoLibraryUsageDescription set
- [ ] No analytics/tracking (or disclosed)
- [ ] CCPA "Do Not Sell" not applicable (no selling)

### Final Review

- [ ] Fresh install test
- [ ] First-launch experience smooth
- [ ] No console errors/warnings
- [ ] Memory usage stable
- [ ] Battery usage acceptable
```

**Verification**:
- All checklist items complete
- Build uploads successfully
- Ready for review submission

### Task 6: Create Compliance Documentation

**Purpose**: Document compliance status for future reference.

Create `Opta Scan/Documentation/COMPLIANCE.md` (or keep in .planning):

```markdown
# Opta Scan Compliance Documentation

## App Store Submission: v1.2.0

**Submission Date**: TBD
**Review Status**: Pending

## Privacy Manifest

**File**: `Opta Scan/PrivacyInfo.xcprivacy`

### Declared APIs

| API | Reason Code | Usage |
|-----|-------------|-------|
| UserDefaults | CA92.1 | App settings and preferences |
| File Timestamp | C617.1 | History item modification tracking |
| System Boot Time | 35F9.1 | Animation timing calculations |

### Data Collection

- **Collected Data**: None stored locally beyond scan history
- **Third-Party SDKs**: None
- **Analytics**: None
- **Advertising**: None

## Accessibility Status

| Feature | Status | Notes |
|---------|--------|-------|
| VoiceOver | ✅ | All screens navigable |
| Dynamic Type | ✅ | XS to XXXL supported |
| Reduce Motion | ✅ | All animations disabled |
| High Contrast | ✅ | System setting respected |

## Performance Benchmarks

| Metric | Target | Achieved |
|--------|--------|----------|
| Launch Time | < 2s | TBD |
| Scroll FPS | 60 | TBD |
| Memory Usage | < 150MB | TBD |
| Battery Impact | Low | TBD |

## Known Issues

None at time of submission.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-21 | Initial release (v1.0 MVP + v1.1 Polish) |
| 1.2.0 | TBD | Premium Polish (gestures, shaders, animations) |
```

**Verification**:
- Documentation complete and accurate
- All compliance items documented
- Ready for audit if needed

## Acceptance Criteria

### Privacy Manifest
- [ ] PrivacyInfo.xcprivacy exists and validates
- [ ] All Required Reason APIs declared with correct reasons
- [ ] No undeclared API usage detected
- [ ] Build produces no privacy warnings

### Accessibility
- [ ] VoiceOver navigation works on all screens
- [ ] Dynamic Type scales properly at all sizes
- [ ] Reduce Motion disables all animations
- [ ] Color contrast meets WCAG AA (4.5:1)

### App Store Guidelines
- [ ] All safety requirements met
- [ ] Performance requirements verified
- [ ] Design guidelines followed
- [ ] Legal requirements satisfied
- [ ] Metal/AI specific checks passed

### Pre-Submission
- [ ] App Store Connect fully configured
- [ ] Screenshots prepared
- [ ] Build validated without errors
- [ ] All testing complete

### Documentation
- [ ] COMPLIANCE.md created
- [ ] All status items documented
- [ ] Version history updated

## Estimated Scope

- **Files created**: 1 (COMPLIANCE.md)
- **Files verified**: 10+ (all major feature files)
- **Audits performed**: 5 (Privacy, Accessibility, Guidelines, Metal, Pre-submission)
- **Complexity**: Low (verification, not implementation)
- **Risk**: Low (documentation and testing)

## Notes

### Timeline Considerations
- Allow 1-2 business days for App Store review
- Have test accounts ready if required
- Be prepared to respond to reviewer questions

### Common Rejection Reasons to Avoid
1. **Incomplete functionality**: All features must work
2. **Crashes**: Zero tolerance for crashes during review
3. **Privacy issues**: Must declare all data usage
4. **Guideline 4.2 (Minimum Functionality)**: App must provide value
5. **Misleading metadata**: Screenshots must match app

### Post-Submission
- Monitor App Store Connect for status updates
- Respond promptly to reviewer questions
- Be ready to submit expedited review if rejected for minor issues
