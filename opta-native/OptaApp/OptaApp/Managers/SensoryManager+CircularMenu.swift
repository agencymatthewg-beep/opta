//
//  SensoryManager+CircularMenu.swift
//  OptaApp
//
//  Extension to SensoryManager providing sensory feedback for the circular menu.
//  Adds Interaction type, haptic patterns, and coordinated feedback methods.
//

import Foundation

// MARK: - Haptic Feedback Type

/// Extended haptic types for UI interactions
/// Maps to appropriate HapticType or provides custom patterns
extension SensoryManager {

    /// UI-focused haptic feedback types
    enum UIHaptic {
        /// Generic soft feedback for general interactions
        case generic
        /// Alignment haptic for snapping/highlighting
        case alignment
        /// Level change haptic for navigation/selection
        case levelChange
        /// Soft tick for progress indication
        case tick
        /// Error feedback
        case error
    }

    /// Play a UI-focused haptic
    /// - Parameter haptic: The haptic type to play
    func playHaptic(_ haptic: UIHaptic) {
        guard isEnabled, hapticsEnabled else { return }
        guard thermal.shouldEnableFeature(.haptics) else { return }

        switch haptic {
        case .generic:
            // Soft generic feedback
            haptics.playHaptic(type: .tap)
        case .alignment:
            // Quick subtle tick for sector highlighting
            haptics.playHaptic(type: .pulse)
        case .levelChange:
            // Stronger feedback for navigation/selection
            haptics.playHaptic(type: .tap)
        case .tick:
            // Light pulse for progress
            haptics.playHaptic(type: .pulse)
        case .error:
            // Warning pattern for errors
            haptics.playHaptic(type: .warning)
        }
    }
}

// MARK: - Sound Type

extension SensoryManager {

    /// Sound effects for UI interactions
    enum UISound: String {
        /// Activation sound for selections
        case activate = "activate"
        /// Navigation sound
        case navigate = "navigate"
        /// Error sound
        case error = "error"
        /// Open/close sound
        case whoosh = "whoosh"
    }

    /// Play a UI sound effect
    /// - Parameters:
    ///   - sound: The sound to play
    ///   - volume: Volume level (0.0 to 1.0)
    func playSound(_ sound: UISound, volume: Float = 0.5) {
        guard isEnabled, audioEnabled else { return }

        audio.playSound2D(named: sound.rawValue, volume: volume)
    }
}

// MARK: - Interaction Type

extension SensoryManager {

    /// Coordinated haptic and audio interaction
    struct Interaction {
        /// Haptic feedback type (nil for no haptic)
        let haptic: UIHaptic?
        /// Sound effect (nil for no sound)
        let sound: UISound?
        /// Volume for sound (default 0.5)
        let volume: Float

        init(haptic: UIHaptic?, sound: UISound?, volume: Float = 0.5) {
            self.haptic = haptic
            self.sound = sound
            self.volume = volume
        }
    }

    /// Play a coordinated interaction with haptic and audio feedback
    /// - Parameter interaction: The interaction to play
    func playInteraction(_ interaction: Interaction) {
        guard isEnabled else { return }

        // Play haptic if specified
        if let haptic = interaction.haptic {
            playHaptic(haptic)
        }

        // Play sound if specified
        if let sound = interaction.sound {
            playSound(sound, volume: interaction.volume)
        }
    }
}

// MARK: - Circular Menu Specific Triggers

extension SensoryManager {

    /// Trigger feedback when a sector is highlighted
    func triggerSectorHighlight() {
        playInteraction(.sectorHighlight)
    }

    /// Trigger feedback when a sector is selected
    func triggerSectorSelect() {
        playInteraction(.sectorSelect)
    }

    /// Trigger feedback when circular menu opens
    func triggerCircularMenuOpen() {
        playInteraction(.menuOpen)
    }

    /// Trigger feedback when circular menu closes
    func triggerCircularMenuClose() {
        playInteraction(.menuClose)
    }

    /// Trigger feedback when navigating via keyboard
    func triggerKeyboardNavigation() {
        playInteraction(.navigation)
    }

    /// Trigger error feedback for invalid selections
    func triggerSelectionError() {
        playInteraction(Interaction(haptic: .error, sound: .error, volume: 0.4))
    }
}

// MARK: - Predefined Interactions

extension SensoryManager.Interaction {

    /// Sector highlight - subtle alignment feedback
    static let sectorHighlight = SensoryManager.Interaction(
        haptic: .alignment,
        sound: nil
    )

    /// Sector selection - confirmation feedback with sound
    static let sectorSelect = SensoryManager.Interaction(
        haptic: .levelChange,
        sound: .activate,
        volume: 0.6
    )

    /// Menu open - subtle generic feedback
    static let menuOpen = SensoryManager.Interaction(
        haptic: .generic,
        sound: nil
    )

    /// Menu close - subtle generic feedback
    static let menuClose = SensoryManager.Interaction(
        haptic: .generic,
        sound: nil
    )

    /// Keyboard navigation - alignment tick
    static let navigation = SensoryManager.Interaction(
        haptic: .alignment,
        sound: nil
    )

    /// Error feedback
    static let error = SensoryManager.Interaction(
        haptic: .error,
        sound: .error,
        volume: 0.4
    )
}
