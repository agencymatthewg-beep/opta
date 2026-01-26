//
//  GameSessionViewModel.swift
//  OptaNative
//
//  View model for the Game Session Tracking feature.
//  Manages recording state, live metrics, and session history.
//  Created for Opta Native macOS - Plan 96-01 (v12.0)
//

import SwiftUI

@Observable
@MainActor
class GameSessionViewModel {

    // MARK: - Published Properties

    /// Whether a game session is currently being recorded
    var isRecording: Bool = false

    /// Duration string (e.g., "00:42")
    var currentDuration: String = "00:00"

    /// Current live FPS (estimated)
    var currentFPS: Double = 0

    /// Current CPU usage
    var currentCPU: Double = 0

    /// List of past game sessions
    var sessions: [GameSession] = []

    /// The most recent session for detail view
    var activeSession: GameSession?

    /// Game name for current session (used for pattern tracking)
    private var currentGameName: String?

    // MARK: - Private Properties

    private let service = GameSessionService()
    private let patternService = PatternLearningService()
    /// Task for periodic metrics updates
    private var timerTask: Task<Void, Never>?

    // MARK: - Initialization

    init() {
        Task {
            await loadSessions()
        }
    }

    // MARK: - Actions

    func startRecording(gameName: String, gameId: String? = nil, isOptimized: Bool = false) {
        guard !isRecording else { return }

        Task {
            // Track game launch for pattern learning
            await patternService.trackEvent(.gameLaunch, context: gameName)

            // Track optimization state if enabled
            if isOptimized {
                await patternService.trackEvent(.optimizeOn, context: gameName)
            }

            await service.startSession(gameName: gameName, gameId: gameId, isOptimized: isOptimized)
            self.isRecording = true
            self.currentGameName = gameName
            self.startTimer()
        }
    }
    
    func stopRecording() {
        guard isRecording else { return }

        Task {
            // Track optimization off for pattern learning
            if let gameName = currentGameName {
                await patternService.trackEvent(.optimizeOff, context: gameName)
            }

            if let finalizedSession = await service.stopSession() {
                self.sessions.append(finalizedSession)
                self.activeSession = finalizedSession // Show detail immediately
            }
            self.isRecording = false
            self.currentGameName = nil
            self.stopTimer()
            self.currentDuration = "00:00"
            self.currentFPS = 0
            self.currentCPU = 0

            await loadSessions() // Refresh list to be sure
        }
    }
    
    func loadSessions() async {
        let all = await service.getAllSessions()
        // Sort by date descending
        self.sessions = all.sorted { $0.startTime > $1.startTime }
    }
    
    // MARK: - Timer Logic

    private func startTimer() {
        stopTimer()
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.updateLiveMetrics()
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }
    
    private func updateLiveMetrics() async {
        // duration
        let duration = await service.getCurrentDuration()
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        self.currentDuration = String(format: "%02d:%02d", minutes, seconds)

        // live stats
        if let session = await service.getActiveSession(), let lastSample = session.samples.last {
            // Update activeSession to reflected live graph if we want
            self.activeSession = session
            self.currentFPS = lastSample.fps ?? 0
            self.currentCPU = lastSample.cpuUsage
        }
    }

    // MARK: - Pattern Learning Integration

    /// Check if optimization should be suggested for a given game based on user patterns
    func shouldSuggestOptimization(for gameName: String) async -> Bool {
        guard !gameName.isEmpty else { return false }
        return await patternService.shouldSuggestOptimization(for: gameName)
    }

    /// Get optimization probability for a game (0.0 to 1.0)
    func getOptimizationProbability(for gameName: String) async -> Double {
        guard !gameName.isEmpty else { return 0 }
        let patterns = await patternService.getTopOptimizedContexts(limit: 100)
        return patterns.first { $0.context.lowercased() == gameName.lowercased() }?.optimizationProbability ?? 0
    }
}
