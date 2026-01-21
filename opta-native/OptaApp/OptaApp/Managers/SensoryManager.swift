//
//  SensoryManager.swift
//  OptaApp
//
//  Unified manager for coordinated haptic and audio feedback.
//  Based on Gemini Research: Premium-Haptics-Spatial-Audio-Opta.md (Part VII)
//

import Foundation
import simd

// MARK: - Sensory Manager

/// Unified manager for coordinated haptic and audio feedback
///
/// This is the single entry point for all sensory feedback in Opta.
/// It coordinates:
/// - Haptics (via HapticsManager with AHAP patterns)
/// - Spatial Audio (via SpatialAudioManager)
/// - Thermal adaptation (via ThermalStateManager)
///
/// Key design decisions from Gemini research:
/// - Single entry point prevents audio/haptic desync
/// - Thermal state respected in all trigger methods
/// - Graceful degradation when device is hot
@MainActor
final class SensoryManager {

    // MARK: - Singleton

    static let shared = SensoryManager()

    // MARK: - Dependencies

    private let haptics = HapticsManager.shared
    private let audio = SpatialAudioManager.shared
    private let thermal = ThermalStateManager.shared

    // MARK: - State

    /// Whether sensory feedback is enabled globally
    var isEnabled: Bool = true

    /// Whether to use fallback haptics in low power mode
    var useFallbackInLowPower: Bool = true

    /// Whether to play audio feedback
    var audioEnabled: Bool = true

    /// Whether to play haptic feedback
    var hapticsEnabled: Bool = true

    // MARK: - Initialization

    private init() {
        setupThermalObserver()
        print("[SensoryManager] Initialized")
    }

    // MARK: - Setup

    private func setupThermalObserver() {
        NotificationCenter.default.addObserver(
            forName: .thermalStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleThermalChange(notification)
        }

        NotificationCenter.default.addObserver(
            forName: .powerStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handlePowerChange(notification)
        }
    }

    private func handleThermalChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let shouldDisable = userInfo["shouldDisableHaptics"] as? Bool else { return }

        if shouldDisable {
            print("[SensoryManager] Disabling haptics due to thermal state")
        } else {
            print("[SensoryManager] Re-enabling haptics (thermal state nominal/fair)")
        }
    }

    private func handlePowerChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let isLowPower = userInfo["isLowPowerMode"] as? Bool else { return }

        if isLowPower {
            print("[SensoryManager] Low Power Mode enabled - using power-efficient feedback")
        }
    }

    // MARK: - Coordinated Triggers

    /// Trigger explosion at 3D position with synced haptics and audio
    /// - Parameters:
    ///   - position: 3D position in visual coordinate space
    ///   - intensity: Intensity multiplier (0.0 to 1.0)
    func triggerExplosion(at position: SIMD3<Float>, intensity: Float = 1.0) {
        guard isEnabled else { return }

        // Play haptic (respects thermal state internally)
        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .explosion)
        }

        // Play spatial audio (simplified if thermal stressed)
        if audioEnabled {
            if thermal.shouldSimplifyAudio {
                // Use non-spatial fallback at origin
                audio.playSound(named: "explosion", at: .zero, volume: intensity)
            } else {
                audio.playExplosion(at: position, intensity: intensity)
            }
        }
    }

    /// Trigger optimization complete feedback
    func triggerOptimizationComplete() {
        guard isEnabled else { return }

        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .pulse)
        }

        if audioEnabled {
            audio.playSound2D(named: "optimize_complete", volume: 0.7)
        }
    }

    /// Trigger ring wake-up feedback
    func triggerWakeUp() {
        guard isEnabled else { return }

        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .wakeUp)
        }
    }

    /// Trigger warning feedback
    func triggerWarning() {
        guard isEnabled else { return }

        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .warning)
        }

        if audioEnabled {
            audio.playSound2D(named: "warning", volume: 0.6)
        }
    }

    /// Trigger simple tap feedback for UI interactions
    func triggerTap() {
        guard isEnabled else { return }

        // Skip in low power mode if using fallback
        if thermal.isLowPowerModeEnabled && useFallbackInLowPower {
            // In low power mode, skip custom haptics entirely
            // (Could use UIImpactFeedbackGenerator on iOS for more efficiency)
            return
        }

        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .tap)
        }
    }

    /// Trigger notification feedback
    func triggerNotification() {
        guard isEnabled else { return }

        if hapticsEnabled && thermal.shouldEnableFeature(.haptics) {
            haptics.playHaptic(type: .tap)
        }

        if audioEnabled {
            audio.playSound2D(named: "notification", volume: 0.5)
        }
    }

    // MARK: - Spatial Audio Configuration

    /// Update listener position for spatial audio
    /// Call this when the camera/viewpoint moves
    /// - Parameter position: Camera position in visual coordinate space
    func updateListenerPosition(_ position: SIMD3<Float>) {
        audio.updateListenerPosition(position)
    }

    /// Update listener orientation for spatial audio
    /// Call this when the camera/viewpoint rotates
    /// - Parameters:
    ///   - forward: Forward direction vector
    ///   - up: Up direction vector
    func updateListenerOrientation(forward: SIMD3<Float>, up: SIMD3<Float>) {
        audio.updateListenerOrientation(forward: forward, up: up)
    }

    /// Set the coordinate scale for spatial audio
    /// - Parameter scale: Scale factor (visual units to meters)
    func setCoordinateScale(_ scale: Float) {
        audio.coordinateScale = scale
    }

    // MARK: - Engine Control

    /// Start all sensory engines (call on app foreground)
    func startEngines() {
        haptics.startEngine()
        audio.startEngine()
        print("[SensoryManager] Engines started")
    }

    /// Stop all sensory engines (call on app background)
    func stopEngines() {
        haptics.stopEngine()
        audio.stopEngine()
        print("[SensoryManager] Engines stopped")
    }

    // MARK: - Status

    /// Whether haptics are currently available
    var hapticsAvailable: Bool {
        haptics.supportsHaptics && haptics.isEngineRunning
    }

    /// Whether spatial audio is currently available
    var audioAvailable: Bool {
        audio.isAvailable
    }

    /// Whether AHAP patterns loaded successfully
    var ahapPatternsLoaded: Bool {
        haptics.ahapPatternsLoaded
    }

    /// Current thermal state description
    var thermalStateDescription: String {
        thermal.thermalStateDescription
    }

    /// User-facing message about thermal state (if any)
    var thermalUserMessage: String? {
        thermal.userMessage
    }
}
