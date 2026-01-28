//
//  GamificationManager.swift
//  OptaApp
//
//  Manages gamification state: badge unlocking, streak tracking,
//  XP progression, daily challenges, and JSON persistence.
//

import Foundation

// MARK: - Gamification Manager

/// Singleton manager for the gamification system.
/// Tracks user progress, unlocks badges, manages streaks and daily challenges.
/// Persists state to ~/Library/Application Support/OptaApp/gamification.json
@Observable
class GamificationManager {

    // MARK: - Singleton

    static let shared = GamificationManager()

    // MARK: - State

    /// All badges (locked and unlocked)
    var badges: [Badge] = []

    /// All achievements with progress tracking
    var achievements: [Achievement] = []

    /// Current streak data
    var streak: Streak = Streak()

    /// XP and level progression
    var xp: XPProgress = XPProgress()

    /// Today's daily challenges
    var dailyChallenges: [DailyChallenge] = []

    /// Most recently unlocked badge (for overlay display)
    var recentUnlock: Badge?

    /// Whether the unlock overlay should be shown
    var showUnlockOverlay: Bool = false

    // MARK: - Tracking Counters

    private var optimizeCount: Int = 0
    private var scoreCheckCount: Int = 0
    private var chatMessageCount: Int = 0
    private var visitedPages: Set<String> = []
    private var lastChallengeDate: Date?

    // MARK: - Constants

    private let fileName = "gamification.json"

    // MARK: - Init

    private init() {
        initializeDefaults()
        load()
    }

    // MARK: - Badge Definitions

    /// All available badges in the system
    private static let badgeDefinitions: [Badge] = [
        // Optimization badges
        Badge(id: "opt-first", name: "First Optimize", description: "Run your first optimization", icon: "bolt.fill", tier: .bronze, category: .optimization),
        Badge(id: "opt-power", name: "Power User", description: "Run 5 optimizations", icon: "bolt.circle.fill", tier: .silver, category: .optimization),
        Badge(id: "opt-master", name: "Optimization Master", description: "Run 25 optimizations", icon: "bolt.shield.fill", tier: .gold, category: .optimization),
        Badge(id: "opt-unstop", name: "Unstoppable", description: "Run 100 optimizations", icon: "bolt.trianglebadge.exclamationmark.fill", tier: .diamond, category: .optimization),

        // Streak badges
        Badge(id: "str-start", name: "Getting Started", description: "Maintain a 3-day streak", icon: "flame.fill", tier: .bronze, category: .streak),
        Badge(id: "str-commit", name: "Committed", description: "Maintain a 7-day streak", icon: "flame.circle.fill", tier: .silver, category: .streak),
        Badge(id: "str-dedic", name: "Dedicated", description: "Maintain a 30-day streak", icon: "flame.fill", tier: .gold, category: .streak),
        Badge(id: "str-legend", name: "Legendary", description: "Maintain a 100-day streak", icon: "flame.fill", tier: .diamond, category: .streak),

        // Score badges
        Badge(id: "scr-rising", name: "Rising Star", description: "Reach a score of 50", icon: "star.fill", tier: .bronze, category: .score),
        Badge(id: "scr-high", name: "High Achiever", description: "Reach a score of 75", icon: "star.circle.fill", tier: .silver, category: .score),
        Badge(id: "scr-elite", name: "Elite", description: "Reach a score of 90", icon: "star.fill", tier: .gold, category: .score),
        Badge(id: "scr-perfect", name: "Perfect", description: "Reach a score of 100", icon: "star.fill", tier: .diamond, category: .score),

        // Exploration badges
        Badge(id: "exp-explore", name: "Explorer", description: "Visit all pages", icon: "safari.fill", tier: .silver, category: .exploration),
        Badge(id: "exp-chat", name: "Conversationalist", description: "Send 10 chat messages", icon: "message.fill", tier: .silver, category: .exploration),
        Badge(id: "exp-analyst", name: "Analyst", description: "Check your score 5 times", icon: "chart.bar.fill", tier: .bronze, category: .exploration),
    ]

    // MARK: - Public API

    /// Record an optimization action
    func recordOptimization() {
        optimizeCount += 1
        updateChallengeProgress(type: .optimize)
        checkOptimizationBadges()
        checkAchievements()
        save()
    }

    /// Record a score check with the current score value
    func recordScoreCheck(score: Int) {
        scoreCheckCount += 1
        updateChallengeProgress(type: .checkScore)
        checkScoreBadges(score: score)
        checkAchievements()
        save()
    }

    /// Record daily activity (call on app appear)
    func recordDailyActivity() {
        streak.recordActivity()
        refreshChallengesIfNeeded()
        checkStreakBadges()
        checkAchievements()
        save()
    }

    /// Record a page visit for exploration tracking
    func recordPageVisit(_ page: PageViewModel) {
        visitedPages.insert(page.rawValue)
        updateChallengeProgress(type: .visitPages)
        checkExplorationBadges()
        checkAchievements()
        save()
    }

    /// Record a chat message sent
    func recordChatMessage() {
        chatMessageCount += 1
        updateChallengeProgress(type: .useChat)
        checkExplorationBadges()
        checkAchievements()
        save()
    }

    // MARK: - Badge Checking

    private func checkOptimizationBadges() {
        let thresholds: [(String, Int)] = [
            ("opt-first", 1),
            ("opt-power", 5),
            ("opt-master", 25),
            ("opt-unstop", 100),
        ]

        for (badgeId, threshold) in thresholds {
            if optimizeCount >= threshold {
                unlockBadgeIfLocked(badgeId)
            }
        }
    }

    private func checkStreakBadges() {
        let thresholds: [(String, Int)] = [
            ("str-start", 3),
            ("str-commit", 7),
            ("str-dedic", 30),
            ("str-legend", 100),
        ]

        for (badgeId, threshold) in thresholds {
            if streak.currentStreak >= threshold {
                unlockBadgeIfLocked(badgeId)
            }
        }
    }

    private func checkScoreBadges(score: Int) {
        let thresholds: [(String, Int)] = [
            ("scr-rising", 50),
            ("scr-high", 75),
            ("scr-elite", 90),
            ("scr-perfect", 100),
        ]

        for (badgeId, threshold) in thresholds {
            if score >= threshold {
                unlockBadgeIfLocked(badgeId)
            }
        }
    }

    private func checkExplorationBadges() {
        // Explorer: visit all pages
        let allPages: Set<String> = Set(PageViewModel.allCases.map { $0.rawValue })
        if visitedPages.isSuperset(of: allPages) {
            unlockBadgeIfLocked("exp-explore")
        }

        // Conversationalist: 10 chat messages
        if chatMessageCount >= 10 {
            unlockBadgeIfLocked("exp-chat")
        }

        // Analyst: 5 score checks
        if scoreCheckCount >= 5 {
            unlockBadgeIfLocked("exp-analyst")
        }
    }

    private func checkAchievements() {
        for i in achievements.indices {
            guard achievements[i].unlockedDate == nil else { continue }

            switch achievements[i].requirement {
            case .optimizeCount(let target):
                achievements[i].progress = min(optimizeCount, target)
            case .scoreReached:
                // Updated externally via recordScoreCheck
                break
            case .streakDays(let target):
                achievements[i].progress = min(streak.currentStreak, target)
            case .pagesVisited(let target):
                achievements[i].progress = min(visitedPages.count, target)
            case .chatMessages(let target):
                achievements[i].progress = min(chatMessageCount, target)
            }

            if achievements[i].progress >= achievements[i].target && achievements[i].unlockedDate == nil {
                achievements[i].unlockedDate = Date()
                xp.addXP(achievements[i].xpReward)
            }
        }
    }

    // MARK: - Badge Unlock

    private func unlockBadgeIfLocked(_ badgeId: String) {
        guard let index = badges.firstIndex(where: { $0.id == badgeId && !$0.isUnlocked }) else { return }

        badges[index].unlockedDate = Date()
        xp.addXP(badges[index].tier.xpReward)

        // Trigger overlay
        recentUnlock = badges[index]
        showUnlockOverlay = true
    }

    // MARK: - Daily Challenges

    private func refreshChallengesIfNeeded() {
        let calendar = Calendar.current

        if let lastDate = lastChallengeDate, calendar.isDateInToday(lastDate) {
            // Already generated today
            return
        }

        dailyChallenges = generateDailyChallenges()
        lastChallengeDate = Date()
    }

    private func generateDailyChallenges() -> [DailyChallenge] {
        let today = Date()
        let templates: [(ChallengeType, String, String, Int, Int)] = [
            (.optimize, "Quick Optimizer", "Run 2 optimizations today", 2, 20),
            (.optimize, "Power Session", "Run 5 optimizations today", 5, 40),
            (.checkScore, "Score Check", "Check your score today", 1, 10),
            (.checkScore, "Score Watcher", "Check your score 3 times", 3, 25),
            (.useChat, "Ask Opta", "Send a message to AI Chat", 1, 10),
            (.useChat, "Deep Conversation", "Send 5 chat messages", 5, 30),
            (.visitPages, "Page Explorer", "Visit 3 different pages", 3, 15),
            (.visitPages, "Full Tour", "Visit 5 different pages", 5, 30),
        ]

        // Use day-of-year as seed for deterministic daily selection
        let dayOfYear = calendar.ordinality(of: .day, in: .year, for: today) ?? 1
        var seededIndices: [Int] = []
        var seed = dayOfYear
        while seededIndices.count < 3 {
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
            let idx = seed % templates.count
            if !seededIndices.contains(idx) {
                seededIndices.append(idx)
            }
        }

        return seededIndices.map { idx in
            let template = templates[idx]
            return DailyChallenge(
                id: "challenge-\(template.0.rawValue)-\(idx)",
                title: template.1,
                description: template.2,
                icon: template.0.icon,
                type: template.0,
                target: template.3,
                progress: 0,
                xpReward: template.4,
                date: today
            )
        }
    }

    private let calendar = Calendar.current

    private func updateChallengeProgress(type: ChallengeType) {
        for i in dailyChallenges.indices {
            guard dailyChallenges[i].type == type && !dailyChallenges[i].isComplete else { continue }
            dailyChallenges[i].progress += 1

            // Award XP on completion
            if dailyChallenges[i].isComplete {
                xp.addXP(dailyChallenges[i].xpReward)
            }
        }
    }

    // MARK: - Initialization

    private func initializeDefaults() {
        badges = Self.badgeDefinitions
        achievements = [
            Achievement(id: "ach-opt10", name: "Optimizer Pro", description: "Run 10 optimizations", icon: "bolt.fill", requirement: .optimizeCount(10), progress: 0, target: 10, xpReward: 30),
            Achievement(id: "ach-streak7", name: "Week Warrior", description: "Maintain a 7-day streak", icon: "flame.fill", requirement: .streakDays(7), progress: 0, target: 7, xpReward: 25),
            Achievement(id: "ach-pages5", name: "Navigator", description: "Visit 5 different pages", icon: "safari.fill", requirement: .pagesVisited(5), progress: 0, target: 5, xpReward: 15),
            Achievement(id: "ach-chat10", name: "Chatty", description: "Send 10 chat messages", icon: "message.fill", requirement: .chatMessages(10), progress: 0, target: 10, xpReward: 20),
            Achievement(id: "ach-opt50", name: "Optimization Veteran", description: "Run 50 optimizations", icon: "bolt.circle.fill", requirement: .optimizeCount(50), progress: 0, target: 50, xpReward: 60),
            Achievement(id: "ach-streak30", name: "Monthly Master", description: "Maintain a 30-day streak", icon: "flame.circle.fill", requirement: .streakDays(30), progress: 0, target: 30, xpReward: 75),
        ]
        dailyChallenges = generateDailyChallenges()
        lastChallengeDate = Date()
    }

    // MARK: - Persistence

    func load() {
        let url = storageURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let state = try decoder.decode(GamificationState.self, from: data)

            badges = state.badges
            achievements = state.achievements
            streak = state.streak
            xp = state.xp
            dailyChallenges = state.dailyChallenges
            optimizeCount = state.optimizeCount
            scoreCheckCount = state.scoreCheckCount
            chatMessageCount = state.chatMessageCount
            visitedPages = state.visitedPages
            lastChallengeDate = state.lastChallengeDate
        } catch {
            print("[GamificationManager] Failed to load state: \(error)")
        }
    }

    func save() {
        let url = storageURL()
        let directory = url.deletingLastPathComponent()

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let state = GamificationState(
                badges: badges,
                achievements: achievements,
                streak: streak,
                xp: xp,
                dailyChallenges: dailyChallenges,
                optimizeCount: optimizeCount,
                scoreCheckCount: scoreCheckCount,
                chatMessageCount: chatMessageCount,
                visitedPages: visitedPages,
                lastChallengeDate: lastChallengeDate
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(state)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[GamificationManager] Failed to save state: \(error)")
        }
    }

    private func storageURL() -> URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("OptaApp/gamification.json")
    }

    // MARK: - Computed Helpers

    /// Number of unlocked badges
    var unlockedBadgeCount: Int {
        badges.filter { $0.isUnlocked }.count
    }

    /// Total number of badges
    var totalBadgeCount: Int {
        badges.count
    }

    /// Recently unlocked badges (last 4)
    var recentBadges: [Badge] {
        badges
            .filter { $0.isUnlocked }
            .sorted { ($0.unlockedDate ?? .distantPast) > ($1.unlockedDate ?? .distantPast) }
            .prefix(4)
            .map { $0 }
    }

    /// Next achievements closest to unlocking
    var nextAchievements: [Achievement] {
        achievements
            .filter { !$0.isUnlocked }
            .sorted { $0.progressFraction > $1.progressFraction }
            .prefix(3)
            .map { $0 }
    }
}

// MARK: - PageViewModel CaseIterable

extension PageViewModel: CaseIterable {
    static var allCases: [PageViewModel] {
        [.dashboard, .optimize, .games, .gameDetail, .processes, .settings, .chess, .aiChat, .score, .gamification]
    }
}
