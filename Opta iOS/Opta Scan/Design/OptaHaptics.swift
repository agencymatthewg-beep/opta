//
//  OptaHaptics.swift
//  Opta Scan
//
//  CoreHaptics integration following IOS_AESTHETIC_GUIDE.md
//  Created by Matthew Byrden
//

import CoreHaptics
import UIKit

// MARK: - OptaHaptics Singleton

/// Centralized haptic feedback manager for Opta Scan
/// Uses CoreHaptics for premium feel with fallback to UIFeedbackGenerator
final class OptaHaptics {
    static let shared = OptaHaptics()

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
    func tap() {
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
    }

    /// Button press feedback - for primary actions
    func buttonPress() {
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
    }

    /// Success completion feedback - for positive outcomes
    func success() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.success)
    }

    /// Warning feedback - for attention-requiring states
    func warning() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.warning)
    }

    /// Error feedback - for failure states
    func error() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.error)
    }

    /// Processing start feedback - for beginning of heavy operations
    func processingStart() {
        let impact = UIImpactFeedbackGenerator(style: .heavy)
        impact.impactOccurred()
    }

    /// Selection changed feedback - for sliders, pickers
    func selectionChanged() {
        let selection = UISelectionFeedbackGenerator()
        selection.selectionChanged()
    }

    // MARK: - Custom AHAP Patterns

    /// Play a custom haptic pattern from an AHAP file
    /// - Parameter named: The name of the AHAP file (without extension)
    func playCustomHaptic(named: String) {
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

    // MARK: - Advanced Haptic Patterns

    /// Double tap pattern for confirmations
    func doubleTap() {
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
