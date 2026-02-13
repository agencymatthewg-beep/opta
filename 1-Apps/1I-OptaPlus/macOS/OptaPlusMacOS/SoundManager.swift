//
//  SoundManager.swift
//  OptaPlusMacOS
//
//  Subtle UI sound effects using system sounds.
//  Respects the system "Play user interface sound effects" preference.
//

import AppKit
import Foundation

@MainActor
final class SoundManager {
    static let shared = SoundManager()

    // MARK: - Sound Types

    enum Sound: String {
        case sendMessage = "Tink"
        case receiveMessage = "Pop"
        case connected = "Glass"
        case error = "Basso"
    }

    // MARK: - State

    /// Cache loaded sounds to avoid repeated lookups.
    private var cache: [Sound: NSSound] = [:]

    private init() {}

    // MARK: - Public API

    /// Play a UI sound if the system preference allows it.
    func play(_ sound: Sound) {
        guard systemSoundEffectsEnabled else { return }

        let nsSound: NSSound
        if let cached = cache[sound] {
            nsSound = cached
        } else if let loaded = NSSound(named: NSSound.Name(sound.rawValue)) {
            cache[sound] = loaded
            nsSound = loaded
        } else {
            return
        }

        // Stop if already playing (allows rapid re-trigger)
        if nsSound.isPlaying { nsSound.stop() }
        nsSound.play()
    }

    // MARK: - System Preference

    /// Check if "Play user interface sound effects" is enabled.
    private var systemSoundEffectsEnabled: Bool {
        // com.apple.sound.uiaudio.enabled defaults to true
        let defaults = UserDefaults(suiteName: ".GlobalPreferences")
        let key = "com.apple.sound.uiaudio.enabled"
        guard let val = defaults?.object(forKey: key) else { return true }
        return (val as? NSNumber)?.boolValue ?? true
    }
}
