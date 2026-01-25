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
    
    // MARK: - Private Properties
    
    private let service = GameSessionService()
    private var timer: Timer?
    
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
            await service.startSession(gameName: gameName, gameId: gameId, isOptimized: isOptimized)
            self.isRecording = true
            self.startTimer()
        }
    }
    
    func stopRecording() {
        guard isRecording else { return }
        
        Task {
            if let finalizedSession = await service.stopSession() {
                self.sessions.append(finalizedSession)
                self.activeSession = finalizedSession // Show detail immediately
            }
            self.isRecording = false
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
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.updateLiveMetrics()
            }
        }
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
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
}
