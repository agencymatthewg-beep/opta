//
//  ScoreModels.swift
//  OptaApp
//
//  Score breakdown types, category scoring, history persistence,
//  and the ScoreHistoryManager for tracking score snapshots over time.
//

import Foundation

// MARK: - Score Category

/// Categories for score breakdown analysis
enum ScoreCategory: String, Codable, CaseIterable, Identifiable {
    case performance = "Performance"
    case stability = "Stability"
    case gaming = "Gaming"

    var id: String { rawValue }

    /// Human-readable display name
    var displayName: String {
        rawValue
    }

    /// SF Symbol icon name
    var icon: String {
        switch self {
        case .performance: return "cpu"
        case .stability: return "shield.checkered"
        case .gaming: return "gamecontroller.fill"
        }
    }

    /// Brief description of what this category measures
    var description: String {
        switch self {
        case .performance:
            return "CPU and GPU efficiency, process optimization"
        case .stability:
            return "Thermal management, memory pressure control"
        case .gaming:
            return "Game optimization readiness, latency potential"
        }
    }
}

// MARK: - Score Impact

/// Impact indicator for individual score factors
enum ScoreImpact: String, Codable {
    case positive
    case neutral
    case negative
}

// MARK: - Score Detail

/// An individual factor contributing to a category score
struct ScoreDetail: Identifiable, Codable {
    var id: UUID = UUID()
    let name: String
    let value: Int
    let impact: ScoreImpact
}

// MARK: - Category Score

/// A category's computed score with breakdown details
struct CategoryScore: Identifiable {
    var id: String { category.rawValue }
    let category: ScoreCategory
    let score: Int
    let grade: String
    let details: [ScoreDetail]
}

// MARK: - Score Snapshot

/// A point-in-time score recording for history tracking
struct ScoreSnapshot: Codable, Identifiable {
    var id: UUID = UUID()
    let date: Date
    let totalScore: Int
    let categoryScores: [String: Int]
    let afterOptimization: Bool
}

// MARK: - Score Breakdown

/// Complete score analysis computed from current system telemetry
struct ScoreBreakdown {
    let totalScore: Int
    let totalGrade: String
    let categories: [CategoryScore]

    /// Calculate score breakdown from current ViewModel telemetry data
    static func calculate(from viewModel: OptaViewModel) -> ScoreBreakdown {
        let performanceScore = calculatePerformance(from: viewModel)
        let stabilityScore = calculateStability(from: viewModel)
        let gamingScore = calculateGaming(from: viewModel)

        let categories = [performanceScore, stabilityScore, gamingScore]
        let total = categories.reduce(0) { $0 + $1.score } / max(categories.count, 1)
        let grade = gradeFor(score: total)

        return ScoreBreakdown(
            totalScore: total,
            totalGrade: grade,
            categories: categories
        )
    }

    // MARK: - Category Calculations

    private static func calculatePerformance(from vm: OptaViewModel) -> CategoryScore {
        // CPU idle efficiency: lower usage = higher score
        let cpuScore = max(0, min(100, 100 - Int(vm.cpuUsage)))
        let cpuDetail = ScoreDetail(
            name: "CPU Idle Efficiency",
            value: cpuScore,
            impact: cpuScore >= 70 ? .positive : (cpuScore >= 40 ? .neutral : .negative)
        )

        // GPU efficiency: moderate usage is fine, very high is bad
        let gpuUsage = vm.gpuUsage ?? 0
        let gpuScore = max(0, min(100, 100 - Int(gpuUsage * 0.8)))
        let gpuDetail = ScoreDetail(
            name: "GPU Efficiency",
            value: gpuScore,
            impact: gpuScore >= 60 ? .positive : (gpuScore >= 30 ? .neutral : .negative)
        )

        // Memory efficiency: lower usage = higher score
        let memScore = max(0, min(100, 100 - Int(vm.memoryUsage * 0.9)))
        let memDetail = ScoreDetail(
            name: "Memory Efficiency",
            value: memScore,
            impact: memScore >= 60 ? .positive : (memScore >= 30 ? .neutral : .negative)
        )

        let avg = (cpuScore + gpuScore + memScore) / 3
        return CategoryScore(
            category: .performance,
            score: avg,
            grade: gradeFor(score: avg),
            details: [cpuDetail, gpuDetail, memDetail]
        )
    }

    private static func calculateStability(from vm: OptaViewModel) -> CategoryScore {
        // Thermal state scoring
        let thermalScore: Int
        switch vm.thermalState {
        case .nominal: thermalScore = 100
        case .fair: thermalScore = 75
        case .serious: thermalScore = 40
        case .critical: thermalScore = 10
        }
        let thermalDetail = ScoreDetail(
            name: "Thermal Management",
            value: thermalScore,
            impact: thermalScore >= 70 ? .positive : (thermalScore >= 40 ? .neutral : .negative)
        )

        // Memory pressure scoring
        let pressureScore: Int
        switch vm.memoryPressure {
        case .normal: pressureScore = 100
        case .warning: pressureScore = 50
        case .critical: pressureScore = 15
        }
        let pressureDetail = ScoreDetail(
            name: "Memory Pressure",
            value: pressureScore,
            impact: pressureScore >= 70 ? .positive : (pressureScore >= 40 ? .neutral : .negative)
        )

        // System uptime stability (derived from thermal + pressure combined)
        let uptimeScore = min(thermalScore, pressureScore)
        let uptimeDetail = ScoreDetail(
            name: "System Stability",
            value: uptimeScore,
            impact: uptimeScore >= 70 ? .positive : (uptimeScore >= 40 ? .neutral : .negative)
        )

        let avg = (thermalScore + pressureScore + uptimeScore) / 3
        return CategoryScore(
            category: .stability,
            score: avg,
            grade: gradeFor(score: avg),
            details: [thermalDetail, pressureDetail, uptimeDetail]
        )
    }

    private static func calculateGaming(from vm: OptaViewModel) -> CategoryScore {
        // GPU availability (having GPU data is positive)
        let gpuAvailable = vm.gpuUsage != nil
        let gpuReadyScore = gpuAvailable ? 80 : 40
        let gpuDetail = ScoreDetail(
            name: "GPU Availability",
            value: gpuReadyScore,
            impact: gpuAvailable ? .positive : .negative
        )

        // Memory headroom: more free memory = better for games
        let memHeadroom = max(0, min(100, Int(100 - vm.memoryUsage)))
        let memDetail = ScoreDetail(
            name: "Memory Headroom",
            value: memHeadroom,
            impact: memHeadroom >= 50 ? .positive : (memHeadroom >= 25 ? .neutral : .negative)
        )

        // Thermal headroom for sustained performance
        let thermalHeadroom: Int
        switch vm.thermalState {
        case .nominal: thermalHeadroom = 95
        case .fair: thermalHeadroom = 70
        case .serious: thermalHeadroom = 30
        case .critical: thermalHeadroom = 5
        }
        let thermalDetail = ScoreDetail(
            name: "Thermal Headroom",
            value: thermalHeadroom,
            impact: thermalHeadroom >= 60 ? .positive : (thermalHeadroom >= 30 ? .neutral : .negative)
        )

        let avg = (gpuReadyScore + memHeadroom + thermalHeadroom) / 3
        return CategoryScore(
            category: .gaming,
            score: avg,
            grade: gradeFor(score: avg),
            details: [gpuDetail, memDetail, thermalDetail]
        )
    }

    // MARK: - Grade Mapping

    static func gradeFor(score: Int) -> String {
        switch score {
        case 95...100: return "S"
        case 80..<95: return "A"
        case 65..<80: return "B"
        case 50..<65: return "C"
        case 30..<50: return "D"
        default: return "F"
        }
    }
}

// MARK: - Score History Manager

/// Manages persistence of score snapshots over time.
/// Stores history as JSON at ~/Library/Application Support/OptaApp/score-history.json
@Observable
class ScoreHistoryManager {

    // MARK: - Singleton

    static let shared = ScoreHistoryManager()

    // MARK: - State

    /// All recorded score snapshots (most recent first)
    var history: [ScoreSnapshot] = []

    /// Current computed breakdown (set on ScoreDetailView appear)
    var currentBreakdown: ScoreBreakdown?

    /// Score improvement from last optimization run
    var lastOptimizationDelta: Int? {
        guard history.count >= 2 else { return nil }
        // Find most recent afterOptimization=true and the entry before it
        if let optimizedIndex = history.firstIndex(where: { $0.afterOptimization }),
           optimizedIndex + 1 < history.count {
            let after = history[optimizedIndex].totalScore
            let before = history[optimizedIndex + 1].totalScore
            let delta = after - before
            return delta != 0 ? delta : nil
        }
        return nil
    }

    // MARK: - Constants

    private let maxEntries = 90
    private let fileName = "score-history.json"

    // MARK: - Init

    private init() {
        loadHistory()
    }

    // MARK: - Public API

    /// Record a new score snapshot
    func recordScore(total: Int, categories: [ScoreCategory: Int], afterOptimization: Bool) {
        let categoryDict = Dictionary(uniqueKeysWithValues: categories.map { ($0.key.rawValue, $0.value) })
        let snapshot = ScoreSnapshot(
            date: Date(),
            totalScore: total,
            categoryScores: categoryDict,
            afterOptimization: afterOptimization
        )
        history.insert(snapshot, at: 0)

        // Trim to max entries
        if history.count > maxEntries {
            history = Array(history.prefix(maxEntries))
        }

        saveHistory()
    }

    // MARK: - Persistence

    func loadHistory() {
        let url = storageURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            history = try decoder.decode([ScoreSnapshot].self, from: data)
        } catch {
            print("[ScoreHistoryManager] Failed to load history: \(error)")
            history = []
        }
    }

    func saveHistory() {
        let url = storageURL()
        let directory = url.deletingLastPathComponent()

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(history)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[ScoreHistoryManager] Failed to save history: \(error)")
        }
    }

    private func storageURL() -> URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("OptaApp/score-history.json")
    }
}
