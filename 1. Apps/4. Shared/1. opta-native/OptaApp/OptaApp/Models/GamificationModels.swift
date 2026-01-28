//
//  GamificationModels.swift
//  OptaApp
//
//  Gamification types: badges, achievements, streaks, XP progression,
//  and daily challenges. Used by GamificationManager for tracking and persistence.
//

import Foundation

// MARK: - Badge Tier

/// Tier levels for badges, each with distinct visual styling and XP reward
enum BadgeTier: String, Codable, CaseIterable {
    case bronze = "Bronze"
    case silver = "Silver"
    case gold = "Gold"
    case diamond = "Diamond"

    /// Hex color for tier visual styling
    var color: String {
        switch self {
        case .bronze: return "CD7F32"
        case .silver: return "C0C0C0"
        case .gold: return "FFD700"
        case .diamond: return "B9F2FF"
        }
    }

    /// XP reward for unlocking a badge of this tier
    var xpReward: Int {
        switch self {
        case .bronze: return 10
        case .silver: return 25
        case .gold: return 50
        case .diamond: return 100
        }
    }
}

// MARK: - Badge Category

/// Categories for organizing badges
enum BadgeCategory: String, Codable, CaseIterable {
    case optimization = "Optimization"
    case streak = "Streak"
    case score = "Score"
    case exploration = "Exploration"

    /// SF Symbol icon for the category
    var icon: String {
        switch self {
        case .optimization: return "bolt.fill"
        case .streak: return "flame.fill"
        case .score: return "chart.bar.fill"
        case .exploration: return "safari.fill"
        }
    }
}

// MARK: - Badge

/// A collectible badge that can be unlocked through user actions
struct Badge: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let tier: BadgeTier
    let category: BadgeCategory
    var unlockedDate: Date?

    /// Whether the badge has been unlocked
    var isUnlocked: Bool {
        unlockedDate != nil
    }
}

// MARK: - Achievement Requirement

/// Conditions that must be met to unlock an achievement
enum AchievementRequirement: Codable, Equatable {
    case optimizeCount(Int)
    case scoreReached(Int)
    case streakDays(Int)
    case pagesVisited(Int)
    case chatMessages(Int)
}

// MARK: - Achievement

/// A trackable goal with progress toward a target
struct Achievement: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let requirement: AchievementRequirement
    var progress: Int
    let target: Int
    var unlockedDate: Date?
    let xpReward: Int

    /// Whether the achievement has been completed
    var isUnlocked: Bool {
        unlockedDate != nil
    }

    /// Progress as a fraction (0.0 to 1.0)
    var progressFraction: Double {
        guard target > 0 else { return 0 }
        return min(1.0, Double(progress) / Double(target))
    }
}

// MARK: - Streak

/// Tracks consecutive days of app usage
struct Streak: Codable {
    var currentStreak: Int = 0
    var longestStreak: Int = 0
    var lastActiveDate: Date?

    /// Whether the user has been active today
    var isActiveToday: Bool {
        guard let last = lastActiveDate else { return false }
        return Calendar.current.isDateInToday(last)
    }

    /// Record activity for today, updating streak counts
    mutating func recordActivity() {
        let now = Date()

        if let last = lastActiveDate {
            if Calendar.current.isDateInToday(last) {
                // Already recorded today
                return
            } else if Calendar.current.isDateInYesterday(last) {
                // Consecutive day
                currentStreak += 1
            } else {
                // Streak broken
                currentStreak = 1
            }
        } else {
            // First activity ever
            currentStreak = 1
        }

        lastActiveDate = now
        longestStreak = max(longestStreak, currentStreak)
    }
}

// MARK: - XP Progress

/// Experience point tracking with level progression
struct XPProgress: Codable {
    var totalXP: Int = 0

    /// Current level (1-based, 100 XP per level)
    var level: Int {
        totalXP / 100 + 1
    }

    /// XP earned within the current level
    var currentLevelXP: Int {
        totalXP % 100
    }

    /// XP needed to reach the next level
    var xpToNextLevel: Int {
        100 - currentLevelXP
    }

    /// Progress within current level as a fraction (0.0 to 1.0)
    var levelProgress: Double {
        Double(currentLevelXP) / 100.0
    }

    /// Add XP to the total
    mutating func addXP(_ amount: Int) {
        totalXP += amount
    }
}

// MARK: - Challenge Type

/// Types of daily challenges available
enum ChallengeType: String, Codable, CaseIterable {
    case optimize = "Optimize"
    case checkScore = "CheckScore"
    case useChat = "UseChat"
    case visitPages = "VisitPages"

    /// SF Symbol icon for the challenge type
    var icon: String {
        switch self {
        case .optimize: return "bolt.circle.fill"
        case .checkScore: return "chart.bar.fill"
        case .useChat: return "message.fill"
        case .visitPages: return "safari.fill"
        }
    }
}

// MARK: - Daily Challenge

/// A time-limited challenge that refreshes daily
struct DailyChallenge: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let type: ChallengeType
    let target: Int
    var progress: Int
    let xpReward: Int
    let date: Date

    /// Whether the challenge has been completed
    var isComplete: Bool {
        progress >= target
    }

    /// Progress as a fraction (0.0 to 1.0)
    var progressFraction: Double {
        guard target > 0 else { return 0 }
        return min(1.0, Double(progress) / Double(target))
    }
}

// MARK: - Gamification State

/// Persisted state for the gamification system
struct GamificationState: Codable {
    var badges: [Badge]
    var achievements: [Achievement]
    var streak: Streak
    var xp: XPProgress
    var dailyChallenges: [DailyChallenge]
    var optimizeCount: Int
    var scoreCheckCount: Int
    var chatMessageCount: Int
    var visitedPages: Set<String>
    var lastChallengeDate: Date?
}
