//
//  PerformanceManager.swift
//  Opta Scan
//
//  Unified performance management for thermal, battery, and quality
//  Part of Phase 15: Performance Tuning
//

import SwiftUI
import Combine

// MARK: - Battery Mode

/// User-selectable battery optimization mode
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

    var iconName: String {
        switch self {
        case .balanced: return "battery.75"
        case .performance: return "bolt.fill"
        case .batterySaver: return "leaf.fill"
        }
    }
}

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

    /// User-selected battery optimization mode
    var batteryModeRaw: String {
        get { UserDefaults.standard.string(forKey: "opta.batteryMode") ?? BatteryMode.balanced.rawValue }
        set {
            UserDefaults.standard.set(newValue, forKey: "opta.batteryMode")
            updateEffectiveQuality()
        }
    }

    /// Current battery mode
    var currentBatteryMode: BatteryMode {
        get { BatteryMode(rawValue: batteryModeRaw) ?? .balanced }
        set { batteryModeRaw = newValue.rawValue }
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

    /// Adjust quality tier based on battery mode preference
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
