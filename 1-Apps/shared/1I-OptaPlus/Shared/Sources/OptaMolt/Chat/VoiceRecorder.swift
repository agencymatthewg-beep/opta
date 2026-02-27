//
//  VoiceRecorder.swift
//  OptaMolt
//
//  Audio recording using AVFoundation. Records M4A (AAC) for compact file size.
//  Handles microphone permission, audio level metering, and max duration.
//

import Foundation
import AVFoundation
import SwiftUI

// MARK: - Voice Recorder

@MainActor
public final class VoiceRecorder: NSObject, ObservableObject {
    @Published public var isRecording = false
    @Published public var recordingDuration: TimeInterval = 0
    @Published public var audioLevel: Float = 0
    @Published public var permissionDenied = false

    public static let maxDuration: TimeInterval = 300 // 5 minutes

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var tempURL: URL?

    override public init() {
        super.init()
    }

    // MARK: - Permission

    public func requestPermission() async -> Bool {
        #if canImport(UIKit)
        let status = AVAudioApplication.shared.recordPermission
        switch status {
        case .granted:
            return true
        case .undetermined:
            return await AVAudioApplication.requestRecordPermission()
        default:
            await MainActor.run { permissionDenied = true }
            return false
        }
        #else
        // macOS: request via AVCaptureDevice
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return true
        case .notDetermined:
            return await AVCaptureDevice.requestAccess(for: .audio)
        default:
            permissionDenied = true
            return false
        }
        #endif
    }

    // MARK: - Start Recording

    public func start() {
        Task {
            guard await requestPermission() else { return }
            await beginRecording()
        }
    }

    private func beginRecording() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-\(UUID().uuidString.prefix(8)).m4a")
        tempURL = url

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVEncoderBitRateKey: 128_000
        ]

        #if canImport(UIKit)
        configureAudioSession()
        #endif

        do {
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.isMeteringEnabled = true
            recorder?.delegate = self
            recorder?.record()

            isRecording = true
            recordingDuration = 0
            audioLevel = 0

            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.updateMetering()
                }
            }
        } catch {
            cleanup()
        }
    }

    // MARK: - Stop Recording

    /// Stops recording and returns the audio data, or nil if cancelled/failed.
    public func stop() -> Data? {
        timer?.invalidate()
        timer = nil

        guard let recorder, isRecording else {
            cleanup()
            return nil
        }

        recorder.stop()
        isRecording = false

        #if canImport(UIKit)
        deactivateAudioSession()
        #endif

        guard let url = tempURL, let data = try? Data(contentsOf: url) else {
            cleanup()
            return nil
        }

        cleanup()
        return data
    }

    /// Cancel recording without returning data.
    public func cancel() {
        timer?.invalidate()
        timer = nil
        recorder?.stop()
        isRecording = false
        recordingDuration = 0
        audioLevel = 0

        #if canImport(UIKit)
        deactivateAudioSession()
        #endif

        cleanup()
    }

    // MARK: - Private

    private func updateMetering() {
        guard let recorder, isRecording else { return }
        recorder.updateMeters()
        let power = recorder.averagePower(forChannel: 0)
        // Normalize from dB (-160..0) to 0..1
        let normalized = max(0, min(1, (power + 50) / 50))
        audioLevel = normalized
        recordingDuration = recorder.currentTime

        if recordingDuration >= Self.maxDuration {
            _ = stop()
        }
    }

    private func cleanup() {
        if let url = tempURL {
            try? FileManager.default.removeItem(at: url)
        }
        tempURL = nil
        recorder = nil
    }

    #if canImport(UIKit)
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try? session.setActive(true)
    }

    private func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    #endif
}

// MARK: - AVAudioRecorderDelegate

extension VoiceRecorder: AVAudioRecorderDelegate {
    nonisolated public func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in
            if !flag {
                isRecording = false
            }
        }
    }
}
