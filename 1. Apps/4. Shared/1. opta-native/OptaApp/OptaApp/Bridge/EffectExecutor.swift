//
//  EffectExecutor.swift
//  OptaApp
//
//  Executes Crux Effects on the native platform.
//  Bridges Rust Effects to Swift/macOS native APIs.
//

import Foundation
import AppKit
import UserNotifications

// MARK: - Effect Executor

/// Executes Crux Effects on the native macOS platform.
///
/// The EffectExecutor is responsible for bridging the declarative Effects
/// returned by the Crux core to imperative native platform actions.
///
/// # Effect Types
///
/// - **Haptic**: Triggers CoreHaptics feedback via HapticsManager
/// - **Audio**: Plays spatial audio sounds (Phase 70)
/// - **Timer**: Schedules delayed event dispatch
/// - **Notification**: Shows system notifications
/// - **Clipboard**: Copies text to pasteboard
/// - **URL**: Opens URLs in default browser
///
/// # Completion Callbacks
///
/// Some effects produce result events that should be dispatched back to
/// the Crux core. The completion callback is called with the result event.
@MainActor
final class EffectExecutor {

    // MARK: - Dependencies

    private let hapticsManager = HapticsManager.shared

    // MARK: - Active Timers

    private var activeTimers: [String: Timer] = [:]
    private var activeIntervals: [String: Timer] = [:]

    // MARK: - Initialization

    init() {
        // Request notification permission on init
        requestNotificationPermission()
    }

    // MARK: - Effect Execution

    /// Execute an effect from JSON and call completion with result event.
    ///
    /// - Parameters:
    ///   - effectJson: JSON string representing an Effect from Rust
    ///   - completion: Callback with result event (if any)
    func execute(effectJson: String, completion: @escaping (OptaEvent) -> Void) {
        guard let data = effectJson.data(using: .utf8) else {
            print("[EffectExecutor] Failed to convert effect JSON to data: \(effectJson)")
            return
        }

        // Try to decode the effect
        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            let effect = try decoder.decode(EffectWrapper.self, from: data)
            executeEffect(effect, completion: completion)
        } catch {
            print("[EffectExecutor] Failed to decode effect: \(error)")
            print("[EffectExecutor] Raw JSON: \(effectJson)")
        }
    }

    /// Execute a decoded effect
    private func executeEffect(_ effect: EffectWrapper, completion: @escaping (OptaEvent) -> Void) {
        switch effect {
        case .playHaptic(let id, let pattern):
            executeHaptic(id: id, pattern: pattern)

        case .playSpatialAudio(let id, let sound, let position):
            executeSpatialAudio(id: id, sound: sound, position: position)

        case .collectTelemetry(let id):
            // Telemetry collection handled by existing TelemetryService
            // Result event dispatched when telemetry arrives
            print("[EffectExecutor] CollectTelemetry effect \(id) - handled by TelemetryService")

        case .scheduleTimer(let id, let delayMs, let eventJson):
            executeTimer(id: id, delayMs: delayMs, eventJson: eventJson, completion: completion)

        case .scheduleInterval(let id, let intervalMs, let eventJson):
            executeInterval(id: id, intervalMs: intervalMs, eventJson: eventJson, completion: completion)

        case .cancelTimer(let id):
            cancelTimer(id: id)

        case .showNotification(let id, let title, let body):
            executeNotification(id: id, title: title, body: body)

        case .copyToClipboard(let id, let text):
            executeCopyToClipboard(id: id, text: text)

        case .openUrl(let id, let url):
            executeOpenUrl(id: id, url: url)

        case .requestNotificationPermission(let id):
            requestNotificationPermission()

        case .unknown(let rawJson):
            print("[EffectExecutor] Unknown effect type: \(rawJson)")
        }
    }

    // MARK: - Haptic Effects

    private func executeHaptic(id: String, pattern: HapticPatternWrapper) {
        // Map Crux HapticPattern to existing HapticsManager
        let ffiPattern: FfiHapticPattern
        switch pattern {
        case .light:
            ffiPattern = .light
        case .medium:
            ffiPattern = .medium
        case .heavy:
            ffiPattern = .heavy
        case .success:
            ffiPattern = .success
        case .warning:
            ffiPattern = .warning
        case .error:
            ffiPattern = .error
        case .optimizingPulse:
            ffiPattern = .optimizingPulse
        case .scoreCelebration:
            ffiPattern = .scoreCelebration
        }

        // Use HapticsManager to play the pattern
        // Note: HapticsManager uses its own HapticType, we need to bridge
        playHapticFeedback(pattern: ffiPattern)

        #if DEBUG
        print("[EffectExecutor] Played haptic: \(pattern)")
        #endif
    }

    /// Bridge FfiHapticPattern to HapticsManager
    private func playHapticFeedback(pattern: FfiHapticPattern) {
        switch pattern {
        case .light:
            hapticsManager.playTap()
        case .medium:
            hapticsManager.playTap()
        case .heavy:
            hapticsManager.playExplosion()
        case .success:
            hapticsManager.playWakeUp()
        case .warning:
            hapticsManager.playWarning()
        case .error:
            hapticsManager.playWarning()
        case .optimizingPulse:
            hapticsManager.playPulse()
        case .scoreCelebration:
            hapticsManager.playExplosion()
        }
    }

    // MARK: - Audio Effects

    private func executeSpatialAudio(id: String, sound: SoundEffectWrapper, position: AudioPositionWrapper?) {
        // TODO: Implement spatial audio in Phase 70
        print("[EffectExecutor] Spatial audio: \(sound) at position: \(String(describing: position))")
    }

    // MARK: - Timer Effects

    private func executeTimer(id: String, delayMs: UInt64, eventJson: String?, completion: @escaping (OptaEvent) -> Void) {
        let delay = Double(delayMs) / 1000.0

        let timer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.activeTimers.removeValue(forKey: id)

            // Parse and dispatch the event
            if let eventJson = eventJson {
                // For now, handle common timer events
                if eventJson.contains("TelemetryTick") {
                    completion(.telemetryTick)
                } else if eventJson.contains("RefreshProcesses") {
                    completion(.refreshProcesses)
                }
            }
        }

        activeTimers[id] = timer

        #if DEBUG
        print("[EffectExecutor] Scheduled timer \(id) for \(delay)s")
        #endif
    }

    private func executeInterval(id: String, intervalMs: UInt64, eventJson: String?, completion: @escaping (OptaEvent) -> Void) {
        let interval = Double(intervalMs) / 1000.0

        let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            // Parse and dispatch the event
            if let eventJson = eventJson {
                if eventJson.contains("TelemetryTick") {
                    completion(.telemetryTick)
                } else if eventJson.contains("RefreshProcesses") {
                    completion(.refreshProcesses)
                }
            }
        }

        activeIntervals[id] = timer

        #if DEBUG
        print("[EffectExecutor] Scheduled interval \(id) every \(interval)s")
        #endif
    }

    private func cancelTimer(id: String) {
        if let timer = activeTimers.removeValue(forKey: id) {
            timer.invalidate()
            print("[EffectExecutor] Cancelled timer \(id)")
        }
        if let interval = activeIntervals.removeValue(forKey: id) {
            interval.invalidate()
            print("[EffectExecutor] Cancelled interval \(id)")
        }
    }

    // MARK: - Notification Effects

    private func executeNotification(id: String, title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[EffectExecutor] Failed to show notification: \(error)")
            } else {
                #if DEBUG
                print("[EffectExecutor] Showed notification: \(title)")
                #endif
            }
        }
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("[EffectExecutor] Notification permission error: \(error)")
            } else {
                print("[EffectExecutor] Notification permission: \(granted ? "granted" : "denied")")
            }
        }
    }

    // MARK: - Clipboard Effects

    private func executeCopyToClipboard(id: String, text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)

        #if DEBUG
        print("[EffectExecutor] Copied to clipboard: \(text.prefix(50))...")
        #endif
    }

    // MARK: - URL Effects

    private func executeOpenUrl(id: String, url: String) {
        guard let nsUrl = URL(string: url) else {
            print("[EffectExecutor] Invalid URL: \(url)")
            return
        }

        NSWorkspace.shared.open(nsUrl)

        #if DEBUG
        print("[EffectExecutor] Opened URL: \(url)")
        #endif
    }

    // MARK: - Cleanup

    func cancelAllTimers() {
        activeTimers.values.forEach { $0.invalidate() }
        activeTimers.removeAll()
        activeIntervals.values.forEach { $0.invalidate() }
        activeIntervals.removeAll()
    }
}

// MARK: - Effect Wrapper Types for JSON Decoding

/// Wrapper enum for decoding Rust Effect variants
enum EffectWrapper: Decodable {
    case playHaptic(id: String, pattern: HapticPatternWrapper)
    case playSpatialAudio(id: String, sound: SoundEffectWrapper, position: AudioPositionWrapper?)
    case collectTelemetry(id: String)
    case scheduleTimer(id: String, delayMs: UInt64, eventJson: String?)
    case scheduleInterval(id: String, intervalMs: UInt64, eventJson: String?)
    case cancelTimer(id: String)
    case showNotification(id: String, title: String, body: String)
    case copyToClipboard(id: String, text: String)
    case openUrl(id: String, url: String)
    case requestNotificationPermission(id: String)
    case unknown(rawJson: String)

    // Custom Decodable for Rust enum serialization format
    private enum CodingKeys: String, CodingKey {
        case playHaptic = "PlayHaptic"
        case playSpatialAudio = "PlaySpatialAudio"
        case collectTelemetry = "CollectTelemetry"
        case scheduleTimer = "ScheduleTimer"
        case scheduleInterval = "ScheduleInterval"
        case cancelTimer = "CancelTimer"
        case showNotification = "ShowNotification"
        case copyToClipboard = "CopyToClipboard"
        case openUrl = "OpenUrl"
        case requestNotificationPermission = "RequestNotificationPermission"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let haptic = try? container.decode(PlayHapticPayload.self, forKey: .playHaptic) {
            self = .playHaptic(id: haptic.id, pattern: haptic.pattern)
        } else if let audio = try? container.decode(PlaySpatialAudioPayload.self, forKey: .playSpatialAudio) {
            self = .playSpatialAudio(id: audio.id, sound: audio.sound, position: audio.position)
        } else if let telemetry = try? container.decode(IdPayload.self, forKey: .collectTelemetry) {
            self = .collectTelemetry(id: telemetry.id)
        } else if let timer = try? container.decode(ScheduleTimerPayload.self, forKey: .scheduleTimer) {
            self = .scheduleTimer(id: timer.id, delayMs: timer.delayMs, eventJson: timer.event)
        } else if let interval = try? container.decode(ScheduleIntervalPayload.self, forKey: .scheduleInterval) {
            self = .scheduleInterval(id: interval.id, intervalMs: interval.intervalMs, eventJson: interval.event)
        } else if let cancel = try? container.decode(IdPayload.self, forKey: .cancelTimer) {
            self = .cancelTimer(id: cancel.id)
        } else if let notification = try? container.decode(ShowNotificationPayload.self, forKey: .showNotification) {
            self = .showNotification(id: notification.id, title: notification.title, body: notification.body)
        } else if let clipboard = try? container.decode(CopyToClipboardPayload.self, forKey: .copyToClipboard) {
            self = .copyToClipboard(id: clipboard.id, text: clipboard.text)
        } else if let url = try? container.decode(OpenUrlPayload.self, forKey: .openUrl) {
            self = .openUrl(id: url.id, url: url.url)
        } else if let permission = try? container.decode(IdPayload.self, forKey: .requestNotificationPermission) {
            self = .requestNotificationPermission(id: permission.id)
        } else {
            // Capture raw JSON for debugging
            let singleContainer = try decoder.singleValueContainer()
            if let raw = try? singleContainer.decode([String: AnyDecodable].self) {
                self = .unknown(rawJson: String(describing: raw))
            } else {
                self = .unknown(rawJson: "Unable to decode")
            }
        }
    }
}

// MARK: - Payload Types

private struct PlayHapticPayload: Decodable {
    let id: String
    let pattern: HapticPatternWrapper
}

private struct PlaySpatialAudioPayload: Decodable {
    let id: String
    let sound: SoundEffectWrapper
    let position: AudioPositionWrapper?
}

private struct IdPayload: Decodable {
    let id: String
}

private struct ScheduleTimerPayload: Decodable {
    let id: String
    let delayMs: UInt64
    let event: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case delayMs = "delay_ms"
        case event
    }
}

private struct ScheduleIntervalPayload: Decodable {
    let id: String
    let intervalMs: UInt64
    let event: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case intervalMs = "interval_ms"
        case event
    }
}

private struct ShowNotificationPayload: Decodable {
    let id: String
    let title: String
    let body: String
}

private struct CopyToClipboardPayload: Decodable {
    let id: String
    let text: String
}

private struct OpenUrlPayload: Decodable {
    let id: String
    let url: String
}

// MARK: - Haptic Pattern Wrapper

/// Haptic pattern matching Rust HapticPattern enum
enum HapticPatternWrapper: String, Codable {
    case light = "Light"
    case medium = "Medium"
    case heavy = "Heavy"
    case success = "Success"
    case warning = "Warning"
    case error = "Error"
    case optimizingPulse = "OptimizingPulse"
    case scoreCelebration = "ScoreCelebration"
}

// MARK: - Sound Effect Wrapper

/// Sound effect matching Rust SoundEffect enum
enum SoundEffectWrapper: String, Codable {
    case click = "Click"
    case transition = "Transition"
    case optimizeStart = "OptimizeStart"
    case optimizeComplete = "OptimizeComplete"
    case scoreUp = "ScoreUp"
    case alert = "Alert"
    case ringWake = "RingWake"
    case ringSleep = "RingSleep"
}

// MARK: - Audio Position Wrapper

/// 3D position for spatial audio
struct AudioPositionWrapper: Codable {
    var x: Float
    var y: Float
    var z: Float
}

// MARK: - AnyDecodable Helper

/// Helper for decoding unknown JSON structures
struct AnyDecodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyDecodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyDecodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
}
