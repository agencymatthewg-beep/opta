# Plan 21-02: Offline UX and Performance Polish

## Overview

Integrate GenerationStream into ProcessingView for real progress feedback, add cancel support, and optimize battery/performance for 11B model inference.

**Phase**: 21 - Local-First Polish
**Milestone**: v2.0 Local Intelligence
**Depends on**: Plan 21-01 (Settings and Model UI)

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (1 session) |
| **Risk** | Low (UI integration, performance tuning) |
| **Files** | ~4 modified |

## Tasks

### Task 1: Update ProcessingView with GenerationStream

**Goal**: Show real token progress, current text preview, and cancel button

**File**: `Opta Scan/Views/ProcessingView.swift`

**Replace static processing text with stream state**:

```swift
//
//  ProcessingView.swift
//  Opta Scan
//
//  Real-time processing view with token streaming progress
//

import SwiftUI

struct ProcessingView: View {

    // MARK: - Properties

    let prompt: String
    let generationStream: GenerationStream
    let onCancel: () -> Void

    // MARK: - Animation State

    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0
    @State private var isVisible = false

    // MARK: - Constants

    private enum Layout {
        static let glowSize: CGFloat = 120
        static let glowBlur: CGFloat = 30
        static let ringSize: CGFloat = 95
        static let ringLineWidth: CGFloat = 3
        static let innerCircleSize: CGFloat = 80
        static let sparkleSize: CGFloat = 32
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Animated Opta Logo
                animatedLogo
                    .opacity(isVisible ? 1 : 0)
                    .scaleEffect(isVisible ? 1 : 0.8)

                // Progress Section
                progressSection
                    .opacity(isVisible ? 1 : 0)
                    .offset(y: isVisible ? 0 : 20)

                // Text Preview
                if !generationStream.currentText.isEmpty {
                    textPreview
                        .opacity(isVisible ? 1 : 0)
                }

                Spacer()

                // Cancel Button
                cancelButton
                    .opacity(isVisible ? 1 : 0)
            }
        }
        .onAppear(perform: startAnimations)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Processing: \(Int(generationStream.progress * 100))% complete")
    }

    // MARK: - Subviews

    private var animatedLogo: some View {
        ZStack {
            // Outer Glow
            Circle()
                .fill(Color.optaPurpleGlow)
                .frame(width: Layout.glowSize, height: Layout.glowSize)
                .blur(radius: Layout.glowBlur)
                .scaleEffect(pulseScale)

            // Rotating Ring
            Circle()
                .trim(from: 0, to: 0.7)
                .stroke(
                    AngularGradient(
                        colors: [Color.optaPurple.opacity(0), Color.optaPurple, Color.optaBlue],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: Layout.ringLineWidth, lineCap: .round)
                )
                .frame(width: Layout.ringSize, height: Layout.ringSize)
                .rotationEffect(.degrees(rotation))

            // Progress Ring
            Circle()
                .trim(from: 0, to: generationStream.progress)
                .stroke(Color.optaGreen, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .frame(width: Layout.ringSize + 10, height: Layout.ringSize + 10)
                .rotationEffect(.degrees(-90))
                .animation(.optaSpring, value: generationStream.progress)

            // Inner Circle
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.optaPurple, Color.optaBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: Layout.innerCircleSize, height: Layout.innerCircleSize)

            // Sparkle Icon
            Image(systemName: "sparkles")
                .font(.system(size: Layout.sparkleSize, weight: .medium))
                .foregroundStyle(.white)
                .symbolEffect(.pulse.byLayer, options: .repeating)
        }
        .accessibilityHidden(true)
    }

    private var progressSection: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            // Progress Percentage
            Text("\(Int(generationStream.progress * 100))%")
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(Color.optaTextPrimary)
                .contentTransition(.numericText())
                .animation(.optaSpring, value: generationStream.progress)

            // Token Count
            Text("\(generationStream.tokenCount) tokens generated")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            // Prompt
            Text(prompt)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextMuted)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
    }

    private var textPreview: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.xs) {
            Text("Generating...")
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextMuted)

            Text(generationStream.currentText.suffix(200))
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(OptaDesign.Spacing.md)
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small))
        .padding(.horizontal, OptaDesign.Spacing.lg)
    }

    private var cancelButton: some View {
        Button {
            OptaHaptics.shared.tap()
            onCancel()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "xmark.circle.fill")
                Text("Cancel")
            }
            .font(.optaCaption)
            .foregroundStyle(Color.optaTextMuted)
        }
        .padding(.bottom, OptaDesign.Spacing.xxl)
        .accessibilityLabel("Cancel generation")
    }

    // MARK: - Private Methods

    private func startAnimations() {
        OptaHaptics.shared.processingStart()

        withAnimation(.optaSpringGentle) {
            isVisible = true
        }

        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = 1.2
        }

        withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
            rotation = 360
        }
    }
}
```

### Task 2: Update ScanFlowState with Cancel Support

**Goal**: Wire cancel action through ScanFlowState

**File**: `Opta Scan/Models/ScanFlow.swift`

**Add cancel method and stream access**:
```swift
// Add computed property for stream access
var generationStream: GenerationStream {
    llmManager.generationStream
}

// Add cancel method
func cancelProcessing() {
    Task {
        await llmManager.cancelGeneration()
        currentStep = .capture
        OptaHaptics.shared.tap()
    }
}
```

### Task 3: Update View Callsites

**Goal**: Pass GenerationStream and onCancel to ProcessingView

**File**: `Opta Scan/Views/ScanFlowView.swift` (or wherever ProcessingView is instantiated)

**Update ProcessingView instantiation**:
```swift
case .processing:
    ProcessingView(
        prompt: flowState.currentPrompt,
        generationStream: flowState.generationStream,
        onCancel: { flowState.cancelProcessing() }
    )
```

### Task 4: Add Battery Optimization Settings

**Goal**: Allow users to prioritize battery life vs speed

**File**: `Opta Scan/Services/PerformanceManager.swift`

**Add battery optimization mode**:
```swift
// Add to PerformanceManager

enum BatteryMode: String, CaseIterable {
    case balanced = "Balanced"
    case performance = "Performance"
    case batterySaver = "Battery Saver"

    var maxTokensPerSecondTarget: Int {
        switch self {
        case .balanced: return 15
        case .performance: return 25
        case .batterySaver: return 8
        }
    }

    var description: String {
        switch self {
        case .balanced: return "Good speed and battery life"
        case .performance: return "Faster, uses more battery"
        case .batterySaver: return "Slower, extends battery"
        }
    }
}

// Add property
@AppStorage("opta.batteryMode") var batteryMode: String = BatteryMode.balanced.rawValue

var currentBatteryMode: BatteryMode {
    BatteryMode(rawValue: batteryMode) ?? .balanced
}

// Adjust effective quality based on battery mode
func adjustQualityForBatteryMode(_ baseQuality: QualityTier) -> QualityTier {
    switch currentBatteryMode {
    case .performance:
        return baseQuality // No reduction
    case .balanced:
        return baseQuality // Use thermal-based quality
    case .batterySaver:
        // Step down quality for battery savings
        switch baseQuality {
        case .ultra: return .high
        case .high: return .medium
        case .medium: return .low
        case .low: return .low
        }
    }
}
```

### Task 5: Add Inference Performance Logging

**Goal**: Log inference performance for debugging and optimization

**File**: `Opta Scan/Services/MLXService.swift`

**Add performance tracking**:
```swift
// Add after generation completes, inside generate() method

private func logInferencePerformance(
    tokenCount: Int,
    duration: TimeInterval,
    model: String
) {
    let tokensPerSecond = duration > 0 ? Double(tokenCount) / duration : 0

    #if DEBUG
    print("""
    [MLXService] Inference Complete
    - Model: \(model)
    - Tokens: \(tokenCount)
    - Duration: \(String(format: "%.2f", duration))s
    - Speed: \(String(format: "%.1f", tokensPerSecond)) tok/s
    - Thermal: \(ProcessInfo.processInfo.thermalState.rawValue)
    - Battery: \(UIDevice.current.batteryLevel * 100)%
    """)
    #endif

    // Store for analytics (optional future feature)
    UserDefaults.standard.set(tokensPerSecond, forKey: "opta.lastInferenceSpeed")
}
```

**Track timing around generation**:
```swift
// Before generation
let startTime = CFAbsoluteTimeGetCurrent()

// After generation completes
let duration = CFAbsoluteTimeGetCurrent() - startTime
logInferencePerformance(
    tokenCount: allTokens.count,
    duration: duration,
    model: container.configuration.name
)
```

### Task 6: Update SettingsView with Battery Mode Picker

**Goal**: Add battery mode selection to Settings

**File**: `Opta Scan/Views/SettingsView.swift`

**Add in Preferences section**:
```swift
// Inside Preferences section
Picker("Battery Mode", selection: $performanceManager.batteryMode) {
    ForEach(PerformanceManager.BatteryMode.allCases, id: \.self) { mode in
        VStack(alignment: .leading) {
            Text(mode.rawValue)
            Text(mode.description)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextMuted)
        }
        .tag(mode.rawValue)
    }
}
.pickerStyle(.inline)
.listRowBackground(Color.optaSurface)
```

Or simpler inline approach:
```swift
SettingsRow(
    icon: "battery.100",
    title: "Battery Mode",
    subtitle: PerformanceManager.shared.currentBatteryMode.description
)
// With navigation to picker view
```

## Checkpoints

- [ ] **Checkpoint 1**: ProcessingView updated with stream
- [ ] **Checkpoint 2**: ScanFlowState cancel support added
- [ ] **Checkpoint 3**: View callsites updated
- [ ] **Checkpoint 4**: Battery optimization mode added
- [ ] **Checkpoint 5**: Inference performance logging added
- [ ] **Checkpoint 6**: Settings battery mode picker added
- [ ] **Checkpoint 7**: Build succeeds

## Verification

```bash
# Build for device
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build
```

## Dependencies

**Existing files modified**:
- `Opta Scan/Views/ProcessingView.swift`
- `Opta Scan/Models/ScanFlow.swift`
- `Opta Scan/Views/ScanFlowView.swift` (or equivalent)
- `Opta Scan/Services/PerformanceManager.swift`
- `Opta Scan/Services/MLXService.swift`
- `Opta Scan/Views/SettingsView.swift`

## Notes

- ProcessingView now shows real-time token count and progress percentage
- Cancel button allows users to abort long generations
- Battery mode provides user control over speed vs battery trade-off
- Performance logging helps identify bottlenecks on different devices
- All changes respect existing PerformanceManager quality tier system
- Text preview shows last 200 characters to avoid UI performance issues

---

*Plan created: 2026-01-22*
*Phase: 21 - Local-First Polish*
*Milestone: v2.0 Local Intelligence*
