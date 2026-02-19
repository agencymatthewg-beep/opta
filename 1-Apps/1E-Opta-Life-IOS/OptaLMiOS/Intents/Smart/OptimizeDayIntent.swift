import AppIntents
import SwiftUI

// MARK: - Optimize Day Intent

struct OptimizeDayIntent: AppIntent {
    static var title: LocalizedStringResource = "Optimize My Day"
    static var description = IntentDescription("Optimize your schedule based on sleep data, energy levels, and task priorities")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Date", default: .today)
    var targetDate: OptimizeDateEntity

    @Parameter(title: "Apply Changes", default: false)
    var applyChanges: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Optimize \(\.$targetDate)") {
            \.$applyChanges
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared
        var sleepData: SleepData?
        var tasks: [OptaTask] = []
        var events: [CalendarEvent] = []

        // Fetch data (gracefully handle failures)
        if healthService.isHealthDataAvailable {
            let hasAccess = await healthService.requestHealthAccess()
            if hasAccess {
                sleepData = try? await healthService.fetchSleepData(for: Date())
            }
        }

        tasks = (try? await APIService.shared.fetchTodayTasks()) ?? []
        events = (try? await APIService.shared.fetchCalendarEvents()) ?? []

        let optimization = generateOptimization(sleep: sleepData, tasks: tasks, events: events)

        if optimization.suggestions.isEmpty {
            HapticManager.shared.notification(.success)
            return .result(
                dialog: "Your day looks well-optimized already!",
                view: OptimizeDaySnippetView(optimization: optimization)
            )
        }

        HapticManager.shared.notification(.success)

        let spoken = "I have \(optimization.suggestions.count) optimization\(optimization.suggestions.count == 1 ? "" : "s") for \(targetDate.rawValue). Your optimization score is \(optimization.score) out of 100."

        return .result(
            dialog: IntentDialog(stringLiteral: spoken),
            view: OptimizeDaySnippetView(optimization: optimization)
        )
    }

    // MARK: - Optimization Logic

    private func generateOptimization(sleep: SleepData?, tasks: [OptaTask], events: [CalendarEvent]) -> DayOptimization {
        var suggestions: [OptimizationSuggestion] = []
        var score = 70 // Base score

        // Energy level estimation from sleep
        let energyLevel: EnergyLevel
        if let sleep {
            switch sleep.quality {
            case .excellent:
                energyLevel = .high
                score += 15
            case .good:
                energyLevel = .high
                score += 10
            case .fair:
                energyLevel = .medium
                score += 0
            case .poor:
                energyLevel = .low
                score -= 10
            }
        } else {
            energyLevel = .medium
        }

        // 1. High-priority tasks during peak energy
        let urgentTasks = tasks.filter { !$0.isCompleted && ($0.priority == .urgent || $0.priority == .high) }
        if !urgentTasks.isEmpty && energyLevel == .high {
            suggestions.append(OptimizationSuggestion(
                title: "Schedule \(urgentTasks.count) high-priority task\(urgentTasks.count == 1 ? "" : "s") in the morning",
                reason: "Your energy level is high — tackle important work first",
                impact: .high,
                icon: "bolt.fill"
            ))
            score += 5
        }

        // 2. Low energy? Move non-urgent tasks
        if energyLevel == .low {
            suggestions.append(OptimizationSuggestion(
                title: "Defer low-priority tasks",
                reason: "Low energy today — focus only on essentials",
                impact: .medium,
                icon: "arrow.right.circle"
            ))
        }

        // 3. Break suggestions for back-to-back meetings
        let sortedEvents = events
            .filter { $0.startDate != nil && !$0.isAllDay }
            .sorted { ($0.startDate ?? .distantPast) < ($1.startDate ?? .distantPast) }

        var consecutiveMeetings = 0
        for i in 0..<(sortedEvents.count - 1) {
            if let end1 = sortedEvents[i].endDate,
               let start2 = sortedEvents[i + 1].startDate,
               start2.timeIntervalSince(end1) < 900 {
                consecutiveMeetings += 1
            }
        }
        if consecutiveMeetings >= 2 {
            suggestions.append(OptimizationSuggestion(
                title: "Add breaks between \(consecutiveMeetings) consecutive meetings",
                reason: "Back-to-back meetings reduce focus and increase fatigue",
                impact: .medium,
                icon: "cup.and.saucer.fill"
            ))
            score -= 5
        }

        // 4. Sleep recommendation
        if let sleep, sleep.quality == .poor {
            suggestions.append(OptimizationSuggestion(
                title: "Aim for earlier bedtime tonight",
                reason: "Poor sleep quality detected — recovery is important",
                impact: .high,
                icon: "moon.fill"
            ))
        }

        // 5. Buffer time before important meetings
        let importantEvents = events.filter { event in
            let title = event.summary.lowercased()
            return title.contains("important") || title.contains("review") ||
                   title.contains("presentation") || title.contains("interview")
        }
        if !importantEvents.isEmpty {
            suggestions.append(OptimizationSuggestion(
                title: "Add 15-min prep time before important meetings",
                reason: "\(importantEvents.count) important event\(importantEvents.count == 1 ? "" : "s") found",
                impact: .low,
                icon: "clock.badge.checkmark"
            ))
        }

        score = max(0, min(100, score))

        return DayOptimization(
            score: score,
            energyLevel: energyLevel,
            suggestions: suggestions,
            taskCount: tasks.filter { !$0.isCompleted }.count,
            eventCount: events.count
        )
    }
}

// MARK: - Entities

enum OptimizeDateEntity: String, AppEnum {
    case today = "today"
    case tomorrow = "tomorrow"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Optimize Date")

    static var caseDisplayRepresentations: [OptimizeDateEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .tomorrow: DisplayRepresentation(title: "Tomorrow")
    ]
}

// MARK: - Models

enum EnergyLevel: String {
    case high, medium, low

    var displayName: String { rawValue.capitalized }
    var emoji: String {
        switch self {
        case .high: return "⚡"
        case .medium: return "🔋"
        case .low: return "🪫"
        }
    }
    var color: Color {
        switch self {
        case .high: return .green
        case .medium: return .yellow
        case .low: return .orange
        }
    }
}

enum OptimizationImpact: String {
    case high, medium, low

    var color: Color {
        switch self {
        case .high: return .red
        case .medium: return .orange
        case .low: return .blue
        }
    }
}

struct OptimizationSuggestion: Identifiable {
    let id = UUID()
    let title: String
    let reason: String
    let impact: OptimizationImpact
    let icon: String
}

struct DayOptimization {
    let score: Int
    let energyLevel: EnergyLevel
    let suggestions: [OptimizationSuggestion]
    let taskCount: Int
    let eventCount: Int
}

// MARK: - Snippet Views

struct OptimizeDaySnippetView: View {
    let optimization: DayOptimization

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with score
            HStack {
                Image(systemName: "wand.and.stars")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Day Optimization")
                        .font(.headline)
                    HStack(spacing: 4) {
                        Text("Energy: \(optimization.energyLevel.emoji)")
                            .font(.caption)
                        Text("•")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("\(optimization.taskCount) tasks, \(optimization.eventCount) events")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()

                // Score circle
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.2), lineWidth: 3)
                    Circle()
                        .trim(from: 0, to: Double(optimization.score) / 100.0)
                        .stroke(scoreColor, lineWidth: 3)
                        .rotationEffect(.degrees(-90))
                    Text("\(optimization.score)")
                        .font(.caption.bold())
                }
                .frame(width: 36, height: 36)
            }

            if !optimization.suggestions.isEmpty {
                Divider()

                ForEach(optimization.suggestions) { suggestion in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: suggestion.icon)
                            .foregroundColor(suggestion.impact.color)
                            .font(.caption)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(suggestion.title)
                                .font(.caption.bold())
                            Text(suggestion.reason)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            } else {
                HStack {
                    Spacer()
                    Text("✓ Your day is well-optimized!")
                        .font(.subheadline)
                        .foregroundColor(.green)
                    Spacer()
                }
            }
        }
        .padding()
    }

    private var scoreColor: Color {
        if optimization.score >= 80 { return .green }
        if optimization.score >= 60 { return .yellow }
        return .orange
    }
}
