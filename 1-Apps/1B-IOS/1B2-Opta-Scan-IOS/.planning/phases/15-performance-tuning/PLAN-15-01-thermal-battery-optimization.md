# Plan 15-01: Thermal & Battery Optimization

## Goal

Create a unified PerformanceManager with thermal monitoring, battery optimization, and quality tier management.

## Context

Building on all visual effects, this adds:
- Thermal state monitoring and response
- Low Power Mode detection
- Quality tier management (Ultra/High/Medium/Low)
- Automatic quality switching based on device state
- Battery-conscious rendering

## Implementation

### Step 1: Create Performance Manager

Create `Opta Scan/Services/PerformanceManager.swift`:

```swift
//
//  PerformanceManager.swift
//  Opta Scan
//
//  Unified performance management for thermal, battery, and quality
//  Part of Phase 15: Performance Tuning
//

import SwiftUI
import Combine

// MARK: - Quality Tier

/// Quality levels for visual effects
enum QualityTier: Int, Comparable, CaseIterable {
    case low = 0
    case medium = 1
    case high = 2
    case ultra = 3

    static func < (lhs: QualityTier, rhs: QualityTier) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var particleBirthRate: Float {
        switch self {
        case .low: return 1
        case .medium: return 3
        case .high: return 6
        case .ultra: return 10
        }
    }

    var blurRadius: CGFloat {
        switch self {
        case .low: return 5
        case .medium: return 10
        case .high: return 15
        case .ultra: return 20
        }
    }

    var shadowLayers: Int {
        switch self {
        case .low: return 1
        case .medium: return 2
        case .high: return 3
        case .ultra: return 4
        }
    }

    var animationEnabled: Bool {
        self >= .medium
    }

    var particlesEnabled: Bool {
        self >= .high
    }

    var metalShadersEnabled: Bool {
        self >= .medium
    }
}

// MARK: - Thermal State

/// Thermal state levels
enum ThermalLevel: Int, Comparable {
    case nominal = 0
    case fair = 1
    case serious = 2
    case critical = 3

    static func < (lhs: ThermalLevel, rhs: ThermalLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    init(from processInfo: ProcessInfo.ThermalState) {
        switch processInfo {
        case .nominal: self = .nominal
        case .fair: self = .fair
        case .serious: self = .serious
        case .critical: self = .critical
        @unknown default: self = .nominal
        }
    }

    var maxQualityTier: QualityTier {
        switch self {
        case .nominal: return .ultra
        case .fair: return .high
        case .serious: return .medium
        case .critical: return .low
        }
    }
}

// MARK: - Performance Manager

/// Unified performance management singleton
@Observable
final class PerformanceManager {
    static let shared = PerformanceManager()

    // MARK: - State

    private(set) var currentQuality: QualityTier = .high
    private(set) var thermalLevel: ThermalLevel = .nominal
    private(set) var isLowPowerMode: Bool = false
    private(set) var batteryLevel: Float = 1.0
    private(set) var isCharging: Bool = false

    /// User preference for max quality (can be overridden by system)
    var preferredQuality: QualityTier = .ultra {
        didSet { updateEffectiveQuality() }
    }

    /// Whether to respect system constraints (thermal, battery)
    var respectSystemConstraints: Bool = true {
        didSet { updateEffectiveQuality() }
    }

    // MARK: - Computed

    /// Effective quality after applying constraints
    var effectiveQuality: QualityTier {
        currentQuality
    }

    /// Whether reduce motion is enabled
    var reduceMotionEnabled: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupMonitoring()
        updateEffectiveQuality()
    }

    // MARK: - Setup

    private func setupMonitoring() {
        // Thermal state monitoring
        NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
            .sink { [weak self] _ in
                self?.updateThermalState()
            }
            .store(in: &cancellables)

        // Low Power Mode monitoring
        NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
            .sink { [weak self] _ in
                self?.updatePowerState()
            }
            .store(in: &cancellables)

        // Battery monitoring
        UIDevice.current.isBatteryMonitoringEnabled = true
        NotificationCenter.default.publisher(for: UIDevice.batteryLevelDidChangeNotification)
            .sink { [weak self] _ in
                self?.updateBatteryState()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIDevice.batteryStateDidChangeNotification)
            .sink { [weak self] _ in
                self?.updateBatteryState()
            }
            .store(in: &cancellables)

        // Initial state
        updateThermalState()
        updatePowerState()
        updateBatteryState()
    }

    // MARK: - State Updates

    private func updateThermalState() {
        thermalLevel = ThermalLevel(from: ProcessInfo.processInfo.thermalState)
        updateEffectiveQuality()
    }

    private func updatePowerState() {
        isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        updateEffectiveQuality()
    }

    private func updateBatteryState() {
        batteryLevel = UIDevice.current.batteryLevel
        isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
        updateEffectiveQuality()
    }

    private func updateEffectiveQuality() {
        guard respectSystemConstraints else {
            currentQuality = preferredQuality
            return
        }

        var quality = preferredQuality

        // Apply thermal constraints
        if quality > thermalLevel.maxQualityTier {
            quality = thermalLevel.maxQualityTier
        }

        // Apply low power mode constraint
        if isLowPowerMode && quality > .medium {
            quality = .medium
        }

        // Apply low battery constraint (below 20% and not charging)
        if batteryLevel < 0.2 && !isCharging && quality > .medium {
            quality = .medium
        }

        // Apply reduce motion constraint
        if reduceMotionEnabled && quality > .low {
            quality = .low
        }

        currentQuality = quality
    }

    // MARK: - Public API

    /// Force quality update check
    func refresh() {
        updateThermalState()
        updatePowerState()
        updateBatteryState()
    }

    /// Get recommended frame rate for current conditions
    var recommendedFrameRate: Int {
        switch currentQuality {
        case .ultra: return 120 // ProMotion
        case .high: return 60
        case .medium: return 30
        case .low: return 30
        }
    }
}

// MARK: - Environment Key

private struct PerformanceManagerKey: EnvironmentKey {
    static let defaultValue = PerformanceManager.shared
}

extension EnvironmentValues {
    var performanceManager: PerformanceManager {
        get { self[PerformanceManagerKey.self] }
        set { self[PerformanceManagerKey.self] = newValue }
    }
}

// MARK: - View Modifier

/// Modifier that provides quality-aware rendering
struct QualityAwareModifier: ViewModifier {
    @Environment(\.performanceManager) var performance

    func body(content: Content) -> some View {
        content
            .environment(\.performanceManager, performance)
    }
}

extension View {
    /// Make view quality-aware
    func qualityAware() -> some View {
        modifier(QualityAwareModifier())
    }
}
```

### Step 2: Create Quality-Adaptive Components

Create `Opta Scan/Design/QualityAdaptive.swift`:

```swift
//
//  QualityAdaptive.swift
//  Opta Scan
//
//  Quality-adaptive view modifiers and components
//  Part of Phase 15: Performance Tuning
//

import SwiftUI

// MARK: - Quality-Adaptive Blur

/// Blur that adapts to quality tier
struct AdaptiveBlurModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let baseRadius: CGFloat

    func body(content: Content) -> some View {
        let radius = baseRadius * (CGFloat(performance.currentQuality.rawValue + 1) / 4.0)
        content
            .blur(radius: radius)
    }
}

extension View {
    /// Apply quality-adaptive blur
    func adaptiveBlur(radius: CGFloat = 10) -> some View {
        modifier(AdaptiveBlurModifier(baseRadius: radius))
    }
}

// MARK: - Quality-Adaptive Shadow

/// Shadow that adapts to quality tier
struct AdaptiveShadowModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let color: Color
    let baseRadius: CGFloat

    func body(content: Content) -> some View {
        let layers = performance.currentQuality.shadowLayers
        let radius = baseRadius * (CGFloat(performance.currentQuality.rawValue + 1) / 4.0)

        content
            .background {
                ForEach(0..<layers, id: \.self) { layer in
                    content
                        .blur(radius: radius * CGFloat(layer + 1) / CGFloat(layers))
                        .opacity(0.3 / Double(layer + 1))
                }
            }
    }
}

extension View {
    /// Apply quality-adaptive shadow
    func adaptiveShadow(color: Color = .black, radius: CGFloat = 10) -> some View {
        modifier(AdaptiveShadowModifier(color: color, baseRadius: radius))
    }
}

// MARK: - Quality-Adaptive Animation

/// Animation that respects quality tier and reduce motion
struct AdaptiveAnimationModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let animation: Animation

    func body(content: Content) -> some View {
        content
            .animation(
                performance.currentQuality.animationEnabled ? animation : .none,
                value: performance.currentQuality
            )
    }
}

extension View {
    /// Apply quality-adaptive animation
    func adaptiveAnimation(_ animation: Animation = .optaSpring) -> some View {
        modifier(AdaptiveAnimationModifier(animation: animation))
    }
}

// MARK: - Conditional Effect

/// Apply effect only if quality allows
struct ConditionalEffectModifier<Effect: ViewModifier>: ViewModifier {
    @Environment(\.performanceManager) var performance
    let minimumQuality: QualityTier
    let effect: Effect

    func body(content: Content) -> some View {
        if performance.currentQuality >= minimumQuality {
            content.modifier(effect)
        } else {
            content
        }
    }
}

extension View {
    /// Apply effect only if quality tier is met
    func conditionalEffect<Effect: ViewModifier>(
        _ effect: Effect,
        minimumQuality: QualityTier
    ) -> some View {
        modifier(ConditionalEffectModifier(minimumQuality: minimumQuality, effect: effect))
    }
}

// MARK: - Performance Debug Overlay

/// Debug overlay showing current performance state
struct PerformanceDebugView: View {
    @Environment(\.performanceManager) var performance

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Quality: \(String(describing: performance.currentQuality))")
            Text("Thermal: \(String(describing: performance.thermalLevel))")
            Text("Low Power: \(performance.isLowPowerMode ? "Yes" : "No")")
            Text("Battery: \(Int(performance.batteryLevel * 100))%")
            Text("Charging: \(performance.isCharging ? "Yes" : "No")")
            Text("Target FPS: \(performance.recommendedFrameRate)")
        }
        .font(.caption.monospaced())
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}
```

### Step 3: Add Files to Xcode Project

Add:
- PerformanceManager.swift to Services group (create if needed)
- QualityAdaptive.swift to Design group

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Services/PerformanceManager.swift` | Create |
| `Opta Scan/Design/QualityAdaptive.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Quality tier responds to thermal state changes
3. Low Power Mode triggers quality reduction
4. Battery level affects quality appropriately

## Dependencies

- Phase 14 complete
- ProcessInfo thermal notifications
- UIDevice battery monitoring
