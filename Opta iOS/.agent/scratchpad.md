# Ralph Scratchpad - Opta Scan iOS

## Current Tasks

### Phase 1: App Foundation (Finish)
- [ ] Verify Phase 1 complete (human approved tab navigation)

### Phase 2: Capture Experience
- [ ] 2-01: Camera capture view with AVFoundation real-time preview
- [ ] 2-02: Photo library picker using PhotosUI
- [ ] 2-03: Text prompt input with smart suggestions
- [ ] 2-04: Unified capture interface (toggle photo/text modes)

### Phase 3: Claude Integration
- [ ] 3-01: Claude API client with Anthropic Swift SDK
- [ ] 3-02: Image-to-optimization prompt engineering
- [ ] 3-03: Streaming response handling with async/await
- [ ] 3-04: "Optamize" slider (quick vs thorough depth)

### Phase 4: Question Flow
- [ ] 4-01: Question card UI component with glass styling
- [ ] 4-02: Dynamic question generation from Claude response
- [ ] 4-03: Answer collection and context building
- [ ] 4-04: Skip/customize question flow

### Phase 5: Result Visualization
- [ ] 5-01: Result card component system
- [ ] 5-02: Ranking/comparison visualization
- [ ] 5-03: Image overlay highlights for photos
- [ ] 5-04: Expandable detail sections
- [ ] 5-05: Share sheet integration

### Phase 6: History & Persistence
- [ ] 6-01: Core Data model for scans
- [ ] 6-02: History list view with design system
- [ ] 6-03: Search and filter history
- [ ] 6-04: Delete/manage saved scans

### Phase 7: UX Polish
- [ ] 7-01: Page transition animations
- [ ] 7-02: Haptic feedback integration throughout
- [ ] 7-03: VoiceOver accessibility
- [ ] 7-04: Dynamic Type support
- [ ] 7-05: Error states and empty states

### Phase 8: Launch Prep
- [ ] 8-01: App icon and launch screen
- [ ] 8-02: Onboarding flow
- [ ] 8-03: Settings screen with preferences
- [ ] 8-04: App Store screenshots and metadata

## Context

- **Project**: Opta Scan iOS - Photo/prompt → Questions → Optimized answer
- **Tech Stack**: SwiftUI, iOS 17+, Claude API, Core Data
- **Design System**: IOS_AESTHETIC_GUIDE.md (OLED colors, spring animations, glass effects)
- **Bundle ID**: com.opta.scan

## Notes

- Each plan should be a single commit
- Follow design system strictly (colors, typography, glass modifiers)
- Use SF Symbols for all icons
- Test on iOS Simulator before committing
