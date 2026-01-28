//
//  GameSessionTracker.swift
//  OptaApp
//
//  Monitors game launches via NSWorkspace and records telemetry samples
//  during active game sessions. Persists session history to JSON.
//

import Foundation
import AppKit

// MARK: - GameSessionTracker

/// Tracks game play sessions by monitoring running processes.
///
/// When a tracked game is detected as running, the tracker begins recording
/// TelemetrySamples every 5 seconds. When the game exits, the session is
/// finalized and persisted to disk.
///
/// Usage:
/// ```swift
/// GameSessionTracker.shared.startMonitoring(games: detectedGames)
/// ```
///
/// Persistence: ~/Library/Application Support/OptaApp/game-sessions.json
@Observable
class GameSessionTracker {

    // MARK: - Singleton

    static let shared = GameSessionTracker()

    // MARK: - State

    /// All recorded game sessions (most recent first)
    var sessions: [GameSession] = []

    /// Currently active session (nil if no game is being tracked)
    var activeSession: GameSession?

    /// Whether the tracker is actively monitoring for game launches
    var isTracking: Bool = false

    // MARK: - Private Properties

    /// Bundle identifiers of games to watch for
    private var trackedGameBundleIds: Set<String> = []

    /// Map of bundle ID to Game for quick lookup
    private var gamesByBundleId: [String: Game] = [:]

    /// Timer for checking running processes
    private var processCheckTimer: Timer?

    /// Timer for recording telemetry samples
    private var sampleTimer: Timer?

    /// Reference to telemetry source (set externally)
    var telemetrySource: (() -> (cpu: Float, gpu: Float?, memory: Float, thermal: String))?

    // MARK: - Constants

    private let maxSessions = 50
    private let sampleInterval: TimeInterval = 5.0
    private let processCheckInterval: TimeInterval = 10.0
    private let fileName = "game-sessions.json"

    // MARK: - Init

    private init() {
        load()
    }

    // MARK: - Public API

    /// Begin monitoring for game launches from the provided game list.
    ///
    /// Stores bundle identifiers from all games with known identifiers
    /// and starts a timer that checks NSWorkspace for running games.
    func startMonitoring(games: [Game]) {
        // Build lookup maps
        trackedGameBundleIds.removeAll()
        gamesByBundleId.removeAll()

        for game in games {
            if let bundleId = game.bundleIdentifier, !bundleId.isEmpty {
                trackedGameBundleIds.insert(bundleId)
                gamesByBundleId[bundleId] = game
            }
        }

        guard !trackedGameBundleIds.isEmpty else {
            print("[GameSessionTracker] No games with bundle IDs to monitor")
            return
        }

        isTracking = true

        // Start process checking timer on main run loop
        processCheckTimer?.invalidate()
        processCheckTimer = Timer.scheduledTimer(
            withTimeInterval: processCheckInterval,
            repeats: true
        ) { [weak self] _ in
            self?.checkForRunningGames()
        }

        print("[GameSessionTracker] Monitoring \(trackedGameBundleIds.count) games")
    }

    /// Stop monitoring for game launches and end any active session.
    func stopMonitoring() {
        processCheckTimer?.invalidate()
        processCheckTimer = nil
        isTracking = false

        if activeSession != nil {
            endSession()
        }

        print("[GameSessionTracker] Monitoring stopped")
    }

    /// Get all sessions for a specific game.
    func sessionsForGame(_ gameId: UUID) -> [GameSession] {
        sessions.filter { $0.gameId == gameId }
    }

    /// Get the most recent sessions across all games.
    func recentSessions(limit: Int = 10) -> [GameSession] {
        Array(sessions.prefix(limit))
    }

    // MARK: - Private: Process Detection

    /// Check NSWorkspace for any tracked games that are currently running.
    private func checkForRunningGames() {
        let runningApps = NSWorkspace.shared.runningApplications

        for app in runningApps {
            guard let bundleId = app.bundleIdentifier else { continue }

            if trackedGameBundleIds.contains(bundleId) {
                // Game is running
                if activeSession == nil {
                    // Start a new session
                    if let game = gamesByBundleId[bundleId] {
                        startSession(for: game)
                    }
                }
                return // Only track one game at a time
            }
        }

        // No tracked game running, end active session if any
        if activeSession != nil {
            endSession()
        }
    }

    // MARK: - Private: Session Management

    /// Start a new session for the given game.
    private func startSession(for game: Game) {
        let session = GameSession(
            gameId: game.id,
            gameName: game.name,
            optimizedBefore: game.isOptimized
        )
        activeSession = session

        // Start sample timer
        sampleTimer?.invalidate()
        sampleTimer = Timer.scheduledTimer(
            withTimeInterval: sampleInterval,
            repeats: true
        ) { [weak self] _ in
            self?.recordSample()
        }

        print("[GameSessionTracker] Session started for: \(game.name)")
    }

    /// End the active session, save it to history.
    private func endSession() {
        guard var session = activeSession else { return }

        // Finalize session
        session.endTime = Date()
        sampleTimer?.invalidate()
        sampleTimer = nil

        // Only save sessions with at least 2 samples (10+ seconds of play)
        if session.samples.count >= 2 {
            sessions.insert(session, at: 0)

            // Trim to max entries
            if sessions.count > maxSessions {
                sessions = Array(sessions.prefix(maxSessions))
            }

            save()
            print("[GameSessionTracker] Session ended for: \(session.gameName) (\(session.samples.count) samples)")
        } else {
            print("[GameSessionTracker] Session too short, discarding: \(session.gameName)")
        }

        activeSession = nil
    }

    /// Record a telemetry sample from the current system state.
    private func recordSample() {
        guard activeSession != nil else { return }

        let telemetry: (cpu: Float, gpu: Float?, memory: Float, thermal: String)

        if let source = telemetrySource {
            telemetry = source()
        } else {
            // Fallback: use basic system info
            telemetry = (cpu: 0, gpu: nil, memory: 0, thermal: "Nominal")
        }

        // Estimate FPS from GPU load (rough heuristic: lower GPU = higher FPS headroom)
        let estimatedFps: Float?
        if let gpu = telemetry.gpu {
            // Rough estimate: 60 FPS at 50% GPU, scaling down as GPU increases
            estimatedFps = max(15, min(144, 60.0 * (100.0 - gpu * 0.5) / 70.0))
        } else {
            estimatedFps = nil
        }

        let sample = TelemetrySample(
            cpuUsage: telemetry.cpu,
            gpuUsage: telemetry.gpu,
            memoryUsage: telemetry.memory,
            thermalState: telemetry.thermal,
            fps: estimatedFps
        )

        activeSession?.samples.append(sample)
    }

    // MARK: - Persistence

    /// Load session history from disk.
    func load() {
        let url = storageURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            sessions = try decoder.decode([GameSession].self, from: data)
            print("[GameSessionTracker] Loaded \(sessions.count) sessions")
        } catch {
            print("[GameSessionTracker] Failed to load sessions: \(error)")
            sessions = []
        }
    }

    /// Save session history to disk.
    func save() {
        let url = storageURL()
        let directory = url.deletingLastPathComponent()

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(sessions)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[GameSessionTracker] Failed to save sessions: \(error)")
        }
    }

    private func storageURL() -> URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("OptaApp/\(fileName)")
    }
}
