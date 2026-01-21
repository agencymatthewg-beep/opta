# Plan 10-01: Metal Shader Foundation

## Overview

**Phase**: 10 - Metal Shaders
**Plan**: 01 of 03
**Goal**: Establish Metal shader infrastructure with SwiftUI integration, Privacy Manifest compliance, and thermal-aware quality management

## Context

This plan creates the foundation for GPU-accelerated visual effects in Opta Scan. SwiftUI (iOS 17+) provides native Metal shader integration through `colorEffect()`, `distortionEffect()`, and `layerEffect()` view modifiers. Metal functions must be marked with `[[stitchable]]` attribute.

**Current state**: No Metal shaders exist. Glass effects use SwiftUI materials (`.thinMaterial`, etc.)
**Target state**: Metal shader library with infrastructure, thermal monitoring, and Privacy Manifest compliance

## Research Compliance

*Based on: Gemini Deep Research/iOS/Distribution/iOS-App-Store-Compliance-wgpu.md*

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Privacy Manifest** | Create `PrivacyInfo.xcprivacy` with Required Reason APIs | Critical |
| **Thermal Monitoring** | Implement `ThermalMonitor` for adaptive shader quality | High |
| **Async Init** | Ensure shader compilation doesn't block main thread | High |
| **Accessibility** | Respect `accessibilityReduceMotion` | High |

## Dependencies

- Phase 9 complete (gesture system in place)
- iOS 17+ target (already set)
- Xcode with Metal compiler support

## Tasks

### Task 0: Create Privacy Manifest (CRITICAL - Do First)

Create `Opta Scan/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <!-- UserDefaults for app settings and onboarding state -->
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
        <!-- File Timestamp for Core Data and asset caching -->
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
        <!-- System Boot Time for animation frame timing -->
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>35F9.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

**Add to Xcode:**
1. File > Add Files to "Opta Scan"
2. Select `PrivacyInfo.xcprivacy`
3. Ensure "Copy items if needed" and target membership is checked

**Verification**: Project builds, no ITMS-91053 warnings in App Store Connect

### Task 1: Create Thermal Monitor

Create `Opta Scan/Services/ThermalMonitor.swift`:

```swift
//
//  ThermalMonitor.swift
//  Opta Scan
//
//  Monitors device thermal state for adaptive shader quality
//  Based on: Gemini Deep Research/iOS/AI-ML/AI Optimization for iOS Apps.md
//

import Foundation
import Combine

/// Shader quality levels based on thermal state
enum ShaderQuality: Int, Comparable {
    case high = 3      // Full effects, 60fps
    case medium = 2    // Simplified effects, 30fps animations
    case minimal = 1   // Basic effects only, reduce GPU load

    static func < (lhs: ShaderQuality, rhs: ShaderQuality) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var maxAnimationFrameRate: Double {
        switch self {
        case .high: return 60
        case .medium: return 30
        case .minimal: return 15
        }
    }

    var enableComplexShaders: Bool {
        self >= .medium
    }

    var enableAnimatedShaders: Bool {
        self >= .medium
    }
}

/// Monitors thermal state and publishes appropriate shader quality level
@MainActor
final class ThermalMonitor: ObservableObject {
    static let shared = ThermalMonitor()

    @Published private(set) var shaderQuality: ShaderQuality = .high
    @Published private(set) var thermalState: ProcessInfo.ThermalState = .nominal

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Initial state
        updateThermalState()

        // Subscribe to thermal state changes
        NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updateThermalState()
            }
            .store(in: &cancellables)
    }

    private func updateThermalState() {
        thermalState = ProcessInfo.processInfo.thermalState

        switch thermalState {
        case .nominal, .fair:
            shaderQuality = .high
        case .serious:
            shaderQuality = .medium
            logThermalWarning("Thermal state serious - reducing shader quality")
        case .critical:
            shaderQuality = .minimal
            logThermalWarning("Thermal state critical - minimal shader effects")
        @unknown default:
            shaderQuality = .medium
        }
    }

    private func logThermalWarning(_ message: String) {
        #if DEBUG
        print("[ThermalMonitor] \(message)")
        #endif
    }
}

// MARK: - SwiftUI Environment

import SwiftUI

private struct ShaderQualityKey: EnvironmentKey {
    static let defaultValue: ShaderQuality = .high
}

extension EnvironmentValues {
    var shaderQuality: ShaderQuality {
        get { self[ShaderQualityKey.self] }
        set { self[ShaderQualityKey.self] = newValue }
    }
}

extension View {
    /// Inject thermal-aware shader quality into environment
    func withThermalMonitoring() -> some View {
        modifier(ThermalMonitoringModifier())
    }
}

private struct ThermalMonitoringModifier: ViewModifier {
    @StateObject private var thermalMonitor = ThermalMonitor.shared

    func body(content: Content) -> some View {
        content
            .environment(\.shaderQuality, thermalMonitor.shaderQuality)
    }
}
```

**Verification**: ThermalMonitor publishes quality changes when thermal state changes

### Task 2: Create Metal Shader Library File

Create `Opta Scan/Shaders/OptaShaders.metal` with:

```metal
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// MARK: - Color Tint Effect
// Basic color tinting shader to verify pipeline works

[[ stitchable ]] half4 colorTint(
    float2 position,
    half4 color,
    half4 tintColor,
    float intensity
) {
    // Blend original color with tint based on intensity
    half4 tinted = mix(color, tintColor * color.a, half(intensity));
    return tinted;
}

// MARK: - Brightness Adjustment
// Simple brightness shader for glow preparation

[[ stitchable ]] half4 brightness(
    float2 position,
    half4 color,
    float amount
) {
    half4 result = color;
    result.rgb *= half(1.0 + amount);
    return result;
}

// MARK: - Saturation Adjustment

[[ stitchable ]] half4 saturation(
    float2 position,
    half4 color,
    float amount
) {
    // Luminance weights for perceived brightness
    half3 luminance = half3(0.2126, 0.7152, 0.0722);
    half gray = dot(color.rgb, luminance);
    half3 result = mix(half3(gray), color.rgb, half(amount));
    return half4(result, color.a);
}
```

**Verification**: File compiles without errors when building project

### Task 3: Create SwiftUI Shader Extensions

Create `Opta Scan/Design/ShaderEffects.swift` with:

```swift
//
//  ShaderEffects.swift
//  Opta Scan
//
//  SwiftUI extensions for Metal shader effects
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

// MARK: - Shader Effect Availability

/// Check if Metal shaders are available and should be enabled
@available(iOS 17.0, *)
enum OptaShaderEffects {
    /// Whether shader effects should be enabled
    /// Respects: Reduce Motion, thermal state, iOS version
    static func isEnabled(quality: ShaderQuality = ThermalMonitor.shared.shaderQuality) -> Bool {
        guard !UIAccessibility.isReduceMotionEnabled else { return false }
        return quality.enableComplexShaders
    }

    /// Whether animated shader effects should be enabled
    static func isAnimationEnabled(quality: ShaderQuality = ThermalMonitor.shared.shaderQuality) -> Bool {
        guard !UIAccessibility.isReduceMotionEnabled else { return false }
        return quality.enableAnimatedShaders
    }
}

// MARK: - Color Tint Effect

@available(iOS 17.0, *)
extension View {
    /// Apply a color tint shader effect
    /// - Parameters:
    ///   - color: The tint color to apply
    ///   - intensity: Tint intensity from 0 (none) to 1 (full)
    ///   - isEnabled: Whether the effect is active
    func shaderTint(
        _ color: Color,
        intensity: Double = 0.3,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = color.resolve(in: EnvironmentValues())
        return self.colorEffect(
            ShaderLibrary.colorTint(
                .color(resolved),
                .float(intensity)
            ),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled()
        )
    }

    /// Apply brightness adjustment shader
    /// - Parameters:
    ///   - amount: Brightness adjustment (-1 to 1, 0 = no change)
    ///   - isEnabled: Whether the effect is active
    func shaderBrightness(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.brightness(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled()
        )
    }

    /// Apply saturation adjustment shader
    /// - Parameters:
    ///   - amount: Saturation level (0 = grayscale, 1 = normal, >1 = oversaturated)
    ///   - isEnabled: Whether the effect is active
    func shaderSaturation(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.saturation(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled()
        )
    }
}

// MARK: - Fallback for iOS 16

extension View {
    /// Conditional shader tint with iOS 16 fallback
    @ViewBuilder
    func optaTint(_ color: Color, intensity: Double = 0.3) -> some View {
        if #available(iOS 17.0, *) {
            self.shaderTint(color, intensity: intensity)
        } else {
            self.colorMultiply(color.opacity(intensity))
        }
    }
}
```

**Verification**: Build succeeds, no compiler errors

### Task 4: Add Metal File to Xcode Project

Ensure the `.metal` file is:
1. Added to the Xcode project
2. Included in the app target's "Compile Sources" build phase
3. Metal compiler settings are correct (default should work)

**Verification**: Project builds without Metal compiler errors

### Task 5: Create Shader Demo View (Development Only)

Create `Opta Scan/Views/Debug/ShaderDemoView.swift` for testing:

```swift
//
//  ShaderDemoView.swift
//  Opta Scan
//
//  Development view for testing Metal shader effects
//

import SwiftUI

#if DEBUG
@available(iOS 17.0, *)
struct ShaderDemoView: View {
    @StateObject private var thermalMonitor = ThermalMonitor.shared
    @State private var tintIntensity: Double = 0.3
    @State private var brightness: Double = 0.0
    @State private var saturation: Double = 1.0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Thermal status banner
                    thermalStatusBanner

                    // Sample content to apply shaders to
                    sampleCard
                        .shaderTint(.optaPurple, intensity: tintIntensity)
                        .shaderBrightness(brightness)
                        .shaderSaturation(saturation)

                    // Controls
                    controlsSection
                }
                .padding(OptaDesign.Spacing.lg)
            }
            .background(Color.optaBackground)
            .navigationTitle("Shader Demo")
            .navigationBarTitleDisplayMode(.inline)
        }
        .withThermalMonitoring()
    }

    private var thermalStatusBanner: some View {
        HStack {
            Image(systemName: thermalIcon)
                .foregroundStyle(thermalColor)
            Text("Thermal: \(thermalStateText)")
                .font(.optaCaption)
            Spacer()
            Text("Quality: \(thermalMonitor.shaderQuality)")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
        }
        .padding(OptaDesign.Spacing.md)
        .background(thermalColor.opacity(0.1))
        .cornerRadius(8)
    }

    private var thermalIcon: String {
        switch thermalMonitor.thermalState {
        case .nominal: return "thermometer.low"
        case .fair: return "thermometer.medium"
        case .serious: return "thermometer.high"
        case .critical: return "thermometer.sun.fill"
        @unknown default: return "thermometer"
        }
    }

    private var thermalColor: Color {
        switch thermalMonitor.thermalState {
        case .nominal: return .optaGreen
        case .fair: return .optaBlue
        case .serious: return .optaAmber
        case .critical: return .optaRed
        @unknown default: return .optaTextMuted
        }
    }

    private var thermalStateText: String {
        switch thermalMonitor.thermalState {
        case .nominal: return "Nominal"
        case .fair: return "Fair"
        case .serious: return "Serious"
        case .critical: return "Critical"
        @unknown default: return "Unknown"
        }
    }

    private var sampleCard: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.optaPurple)

            Text("Metal Shader Test")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            Text("Adjust sliders to see shader effects")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(OptaDesign.Spacing.xl)
        .glassContent()
    }

    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            Text("Shader Parameters")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Tint Intensity: \(tintIntensity, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $tintIntensity, in: 0...1)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Brightness: \(brightness, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $brightness, in: -0.5...0.5)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Saturation: \(saturation, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $saturation, in: 0...2)
                    .tint(.optaPurple)
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }
}

#Preview {
    if #available(iOS 17.0, *) {
        ShaderDemoView()
    }
}
#endif
```

**Verification**: Demo view renders and shader controls function, thermal status displays

### Task 6: Verify Build and Document

1. Run full build: `xcodebuild -project "Opta Scan.xcodeproj" -scheme "w" build`
2. Verify no warnings related to Metal shaders or Privacy Manifest
3. Test on simulator (iOS 17+) that shaders render
4. Verify ThermalMonitor responds to state changes

## Acceptance Criteria

- [ ] `PrivacyInfo.xcprivacy` created with Required Reason APIs (UserDefaults, FileTimestamp, SystemBootTime)
- [ ] `ThermalMonitor.swift` monitors thermal state and publishes shader quality
- [ ] `OptaShaders.metal` file created and compiles
- [ ] `ShaderEffects.swift` provides SwiftUI view extensions
- [ ] Basic color tint, brightness, saturation shaders work
- [ ] Shader effects automatically degrade based on thermal state
- [ ] Accessibility: Effects disabled when Reduce Motion is on
- [ ] iOS 16 fallback exists for `optaTint`
- [ ] Build succeeds on iPhone 17 Pro simulator

## Estimated Scope

- **Files created**: 5 (PrivacyInfo.xcprivacy, ThermalMonitor.swift, OptaShaders.metal, ShaderEffects.swift, ShaderDemoView.swift)
- **Files modified**: 0
- **Complexity**: Medium (new technology introduction + compliance)
- **Risk**: Low (additive, no breaking changes)

## Notes

- Privacy Manifest is REQUIRED for App Store submission - do this first
- Metal shaders require iOS 17+ for SwiftUI integration
- `[[stitchable]]` attribute is mandatory for SwiftUI shader functions
- ThermalMonitor should be injected at app root with `.withThermalMonitoring()`
- Color resolved values must use `EnvironmentValues()` for correct color space
- Future plans will build on this foundation for glass and glow effects
