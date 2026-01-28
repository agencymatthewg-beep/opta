# Plan 10-03: Animated Gradient & Glow Effects

## Overview

**Phase**: 10 - Metal Shaders
**Plan**: 03 of 03
**Goal**: Create animated shader effects including flowing gradients, pulsing glow, and processing state indicators

## Research Compliance

This plan incorporates findings from Gemini Deep Research documents:
- `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md` - Watchdog timer compliance, thermal adaptation
- `iOS/AI-ML/AI Optimization for iOS Apps.md` - Performance optimization, battery considerations

### Critical Requirements Addressed

1. **Watchdog Timer (20-second limit)**: Async shader compilation prevents launch blocking
2. **Thermal Awareness**: Animations adapt frame rate based on thermal state
3. **Reduce Motion**: All animations respect accessibility preference
4. **Battery Optimization**: TimelineView pauses when not visible, thermal degradation reduces GPU load

## Context

This plan adds time-based animations to Metal shaders for premium visual polish. Key use cases:
- **Processing states**: Animated glow while Claude is analyzing
- **Ambient effects**: Subtle gradient flow on hero elements
- **Attention states**: Pulsing borders for important UI elements

**Current state**: Static shader effects from Plans 10-01 and 10-02
**Target state**: Animated shader effects with TimelineView integration, thermal-aware frame rates

## Dependencies

- Plan 10-01 complete (shader foundation, ThermalMonitor)
- Plan 10-02 complete (glass shaders)
- `OptaShaders.metal` exists
- `ShaderEffects.swift` exists
- `ThermalMonitor.swift` exists (from Plan 10-01)

## Tasks

### Task 0: Create Async Shader Compilation Manager (CRITICAL - Watchdog Compliance)

**Purpose**: Ensure shader compilation doesn't block app launch (20-second Watchdog limit).

Create `Opta Scan/Design/ShaderCompilationManager.swift`:

```swift
//
//  ShaderCompilationManager.swift
//  Opta Scan
//
//  Async shader compilation for Watchdog compliance
//  Part of Phase 10: Metal Shaders - Research Compliance
//
//  Reference: iOS/Distribution/iOS-App-Store-Compliance-wgpu.md
//  "Async Initialization Pattern" - prevents launch-blocking
//

import SwiftUI
import Metal

/// Manages async shader compilation to prevent launch-blocking
/// Critical for Watchdog timer compliance (20-second limit)
@MainActor
final class ShaderCompilationManager: ObservableObject {
    static let shared = ShaderCompilationManager()

    /// Whether shaders are ready for use
    @Published private(set) var isReady = false

    /// Compilation progress (0-1) for UI feedback
    @Published private(set) var compilationProgress: Double = 0

    /// Any compilation errors
    @Published private(set) var compilationError: Error?

    /// List of shader functions to pre-warm
    private let shaderFunctions = [
        "obsidianGlass",
        "noiseOctave",
        "gradientFlow",
        "pulsingGlow",
        "shimmer",
        "breathingGlow"
    ]

    private init() {}

    /// Pre-compile shaders on background thread
    /// Call this early in app lifecycle but AFTER launch completes
    func precompileShaders() async {
        guard !isReady else { return }

        do {
            // Get Metal device
            guard let device = MTLCreateSystemDefaultDevice() else {
                throw ShaderCompilationError.noMetalDevice
            }

            // Get default library (contains our shaders)
            guard let library = device.makeDefaultLibrary() else {
                throw ShaderCompilationError.noDefaultLibrary
            }

            // Pre-warm each shader function
            let total = Double(shaderFunctions.count)
            for (index, functionName) in shaderFunctions.enumerated() {
                // Attempt to get function (this triggers compilation)
                if library.makeFunction(name: functionName) != nil {
                    // Successfully compiled/cached
                }

                // Update progress on main thread
                compilationProgress = Double(index + 1) / total

                // Yield to prevent blocking
                await Task.yield()
            }

            isReady = true

        } catch {
            compilationError = error
            // Fall back to graceful degradation - app still works, just no shaders
            isReady = true // Allow app to continue
        }
    }
}

enum ShaderCompilationError: Error, LocalizedError {
    case noMetalDevice
    case noDefaultLibrary

    var errorDescription: String? {
        switch self {
        case .noMetalDevice:
            return "Metal is not available on this device"
        case .noDefaultLibrary:
            return "Could not load shader library"
        }
    }
}

// MARK: - App Integration

/// View modifier to trigger shader pre-compilation
struct ShaderPrecompilationModifier: ViewModifier {
    @StateObject private var compilationManager = ShaderCompilationManager.shared

    func body(content: Content) -> some View {
        content
            .task {
                // Start compilation after view appears (post-launch)
                await compilationManager.precompileShaders()
            }
    }
}

extension View {
    /// Trigger async shader pre-compilation when view appears
    /// Place on root view (e.g., ContentView) for early compilation
    func precompileShaders() -> some View {
        modifier(ShaderPrecompilationModifier())
    }
}
```

**Integration in App**:

```swift
// In Opta_ScanApp.swift or ContentView.swift
@main
struct Opta_ScanApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .precompileShaders() // Start async compilation post-launch
        }
    }
}
```

**Verification**:
- App launches in < 2 seconds (no shader blocking)
- Shaders compile in background
- `isReady` becomes true before user needs effects

### Task 1: Add Animated Shaders to Metal File

Add to `Opta Scan/Shaders/OptaShaders.metal`:

```metal
// MARK: - Animated Gradient Flow
// Creates a flowing gradient effect driven by time

[[ stitchable ]] half4 gradientFlow(
    float2 position,
    half4 color,
    float2 size,
    float time,            // Time in seconds
    half4 color1,          // Start gradient color
    half4 color2,          // End gradient color
    float speed,           // Flow speed
    float angle            // Flow direction in radians
) {
    float2 uv = position / size;

    // Create flowing pattern
    float2 dir = float2(cos(angle), sin(angle));
    float flow = dot(uv, dir) + time * speed;

    // Smooth oscillating gradient
    float t = sin(flow * 3.14159) * 0.5 + 0.5;

    // Mix gradient colors
    half4 gradientColor = mix(color1, color2, half(t));

    // Blend with original color
    half4 result = color;
    result.rgb = mix(result.rgb, gradientColor.rgb * result.a, half(0.3));

    return result;
}

// MARK: - Pulsing Glow Effect
// Creates a pulsing glow effect for processing states

[[ stitchable ]] half4 pulsingGlow(
    float2 position,
    half4 color,
    float2 size,
    float time,
    half4 glowColor,
    float pulseSpeed,      // Pulses per second
    float minIntensity,    // Minimum glow (0-1)
    float maxIntensity     // Maximum glow (0-1)
) {
    float2 uv = position / size;

    // Calculate edge distance for glow
    float2 edgeDist = min(uv, 1.0 - uv);
    float edge = min(edgeDist.x, edgeDist.y);

    // Pulsing intensity
    float pulse = sin(time * pulseSpeed * 6.28318) * 0.5 + 0.5;
    float intensity = mix(minIntensity, maxIntensity, pulse);

    // Edge glow with pulse
    float glowFactor = (1.0 - smoothstep(0.0, 0.12, edge)) * intensity;

    // Apply glow
    half4 result = color;
    result.rgb = mix(result.rgb, glowColor.rgb * result.a, half(glowFactor));

    return result;
}

// MARK: - Shimmer Effect
// Creates a shimmer/shine sweep across the view

[[ stitchable ]] half4 shimmer(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float width,           // Shimmer band width (0-1)
    float speed,           // Sweep speed
    float intensity        // Shimmer brightness
) {
    float2 uv = position / size;

    // Moving shimmer position (loops every cycle)
    float shimmerPos = fract(time * speed);

    // Distance from shimmer band (diagonal sweep)
    float diagPos = (uv.x + uv.y) * 0.5;
    float dist = abs(diagPos - shimmerPos);

    // Soft shimmer band
    float shimmerFactor = 1.0 - smoothstep(0.0, width, dist);
    shimmerFactor *= intensity;

    // Add shimmer highlight
    half4 result = color;
    result.rgb += half(shimmerFactor * 0.15);

    return result;
}

// MARK: - Breathing Glow
// Smooth, slow pulsing for ambient effects

[[ stitchable ]] half4 breathingGlow(
    float2 position,
    half4 color,
    float time,
    half4 glowColor,
    float breathSpeed      // Breath cycles per second
) {
    // Smooth sine wave breathing
    float breath = sin(time * breathSpeed * 6.28318) * 0.5 + 0.5;
    breath = breath * breath; // Ease in-out

    // Subtle color shift
    half4 result = color;
    result.rgb = mix(result.rgb, glowColor.rgb * result.a, half(breath * 0.15));

    return result;
}
```

**Verification**: Metal file compiles without errors

### Task 2: Create Animated Shader Extensions

Add to `Opta Scan/Design/ShaderEffects.swift`:

```swift
// MARK: - Animated Shader Effects

@available(iOS 17.0, *)
extension View {
    /// Apply animated flowing gradient effect
    /// - Parameters:
    ///   - time: Current animation time (from TimelineView)
    ///   - color1: First gradient color
    ///   - color2: Second gradient color
    ///   - speed: Flow speed (default: 0.5)
    ///   - angle: Flow direction in degrees (default: 45)
    func gradientFlow(
        time: Double,
        color1: Color = .optaPurple,
        color2: Color = .optaBlue,
        speed: Double = 0.5,
        angle: Double = 45,
        isEnabled: Bool = true
    ) -> some View {
        let resolved1 = color1.resolve(in: EnvironmentValues())
        let resolved2 = color2.resolve(in: EnvironmentValues())
        return GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.gradientFlow(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .color(resolved1),
                    .color(resolved2),
                    .float(speed),
                    .float(angle * .pi / 180)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply pulsing glow effect for processing states
    /// - Parameters:
    ///   - time: Current animation time
    ///   - glowColor: Glow color (default: purple)
    ///   - pulseSpeed: Pulses per second (default: 1.5)
    ///   - minIntensity: Minimum glow 0-1 (default: 0.2)
    ///   - maxIntensity: Maximum glow 0-1 (default: 0.6)
    func pulsingGlow(
        time: Double,
        glowColor: Color = .optaPurpleGlow,
        pulseSpeed: Double = 1.5,
        minIntensity: Double = 0.2,
        maxIntensity: Double = 0.6,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = glowColor.resolve(in: EnvironmentValues())
        return GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.pulsingGlow(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .color(resolved),
                    .float(pulseSpeed),
                    .float(minIntensity),
                    .float(maxIntensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply shimmer sweep effect
    /// - Parameters:
    ///   - time: Current animation time
    ///   - width: Shimmer band width 0-1 (default: 0.2)
    ///   - speed: Sweep speed (default: 0.3)
    ///   - intensity: Shimmer brightness 0-1 (default: 0.5)
    func shimmer(
        time: Double,
        width: Double = 0.2,
        speed: Double = 0.3,
        intensity: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.shimmer(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .float(width),
                    .float(speed),
                    .float(intensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply subtle breathing glow for ambient effects
    /// - Parameters:
    ///   - time: Current animation time
    ///   - glowColor: Glow color
    ///   - speed: Breath cycles per second (default: 0.5)
    func breathingGlow(
        time: Double,
        glowColor: Color = .optaPurple,
        speed: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = glowColor.resolve(in: EnvironmentValues())
        return self.colorEffect(
            ShaderLibrary.breathingGlow(
                .float(time),
                .color(resolved),
                .float(speed)
            ),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }
}
```

**Verification**: Extensions compile correctly

### Task 3: Create Processing State Component

Create `Opta Scan/Views/Components/ProcessingGlowView.swift`:

```swift
//
//  ProcessingGlowView.swift
//  Opta Scan
//
//  Animated glow effect for processing/loading states
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

/// Wraps content with an animated pulsing glow when processing
@available(iOS 17.0, *)
struct ProcessingGlowView<Content: View>: View {
    let isProcessing: Bool
    let glowColor: Color
    @ViewBuilder let content: () -> Content

    @State private var animationTime: Double = 0

    init(
        isProcessing: Bool,
        glowColor: Color = .optaPurpleGlow,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isProcessing = isProcessing
        self.glowColor = glowColor
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60, paused: !isProcessing)) { timeline in
            content()
                .pulsingGlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    glowColor: glowColor,
                    pulseSpeed: 1.5,
                    minIntensity: 0.15,
                    maxIntensity: 0.5,
                    isEnabled: isProcessing
                )
        }
    }
}

/// Convenience modifier for processing glow
@available(iOS 17.0, *)
extension View {
    /// Add processing glow animation when condition is true
    func processingGlow(
        _ isProcessing: Bool,
        color: Color = .optaPurpleGlow
    ) -> some View {
        ProcessingGlowView(isProcessing: isProcessing, glowColor: color) {
            self
        }
    }
}

// MARK: - iOS 16 Fallback

extension View {
    /// Processing glow with iOS 16 fallback (uses opacity animation)
    @ViewBuilder
    func optaProcessingGlow(_ isProcessing: Bool) -> some View {
        if #available(iOS 17.0, *) {
            self.processingGlow(isProcessing)
        } else {
            // Fallback: simple opacity pulse
            self.overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.optaPurpleGlow, lineWidth: 2)
                    .opacity(isProcessing ? 0.6 : 0)
                    .animation(
                        isProcessing ?
                            .easeInOut(duration: 0.8).repeatForever(autoreverses: true) :
                            .default,
                        value: isProcessing
                    )
            )
        }
    }
}
```

**Verification**: Component compiles and provides fallback

### Task 4: Create Ambient Gradient Component

Create `Opta Scan/Views/Components/AmbientGradientView.swift`:

```swift
//
//  AmbientGradientView.swift
//  Opta Scan
//
//  Animated ambient gradient for hero/highlight elements
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

/// Adds subtle animated gradient flow to content
@available(iOS 17.0, *)
struct AmbientGradientView<Content: View>: View {
    let isAnimating: Bool
    let color1: Color
    let color2: Color
    let speed: Double
    @ViewBuilder let content: () -> Content

    init(
        isAnimating: Bool = true,
        color1: Color = .optaPurple,
        color2: Color = .optaBlue,
        speed: Double = 0.3,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isAnimating = isAnimating
        self.color1 = color1
        self.color2 = color2
        self.speed = speed
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30, paused: !isAnimating)) { timeline in
            content()
                .gradientFlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    color1: color1,
                    color2: color2,
                    speed: speed,
                    isEnabled: isAnimating
                )
        }
    }
}

/// Convenience modifier for ambient gradient
@available(iOS 17.0, *)
extension View {
    /// Add ambient flowing gradient effect
    func ambientGradient(
        _ isAnimating: Bool = true,
        colors: (Color, Color) = (.optaPurple, .optaBlue),
        speed: Double = 0.3
    ) -> some View {
        AmbientGradientView(
            isAnimating: isAnimating,
            color1: colors.0,
            color2: colors.1,
            speed: speed
        ) {
            self
        }
    }
}
```

**Verification**: Component compiles correctly

### Task 5: Update Demo View with Animated Effects

Update `Opta Scan/Views/Debug/ShaderDemoView.swift` to add animated effect section:

```swift
// Add state variables
@State private var isProcessing = false
@State private var animationTime: Double = 0

// Add to body VStack:
private var animatedSection: some View {
    VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
        Text("Animated Effects")
            .font(.optaHeadline)
            .foregroundStyle(Color.optaTextPrimary)

        // Processing glow demo
        VStack(spacing: OptaDesign.Spacing.sm) {
            Text("Processing Glow")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            HStack(spacing: OptaDesign.Spacing.md) {
                VStack {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.optaPurple)
                    Text("Analyzing...")
                        .font(.optaCaption)
                }
                .frame(maxWidth: .infinity)
                .padding(OptaDesign.Spacing.lg)
                .glassContent()
                .optaProcessingGlow(isProcessing)

                Toggle("", isOn: $isProcessing)
                    .labelsHidden()
                    .tint(.optaPurple)
            }
        }

        // Gradient flow demo
        TimelineView(.animation(minimumInterval: 1/30)) { timeline in
            VStack(spacing: OptaDesign.Spacing.sm) {
                Text("Gradient Flow")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                HStack(spacing: OptaDesign.Spacing.md) {
                    gradientDemoCard(
                        time: timeline.date.timeIntervalSinceReferenceDate,
                        colors: (.optaPurple, .optaBlue),
                        label: "Purple-Blue"
                    )
                    gradientDemoCard(
                        time: timeline.date.timeIntervalSinceReferenceDate,
                        colors: (.optaGreen, .optaBlue),
                        label: "Green-Blue"
                    )
                }
            }
        }

        // Shimmer demo
        TimelineView(.animation(minimumInterval: 1/60)) { timeline in
            VStack(spacing: OptaDesign.Spacing.sm) {
                Text("Shimmer Effect")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                HStack {
                    Image(systemName: "sparkle")
                        .font(.system(size: 24))
                    Text("Premium Feature")
                        .font(.optaBody)
                }
                .foregroundStyle(Color.optaTextPrimary)
                .frame(maxWidth: .infinity)
                .padding(OptaDesign.Spacing.lg)
                .glassContent()
                .shimmer(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    width: 0.15,
                    speed: 0.4,
                    intensity: 0.6
                )
            }
        }
    }
    .padding(OptaDesign.Spacing.lg)
    .glassContent()
}

private func gradientDemoCard(
    time: Double,
    colors: (Color, Color),
    label: String
) -> some View {
    VStack {
        Circle()
            .fill(colors.0)
            .frame(width: 24, height: 24)
        Text(label)
            .font(.optaLabel)
    }
    .frame(maxWidth: .infinity)
    .padding(OptaDesign.Spacing.md)
    .glassContent()
    .gradientFlow(
        time: time,
        color1: colors.0,
        color2: colors.1,
        speed: 0.3
    )
}
```

**Verification**: Demo shows all animated effects working

### Task 6: Build Verification and Performance Test

1. Build project: `xcodebuild -project "Opta Scan.xcodeproj" -scheme "w" build`
2. Run on iOS 17+ simulator
3. Open ShaderDemoView and verify:
   - Processing glow pulses smoothly
   - Gradient flow animates without stuttering
   - Shimmer sweeps across cards
4. Check CPU/GPU usage in Instruments (should be minimal)
5. Verify effects pause when TimelineView is paused

### Task 7: Thermal-Aware Animation Frame Rates (Research Compliance)

**Purpose**: Reduce GPU load during thermal pressure by adapting animation frame rates.

Create `Opta Scan/Design/ThermalAwareTimelineSchedule.swift`:

```swift
//
//  ThermalAwareTimelineSchedule.swift
//  Opta Scan
//
//  Thermal-adaptive animation scheduling
//  Part of Phase 10: Metal Shaders - Research Compliance
//
//  Reference: iOS/Distribution/iOS-App-Store-Compliance-wgpu.md
//  "Thermal Monitoring" - adaptive rendering quality
//

import SwiftUI

/// TimelineView schedule that adapts frame rate based on thermal state
struct ThermalAwareAnimationSchedule: TimelineSchedule {
    let baseInterval: TimeInterval
    let thermalMonitor: ThermalMonitor

    init(baseInterval: TimeInterval = 1/60, thermalMonitor: ThermalMonitor = .shared) {
        self.baseInterval = baseInterval
        self.thermalMonitor = thermalMonitor
    }

    func entries(from startDate: Date, mode: TimelineScheduleMode) -> Entries {
        Entries(startDate: startDate, baseInterval: adaptedInterval, mode: mode)
    }

    /// Adapt interval based on thermal state
    private var adaptedInterval: TimeInterval {
        switch thermalMonitor.shaderQuality {
        case .high:
            return baseInterval              // 60fps for high quality
        case .medium:
            return baseInterval * 2          // 30fps for medium
        case .minimal:
            return baseInterval * 4          // 15fps for minimal (or pause)
        }
    }

    struct Entries: Sequence, IteratorProtocol {
        var nextDate: Date
        let interval: TimeInterval
        let mode: TimelineScheduleMode

        init(startDate: Date, baseInterval: TimeInterval, mode: TimelineScheduleMode) {
            self.nextDate = startDate
            self.interval = baseInterval
            self.mode = mode
        }

        mutating func next() -> Date? {
            let current = nextDate
            nextDate = nextDate.addingTimeInterval(interval)
            return current
        }
    }
}

// MARK: - Convenience Extensions

extension TimelineSchedule where Self == ThermalAwareAnimationSchedule {
    /// Thermal-aware animation schedule (adapts fps based on thermal state)
    static func thermalAwareAnimation(
        baseInterval: TimeInterval = 1/60
    ) -> ThermalAwareAnimationSchedule {
        ThermalAwareAnimationSchedule(baseInterval: baseInterval)
    }
}

// MARK: - Thermal-Aware Animated View Wrapper

/// Wrapper that provides thermal-aware animation timing
@available(iOS 17.0, *)
struct ThermalAwareAnimatedView<Content: View>: View {
    @ObservedObject var thermalMonitor = ThermalMonitor.shared
    @Environment(\.accessibilityReduceMotion) var reduceMotion

    let baseFrameRate: Double
    @ViewBuilder let content: (Double) -> Content

    init(
        baseFrameRate: Double = 60,
        @ViewBuilder content: @escaping (Double) -> Content
    ) {
        self.baseFrameRate = baseFrameRate
        self.content = content
    }

    var body: some View {
        if reduceMotion {
            // Static view when Reduce Motion is enabled
            content(0)
        } else if thermalMonitor.shaderQuality == .minimal {
            // Skip animations entirely at critical thermal
            content(0)
        } else {
            TimelineView(.animation(minimumInterval: adaptedInterval, paused: false)) { timeline in
                content(timeline.date.timeIntervalSinceReferenceDate)
            }
        }
    }

    private var adaptedInterval: TimeInterval {
        switch thermalMonitor.shaderQuality {
        case .high:
            return 1.0 / baseFrameRate       // Full frame rate
        case .medium:
            return 2.0 / baseFrameRate       // Half frame rate
        case .minimal:
            return 4.0 / baseFrameRate       // Quarter (fallback, usually static)
        }
    }
}

// MARK: - Convenience Modifier

@available(iOS 17.0, *)
extension View {
    /// Wrap animated content with thermal-aware timing
    func thermalAwareAnimation<T: View>(
        baseFrameRate: Double = 60,
        @ViewBuilder animated: @escaping (Double, Self) -> T
    ) -> some View {
        ThermalAwareAnimatedView(baseFrameRate: baseFrameRate) { time in
            animated(time, self)
        }
    }
}
```

**Usage Example**:

```swift
// Instead of manual TimelineView:
ThermalAwareAnimatedView { time in
    content
        .pulsingGlow(time: time, isEnabled: isProcessing)
}

// Or use the modifier:
content
    .thermalAwareAnimation { time, view in
        view.gradientFlow(time: time)
    }
```

**Verification**:
- Animations run at 60fps when thermal state is nominal
- Animations drop to 30fps when thermal state is serious
- Animations are static when thermal state is critical
- Reduce Motion disables all animations

### Task 8: Accessibility - Reduce Motion Compliance

**Purpose**: Ensure all animations respect the Reduce Motion accessibility setting.

Update all animated view wrappers to check `accessibilityReduceMotion`:

```swift
// In ProcessingGlowView.swift, AmbientGradientView.swift, etc.
@Environment(\.accessibilityReduceMotion) var reduceMotion

var body: some View {
    if reduceMotion {
        // Static fallback - no animation
        content()
    } else {
        // Normal animated content
        TimelineView(...) { timeline in
            content()
                .pulsingGlow(time: timeline.date.timeIntervalSinceReferenceDate, ...)
        }
    }
}
```

**Also update ShaderEffects.swift** to respect Reduce Motion:

```swift
extension View {
    func gradientFlow(
        time: Double,
        // ... other params
        isEnabled: Bool = true
    ) -> some View {
        // isEnabled should be false when Reduce Motion is on
        // The calling code should pass: isEnabled: !reduceMotion
    }
}
```

**Verification**:
- Enable Settings > Accessibility > Motion > Reduce Motion
- Verify all shader animations show static state
- No movement, pulsing, or shimmer effects when enabled

## Acceptance Criteria

### Watchdog & Launch Compliance
- [ ] `ShaderCompilationManager` compiles shaders async post-launch
- [ ] App launches in < 2 seconds (no shader blocking)
- [ ] Graceful degradation if Metal unavailable

### Animated Shader Effects
- [ ] `gradientFlow` shader animates smoothly
- [ ] `pulsingGlow` shader creates processing effect
- [ ] `shimmer` shader creates sweep effect
- [ ] `breathingGlow` shader creates ambient effect
- [ ] `ProcessingGlowView` component works with TimelineView
- [ ] `AmbientGradientView` component works with TimelineView
- [ ] iOS 16 fallback uses opacity animation
- [ ] Animations pause when view is not visible

### Thermal Adaptation (Research Compliance)
- [ ] `ThermalAwareAnimationSchedule` adapts frame rate based on thermal state
- [ ] High quality: 60fps animations
- [ ] Medium quality (Serious thermal): 30fps animations
- [ ] Minimal quality (Critical thermal): Static/disabled animations
- [ ] Battery drain reduced during thermal pressure

### Accessibility Compliance
- [ ] All animations disabled when Reduce Motion enabled
- [ ] Static fallbacks provide equivalent information
- [ ] No VoiceOver confusion from animated state changes

### Performance
- [ ] < 5% CPU on animation at high quality
- [ ] 60fps maintained at nominal thermal
- [ ] GPU usage drops significantly at medium/minimal quality

## Estimated Scope

- **Files created**: 4
  - `ShaderCompilationManager.swift` - Async compilation (Watchdog compliance)
  - `ThermalAwareTimelineSchedule.swift` - Thermal-adaptive animation timing
  - `ProcessingGlowView.swift` - Processing state animations
  - `AmbientGradientView.swift` - Ambient gradient effects
- **Files modified**: 3
  - `OptaShaders.metal` - Add animated shaders
  - `ShaderEffects.swift` - Add animation extensions
  - `Opta_ScanApp.swift` - Add `.precompileShaders()` modifier
- **Complexity**: Medium-High (Watchdog compliance, thermal adaptation, accessibility)
- **Risk**: Low (additive, graceful degradation built-in)

## Notes

### Research-Driven Design
- Async shader compilation prevents Watchdog timer violations (20-second limit)
- Thermal-aware frame rates reduce battery drain during intensive use
- Reduce Motion compliance is mandatory for App Store

### Animation Best Practices
- TimelineView drives animations efficiently (pauses when not visible)
- Animation frame rate adapts: 60fps (nominal) → 30fps (serious) → static (critical)
- All animated shaders accept `isEnabled` parameter for conditional use
- Shimmer effect is great for skeleton loading states
- Use `breathingGlow` for idle states, `pulsingGlow` for active processing

### Testing Recommendations
- Test on physical device to verify thermal behavior
- Use Instruments to monitor GPU usage during animations
- Verify Reduce Motion in Settings disables all effects
- Test cold launch time to ensure < 2 second target
