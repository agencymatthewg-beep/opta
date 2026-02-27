//
//  SoundscapeModule.swift
//  OptaPlusMacOS
//
//  X4. Ambient Soundscapes — optional audio layer that responds to bot activity.
//  Procedurally generated tones (no audio file dependencies), ambient thinking
//  loops, and spatial audio in split-pane mode.
//
//  Module registration:  SoundscapeModule.register()
//  Module removal:       Delete this file. App is silent (minus existing SoundManager).
//
//  Keyboard shortcuts:
//    ⌘⇧M  — Toggle master mute
//
//  Event bus:
//    Listens:  .module_choreography_completed, .module_choreography_stepCompleted, connection state changes
//    Posts:    (none — audio only)
//
//  Frameworks: AVFoundation (AVAudioEngine for mixing/spatial)
//

import SwiftUI
import AVFoundation
import Combine
import OptaMolt
import os.log

// MARK: - Sound Category

/// Categories of sounds with independent volume controls.
enum SoundCategory: String, CaseIterable, Identifiable {
    case uiFeedback = "UI Feedback"
    case ambientThinking = "Ambient Thinking"
    case taskCompletion = "Task Completion"
    case spatial = "Spatial Audio"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .uiFeedback: return "speaker.wave.2"
        case .ambientThinking: return "waveform"
        case .taskCompletion: return "checkmark.circle"
        case .spatial: return "spatial"
        }
    }

    var description: String {
        switch self {
        case .uiFeedback: return "Clicks, pings, whooshes on actions"
        case .ambientThinking: return "Soft tones while bot thinks"
        case .taskCompletion: return "Satisfying sounds on task finish"
        case .spatial: return "Directional audio in split view"
        }
    }
}

// MARK: - Sound Pack

/// A swappable theme of procedurally generated sounds.
enum SoundPack: String, CaseIterable, Identifiable {
    case minimal = "Minimal"
    case ambient = "Ambient"
    case silent = "Silent"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .minimal: return "Clean clicks and tones"
        case .ambient: return "Full soundscape with thinking ambience"
        case .silent: return "No sounds"
        }
    }
}

// MARK: - Soundscape Settings

/// Persisted user preferences for the soundscape module.
struct SoundscapeSettings: Codable {
    var isEnabled: Bool = true
    var masterVolume: Float = 0.5
    var categoryVolumes: [String: Float] = [
        SoundCategory.uiFeedback.rawValue: 0.7,
        SoundCategory.ambientThinking.rawValue: 0.3,
        SoundCategory.taskCompletion.rawValue: 0.6,
        SoundCategory.spatial.rawValue: 0.5,
    ]
    var selectedPack: String = SoundPack.ambient.rawValue
    var respectSystemPreference: Bool = true

    func volume(for category: SoundCategory) -> Float {
        (categoryVolumes[category.rawValue] ?? 0.5) * masterVolume
    }

    var pack: SoundPack {
        SoundPack(rawValue: selectedPack) ?? .ambient
    }
}

// MARK: - Tone Generator

/// Procedurally generates audio buffers for different sound effects.
/// No audio file dependencies — pure sine wave synthesis.
final class ToneGenerator {
    private let sampleRate: Double = 44100
    private let format: AVAudioFormat

    init() {
        self.format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
    }

    /// Generate a short tone (click, ping, etc).
    func generateTone(
        frequency: Double,
        duration: Double,
        attack: Double = 0.01,
        decay: Double = 0.1,
        volume: Float = 0.3,
        harmonics: [(freq: Double, amp: Float)] = []
    ) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            let normalizedT = t / duration

            // ADSR envelope
            let envelope: Float
            if t < attack {
                envelope = Float(t / attack)
            } else if normalizedT < 1.0 - decay / duration {
                let decayProgress = (t - attack) / (duration - attack - decay)
                envelope = 1.0 - Float(decayProgress) * 0.3
            } else {
                let releaseProgress = (normalizedT - (1.0 - decay / duration)) / (decay / duration)
                envelope = max(0, 1.0 - Float(releaseProgress))
            }

            // Fundamental frequency
            var sample = Float(sin(2.0 * .pi * frequency * t)) * volume * envelope

            // Harmonics
            for harmonic in harmonics {
                sample += Float(sin(2.0 * .pi * harmonic.freq * t)) * harmonic.amp * volume * envelope
            }

            leftChannel[frame] = sample
            rightChannel[frame] = sample
        }

        return buffer
    }

    /// Generate an ambient drone (layered sine waves at harmonic intervals).
    func generateAmbientDrone(
        baseFrequency: Double = 110,
        duration: Double = 4.0,
        volume: Float = 0.1
    ) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        let harmonics: [(freq: Double, amp: Float)] = [
            (baseFrequency, 0.4),
            (baseFrequency * 1.5, 0.2),      // Perfect fifth
            (baseFrequency * 2.0, 0.15),      // Octave
            (baseFrequency * 2.5, 0.08),      // Major third (2nd octave)
            (baseFrequency * 3.0, 0.06),      // Perfect fifth (2nd octave)
        ]

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            let normalizedT = t / duration

            // Smooth fade in/out
            let fadeIn = min(1.0, normalizedT * 4)
            let fadeOut = min(1.0, (1.0 - normalizedT) * 4)
            let envelope = Float(fadeIn * fadeOut)

            var sample: Float = 0
            for h in harmonics {
                // Add slight phase drift for richness
                let drift = sin(t * 0.1 * h.freq / baseFrequency) * 0.5
                sample += Float(sin(2.0 * .pi * h.freq * t + drift)) * h.amp
            }

            let finalSample = sample * volume * envelope

            // Slight stereo widening
            let stereoOffset = Float(sin(t * 0.3)) * 0.1
            leftChannel[frame] = finalSample * (1.0 + stereoOffset)
            rightChannel[frame] = finalSample * (1.0 - stereoOffset)
        }

        return buffer
    }

    /// Generate a "whoosh" upward sweep (message sent).
    func generateWhoosh(duration: Double = 0.2, volume: Float = 0.15) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            let progress = t / duration

            // Upward frequency sweep: 200Hz -> 800Hz
            let freq = 200 + progress * 600
            let envelope = Float(sin(progress * .pi)) * volume  // bell curve

            // Mix white noise with sweep for "whoosh" texture
            let sweep = Float(sin(2.0 * .pi * freq * t)) * 0.6
            let noise = Float.random(in: -0.3...0.3) * Float(1.0 - progress) // noise fades out
            let sample = (sweep + noise) * envelope

            leftChannel[frame] = sample
            rightChannel[frame] = sample
        }

        return buffer
    }

    /// Generate a gentle ping (message received) with pitch variation.
    func generatePing(
        frequency: Double = 880,
        duration: Double = 0.3,
        volume: Float = 0.2
    ) -> AVAudioPCMBuffer? {
        generateTone(
            frequency: frequency,
            duration: duration,
            attack: 0.005,
            decay: 0.2,
            volume: volume,
            harmonics: [
                (freq: frequency * 2, amp: 0.15),
                (freq: frequency * 3, amp: 0.05),
            ]
        )
    }

    /// Generate an ascending chord (connection established).
    func generateAscendingChord(volume: Float = 0.15) -> AVAudioPCMBuffer? {
        let duration = 0.6
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        // C5, E5, G5 staggered entry
        let notes: [(freq: Double, delay: Double, amp: Float)] = [
            (523.25, 0.0, 0.4),   // C5
            (659.25, 0.1, 0.3),   // E5
            (783.99, 0.2, 0.25),  // G5
        ]

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            var sample: Float = 0

            for note in notes {
                let noteT = t - note.delay
                guard noteT > 0 else { continue }
                let env = Float(exp(-noteT * 4.0))  // Exponential decay
                sample += Float(sin(2.0 * .pi * note.freq * noteT)) * note.amp * env
            }

            let finalSample = sample * volume
            leftChannel[frame] = finalSample
            rightChannel[frame] = finalSample
        }

        return buffer
    }

    /// Generate a descending tone (connection lost / error).
    func generateDescendingTone(volume: Float = 0.15) -> AVAudioPCMBuffer? {
        let duration = 0.4
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            let progress = t / duration
            let freq = 660 - progress * 400  // 660Hz -> 260Hz
            let envelope = Float(1.0 - progress) * volume

            let sample = Float(sin(2.0 * .pi * freq * t)) * envelope
            leftChannel[frame] = sample
            rightChannel[frame] = sample
        }

        return buffer
    }

    /// Generate a satisfying click (step complete).
    func generateClick(volume: Float = 0.2) -> AVAudioPCMBuffer? {
        generateTone(
            frequency: 1200,
            duration: 0.05,
            attack: 0.001,
            decay: 0.03,
            volume: volume
        )
    }

    /// Generate a micro-fanfare (pipeline complete).
    func generateFanfare(volume: Float = 0.15) -> AVAudioPCMBuffer? {
        let duration = 0.8
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let leftChannel = buffer.floatChannelData?[0],
              let rightChannel = buffer.floatChannelData?[1] else { return nil }

        // Quick ascending arpeggio: G5 -> B5 -> D6 -> G6
        let notes: [(freq: Double, start: Double, dur: Double, amp: Float)] = [
            (783.99, 0.0, 0.3, 0.3),   // G5
            (987.77, 0.12, 0.3, 0.25),  // B5
            (1174.66, 0.24, 0.3, 0.2),  // D6
            (1567.98, 0.36, 0.4, 0.35), // G6 (sustain longer)
        ]

        for frame in 0..<Int(frameCount) {
            let t = Double(frame) / sampleRate
            var sample: Float = 0

            for note in notes {
                let noteT = t - note.start
                guard noteT >= 0 && noteT < note.dur else { continue }
                let env = Float(sin(noteT / note.dur * .pi))  // Bell envelope
                sample += Float(sin(2.0 * .pi * note.freq * noteT)) * note.amp * env
            }

            let finalSample = sample * volume
            leftChannel[frame] = finalSample
            rightChannel[frame] = finalSample
        }

        return buffer
    }
}

// MARK: - Sound Engine

/// Main sound engine using AVAudioEngine for mixing and spatial audio.
@MainActor
final class SoundEngine: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Soundscape")

    // MARK: Published State
    @Published var settings: SoundscapeSettings {
        didSet { persistSettings() }
    }
    @Published var isThinkingAmbientPlaying: Bool = false

    // MARK: Private
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var ambientPlayerNode: AVAudioPlayerNode?
    private var mixerNode: AVAudioMixerNode?
    private let toneGenerator = ToneGenerator()
    private var cancellables = Set<AnyCancellable>()
    private var thinkingLoopTask: Task<Void, Never>?

    // Per-bot pitch offsets for unique ping sounds
    private var botPitchMap: [String: Double] = [:]
    private var nextPitchIndex: Int = 0
    private let pitchScale: [Double] = [880, 988, 1047, 1175, 1319, 1397]  // A5-F6

    static let shared = SoundEngine()

    private init() {
        // Load settings
        if let data = UserDefaults.standard.data(forKey: "optaplus.soundscape"),
           let decoded = try? JSONDecoder().decode(SoundscapeSettings.self, from: data) {
            self.settings = decoded
        } else {
            self.settings = SoundscapeSettings()
        }
        setupEngine()
    }

    // MARK: - Engine Setup

    private func setupEngine() {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        let ambientPlayer = AVAudioPlayerNode()
        let mixer = AVAudioMixerNode()

        engine.attach(player)
        engine.attach(ambientPlayer)
        engine.attach(mixer)

        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!

        engine.connect(player, to: mixer, format: format)
        engine.connect(ambientPlayer, to: mixer, format: format)
        engine.connect(mixer, to: engine.mainMixerNode, format: format)

        self.audioEngine = engine
        self.playerNode = player
        self.ambientPlayerNode = ambientPlayer
        self.mixerNode = mixer
    }

    private func ensureRunning() {
        guard let engine = audioEngine, !engine.isRunning else { return }
        do {
            try engine.start()
            playerNode?.play()
            ambientPlayerNode?.play()
        } catch {
            Self.logger.error("Failed to start audio engine: \(error.localizedDescription)")
        }
    }

    // MARK: - Sound Playback

    /// Play a one-shot sound buffer.
    func play(_ buffer: AVAudioPCMBuffer?, category: SoundCategory, pan: Float = 0) {
        guard settings.isEnabled,
              settings.pack != .silent,
              let buffer = buffer else { return }

        // Check system preference
        if settings.respectSystemPreference && !systemSoundEffectsEnabled {
            return
        }

        ensureRunning()

        let volume = settings.volume(for: category)
        guard volume > 0, let player = playerNode else { return }

        player.volume = volume
        player.pan = pan  // -1.0 (left) to 1.0 (right) for spatial
        player.scheduleBuffer(buffer, completionHandler: nil)
    }

    // MARK: - UI Feedback Sounds

    func playMessageSent() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateWhoosh()
        play(buffer, category: .uiFeedback)
    }

    func playMessageReceived(botId: String) {
        guard settings.pack != .silent else { return }
        let pitch = pitchForBot(botId)
        let buffer = toneGenerator.generatePing(frequency: pitch)
        play(buffer, category: .uiFeedback)
    }

    func playConnected() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateAscendingChord()
        play(buffer, category: .uiFeedback)
    }

    func playDisconnected() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateDescendingTone()
        play(buffer, category: .uiFeedback)
    }

    func playError() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateDescendingTone(volume: 0.1)
        play(buffer, category: .uiFeedback)
    }

    // MARK: - Ambient Thinking

    func startThinkingAmbient() {
        guard settings.isEnabled,
              settings.pack == .ambient,
              !isThinkingAmbientPlaying else { return }

        isThinkingAmbientPlaying = true

        thinkingLoopTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled && self.isThinkingAmbientPlaying {
                let buffer = self.toneGenerator.generateAmbientDrone(
                    baseFrequency: 110 + Double.random(in: -5...5),
                    duration: 4.0,
                    volume: 0.08
                )
                if let buffer {
                    self.ensureRunning()
                    let volume = self.settings.volume(for: .ambientThinking)
                    self.ambientPlayerNode?.volume = volume
                    self.ambientPlayerNode?.scheduleBuffer(buffer, completionHandler: nil)
                }
                try? await Task.sleep(nanoseconds: 3_800_000_000) // Overlap slightly
            }
        }
    }

    func stopThinkingAmbient() {
        isThinkingAmbientPlaying = false
        thinkingLoopTask?.cancel()
        thinkingLoopTask = nil
        ambientPlayerNode?.stop()
        ambientPlayerNode?.play()  // Reset for next time
    }

    // MARK: - Task Completion

    func playStepComplete() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateClick()
        play(buffer, category: .taskCompletion)
    }

    func playPipelineComplete() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generateFanfare()
        play(buffer, category: .taskCompletion)
    }

    func playBell() {
        guard settings.pack != .silent else { return }
        let buffer = toneGenerator.generatePing(frequency: 1047, duration: 0.5, volume: 0.15)
        play(buffer, category: .taskCompletion)
    }

    // MARK: - Spatial Audio

    /// Play a sound with spatial positioning based on pane location.
    /// pan: -1.0 = full left, 0 = center, 1.0 = full right
    func playSpatial(botId: String, pan: Float) {
        guard settings.isEnabled,
              settings.pack != .silent else { return }
        let pitch = pitchForBot(botId)
        let buffer = toneGenerator.generatePing(frequency: pitch, volume: 0.15)
        play(buffer, category: .spatial, pan: pan)
    }

    // MARK: - Bot Pitch Mapping

    private func pitchForBot(_ botId: String) -> Double {
        if let pitch = botPitchMap[botId] { return pitch }
        let pitch = pitchScale[nextPitchIndex % pitchScale.count]
        botPitchMap[botId] = pitch
        nextPitchIndex += 1
        return pitch
    }

    // MARK: - System Preference

    private var systemSoundEffectsEnabled: Bool {
        let defaults = UserDefaults(suiteName: ".GlobalPreferences")
        let key = "com.apple.sound.uiaudio.enabled"
        guard let val = defaults?.object(forKey: key) else { return true }
        return (val as? NSNumber)?.boolValue ?? true
    }

    // MARK: - Persistence

    private func persistSettings() {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: "optaplus.soundscape")
        }
    }
}

// MARK: - Soundscape Settings View

struct SoundscapeSettingsView: View {
    @ObservedObject var engine: SoundEngine

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "waveform.circle")
                    .font(.system(size: 16))
                    .foregroundColor(.optaPrimary)
                Text("Soundscape")
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()

                Toggle("", isOn: $engine.settings.isEnabled)
                    .toggleStyle(.switch)
                    .controlSize(.small)
            }

            if engine.settings.isEnabled {
                // Sound pack selector
                VStack(alignment: .leading, spacing: 6) {
                    Text("Sound Pack")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextSecondary)

                    HStack(spacing: 8) {
                        ForEach(SoundPack.allCases) { pack in
                            Button(action: {
                                withAnimation(.optaSnap) {
                                    engine.settings.selectedPack = pack.rawValue
                                }
                            }) {
                                VStack(spacing: 4) {
                                    Text(pack.rawValue)
                                        .font(.sora(11, weight: engine.settings.pack == pack ? .semibold : .regular))
                                        .foregroundColor(engine.settings.pack == pack ? .optaPrimary : .optaTextSecondary)
                                    Text(pack.description)
                                        .font(.sora(9))
                                        .foregroundColor(.optaTextMuted)
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(engine.settings.pack == pack ? Color.optaPrimaryDim : Color.optaSurface.opacity(0.3))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(engine.settings.pack == pack ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Master volume
                VStack(alignment: .leading, spacing: 4) {
                    Text("Master Volume")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                    HStack {
                        Image(systemName: "speaker")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                        Slider(value: $engine.settings.masterVolume, in: 0...1)
                        Image(systemName: "speaker.wave.3")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Per-category sliders
                VStack(alignment: .leading, spacing: 8) {
                    Text("Categories")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextSecondary)

                    ForEach(SoundCategory.allCases) { category in
                        HStack(spacing: 8) {
                            Image(systemName: category.icon)
                                .font(.system(size: 10))
                                .foregroundColor(.optaPrimary)
                                .frame(width: 16)

                            Text(category.rawValue)
                                .font(.sora(10))
                                .foregroundColor(.optaTextPrimary)
                                .frame(width: 100, alignment: .leading)

                            Slider(
                                value: Binding(
                                    get: { engine.settings.categoryVolumes[category.rawValue] ?? 0.5 },
                                    set: { engine.settings.categoryVolumes[category.rawValue] = $0 }
                                ),
                                in: 0...1
                            )

                            // Preview button
                            Button(action: { previewCategory(category) }) {
                                Image(systemName: "play.circle")
                                    .font(.system(size: 12))
                                    .foregroundColor(.optaTextSecondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // System preference toggle
                Toggle("Respect system sound effects preference", isOn: $engine.settings.respectSystemPreference)
                    .font(.sora(10))
                    .foregroundColor(.optaTextSecondary)
            }
        }
        .padding(16)
    }

    private func previewCategory(_ category: SoundCategory) {
        switch category {
        case .uiFeedback:
            engine.playMessageReceived(botId: "preview")
        case .ambientThinking:
            engine.startThinkingAmbient()
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                engine.stopThinkingAmbient()
            }
        case .taskCompletion:
            engine.playPipelineComplete()
        case .spatial:
            engine.playSpatial(botId: "preview", pan: -0.8)
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                engine.playSpatial(botId: "preview", pan: 0.8)
            }
        }
    }
}

// MARK: - Module Registration

/// Integration point: wire SoundEngine into bot connection lifecycle and chat events.
///
/// **To add:** Call `SoundscapeModule.register(appState:)` in AppState.init()
///             Add SoundscapeSettingsView to the Settings sheet.
///
/// **To remove:** Delete this file. Remove the register call and settings view.
///                The existing SoundManager continues to work independently.
@MainActor
enum SoundscapeModule {
    static func register(appState: AppState) {
        let engine = SoundEngine.shared

        // Observe connection state changes for all bots
        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)

            // Connection sounds
            vm.$connectionState
                .removeDuplicates()
                .sink { state in
                    switch state {
                    case .connected: engine.playConnected()
                    case .disconnected: engine.playDisconnected()
                    default: break
                    }
                }
                .store(in: &registrationCancellables)

            // Bot state → thinking ambient
            vm.$botState
                .removeDuplicates()
                .sink { state in
                    switch state {
                    case .thinking:
                        engine.startThinkingAmbient()
                    case .typing:
                        engine.stopThinkingAmbient()
                    case .idle:
                        engine.stopThinkingAmbient()
                    }
                }
                .store(in: &registrationCancellables)

            // Message sounds
            vm.$messages
                .map(\.count)
                .removeDuplicates()
                .dropFirst()
                .sink { _ in
                    if let last = vm.messages.last {
                        switch last.sender {
                        case .user:
                            engine.playMessageSent()
                        case .bot:
                            engine.playMessageReceived(botId: bot.id)
                        }
                    }
                }
                .store(in: &registrationCancellables)
        }

        // Pipeline completion sounds
        NotificationCenter.default.publisher(for: .module_choreography_stepCompleted)
            .sink { _ in engine.playStepComplete() }
            .store(in: &registrationCancellables)

        NotificationCenter.default.publisher(for: .module_choreography_completed)
            .sink { _ in engine.playPipelineComplete() }
            .store(in: &registrationCancellables)
    }

    private static var registrationCancellables = Set<AnyCancellable>()
}
