//
//  MessageStats.swift
//  OptaMolt
//
//  Per-bot message statistics stored in UserDefaults.
//

import Foundation

// MARK: - Bot Message Stats

public struct BotMessageStats: Codable {
    public var totalSent: Int = 0
    public var totalReceived: Int = 0
    public var responseTimes: [Double] = [] // seconds, last 50
    public var messageDates: [Date] = [] // last 200 timestamps for activity analysis
    public var longestStreak: Int = 0 // consecutive days
    public var currentStreakStart: Date?

    public var averageResponseTime: Double? {
        guard !responseTimes.isEmpty else { return nil }
        return responseTimes.reduce(0, +) / Double(responseTimes.count)
    }

    public var formattedAvgResponseTime: String {
        guard let avg = averageResponseTime else { return "—" }
        if avg < 1 { return String(format: "%.0fms", avg * 1000) }
        return String(format: "%.1fs", avg)
    }

    public var mostActiveHour: Int? {
        guard !messageDates.isEmpty else { return nil }
        let cal = Calendar.current
        var hourCounts = [Int: Int]()
        for date in messageDates {
            let hour = cal.component(.hour, from: date)
            hourCounts[hour, default: 0] += 1
        }
        return hourCounts.max(by: { $0.value < $1.value })?.key
    }

    public var formattedMostActiveTime: String {
        guard let hour = mostActiveHour else { return "—" }
        let h = hour % 12 == 0 ? 12 : hour % 12
        let period = hour < 12 ? "AM" : "PM"
        return "\(h) \(period)"
    }

    public mutating func recordSent(at date: Date = Date()) {
        totalSent += 1
        addDate(date)
    }

    public mutating func recordReceived(at date: Date = Date()) {
        totalReceived += 1
        addDate(date)
    }

    public mutating func recordResponseTime(_ seconds: Double) {
        responseTimes.append(seconds)
        if responseTimes.count > 50 {
            responseTimes.removeFirst(responseTimes.count - 50)
        }
    }

    private mutating func addDate(_ date: Date) {
        messageDates.append(date)
        if messageDates.count > 200 {
            messageDates.removeFirst(messageDates.count - 200)
        }
        updateStreak(date)
    }

    private mutating func updateStreak(_ date: Date) {
        let cal = Calendar.current
        if let start = currentStreakStart {
            let daysBetween = cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: date)).day ?? 0
            if daysBetween <= 1 {
                let streakLength = (cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: date)).day ?? 0) + 1
                longestStreak = max(longestStreak, streakLength)
            } else {
                currentStreakStart = date
            }
        } else {
            currentStreakStart = date
            longestStreak = max(longestStreak, 1)
        }
    }
}

// MARK: - Stats Manager

public struct MessageStatsManager {
    private static let keyPrefix = "optaplus.stats."

    public static func load(botId: String) -> BotMessageStats {
        guard let data = UserDefaults.standard.data(forKey: keyPrefix + botId),
              let stats = try? JSONDecoder().decode(BotMessageStats.self, from: data) else {
            return BotMessageStats()
        }
        return stats
    }

    public static func save(_ stats: BotMessageStats, botId: String) {
        if let data = try? JSONEncoder().encode(stats) {
            UserDefaults.standard.set(data, forKey: keyPrefix + botId)
        }
    }
}
