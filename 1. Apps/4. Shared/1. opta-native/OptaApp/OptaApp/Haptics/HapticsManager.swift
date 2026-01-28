//
//  HapticsManager.swift
//  OptaApp
//
//  Manages CoreHaptics engine for tactile feedback synchronized
//  with Opta Ring animations and UI interactions.
//
//  Refactored for AHAP pattern loading based on Gemini Deep Research:
//  Premium-Haptics-Spatial-Audio-Opta.md
//

import Foundation
import CoreHaptics

// MARK: - Haptic Type Enum (Swift-side mirror)

/// Types of haptic feedback that can be triggered
enum HapticType: UInt32, CaseIterable {
    case tap = 0
    case explosion = 1
    case wakeUp = 2
    case pulse = 3
    case warning = 4
}

// MARK: - Haptics Manager

/// Manages CoreHaptics engine and provides haptic feedback patterns
/// synchronized with Opta Ring animations.
///
/// Key improvements from Gemini research:
/// - AHAP files loaded at init (not during trigger)
/// - Pre-created players for instant playback
/// - Fallback to programmatic haptics if AHAP fails
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

    /// Pre-loaded haptic patterns from AHAP files
    private var patterns: [HapticType: CHHapticPattern] = [:]

    /// Pre-created players for each pattern (reusable)
    private var players: [HapticType: CHHapticPatternPlayer] = [:]

    /// Whether AHAP patterns loaded successfully
    private(set) var ahapPatternsLoaded: Bool = false

    // MARK: - Initialization

    private init() {
        checkHapticsSupport()
        setupEngine()
        loadPatterns()
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

    /// Load AHAP patterns from bundle resources
    /// Key insight from Gemini: Parse AHAP at launch, not during explosion
    private func loadPatterns() {
        guard supportsHaptics, isEngineRunning else { return }

        let patternFiles: [(HapticType, String)] = [
            (.tap, "tap"),
            (.explosion, "ring_explosion"),
            (.wakeUp, "wake_up"),
            (.pulse, "optimization_pulse"),
            (.warning, "warning")
        ]

        var loadedCount = 0

        for (type, filename) in patternFiles {
            // Try multiple paths - AHAP files may be in bundle root or Resources subdirectory
            var url: URL?

            // Try direct bundle path first
            if let directURL = Bundle.main.url(forResource: filename, withExtension: "ahap") {
                url = directURL
            }
            // Try Resources subdirectory
            else if let resourceURL = Bundle.main.url(
                forResource: filename,
                withExtension: "ahap",
                subdirectory: "Resources"
            ) {
                url = resourceURL
            }
            // Try Haptics/Resources subdirectory
            else if let hapticsURL = Bundle.main.url(
                forResource: filename,
                withExtension: "ahap",
                subdirectory: "Haptics/Resources"
            ) {
                url = hapticsURL
            }

            guard let ahapURL = url else {
                print("[HapticsManager] Missing AHAP file: \(filename).ahap")
                continue
            }

            do {
                let pattern = try CHHapticPattern(contentsOf: ahapURL)
                patterns[type] = pattern

                // Pre-create player for instant playback
                if let player = try engine?.makePlayer(with: pattern) {
                    players[type] = player
                }

                loadedCount += 1
                print("[HapticsManager] Loaded pattern: \(filename)")

            } catch {
                print("[HapticsManager] Failed to load \(filename): \(error.localizedDescription)")
            }
        }

        ahapPatternsLoaded = loadedCount > 0
        print("[HapticsManager] Loaded \(loadedCount)/\(patternFiles.count) AHAP patterns")
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

    /// Handle engine reset - restart the engine and recreate players
    private func handleEngineReset() {
        print("[HapticsManager] Engine reset requested, restarting...")

        do {
            try engine?.start()
            isEngineRunning = true

            // Recreate players after engine reset
            recreatePlayers()

            print("[HapticsManager] Engine restarted successfully")
        } catch {
            print("[HapticsManager] Failed to restart engine: \(error.localizedDescription)")
            isEngineRunning = false
        }
    }

    /// Recreate players from existing patterns (after engine reset)
    private func recreatePlayers() {
        players.removeAll()

        for (type, pattern) in patterns {
            do {
                if let player = try engine?.makePlayer(with: pattern) {
                    players[type] = player
                }
            } catch {
                print("[HapticsManager] Failed to recreate player for \(type): \(error.localizedDescription)")
            }
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

            // Recreate players if needed
            if players.isEmpty && !patterns.isEmpty {
                recreatePlayers()
            }
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

    // MARK: - Haptic Playback (AHAP-based)

    /// Play a haptic based on type - uses AHAP patterns if available, falls back to programmatic
    func playHaptic(type: HapticType) {
        guard supportsHaptics, isEngineRunning else { return }

        // Try AHAP-based playback first
        if let player = players[type] {
            do {
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                print("[HapticsManager] AHAP playback failed for \(type): \(error.localizedDescription)")
                // Fall through to programmatic fallback
            }
        }

        // Fallback to programmatic haptics
        playFallbackHaptic(type: type)
    }

    // MARK: - Fallback Haptics (Programmatic)

    /// Fallback to programmatic haptics if AHAP not available
    private func playFallbackHaptic(type: HapticType) {
        switch type {
        case .tap:
            playTapFallback()
        case .explosion:
            playExplosionFallback()
        case .wakeUp:
            playWakeUpFallback()
        case .pulse:
            playPulseFallback()
        case .warning:
            playWarningFallback()
        }
    }

    /// Fallback: Play a simple tap haptic
    private func playTapFallback() {
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
            print("[HapticsManager] Fallback tap failed: \(error.localizedDescription)")
        }
    }

    /// Fallback: Play an explosion haptic with aftershock waves
    private func playExplosionFallback() {
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
            print("[HapticsManager] Fallback explosion failed: \(error.localizedDescription)")
        }
    }

    /// Fallback: Play a gentle wake-up haptic with ramping intensity
    private func playWakeUpFallback() {
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
            print("[HapticsManager] Fallback wake-up failed: \(error.localizedDescription)")
        }
    }

    /// Fallback: Play a soft pulse haptic
    private func playPulseFallback() {
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
            print("[HapticsManager] Fallback pulse failed: \(error.localizedDescription)")
        }
    }

    /// Fallback: Play a double-tap warning haptic
    private func playWarningFallback() {
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
            print("[HapticsManager] Fallback warning failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Legacy API (for compatibility)

    /// Play a simple tap haptic (legacy API)
    func playTap() {
        playHaptic(type: .tap)
    }

    /// Play an explosion haptic (legacy API)
    func playExplosion() {
        playHaptic(type: .explosion)
    }

    /// Play a wake-up haptic (legacy API)
    func playWakeUp() {
        playHaptic(type: .wakeUp)
    }

    /// Play a pulse haptic (legacy API)
    func playPulse() {
        playHaptic(type: .pulse)
    }

    /// Play a warning haptic (legacy API)
    func playWarning() {
        playHaptic(type: .warning)
    }
}
