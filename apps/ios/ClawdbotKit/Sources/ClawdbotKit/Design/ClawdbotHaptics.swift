//
//  ClawdbotHaptics.swift
//  ClawdbotKit
//
//  CoreHaptics integration ported from Opta iOS design system.
//  Cross-platform: Full haptics on iOS, no-op on macOS.
//
//  Created by Matthew Byrden
//

#if os(iOS)
import CoreHaptics
import UIKit

// MARK: - ClawdbotHaptics (iOS Implementation)

/// Centralized haptic feedback manager for Clawdbot apps
/// Uses CoreHaptics for premium feel with fallback to UIFeedbackGenerator
public final class ClawdbotHaptics {
    public static let shared = ClawdbotHaptics()

    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool = false

    private init() {
        prepareHaptics()
    }

    // MARK: - Setup

    private func prepareHaptics() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        guard supportsHaptics else { return }

        do {
            engine = try CHHapticEngine()
            try engine?.start()

            // Handle engine reset
            engine?.resetHandler = { [weak self] in
                do {
                    try self?.engine?.start()
                } catch {
                    print("Failed to restart haptic engine: \(error)")
                }
            }

            // Handle engine stopped
            engine?.stoppedHandler = { reason in
                print("Haptic engine stopped: \(reason)")
            }
        } catch {
            print("Haptic engine failed to initialize: \(error)")
        }
    }

    // MARK: - Basic Haptic Methods

    /// Quick tap feedback - for subtle interactions
    public func tap() {
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
    }

    /// Button press feedback - for primary actions
    public func buttonPress() {
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
    }

    /// Success completion feedback - for positive outcomes
    public func success() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.success)
    }

    /// Warning feedback - for attention-requiring states
    public func warning() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.warning)
    }

    /// Error feedback - for failure states
    public func error() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.error)
    }

    /// Processing start feedback - for beginning of heavy operations
    public func processingStart() {
        let impact = UIImpactFeedbackGenerator(style: .heavy)
        impact.impactOccurred()
    }

    /// Selection changed feedback - for sliders, pickers
    public func selectionChanged() {
        let selection = UISelectionFeedbackGenerator()
        selection.selectionChanged()
    }

    // MARK: - Custom AHAP Patterns

    /// Play a custom haptic pattern from an AHAP file
    /// - Parameter named: The name of the AHAP file (without extension)
    public func playCustomHaptic(named: String) {
        guard supportsHaptics,
              let path = Bundle.main.path(forResource: named, ofType: "ahap") else {
            return
        }

        do {
            try engine?.playPattern(from: URL(fileURLWithPath: path))
        } catch {
            print("Failed to play haptic pattern '\(named)': \(error)")
        }
    }

    // MARK: - Gesture Haptics

    /// Gesture threshold crossed - subtle tick feedback
    /// Use when a swipe gesture crosses a trigger threshold
    public func gestureTick() {
        let impact = UIImpactFeedbackGenerator(style: .rigid)
        impact.impactOccurred(intensity: 0.5)
    }

    /// Gesture committed - action will execute
    /// Use when a gesture is released past the trigger threshold
    public func gestureCommit() {
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
    }

    // MARK: - Advanced Haptic Patterns

    /// Double tap pattern for confirmations
    public func doubleTap() {
        guard supportsHaptics, let engine = engine else {
            // Fallback
            tap()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.tap()
            }
            return
        }

        do {
            let events = [
                CHHapticEvent(eventType: .hapticTransient, parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ], relativeTime: 0),
                CHHapticEvent(eventType: .hapticTransient, parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ], relativeTime: 0.1)
            ]

            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            print("Failed to play double tap haptic: \(error)")
        }
    }
}

#else

// MARK: - ClawdbotHaptics (macOS Stub)

/// No-op haptic manager for macOS (Macs don't have Taptic Engine)
/// Provides the same API surface so code can call haptics without platform checks
public final class ClawdbotHaptics {
    public static let shared = ClawdbotHaptics()

    private init() {}

    // MARK: - No-op Methods

    /// Quick tap feedback - no-op on macOS
    public func tap() {}

    /// Button press feedback - no-op on macOS
    public func buttonPress() {}

    /// Success completion feedback - no-op on macOS
    public func success() {}

    /// Warning feedback - no-op on macOS
    public func warning() {}

    /// Error feedback - no-op on macOS
    public func error() {}

    /// Processing start feedback - no-op on macOS
    public func processingStart() {}

    /// Selection changed feedback - no-op on macOS
    public func selectionChanged() {}

    /// Play a custom haptic pattern - no-op on macOS
    public func playCustomHaptic(named: String) {}

    /// Gesture threshold crossed - no-op on macOS
    public func gestureTick() {}

    /// Gesture committed - no-op on macOS
    public func gestureCommit() {}

    /// Double tap pattern - no-op on macOS
    public func doubleTap() {}
}

#endif

// MARK: - Haptic Timing Rules Reference
/*
 | Action           | Timing               | Style               |
 |------------------|----------------------|---------------------|
 | Button tap       | Immediate            | Light impact        |
 | Capture photo    | On shutter           | Medium impact       |
 | Processing start | At animation start   | Heavy impact        |
 | Result reveal    | 50ms before visual   | Success notification|
 | Slider tick      | At each step         | Selection changed   |
 */
