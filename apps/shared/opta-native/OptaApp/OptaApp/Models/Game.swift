//
//  Game.swift
//  OptaApp
//
//  Game model for the games library.
//  Represents installed games with optimization profiles and performance history.
//

import Foundation

// MARK: - GamePlatform

/// Supported game platforms/storefronts.
enum GamePlatform: String, Codable, CaseIterable, Identifiable {
    case steam
    case epic
    case gog
    case native
    case other

    var id: String { rawValue }

    /// Display name for the platform
    var displayName: String {
        switch self {
        case .steam: return "Steam"
        case .epic: return "Epic Games"
        case .gog: return "GOG"
        case .native: return "Native"
        case .other: return "Other"
        }
    }

    /// SF Symbol icon for the platform
    var iconName: String {
        switch self {
        case .steam: return "cloud.fill"
        case .epic: return "e.circle.fill"
        case .gog: return "g.circle.fill"
        case .native: return "apple.logo"
        case .other: return "questionmark.circle.fill"
        }
    }

    /// Badge color for the platform
    var badgeColor: String {
        switch self {
        case .steam: return "1B2838"
        case .epic: return "313131"
        case .gog: return "6F2C91"
        case .native: return "8B5CF6"
        case .other: return "6B7280"
        }
    }
}

// MARK: - GameOptimizationProfile

/// Per-game optimization configuration.
///
/// Stores game-specific settings including quality level,
/// processes to terminate, and recommended settings.
struct GameOptimizationProfile: Codable, Equatable {
    /// Quality level (0: Low, 1: Medium, 2: High, 3: Ultra, 4: Adaptive)
    var qualityLevel: Int

    /// Processes to terminate when launching this game
    var processesToKill: [String]

    /// Key-value pairs of recommended in-game settings
    var recommendedSettings: [String: String]

    /// When this profile was last applied
    var lastOptimizedAt: Date?

    /// Human-readable quality level name
    var qualityLevelName: String {
        switch qualityLevel {
        case 0: return "Low"
        case 1: return "Medium"
        case 2: return "High"
        case 3: return "Ultra"
        case 4: return "Adaptive"
        default: return "Custom"
        }
    }

    /// Create a default optimization profile
    init(
        qualityLevel: Int = 2,
        processesToKill: [String] = [],
        recommendedSettings: [String: String] = [:],
        lastOptimizedAt: Date? = nil
    ) {
        self.qualityLevel = qualityLevel
        self.processesToKill = processesToKill
        self.recommendedSettings = recommendedSettings
        self.lastOptimizedAt = lastOptimizedAt
    }
}

// MARK: - PerformanceSnapshot

/// A snapshot of game performance during a play session.
///
/// Captures average metrics from a single gaming session
/// for tracking performance history over time.
struct PerformanceSnapshot: Codable, Identifiable, Equatable {
    /// Unique identifier for this snapshot
    let id: UUID

    /// When this snapshot was recorded
    let timestamp: Date

    /// Average frames per second during the session
    let avgFps: Float

    /// Average CPU usage percentage (0-100)
    let avgCpuUsage: Float

    /// Average GPU usage percentage (0-100)
    let avgGpuUsage: Float

    /// Duration of the gaming session in seconds
    let sessionDuration: TimeInterval

    /// Create a new performance snapshot
    init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        avgFps: Float,
        avgCpuUsage: Float,
        avgGpuUsage: Float,
        sessionDuration: TimeInterval
    ) {
        self.id = id
        self.timestamp = timestamp
        self.avgFps = avgFps
        self.avgCpuUsage = avgCpuUsage
        self.avgGpuUsage = avgGpuUsage
        self.sessionDuration = sessionDuration
    }

    /// Formatted session duration (e.g., "2h 30m")
    var formattedDuration: String {
        let hours = Int(sessionDuration) / 3600
        let minutes = (Int(sessionDuration) % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

// MARK: - Game

/// Represents an installed game with its optimization profile and performance history.
///
/// Games are detected from various platforms (Steam, Epic, GOG, native macOS)
/// and can have per-game optimization settings and tracked performance.
struct Game: Codable, Identifiable, Hashable, Equatable {
    /// Unique identifier
    let id: UUID

    /// Game name (extracted from app bundle or directory)
    var name: String

    /// Bundle identifier for native macOS apps
    var bundleIdentifier: String?

    /// Full path to the game executable or .app bundle
    var executablePath: String

    /// PNG data for the game/app icon
    var iconData: Data?

    /// Platform/storefront where the game is installed
    var platform: GamePlatform

    /// Last time the game was played
    var lastPlayed: Date?

    /// Total playtime in seconds
    var totalPlaytime: TimeInterval

    /// Game-specific optimization profile
    var optimizationProfile: GameOptimizationProfile?

    /// Performance history (last N sessions)
    var performanceHistory: [PerformanceSnapshot]

    // MARK: - Initialization

    /// Create a new game entry
    init(
        id: UUID = UUID(),
        name: String,
        bundleIdentifier: String? = nil,
        executablePath: String,
        iconData: Data? = nil,
        platform: GamePlatform,
        lastPlayed: Date? = nil,
        totalPlaytime: TimeInterval = 0,
        optimizationProfile: GameOptimizationProfile? = nil,
        performanceHistory: [PerformanceSnapshot] = []
    ) {
        self.id = id
        self.name = name
        self.bundleIdentifier = bundleIdentifier
        self.executablePath = executablePath
        self.iconData = iconData
        self.platform = platform
        self.lastPlayed = lastPlayed
        self.totalPlaytime = totalPlaytime
        self.optimizationProfile = optimizationProfile
        self.performanceHistory = performanceHistory
    }

    // MARK: - Computed Properties

    /// Formatted total playtime (e.g., "12h 30m")
    var formattedPlaytime: String {
        let hours = Int(totalPlaytime) / 3600
        let minutes = (Int(totalPlaytime) % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "Not played"
        }
    }

    /// Relative time since last played (e.g., "2 days ago")
    var lastPlayedRelative: String {
        guard let lastPlayed = lastPlayed else {
            return "Never"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: lastPlayed, relativeTo: Date())
    }

    /// Whether the game has been optimized (has a profile with lastOptimizedAt)
    var isOptimized: Bool {
        optimizationProfile?.lastOptimizedAt != nil
    }

    /// Average FPS from last 5 sessions
    var averageFps: Float? {
        let recentHistory = performanceHistory.suffix(5)
        guard !recentHistory.isEmpty else { return nil }
        let total = recentHistory.reduce(Float(0)) { $0 + $1.avgFps }
        return total / Float(recentHistory.count)
    }

    /// Average CPU usage from last 5 sessions
    var averageCpuUsage: Float? {
        let recentHistory = performanceHistory.suffix(5)
        guard !recentHistory.isEmpty else { return nil }
        let total = recentHistory.reduce(Float(0)) { $0 + $1.avgCpuUsage }
        return total / Float(recentHistory.count)
    }

    /// Average GPU usage from last 5 sessions
    var averageGpuUsage: Float? {
        let recentHistory = performanceHistory.suffix(5)
        guard !recentHistory.isEmpty else { return nil }
        let total = recentHistory.reduce(Float(0)) { $0 + $1.avgGpuUsage }
        return total / Float(recentHistory.count)
    }

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Game, rhs: Game) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Game Sort Options

/// Sort options for the games library
enum GameSortOption: String, CaseIterable, Identifiable {
    case name = "Name"
    case lastPlayed = "Last Played"
    case playtime = "Playtime"
    case platform = "Platform"

    var id: String { rawValue }

    /// SF Symbol for the sort option
    var iconName: String {
        switch self {
        case .name: return "textformat"
        case .lastPlayed: return "clock"
        case .playtime: return "timer"
        case .platform: return "square.stack.3d.up"
        }
    }
}
