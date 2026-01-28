import AppIntents
import SwiftUI

// MARK: - Smart Time Blocking Intent

struct SmartTimeBlockingIntent: AppIntent {
    static var title: LocalizedStringResource = "Smart Time Blocking"
    static var description = IntentDescription("Automatically block time for your tasks based on priority and deadlines")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Time Period", default: TimeBlockPeriodEntity.today)
    var period: TimeBlockPeriodEntity

    @Parameter(title: "Auto-create events", default: false)
    var autoCreate: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Block time for tasks \(\.$period)") {
            \.$autoCreate
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let api = APIService.shared

        // Fetch tasks
        let dashboard = try await api.fetchTasksDashboard()
        let allTasks = dashboard.todayTasks + dashboard.upcomingTasks

        // Fetch existing calendar events
        let events = try await api.fetchCalendarEvents()

        // Generate time blocks
        let timeBlocks = generateTimeBlocks(
            tasks: allTasks,
            existingEvents: events,
            period: period
        )

        // Auto-create calendar events if enabled
        var createdCount = 0
        if autoCreate {
            for block in timeBlocks {
                do {
                    _ = try await api.createCalendarEvent(
                        title: "🎯 \(block.taskTitle)",
                        startTime: block.startTime,
                        endTime: block.endTime,
                        location: nil,
                        description: "Auto-blocked time for task: \(block.taskTitle)",
                        isAllDay: false
                    )
                    createdCount += 1
                } catch {
                    print("Failed to create event for block: \(error)")
                }
            }

            // Haptic feedback
            if createdCount > 0 {
                HapticManager.shared.notification(.success)
            }
        }

        // Generate spoken response
        let spokenSummary: String
        if autoCreate {
            spokenSummary = createdCount > 0
                ? "Created \(createdCount) time block\(createdCount == 1 ? "" : "s") for your tasks."
                : "No time blocks were created."
        } else {
            spokenSummary = timeBlocks.isEmpty
                ? "No time blocks suggested."
                : "Suggested \(timeBlocks.count) time block\(timeBlocks.count == 1 ? "" : "s") for your tasks."
        }

        return .result(
            dialog: IntentDialog(stringLiteral: spokenSummary),
            view: TimeBlockingSnippetView(
                timeBlocks: timeBlocks,
                period: period,
                autoCreated: autoCreate
            )
        )
    }

    private func generateTimeBlocks(
        tasks: [OptaTask],
        existingEvents: [CalendarEvent],
        period: TimeBlockPeriodEntity
    ) -> [TimeBlock] {
        var blocks: [TimeBlock] = []

        // Filter tasks that need time blocking
        let unscheduledTasks = tasks.filter { task in
            !task.isCompleted &&
            !existingEvents.contains { event in
                event.title.lowercased().contains(task.content.lowercased())
            }
        }

        // Sort by priority and deadline
        let sortedTasks = unscheduledTasks.sorted { task1, task2 in
            // Urgent tasks first
            if task1.priority != task2.priority {
                return task1.priority > task2.priority
            }

            // Then by deadline
            guard let date1 = task1.due?.date else { return false }
            guard let date2 = task2.due?.date else { return true }
            return date1 < date2
        }

        let calendar = Calendar.current
        let startDate = period.startDate
        let endDate = period.endDate

        // Find available time slots
        var currentDate = startDate

        for task in sortedTasks.prefix(10) {
            // Estimate task duration based on priority
            let estimatedMinutes = estimateTaskDuration(task)

            // Find next available slot
            if let slot = findNextAvailableSlot(
                from: currentDate,
                to: endDate,
                duration: estimatedMinutes,
                existingEvents: existingEvents,
                existingBlocks: blocks
            ) {
                blocks.append(TimeBlock(
                    id: UUID().uuidString,
                    taskTitle: task.content,
                    taskId: task.id,
                    startTime: slot.start,
                    endTime: slot.end,
                    duration: estimatedMinutes,
                    priority: task.priority,
                    reason: generateBlockReason(task)
                ))

                // Move to next day if we're past 6 PM
                if calendar.component(.hour, from: slot.end) >= 18 {
                    currentDate = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: slot.end))!
                } else {
                    currentDate = slot.end
                }
            }
        }

        return blocks
    }

    private func estimateTaskDuration(_ task: OptaTask) -> Int {
        // Estimate based on priority and content
        let baseMinutes: Int

        switch task.priority {
        case 4: baseMinutes = 120 // Urgent tasks: 2 hours
        case 3: baseMinutes = 90  // High priority: 1.5 hours
        case 2: baseMinutes = 60  // Medium priority: 1 hour
        default: baseMinutes = 45 // Normal: 45 minutes
        }

        // Adjust based on task title keywords
        let content = task.content.lowercased()
        if content.contains("quick") || content.contains("review") {
            return baseMinutes / 2
        } else if content.contains("project") || content.contains("plan") {
            return baseMinutes * 2
        }

        return baseMinutes
    }

    private func findNextAvailableSlot(
        from startDate: Date,
        to endDate: Date,
        duration: Int,
        existingEvents: [CalendarEvent],
        existingBlocks: [TimeBlock]
    ) -> (start: Date, end: Date)? {
        let calendar = Calendar.current
        var currentDate = startDate

        while currentDate < endDate {
            // Only work hours: 9 AM - 6 PM
            let hour = calendar.component(.hour, from: currentDate)
            if hour < 9 {
                // Jump to 9 AM
                currentDate = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: currentDate)!
            } else if hour >= 18 {
                // Jump to next day 9 AM
                let nextDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: currentDate))!
                currentDate = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: nextDay)!
                continue
            }

            let potentialEnd = calendar.date(byAdding: .minute, value: duration, to: currentDate)!

            // Check for conflicts with existing events
            let hasEventConflict = existingEvents.contains { event in
                event.startTime < potentialEnd && event.endTime > currentDate
            }

            // Check for conflicts with existing blocks
            let hasBlockConflict = existingBlocks.contains { block in
                block.startTime < potentialEnd && block.endTime > currentDate
            }

            if !hasEventConflict && !hasBlockConflict {
                return (currentDate, potentialEnd)
            }

            // Move to next 30-minute slot
            currentDate = calendar.date(byAdding: .minute, value: 30, to: currentDate)!
        }

        return nil
    }

    private func generateBlockReason(_ task: OptaTask) -> String {
        if let dueDate = task.due?.date {
            let daysUntil = Calendar.current.dateComponents([.day], from: Date(), to: dueDate).day ?? 0

            if daysUntil == 0 {
                return "Due today"
            } else if daysUntil == 1 {
                return "Due tomorrow"
            } else if daysUntil <= 7 {
                return "Due in \(daysUntil) days"
            }
        }

        switch task.priority {
        case 4: return "Urgent priority"
        case 3: return "High priority"
        case 2: return "Medium priority"
        default: return "Scheduled"
        }
    }
}

// MARK: - Time Block Period Entity

enum TimeBlockPeriodEntity: String, AppEnum {
    case today = "today"
    case tomorrow = "tomorrow"
    case thisWeek = "this week"
    case nextWeek = "next week"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Time Period")

    static var caseDisplayRepresentations: [TimeBlockPeriodEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .tomorrow: DisplayRepresentation(title: "Tomorrow"),
        .thisWeek: DisplayRepresentation(title: "This Week"),
        .nextWeek: DisplayRepresentation(title: "Next Week")
    ]

    var startDate: Date {
        let calendar = Calendar.current
        let now = Date()

        switch self {
        case .today:
            return now
        case .tomorrow:
            return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        case .thisWeek:
            return now
        case .nextWeek:
            let nextWeekDate = calendar.date(byAdding: .weekOfYear, value: 1, to: now)!
            return calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: nextWeekDate).date!
        }
    }

    var endDate: Date {
        let calendar = Calendar.current

        switch self {
        case .today:
            return calendar.date(byAdding: .day, value: 1, to: startDate)!
        case .tomorrow:
            return calendar.date(byAdding: .day, value: 1, to: startDate)!
        case .thisWeek:
            let startOfWeek = calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: Date()).date!
            return calendar.date(byAdding: .weekOfYear, value: 1, to: startOfWeek)!
        case .nextWeek:
            return calendar.date(byAdding: .weekOfYear, value: 1, to: startDate)!
        }
    }
}

// MARK: - Time Block Model

struct TimeBlock: Identifiable {
    let id: String
    let taskTitle: String
    let taskId: String
    let startTime: Date
    let endTime: Date
    let duration: Int // minutes
    let priority: Int
    let reason: String
}

// MARK: - Time Blocking Snippet View

struct TimeBlockingSnippetView: View {
    let timeBlocks: [TimeBlock]
    let period: TimeBlockPeriodEntity
    let autoCreated: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "calendar.badge.clock")
                    .foregroundColor(.blue)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(autoCreated ? "Time Blocks Created" : "Time Block Suggestions")
                        .font(.headline)
                    Text(period.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if autoCreated {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            if timeBlocks.isEmpty {
                Text("No time blocks available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                // Time blocks list
                ForEach(timeBlocks.prefix(8)) { block in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            // Priority indicator
                            Circle()
                                .fill(priorityColor(block.priority))
                                .frame(width: 8, height: 8)

                            Text(block.taskTitle)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .lineLimit(1)
                        }

                        HStack(spacing: 8) {
                            Text(block.startTime, style: .time)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("-")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(block.endTime, style: .time)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("•")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(block.duration)m")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Text(block.reason)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .italic()
                    }
                    .padding(.vertical, 6)

                    if block.id != timeBlocks.prefix(8).last?.id {
                        Divider()
                    }
                }

                if timeBlocks.count > 8 {
                    Text("+ \(timeBlocks.count - 8) more blocks")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }

                // Action hint
                if !autoCreated {
                    Text("Run again with 'Auto-create events' enabled to add these to your calendar")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .italic()
                        .padding(.top, 8)
                }
            }
        }
        .padding()
    }

    private func priorityColor(_ priority: Int) -> Color {
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .yellow
        default: return .blue
        }
    }
}
