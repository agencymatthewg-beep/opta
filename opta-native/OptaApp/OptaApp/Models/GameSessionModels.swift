//
//  GameSessionModels.swift
//  OptaApp
//
//  Models for game session tracking and benchmark comparisons.
//  TelemetrySample captures per-tick metrics, GameSession aggregates a play session,
//  and BenchmarkResult/BenchmarkSnapshot capture before/after optimization deltas.
//

import Foundation

// MARK: - TelemetrySample

/// A single telemetry measurement taken during a game session.
///
/// Recorded every 5 seconds while a tracked game is running.
/// Captures CPU, GPU, memory, thermal state, and estimated FPS.
struct TelemetrySample: Codable, Identifiable {
    /// Unique identifier
    let id: UUID

    /// When this sample was recorded
    let timestamp: Date

    /// CPU usage percentage (0-100)
    let cpuUsage: Float

    /// GPU usage percentage (0-100), nil if unavailable
    let gpuUsage: Float?

    /// Memory usage percentage (0-100)
    let memoryUsage: Float

    /// Thermal state at sample time (nominal/fair/serious/critical)
    let thermalState: String

    /// Estimated FPS (derived from GPU load), nil if unavailable
    let fps: Float?

    init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        cpuUsage: Float,
        gpuUsage: Float? = nil,
        memoryUsage: Float,
        thermalState: String,
        fps: Float? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.cpuUsage = cpuUsage
        self.gpuUsage = gpuUsage
        self.memoryUsage = memoryUsage
        self.thermalState = thermalState
        self.fps = fps
    }
}

// MARK: - GameSession

/// A complete game play session with telemetry timeline.
///
/// Created when a tracked game is detected as running,
/// populated with TelemetrySamples every 5 seconds,
/// and finalized when the game process exits.
struct GameSession: Codable, Identifiable {
    /// Unique identifier
    let id: UUID

    /// ID of the associated Game
    let gameId: UUID

    /// Name of the game (denormalized for display)
    let gameName: String

    /// When the session started
    let startTime: Date

    /// When the session ended (nil if still active)
    var endTime: Date?

    /// Telemetry samples recorded during the session
    var samples: [TelemetrySample]

    /// Whether the game was optimized before this session started
    let optimizedBefore: Bool

    init(
        id: UUID = UUID(),
        gameId: UUID,
        gameName: String,
        startTime: Date = Date(),
        endTime: Date? = nil,
        samples: [TelemetrySample] = [],
        optimizedBefore: Bool = false
    ) {
        self.id = id
        self.gameId = gameId
        self.gameName = gameName
        self.startTime = startTime
        self.endTime = endTime
        self.samples = samples
        self.optimizedBefore = optimizedBefore
    }

    // MARK: - Computed Properties

    /// Session duration in seconds
    var duration: TimeInterval {
        let end = endTime ?? Date()
        return end.timeIntervalSince(startTime)
    }

    /// Average CPU usage across all samples
    var avgCpu: Float {
        guard !samples.isEmpty else { return 0 }
        return samples.reduce(Float(0)) { $0 + $1.cpuUsage } / Float(samples.count)
    }

    /// Average GPU usage across all samples (nil if no GPU data)
    var avgGpu: Float? {
        let gpuSamples = samples.compactMap { $0.gpuUsage }
        guard !gpuSamples.isEmpty else { return nil }
        return gpuSamples.reduce(Float(0)) { $0 + $1 } / Float(gpuSamples.count)
    }

    /// Average memory usage across all samples
    var avgMemory: Float {
        guard !samples.isEmpty else { return 0 }
        return samples.reduce(Float(0)) { $0 + $1.memoryUsage } / Float(samples.count)
    }

    /// Peak CPU usage during the session
    var peakCpu: Float {
        samples.map { $0.cpuUsage }.max() ?? 0
    }

    /// Peak GPU usage during the session (nil if no GPU data)
    var peakGpu: Float? {
        samples.compactMap { $0.gpuUsage }.max()
    }

    /// Peak memory usage during the session
    var peakMemory: Float {
        samples.map { $0.memoryUsage }.max() ?? 0
    }

    /// Number of samples where thermal state was not nominal
    var thermalEvents: Int {
        samples.filter { $0.thermalState != "Nominal" }.count
    }

    /// Formatted session duration (e.g., "2h 30m")
    var formattedDuration: String {
        let totalSeconds = Int(duration)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "<1m"
        }
    }
}

// MARK: - BenchmarkSnapshot

/// A snapshot of system state at a single point in time.
///
/// Used to capture the "before" and "after" states around
/// an optimization pass for comparison.
struct BenchmarkSnapshot: Codable {
    /// CPU usage percentage at snapshot time
    let cpuUsage: Float

    /// GPU usage percentage (nil if unavailable)
    let gpuUsage: Float?

    /// Memory usage percentage
    let memoryUsage: Float

    /// Thermal state name
    let thermalState: String

    /// Number of running processes
    let processCount: Int

    /// When the snapshot was taken
    let timestamp: Date

    init(
        cpuUsage: Float,
        gpuUsage: Float? = nil,
        memoryUsage: Float,
        thermalState: String,
        processCount: Int,
        timestamp: Date = Date()
    ) {
        self.cpuUsage = cpuUsage
        self.gpuUsage = gpuUsage
        self.memoryUsage = memoryUsage
        self.thermalState = thermalState
        self.processCount = processCount
        self.timestamp = timestamp
    }
}

// MARK: - BenchmarkResult

/// The result of a before/after optimization benchmark.
///
/// Captures two BenchmarkSnapshots and computes improvement deltas.
/// Positive delta values indicate improvement (lower resource usage).
struct BenchmarkResult: Codable, Identifiable {
    /// Unique identifier
    let id: UUID

    /// ID of the associated Game
    let gameId: UUID

    /// Name of the game (denormalized for display)
    let gameName: String

    /// When the benchmark was performed
    let date: Date

    /// System state before optimization
    let beforeState: BenchmarkSnapshot

    /// System state after optimization
    let afterState: BenchmarkSnapshot

    init(
        id: UUID = UUID(),
        gameId: UUID,
        gameName: String,
        date: Date = Date(),
        beforeState: BenchmarkSnapshot,
        afterState: BenchmarkSnapshot
    ) {
        self.id = id
        self.gameId = gameId
        self.gameName = gameName
        self.date = date
        self.beforeState = beforeState
        self.afterState = afterState
    }

    // MARK: - Computed Improvements

    /// CPU improvement (positive = better, means less CPU usage after)
    var cpuImprovement: Float {
        beforeState.cpuUsage - afterState.cpuUsage
    }

    /// Memory improvement (positive = better, means less memory after)
    var memoryImprovement: Float {
        beforeState.memoryUsage - afterState.memoryUsage
    }

    /// Whether thermal state improved (moved closer to nominal)
    var thermalImproved: Bool {
        let order = ["Nominal", "Fair", "Serious", "Critical"]
        let beforeIndex = order.firstIndex(of: beforeState.thermalState) ?? 0
        let afterIndex = order.firstIndex(of: afterState.thermalState) ?? 0
        return afterIndex < beforeIndex
    }

    /// Overall improvement as a weighted average percentage
    /// Positive = system improved, negative = system degraded
    var overallImprovement: Float {
        var improvement: Float = 0
        var weights: Float = 0

        // CPU improvement (weight 0.4)
        improvement += cpuImprovement * 0.4
        weights += 0.4

        // Memory improvement (weight 0.3)
        improvement += memoryImprovement * 0.3
        weights += 0.3

        // GPU improvement (weight 0.2)
        if let beforeGpu = beforeState.gpuUsage, let afterGpu = afterState.gpuUsage {
            improvement += (beforeGpu - afterGpu) * 0.2
            weights += 0.2
        }

        // Thermal improvement (weight 0.1)
        if thermalImproved {
            improvement += 10.0 * 0.1
        }
        weights += 0.1

        return weights > 0 ? improvement / weights : 0
    }
}
