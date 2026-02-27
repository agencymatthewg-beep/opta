import Foundation
import HealthKit

// MARK: - Sleep Data

struct SleepData: Identifiable, Codable {
    let id: UUID
    let date: Date
    let totalHours: Double
    let quality: SleepQuality
    let stages: SleepStages
    let bedTime: Date?
    let wakeTime: Date?

    enum CodingKeys: String, CodingKey {
        case id, date, totalHours, quality, stages, bedTime, wakeTime
    }

    init(id: UUID = UUID(), date: Date, totalHours: Double, quality: SleepQuality, stages: SleepStages, bedTime: Date?, wakeTime: Date?) {
        self.id = id
        self.date = date
        self.totalHours = totalHours
        self.quality = quality
        self.stages = stages
        self.bedTime = bedTime
        self.wakeTime = wakeTime
    }

    /// Vague spoken summary for Siri (privacy-preserving)
    var spokenSummary: String {
        switch quality {
        case .excellent:
            return "You slept very well last night."
        case .good:
            return "You got good rest last night."
        case .fair:
            return "Your sleep was okay last night."
        case .poor:
            return "Your sleep could have been better last night."
        }
    }

    /// Detailed summary for in-app display
    var detailedSummary: String {
        let hours = Int(totalHours)
        let minutes = Int((totalHours - Double(hours)) * 60)
        return "\(hours)h \(minutes)m of \(quality.displayName.lowercased()) sleep"
    }

    /// Quality emoji
    var qualityEmoji: String {
        quality.emoji
    }
}

enum SleepQuality: String, Codable {
    case excellent
    case good
    case fair
    case poor

    var displayName: String {
        switch self {
        case .excellent: return "Excellent"
        case .good: return "Good"
        case .fair: return "Fair"
        case .poor: return "Poor"
        }
    }

    var emoji: String {
        switch self {
        case .excellent: return "🌟"
        case .good: return "😊"
        case .fair: return "😐"
        case .poor: return "😴"
        }
    }

    var color: String {
        switch self {
        case .excellent: return "optaNeonGreen"
        case .good: return "optaNeonCyan"
        case .fair: return "optaNeonAmber"
        case .poor: return "optaNeonRed"
        }
    }

    /// Calculate quality from total hours
    static func from(totalHours: Double) -> SleepQuality {
        switch totalHours {
        case 7.5...10:
            return .excellent
        case 6.5..<7.5:
            return .good
        case 5..<6.5:
            return .fair
        default:
            return .poor
        }
    }
}

struct SleepStages: Codable {
    let rem: Double        // REM sleep in hours
    let deep: Double       // Deep sleep in hours
    let light: Double      // Light sleep in hours
    let awake: Double      // Awake time in hours

    init(rem: Double = 0, deep: Double = 0, light: Double = 0, awake: Double = 0) {
        self.rem = rem
        self.deep = deep
        self.light = light
        self.awake = awake
    }

    var total: Double {
        rem + deep + light + awake
    }

    /// Calculate percentage of each stage
    var remPercentage: Double {
        total > 0 ? (rem / total) * 100 : 0
    }

    var deepPercentage: Double {
        total > 0 ? (deep / total) * 100 : 0
    }

    var lightPercentage: Double {
        total > 0 ? (light / total) * 100 : 0
    }

    var awakePercentage: Double {
        total > 0 ? (awake / total) * 100 : 0
    }
}

// MARK: - Activity Data

struct ActivityData: Identifiable, Codable {
    let id: UUID
    let date: Date
    let steps: Int
    let activeEnergyBurned: Double  // in kcal
    let activeMinutes: Int
    let workouts: [WorkoutSummary]

    init(id: UUID = UUID(), date: Date, steps: Int, activeEnergyBurned: Double, activeMinutes: Int, workouts: [WorkoutSummary] = []) {
        self.id = id
        self.date = date
        self.steps = steps
        self.activeEnergyBurned = activeEnergyBurned
        self.activeMinutes = activeMinutes
        self.workouts = workouts
    }

    /// Vague spoken summary for Siri (privacy-preserving)
    var spokenSummary: String {
        if steps >= 10000 {
            return "You've been very active today."
        } else if steps >= 5000 {
            return "You've had moderate activity today."
        } else {
            return "You've had light activity today."
        }
    }

    /// Detailed summary for in-app display
    var detailedSummary: String {
        "\(steps.formatted()) steps, \(Int(activeEnergyBurned)) kcal burned"
    }

    /// Activity level based on steps
    var activityLevel: ActivityLevel {
        switch steps {
        case 10000...:
            return .high
        case 5000..<10000:
            return .moderate
        case 2000..<5000:
            return .light
        default:
            return .sedentary
        }
    }
}

enum ActivityLevel: String, Codable {
    case high
    case moderate
    case light
    case sedentary

    var displayName: String {
        switch self {
        case .high: return "High"
        case .moderate: return "Moderate"
        case .light: return "Light"
        case .sedentary: return "Sedentary"
        }
    }

    var emoji: String {
        switch self {
        case .high: return "🏃"
        case .moderate: return "🚶"
        case .light: return "🧘"
        case .sedentary: return "🛋️"
        }
    }

    var color: String {
        switch self {
        case .high: return "optaNeonGreen"
        case .moderate: return "optaNeonCyan"
        case .light: return "optaNeonAmber"
        case .sedentary: return "optaNeonRed"
        }
    }
}

struct WorkoutSummary: Identifiable, Codable {
    let id: UUID
    let type: String
    let startDate: Date
    let endDate: Date
    let duration: TimeInterval  // in seconds
    let energyBurned: Double    // in kcal

    init(id: UUID = UUID(), type: String, startDate: Date, endDate: Date, duration: TimeInterval, energyBurned: Double) {
        self.id = id
        self.type = type
        self.startDate = startDate
        self.endDate = endDate
        self.duration = duration
        self.energyBurned = energyBurned
    }

    /// Duration in minutes
    var durationMinutes: Int {
        Int(duration / 60)
    }

    /// Display name for workout type
    var displayName: String {
        // Convert workout type to human-readable format
        type.replacingOccurrences(of: "HKWorkoutActivityType", with: "")
            .replacingOccurrences(of: "([A-Z])", with: " $1", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
}

// MARK: - Productivity Insights

struct ProductivityInsights: Codable {
    let correlationData: [ProductivityCorrelationPoint]
    let averageSleepHours: Double
    let averageTaskCompletionRate: Double
    let optimalSleepRange: ClosedRange<Double>
    let recommendations: [String]

    init(correlationData: [ProductivityCorrelationPoint], averageSleepHours: Double, averageTaskCompletionRate: Double, optimalSleepRange: ClosedRange<Double>, recommendations: [String]) {
        self.correlationData = correlationData
        self.averageSleepHours = averageSleepHours
        self.averageTaskCompletionRate = averageTaskCompletionRate
        self.optimalSleepRange = optimalSleepRange
        self.recommendations = recommendations
    }

    /// Calculate correlation coefficient between sleep and productivity
    var correlationCoefficient: Double {
        guard correlationData.count > 1 else { return 0 }

        let n = Double(correlationData.count)
        let sumX = correlationData.reduce(0) { $0 + $1.sleepHours }
        let sumY = correlationData.reduce(0) { $0 + $1.taskCompletionRate }
        let sumXY = correlationData.reduce(0) { $0 + ($1.sleepHours * $1.taskCompletionRate) }
        let sumX2 = correlationData.reduce(0) { $0 + ($1.sleepHours * $1.sleepHours) }
        let sumY2 = correlationData.reduce(0) { $0 + ($1.taskCompletionRate * $1.taskCompletionRate) }

        let numerator = (n * sumXY) - (sumX * sumY)
        let denominator = sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)))

        guard denominator != 0 else { return 0 }
        return numerator / denominator
    }

    /// Strength of correlation
    var correlationStrength: CorrelationStrength {
        let coefficient = abs(correlationCoefficient)

        switch coefficient {
        case 0.7...1.0:
            return .strong
        case 0.4..<0.7:
            return .moderate
        case 0.2..<0.4:
            return .weak
        default:
            return .negligible
        }
    }

    /// Summary text
    var summary: String {
        let direction = correlationCoefficient > 0 ? "positive" : "negative"
        return "There's a \(correlationStrength.displayName.lowercased()) \(direction) correlation between your sleep and task completion."
    }
}

struct ProductivityCorrelationPoint: Codable, Identifiable {
    let id: UUID
    let date: Date
    let sleepHours: Double
    let taskCompletionRate: Double  // 0-100%
    let tasksCompleted: Int
    let tasksTotal: Int

    init(id: UUID = UUID(), date: Date, sleepHours: Double, taskCompletionRate: Double, tasksCompleted: Int, tasksTotal: Int) {
        self.id = id
        self.date = date
        self.sleepHours = sleepHours
        self.taskCompletionRate = taskCompletionRate
        self.tasksCompleted = tasksCompleted
        self.tasksTotal = tasksTotal
    }
}

enum CorrelationStrength: String, Codable {
    case strong
    case moderate
    case weak
    case negligible

    var displayName: String {
        switch self {
        case .strong: return "Strong"
        case .moderate: return "Moderate"
        case .weak: return "Weak"
        case .negligible: return "Negligible"
        }
    }

    var color: String {
        switch self {
        case .strong: return "optaNeonGreen"
        case .moderate: return "optaNeonCyan"
        case .weak: return "optaNeonAmber"
        case .negligible: return "optaNeonRed"
        }
    }
}

// MARK: - Health Authorization Status

enum HealthAuthorizationStatus {
    case notDetermined
    case sharingDenied
    case sharingAuthorized
    case unavailable

    var isAuthorized: Bool {
        self == .sharingAuthorized
    }

    var displayMessage: String {
        switch self {
        case .notDetermined:
            return "Health access not yet requested"
        case .sharingDenied:
            return "Health access denied. Enable in Settings > Health > Data Access & Devices."
        case .sharingAuthorized:
            return "Health access authorized"
        case .unavailable:
            return "Health data unavailable on this device"
        }
    }
}
