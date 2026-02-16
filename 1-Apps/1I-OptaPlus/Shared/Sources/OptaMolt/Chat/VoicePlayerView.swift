//
//  VoicePlayerView.swift
//  OptaMolt
//
//  Plays audio from Data with waveform visualization, play/pause, and progress.
//  Uses AVAudioPlayer for playback and spring physics for animations.
//

import SwiftUI
import AVFoundation

// MARK: - Voice Player

@MainActor
final class VoicePlayer: NSObject, ObservableObject {
    @Published var isPlaying = false
    @Published var progress: Double = 0 // 0..1
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0

    private var player: AVAudioPlayer?
    private var timer: Timer?

    func load(_ data: Data) {
        do {
            player = try AVAudioPlayer(data: data)
            player?.delegate = self
            player?.prepareToPlay()
            duration = player?.duration ?? 0
        } catch {
            duration = 0
        }
    }

    func togglePlayback() {
        guard let player else { return }
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    func play() {
        guard let player else { return }

        #if canImport(UIKit)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif

        player.play()
        isPlaying = true

        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.updateProgress()
            }
        }
    }

    func pause() {
        player?.pause()
        isPlaying = false
        timer?.invalidate()
        timer = nil
    }

    func seek(to fraction: Double) {
        guard let player else { return }
        let time = fraction * player.duration
        player.currentTime = time
        currentTime = time
        progress = fraction
    }

    private func updateProgress() {
        guard let player else { return }
        currentTime = player.currentTime
        progress = player.duration > 0 ? player.currentTime / player.duration : 0
    }

    func stop() {
        player?.stop()
        isPlaying = false
        timer?.invalidate()
        timer = nil
        progress = 0
        currentTime = 0
    }
}

extension VoicePlayer: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            isPlaying = false
            progress = 0
            currentTime = 0
            timer?.invalidate()
            timer = nil
        }
    }
}

// MARK: - Voice Player View

public struct VoicePlayerView: View {
    let audioData: Data
    let filename: String
    let formattedSize: String

    @StateObject private var player = VoicePlayer()
    @State private var isDragging = false

    public init(audioData: Data, filename: String = "Voice message", formattedSize: String = "") {
        self.audioData = audioData
        self.filename = filename
        self.formattedSize = formattedSize
    }

    public var body: some View {
        HStack(spacing: 10) {
            // Play/pause button
            Button(action: { player.togglePlayback() }) {
                ZStack {
                    Circle()
                        .fill(Color.optaPrimary.opacity(0.15))
                        .frame(width: 36, height: 36)

                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.optaPrimary)
                        .offset(x: player.isPlaying ? 0 : 1) // visual centering for play icon
                }
                .scaleEffect(player.isPlaying ? 1.05 : 1.0)
                .animation(.optaSnap, value: player.isPlaying)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(player.isPlaying ? "Pause" : "Play")

            VStack(alignment: .leading, spacing: 4) {
                // Waveform / progress bar
                WaveformBar(progress: player.progress, isPlaying: player.isPlaying)
                    .frame(height: 24)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isDragging = true
                                let fraction = max(0, min(1, value.location.x / max(1, value.startLocation.x + 150)))
                                player.seek(to: Double(fraction))
                            }
                            .onEnded { _ in
                                isDragging = false
                            }
                    )

                // Duration label
                HStack(spacing: 4) {
                    Text(formatTime(player.currentTime))
                        .monospacedDigit()
                    Text("/")
                        .foregroundColor(.optaTextMuted)
                    Text(formatTime(player.duration))
                        .monospacedDigit()
                }
                .font(.system(size: 10))
                .foregroundColor(.optaTextSecondary)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
        )
        .onAppear { player.load(audioData) }
        .onDisappear { player.stop() }
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Waveform Bar

private struct WaveformBar: View {
    let progress: Double
    let isPlaying: Bool

    // Fixed bar count for consistent display
    private let barCount = 28

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                ForEach(0..<barCount, id: \.self) { index in
                    let fraction = Double(index) / Double(barCount)
                    let isFilled = fraction <= progress
                    let height = barHeight(for: index)

                    RoundedRectangle(cornerRadius: 1)
                        .fill(isFilled ? Color.optaPrimary : Color.optaTextMuted.opacity(0.3))
                        .frame(width: max(2, (geo.size.width - CGFloat(barCount - 1) * 2) / CGFloat(barCount)), height: height)
                        .animation(.optaSnap, value: isFilled)
                }
            }
            .frame(maxHeight: .infinity, alignment: .center)
        }
    }

    /// Generate a pseudo-random but deterministic bar height for visual variety.
    private func barHeight(for index: Int) -> CGFloat {
        // Use a simple hash-like function for deterministic "waveform" look
        let seed = Double(index * 7 + 3)
        let normalized = abs(sin(seed * 1.7) * cos(seed * 0.3))
        let minH: CGFloat = 4
        let maxH: CGFloat = 20
        return minH + CGFloat(normalized) * (maxH - minH)
    }
}

// MARK: - Recording Indicator

public struct RecordingIndicator: View {
    let duration: TimeInterval
    let audioLevel: Float

    @State private var pulse = false

    public init(duration: TimeInterval, audioLevel: Float) {
        self.duration = duration
        self.audioLevel = audioLevel
    }

    public var body: some View {
        HStack(spacing: 8) {
            // Pulsing red dot
            Circle()
                .fill(Color.red)
                .frame(width: 10, height: 10)
                .shadow(color: .red.opacity(0.6), radius: pulse ? 6 : 2)
                .scaleEffect(pulse ? 1.2 : 1.0)
                .onAppear {
                    withAnimation(.optaGentle.repeatForever(autoreverses: true)) {
                        pulse = true
                    }
                }

            // Duration
            Text(formatRecordingTime(duration))
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
                .monospacedDigit()

            // Mini waveform (live audio level)
            HStack(spacing: 2) {
                ForEach(0..<5, id: \.self) { i in
                    let barLevel = audioLevel * Float.random(in: 0.5...1.3)
                    RoundedRectangle(cornerRadius: 1)
                        .fill(Color.red.opacity(0.7))
                        .frame(width: 3, height: CGFloat(max(3, barLevel * 16)))
                        .animation(.optaSnap, value: audioLevel)
                }
            }
            .frame(height: 16)
        }
    }

    private func formatRecordingTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
