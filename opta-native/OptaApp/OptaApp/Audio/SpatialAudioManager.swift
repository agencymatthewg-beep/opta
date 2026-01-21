//
//  SpatialAudioManager.swift
//  OptaApp
//
//  Manages spatial audio for 3D sound positioning using AVAudioEngine.
//  Based on Gemini Research: Premium-Haptics-Spatial-Audio-Opta.md (Part III)
//

import AVFoundation
import simd

// MARK: - Spatial Audio Manager

/// Manages spatial audio for 3D sound positioning
///
/// Key features from Gemini research:
/// - AVAudioEnvironmentNode for 3D audio spatialization
/// - Player pooling to avoid allocation during playback
/// - Coordinate scale factor for visual-to-audio transform
/// - Inverse distance attenuation for realistic physics
@MainActor
final class SpatialAudioManager {

    // MARK: - Singleton

    static let shared = SpatialAudioManager()

    // MARK: - Properties

    private var audioEngine: AVAudioEngine?
    private var environmentNode: AVAudioEnvironmentNode?

    /// Pool of player nodes for concurrent sounds
    private var playerPool: [AVAudioPlayerNode] = []
    private let poolSize = 4

    /// Pre-loaded audio buffers
    private var buffers: [String: AVAudioPCMBuffer] = [:]

    /// Whether spatial audio is available
    private(set) var isAvailable: Bool = false

    /// Scale factor for coordinate conversion (visual units to meters)
    /// Default: 1 unit = 1cm (0.01 meters)
    var coordinateScale: Float = 0.01

    /// Master volume for all spatial audio
    var masterVolume: Float = 1.0 {
        didSet {
            audioEngine?.mainMixerNode.outputVolume = masterVolume
        }
    }

    // MARK: - Initialization

    private init() {
        setupAudioSession()
        setupAudioEngine()
        loadAudioAssets()
    }

    // MARK: - Setup

    /// Configure audio session for playback
    private func setupAudioSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            print("[SpatialAudioManager] Audio session configured for iOS")
        } catch {
            print("[SpatialAudioManager] Audio session setup failed: \(error)")
        }
        #else
        // macOS doesn't require AVAudioSession configuration
        print("[SpatialAudioManager] Audio session setup skipped for macOS")
        #endif
    }

    /// Set up AVAudioEngine with environment node for spatialization
    private func setupAudioEngine() {
        audioEngine = AVAudioEngine()
        environmentNode = AVAudioEnvironmentNode()

        guard let engine = audioEngine,
              let environment = environmentNode else { return }

        // Attach environment node
        engine.attach(environment)

        // Configure listener (user) position at origin
        environment.listenerPosition = AVAudio3DPoint(x: 0, y: 0, z: 0)
        environment.listenerAngularOrientation = AVAudio3DVectorOrientation(
            forward: AVAudio3DVector(x: 0, y: 0, z: -1),
            up: AVAudio3DVector(x: 0, y: 1, z: 0)
        )

        // Configure distance attenuation (inverse model for realistic physics)
        // Per Gemini research: Sound pressure falls off as 1/r
        environment.distanceAttenuationParameters.distanceAttenuationModel = .inverse
        environment.distanceAttenuationParameters.referenceDistance = 1.0  // Full volume at 1 meter
        environment.distanceAttenuationParameters.maximumDistance = 100.0  // Attenuation stops increasing
        environment.distanceAttenuationParameters.rolloffFactor = 1.0      // Standard attenuation

        // Set rendering algorithm (.auto uses HRTF on headphones, vector panning on speakers)
        environment.renderingAlgorithm = .auto

        // Connect environment to main mixer
        let format = environment.outputFormat(forBus: 0)
        engine.connect(environment, to: engine.mainMixerNode, format: format)

        // Create player pool for concurrent sounds
        createPlayerPool(engine: engine, environment: environment)

        // Start engine
        do {
            try engine.start()
            isAvailable = true
            print("[SpatialAudioManager] Audio engine started with \(poolSize) player nodes")
        } catch {
            print("[SpatialAudioManager] Engine start failed: \(error)")
        }
    }

    /// Create pool of player nodes to avoid allocation during playback
    private func createPlayerPool(engine: AVAudioEngine, environment: AVAudioEnvironmentNode) {
        // Mono format for proper spatialization
        // Per Gemini research: Stereo files cannot be spatialized effectively
        let monoFormat = AVAudioFormat(
            standardFormatWithSampleRate: 48000,
            channels: 1
        )

        for _ in 0..<poolSize {
            let player = AVAudioPlayerNode()
            engine.attach(player)
            engine.connect(player, to: environment, format: monoFormat)
            playerPool.append(player)
        }
    }

    /// Load audio assets into memory buffers
    private func loadAudioAssets() {
        // Load explosion sound (must be mono for spatialization)
        loadBuffer(named: "explosion", extension: "wav")
        loadBuffer(named: "optimize_complete", extension: "wav")
        loadBuffer(named: "notification", extension: "wav")
        loadBuffer(named: "warning", extension: "wav")

        print("[SpatialAudioManager] Loaded \(buffers.count) audio buffers")
    }

    /// Load an audio file into a buffer
    private func loadBuffer(named name: String, extension ext: String) {
        // Try multiple paths
        var url: URL?

        if let directURL = Bundle.main.url(forResource: name, withExtension: ext) {
            url = directURL
        } else if let audioURL = Bundle.main.url(
            forResource: name,
            withExtension: ext,
            subdirectory: "Audio"
        ) {
            url = audioURL
        } else if let resourceURL = Bundle.main.url(
            forResource: name,
            withExtension: ext,
            subdirectory: "Resources"
        ) {
            url = resourceURL
        }

        guard let audioURL = url else {
            print("[SpatialAudioManager] Audio file not found: \(name).\(ext)")
            return
        }

        do {
            let file = try AVAudioFile(forReading: audioURL)

            // Convert to mono if needed for spatialization
            let processingFormat = file.processingFormat
            guard let buffer = AVAudioPCMBuffer(
                pcmFormat: processingFormat,
                frameCapacity: AVAudioFrameCount(file.length)
            ) else {
                print("[SpatialAudioManager] Failed to create buffer for \(name)")
                return
            }

            try file.read(into: buffer)
            buffers[name] = buffer
            print("[SpatialAudioManager] Loaded audio: \(name) (\(processingFormat.channelCount) ch)")

        } catch {
            print("[SpatialAudioManager] Failed to load \(name): \(error)")
        }
    }

    // MARK: - Playback

    /// Play a sound at a 3D position
    /// - Parameters:
    ///   - name: Name of the pre-loaded sound
    ///   - position: 3D position in visual coordinate space
    ///   - volume: Volume multiplier (0.0 to 1.0)
    func playSound(named name: String, at position: SIMD3<Float>, volume: Float = 1.0) {
        guard isAvailable,
              let buffer = buffers[name],
              let player = getAvailablePlayer() else { return }

        // Convert visual coordinates to audio coordinates
        // Per Gemini research: Must transform from visual units to meters
        let audioPos = AVAudio3DPoint(
            x: position.x * coordinateScale,
            y: position.y * coordinateScale,
            z: position.z * coordinateScale
        )

        player.position = audioPos
        player.volume = volume

        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
        player.play()
    }

    /// Play a sound without spatialization (2D audio)
    /// - Parameters:
    ///   - name: Name of the pre-loaded sound
    ///   - volume: Volume multiplier (0.0 to 1.0)
    func playSound2D(named name: String, volume: Float = 1.0) {
        playSound(named: name, at: .zero, volume: volume)
    }

    /// Play explosion at position (convenience method)
    /// - Parameters:
    ///   - position: 3D position in visual coordinate space
    ///   - intensity: Intensity multiplier for volume (0.0 to 1.0)
    func playExplosion(at position: SIMD3<Float>, intensity: Float = 1.0) {
        playSound(named: "explosion", at: position, volume: intensity)
    }

    /// Get an available player from the pool
    private func getAvailablePlayer() -> AVAudioPlayerNode? {
        // Find non-playing player
        for player in playerPool where !player.isPlaying {
            return player
        }

        // If all busy, return first (will interrupt)
        return playerPool.first
    }

    // MARK: - Listener Control

    /// Update listener position (call when camera moves)
    /// - Parameter position: Camera position in visual coordinate space
    func updateListenerPosition(_ position: SIMD3<Float>) {
        environmentNode?.listenerPosition = AVAudio3DPoint(
            x: position.x * coordinateScale,
            y: position.y * coordinateScale,
            z: position.z * coordinateScale
        )
    }

    /// Update listener orientation (call when camera rotates)
    /// - Parameters:
    ///   - forward: Forward direction vector
    ///   - up: Up direction vector
    func updateListenerOrientation(forward: SIMD3<Float>, up: SIMD3<Float>) {
        environmentNode?.listenerAngularOrientation = AVAudio3DVectorOrientation(
            forward: AVAudio3DVector(x: forward.x, y: forward.y, z: forward.z),
            up: AVAudio3DVector(x: up.x, y: up.y, z: up.z)
        )
    }

    // MARK: - Engine Control

    /// Start the audio engine if not running
    func startEngine() {
        guard let engine = audioEngine, !engine.isRunning else { return }

        do {
            try engine.start()
            isAvailable = true
            print("[SpatialAudioManager] Engine restarted")
        } catch {
            print("[SpatialAudioManager] Engine restart failed: \(error)")
        }
    }

    /// Stop the audio engine
    func stopEngine() {
        audioEngine?.stop()
        isAvailable = false
        print("[SpatialAudioManager] Engine stopped")
    }

    /// Pause the audio engine
    func pauseEngine() {
        audioEngine?.pause()
        print("[SpatialAudioManager] Engine paused")
    }
}
