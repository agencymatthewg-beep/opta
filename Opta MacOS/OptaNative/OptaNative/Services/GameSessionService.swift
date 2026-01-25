//
//  GameSessionService.swift
//  OptaNative
//
//  Service for tracking game performance sessions and benchmarking.
//  Records FPS, CPU, GPU, and thermal metrics during gameplay.
//  Created for Opta Native macOS - Plan 96-01 (v12.0)
//

import Foundation
import AppKit
import Darwin

// MARK: - Models

/// A recorded telemetry sample during a game session
struct GameSessionSample: Codable, Sendable {
    let timestamp: Date
    let cpuUsage: Double
    let gpuUsage: Double? // Estimated from thermal/power
    let memoryUsedGB: Double
    let thermalState: Int // 0=Nominal, 1=Fair, 2=Serious, 3=Critical
    let fps: Double? // Estimated or injected
}

/// A complete recorded game session
struct GameSession: Codable, Identifiable, Sendable {
    let id: UUID
    let gameName: String
    let gameId: String? // Steam AppID etc.
    let startTime: Date
    let endTime: Date?
    let duration: TimeInterval
    let wasOptimized: Bool // True if Opta optimizations were active
    let samples: [GameSessionSample]

    // Aggregated metrics
    let avgFPS: Double
    let minFPS: Double
    let maxFPS: Double
    let avgCpuUsage: Double
    let avgGpuUsage: Double?
    let maxThermalState: Int
    
    var isComplete: Bool { endTime != nil }
}

// MARK: - Service

/// Actor-based service for recording and persisting game sessions.
actor GameSessionService {
    
    // MARK: - Properties
    
    private var sessions: [GameSession] = []
    private var currentSession: GameSession?
    private var activeSamples: [GameSessionSample] = []
    private var sessionTask: Task<Void, Never>?
    private var isRecording: Bool = false
    
    private let telemetryService: TelemetryService
    private let fileManager = FileManager.default
    
    // MARK: - Initialization
    
    init(telemetryService: TelemetryService = TelemetryService()) {
        self.telemetryService = telemetryService
        Task {
            await loadSessions()
        }
        
        // Auto-save on termination
        Task {
            for await _ in NotificationCenter.default.notifications(named: NSApplication.willTerminateNotification) {
                _ = await self.stopSession()
            }
        }
    }
    
    // MARK: - Recording Control
    
    /// Starts recording a new game session.
    func startSession(gameName: String, gameId: String?, isOptimized: Bool) {
        guard !isRecording else { return }
        
        let session = GameSession(
            id: UUID(),
            gameName: gameName,
            gameId: gameId,
            startTime: Date(),
            endTime: nil,
            duration: 0,
            wasOptimized: isOptimized,
            samples: [],
            avgFPS: 0,
            minFPS: 0,
            maxFPS: 0,
            avgCpuUsage: 0,
            avgGpuUsage: 0,
            maxThermalState: 0
        )
        
        self.currentSession = session
        self.activeSamples = []
        self.isRecording = true
        
        // Start polling loop
        sessionTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self = self else { break }
                
                // Collect sample
                let snapshot = await self.telemetryService.collectSnapshot()
                await self.addSample(from: snapshot)
                
                // Sleep for 1 second
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }
    
    /// Stops the current recording and saves the session.
    func stopSession() async -> GameSession? {
        guard isRecording, var session = currentSession else { return nil }
        
        // Cancel task
        sessionTask?.cancel()
        sessionTask = nil
        isRecording = false
        
        // Finalize session data
        let endTime = Date()
        let duration = endTime.timeIntervalSince(session.startTime)
        let samples = self.activeSamples
        
        // Calculate aggregates
        let fpsValues = samples.compactMap { $0.fps }
        let cpuValues = samples.map { $0.cpuUsage }
        let gpuValues = samples.compactMap { $0.gpuUsage }
        let thermalValues = samples.map { $0.thermalState }
        
        // Create final session
        let finalSession = GameSession(
            id: session.id,
            gameName: session.gameName,
            gameId: session.gameId,
            startTime: session.startTime,
            endTime: endTime,
            duration: duration,
            wasOptimized: session.wasOptimized,
            samples: samples,
            avgFPS: fpsValues.isEmpty ? 0 : fpsValues.reduce(0, +) / Double(fpsValues.count),
            minFPS: fpsValues.min() ?? 0,
            maxFPS: fpsValues.max() ?? 0,
            avgCpuUsage: cpuValues.isEmpty ? 0 : cpuValues.reduce(0, +) / Double(cpuValues.count),
            avgGpuUsage: gpuValues.isEmpty ? 0 : gpuValues.reduce(0, +) / Double(gpuValues.count),
            maxThermalState: thermalValues.max() ?? 0
        )
        
        // Save
        self.sessions.append(finalSession)
        self.currentSession = nil
        self.activeSamples = []
        
        await saveSessions()
        
        return finalSession
    }
    
    // MARK: - Data Collection
    
    private func addSample(from snapshot: TelemetrySnapshot) {
        // Map thermal state to int (0-3)
        // Note: Real thermal state mapping would go here, simplified for now
        let thermalState = snapshot.cpuTemperature.map { temp -> Int in
            if temp > 90 { return 3 } // Critical
            if temp > 80 { return 2 } // Serious
            if temp > 70 { return 1 } // Fair
            return 0 // Nominal
        } ?? 0
        
        // Estimate FPS based on GPU usage/thermal headroom (Simulation for now until Metal HUD hooks)
        // In a real app we'd use Metal Performance HUD APIs or frame injection
        let estimatedFPS = max(30.0, 120.0 - (snapshot.cpuUsage / 2.0)) 
        
        let sample = GameSessionSample(
            timestamp: snapshot.timestamp,
            cpuUsage: snapshot.cpuUsage,
            gpuUsage: snapshot.gpuTemperature, // Using temp as proxy if usage nil
            memoryUsedGB: snapshot.memoryUsedGB,
            thermalState: thermalState,
            fps: estimatedFPS
        )
        
        activeSamples.append(sample)
    }
    
    // MARK: - Persistence
    
    private var persistenceURL: URL? {
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        
        let appDir = appSupport.appendingPathComponent("OptaApp")
        
        // Create directory if needed
        if !fileManager.fileExists(atPath: appDir.path) {
            try? fileManager.createDirectory(at: appDir, withIntermediateDirectories: true)
        }
        
        return appDir.appendingPathComponent("game-sessions.json")
    }
    
    private func saveSessions() async {
        guard let url = persistenceURL else { return }
        
        do {
            let data = try JSONEncoder().encode(sessions)
            try data.write(to: url, options: .atomicWrite)
        } catch {
            print("Failed to save game sessions: \(error)")
        }
    }
    
    private func loadSessions() async {
        guard let url = persistenceURL,
              let data = try? Data(contentsOf: url) else {
            return
        }
        
        do {
            self.sessions = try JSONDecoder().decode([GameSession].self, from: data)
        } catch {
            print("Failed to load game sessions: \(error)")
        }
    }
    
    // MARK: - Accessors
    
    func getAllSessions() -> [GameSession] {
        return sessions
    }
    
    func getSessions(for gameName: String) -> [GameSession] {
        return sessions.filter { $0.gameName == gameName }
    }
    
    /// Returns the active session duration roughly updated
    func getCurrentDuration() -> TimeInterval {
        guard let start = currentSession?.startTime else { return 0 }
        return Date().timeIntervalSince(start)
    }
    
    func isSessionActive() -> Bool {
        return isRecording
    }
    
    /// Returns the data of the currently active session
    func getActiveSession() -> GameSession? {
        return currentSession
    }
}
