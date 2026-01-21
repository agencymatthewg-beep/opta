//
//  ThermalStateManager.swift
//  OptaApp
//
//  Monitors thermal state and triggers quality adaptations for graceful degradation.
//  Based on Gemini Research: Premium-Haptics-Spatial-Audio-Opta.md (Section 6.1)
//

import Foundation
import Combine

// MARK: - Thermal State Manager

/// Monitors thermal state and triggers quality adaptations
///
/// Key insights from Gemini research:
/// - At .fair: Reduce visual particle count
/// - At .serious: Disable haptics, simplify audio
/// - At .critical: Minimal operation
/// - Check isLowPowerModeEnabled for power-efficient fallbacks
@Observable
final class ThermalStateManager {

    // MARK: - Singleton

    static let shared = ThermalStateManager()

    // MARK: - State

    /// Current thermal state
    private(set) var thermalState: ProcessInfo.ThermalState = .nominal

    /// Whether haptics should be disabled
    var shouldDisableHaptics: Bool {
        thermalState == .serious || thermalState == .critical
    }

    /// Whether spatial audio should be simplified (use 2D instead of 3D)
    var shouldSimplifyAudio: Bool {
        thermalState == .serious || thermalState == .critical
    }

    /// Whether to reduce visual quality (particles, effects)
    var shouldReduceVisualQuality: Bool {
        thermalState == .fair || thermalState == .serious || thermalState == .critical
    }

    /// Whether low power mode is enabled
    private(set) var isLowPowerModeEnabled: Bool = false

    /// Quality reduction level (0.0 = full quality, 1.0 = minimum quality)
    /// Use this to scale particle counts, effect intensity, etc.
    var qualityReductionLevel: Float {
        switch thermalState {
        case .nominal: return 0.0
        case .fair: return 0.25
        case .serious: return 0.6
        case .critical: return 1.0
        @unknown default: return 0.0
        }
    }

    /// Suggested particle count multiplier based on thermal state
    var particleCountMultiplier: Float {
        1.0 - (qualityReductionLevel * 0.8)  // At critical: 20% of normal particles
    }

    /// Suggested frame rate target based on thermal state
    var targetFrameRate: Int {
        switch thermalState {
        case .nominal: return 120
        case .fair: return 60
        case .serious: return 30
        case .critical: return 24
        @unknown default: return 60
        }
    }

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        // Get initial state
        thermalState = ProcessInfo.processInfo.thermalState
        isLowPowerModeEnabled = ProcessInfo.processInfo.isLowPowerModeEnabled

        setupObservers()

        print("[ThermalStateManager] Initial state: \(thermalStateDescription)")
        print("[ThermalStateManager] Low Power Mode: \(isLowPowerModeEnabled ? "ON" : "OFF")")
    }

    // MARK: - Setup

    private func setupObservers() {
        // Monitor thermal state changes
        NotificationCenter.default.publisher(
            for: ProcessInfo.thermalStateDidChangeNotification
        )
        .receive(on: DispatchQueue.main)
        .sink { [weak self] _ in
            self?.handleThermalStateChange()
        }
        .store(in: &cancellables)

        // Monitor low power mode changes
        NotificationCenter.default.publisher(
            for: .NSProcessInfoPowerStateDidChange
        )
        .receive(on: DispatchQueue.main)
        .sink { [weak self] _ in
            self?.handlePowerStateChange()
        }
        .store(in: &cancellables)
    }

    // MARK: - Handlers

    private func handleThermalStateChange() {
        let newState = ProcessInfo.processInfo.thermalState
        let oldState = thermalState
        thermalState = newState

        print("[ThermalStateManager] Thermal state: \(thermalStateDescription(for: oldState)) -> \(thermalStateDescription)")

        // Notify dependent systems
        NotificationCenter.default.post(
            name: .thermalStateDidChange,
            object: nil,
            userInfo: [
                "thermalState": newState,
                "previousState": oldState,
                "shouldDisableHaptics": shouldDisableHaptics,
                "shouldSimplifyAudio": shouldSimplifyAudio,
                "shouldReduceVisualQuality": shouldReduceVisualQuality,
                "qualityReduction": qualityReductionLevel
            ]
        )
    }

    private func handlePowerStateChange() {
        let wasLowPowerMode = isLowPowerModeEnabled
        isLowPowerModeEnabled = ProcessInfo.processInfo.isLowPowerModeEnabled

        print("[ThermalStateManager] Low Power Mode: \(wasLowPowerMode ? "ON" : "OFF") -> \(isLowPowerModeEnabled ? "ON" : "OFF")")

        NotificationCenter.default.post(
            name: .powerStateDidChange,
            object: nil,
            userInfo: [
                "isLowPowerMode": isLowPowerModeEnabled,
                "wasLowPowerMode": wasLowPowerMode
            ]
        )
    }

    // MARK: - Helpers

    var thermalStateDescription: String {
        thermalStateDescription(for: thermalState)
    }

    private func thermalStateDescription(for state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: return "Nominal"
        case .fair: return "Fair"
        case .serious: return "Serious"
        case .critical: return "Critical"
        @unknown default: return "Unknown"
        }
    }

    /// Returns a user-facing message about current thermal state
    var userMessage: String? {
        switch thermalState {
        case .nominal:
            return nil
        case .fair:
            return "System is warming up. Visual effects reduced."
        case .serious:
            return "System is hot. Haptics and effects disabled."
        case .critical:
            return "System is overheating. Performance limited."
        @unknown default:
            return nil
        }
    }

    /// Check if a specific feature should be enabled
    func shouldEnableFeature(_ feature: ThermalSensitiveFeature) -> Bool {
        switch feature {
        case .haptics:
            return !shouldDisableHaptics && !isLowPowerModeEnabled
        case .spatialAudio:
            return !shouldSimplifyAudio
        case .particles:
            return thermalState == .nominal || thermalState == .fair
        case .highFrameRate:
            return thermalState == .nominal
        case .animations:
            return thermalState != .critical
        }
    }
}

// MARK: - Feature Enum

/// Features that can be disabled based on thermal state
enum ThermalSensitiveFeature {
    case haptics
    case spatialAudio
    case particles
    case highFrameRate
    case animations
}

// MARK: - Notifications

extension Notification.Name {
    /// Posted when thermal state changes
    /// userInfo keys: thermalState, previousState, shouldDisableHaptics, shouldSimplifyAudio, shouldReduceVisualQuality, qualityReduction
    static let thermalStateDidChange = Notification.Name("com.opta.thermalStateDidChange")

    /// Posted when power state (low power mode) changes
    /// userInfo keys: isLowPowerMode, wasLowPowerMode
    static let powerStateDidChange = Notification.Name("com.opta.powerStateDidChange")
}
