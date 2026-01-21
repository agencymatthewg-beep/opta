//
//  HapticsManager.swift
//  OptaApp
//
//  Manages CoreHaptics engine for tactile feedback synchronized
//  with Opta Ring animations and UI interactions.
//

import Foundation
import CoreHaptics

// MARK: - Haptic Type Enum (Swift-side mirror)

/// Types of haptic feedback that can be triggered
enum HapticType: UInt32 {
    case tap = 0
    case explosion = 1
    case wakeUp = 2
    case pulse = 3
    case warning = 4
}

// MARK: - Haptics Manager

/// Manages CoreHaptics engine and provides haptic feedback patterns
/// synchronized with Opta Ring animations.
@MainActor
final class HapticsManager {

    // MARK: - Singleton

    /// Shared instance for global haptics access
    static let shared = HapticsManager()

    // MARK: - Properties

    /// The CoreHaptics engine
    private var engine: CHHapticEngine?

    /// Whether haptics are supported on this device
    private(set) var supportsHaptics: Bool = false

    /// Whether the engine is currently running
    private(set) var isEngineRunning: Bool = false

    /// Lock for thread-safe engine access
    private let engineLock = NSLock()

    // MARK: - Initialization

    private init() {
        checkHapticsSupport()
        setupEngine()
        registerRustCallback()
    }

    // MARK: - Setup

    /// Check if device supports haptics
    private func checkHapticsSupport() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics

        if !supportsHaptics {
            print("[HapticsManager] Device does not support haptics")
        }
    }

    /// Set up the haptic engine with proper handlers
    private func setupEngine() {
        guard supportsHaptics else { return }

        do {
            engine = try CHHapticEngine()

            // Handle engine stopped events
            engine?.stoppedHandler = { [weak self] reason in
                Task { @MainActor in
                    self?.handleEngineStopped(reason: reason)
                }
            }

            // Handle engine reset events
            engine?.resetHandler = { [weak self] in
                Task { @MainActor in
                    self?.handleEngineReset()
                }
            }

            // Start the engine
            try engine?.start()
            isEngineRunning = true

            print("[HapticsManager] Haptic engine started successfully")

        } catch {
            print("[HapticsManager] Failed to create haptic engine: \(error.localizedDescription)")
            supportsHaptics = false
        }
    }

    /// Handle engine stopped events
    private func handleEngineStopped(reason: CHHapticEngine.StoppedReason) {
        isEngineRunning = false

        let reasonString: String
        switch reason {
        case .audioSessionInterrupt:
            reasonString = "audio session interrupt"
        case .applicationSuspended:
            reasonString = "application suspended"
        case .idleTimeout:
            reasonString = "idle timeout"
        case .systemError:
            reasonString = "system error"
        case .notifyWhenFinished:
            reasonString = "finished"
        case .engineDestroyed:
            reasonString = "engine destroyed"
        case .gameControllerDisconnect:
            reasonString = "game controller disconnect"
        @unknown default:
            reasonString = "unknown"
        }

        print("[HapticsManager] Engine stopped: \(reasonString)")
    }

    /// Handle engine reset - restart the engine
    private func handleEngineReset() {
        print("[HapticsManager] Engine reset requested, restarting...")

        do {
            try engine?.start()
            isEngineRunning = true
            print("[HapticsManager] Engine restarted successfully")
        } catch {
            print("[HapticsManager] Failed to restart engine: \(error.localizedDescription)")
            isEngineRunning = false
        }
    }

    /// Register the callback with Rust
    private func registerRustCallback() {
        // Create the callback that Rust will call
        let callback: HapticCallback = { hapticType in
            Task { @MainActor in
                HapticsManager.shared.playHaptic(type: HapticType(rawValue: hapticType) ?? .tap)
            }
        }

        // Register with Rust
        opta_render_set_haptic_callback(callback)

        print("[HapticsManager] Registered haptic callback with Rust")
    }

    // MARK: - Engine Control

    /// Start the haptic engine if not running
    func startEngine() {
        engineLock.lock()
        defer { engineLock.unlock() }

        guard supportsHaptics, !isEngineRunning else { return }

        do {
            try engine?.start()
            isEngineRunning = true
        } catch {
            print("[HapticsManager] Failed to start engine: \(error.localizedDescription)")
        }
    }

    /// Stop the haptic engine
    func stopEngine() {
        engineLock.lock()
        defer { engineLock.unlock() }

        engine?.stop(completionHandler: { [weak self] error in
            if let error = error {
                print("[HapticsManager] Error stopping engine: \(error.localizedDescription)")
            }
            Task { @MainActor in
                self?.isEngineRunning = false
            }
        })
    }

    // MARK: - Haptic Playback

    /// Play a haptic based on type
    func playHaptic(type: HapticType) {
        switch type {
        case .tap:
            playTap()
        case .explosion:
            playExplosion()
        case .wakeUp:
            playWakeUp()
        case .pulse:
            playPulse()
        case .warning:
            playWarning()
        }
    }

    /// Play a simple tap haptic
    func playTap() {
        guard supportsHaptics, isEngineRunning else { return }

        do {
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)

            let event = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [intensity, sharpness],
                relativeTime: 0
            )

            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)

        } catch {
            print("[HapticsManager] Failed to play tap: \(error.localizedDescription)")
        }
    }

    /// Play an explosion haptic with aftershock waves
    /// Used for ring explosion animations
    func playExplosion() {
        guard supportsHaptics, isEngineRunning else { return }

        do {
            var events: [CHHapticEvent] = []

            // Initial burst - strong transient
            let burstIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
            let burstSharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [burstIntensity, burstSharpness],
                relativeTime: 0
            ))

            // Aftershock waves - 3 waves at decreasing intensity
            let waveDelays: [Double] = [0.1, 0.2, 0.35]
            let waveIntensities: [Float] = [0.6, 0.4, 0.2]

            for (index, delay) in waveDelays.enumerated() {
                let intensity = CHHapticEventParameter(
                    parameterID: .hapticIntensity,
                    value: waveIntensities[index]
                )
                let sharpness = CHHapticEventParameter(
                    parameterID: .hapticSharpness,
                    value: 0.3
                )

                events.append(CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [intensity, sharpness],
                    relativeTime: delay
                ))
            }

            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)

        } catch {
            print("[HapticsManager] Failed to play explosion: \(error.localizedDescription)")
        }
    }

    /// Play a gentle wake-up haptic with ramping intensity
    /// Used for ring activation animations
    func playWakeUp() {
        guard supportsHaptics, isEngineRunning else { return }

        do {
            var events: [CHHapticEvent] = []

            // 5 continuous events ramping from 0.2 to 0.8 intensity
            let count = 5
            let startIntensity: Float = 0.2
            let endIntensity: Float = 0.8
            let totalDuration: Double = 0.5
            let eventDuration: Double = totalDuration / Double(count)

            for i in 0..<count {
                let progress = Float(i) / Float(count - 1)
                let intensity = startIntensity + (endIntensity - startIntensity) * progress

                let intensityParam = CHHapticEventParameter(
                    parameterID: .hapticIntensity,
                    value: intensity
                )
                let sharpnessParam = CHHapticEventParameter(
                    parameterID: .hapticSharpness,
                    value: 0.3 + 0.3 * progress // Also ramp sharpness slightly
                )

                events.append(CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: [intensityParam, sharpnessParam],
                    relativeTime: Double(i) * eventDuration,
                    duration: eventDuration
                ))
            }

            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)

        } catch {
            print("[HapticsManager] Failed to play wake-up: \(error.localizedDescription)")
        }
    }

    /// Play a soft pulse haptic
    /// Used for idle breathing animations
    func playPulse() {
        guard supportsHaptics, isEngineRunning else { return }

        do {
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)

            let event = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [intensity, sharpness],
                relativeTime: 0,
                duration: 0.15
            )

            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)

        } catch {
            print("[HapticsManager] Failed to play pulse: \(error.localizedDescription)")
        }
    }

    /// Play a double-tap warning haptic
    /// Used for warning/alert states
    func playWarning() {
        guard supportsHaptics, isEngineRunning else { return }

        do {
            var events: [CHHapticEvent] = []

            // Double tap at 0.15 second interval
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)

            // First tap
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [intensity, sharpness],
                relativeTime: 0
            ))

            // Second tap at 0.15s
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [intensity, sharpness],
                relativeTime: 0.15
            ))

            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)

        } catch {
            print("[HapticsManager] Failed to play warning: \(error.localizedDescription)")
        }
    }
}
