import AppIntents
import SwiftUI

// MARK: - Smart Time Blocking Intent

struct SmartTimeBlockingIntent: AppIntent {
    static var title: LocalizedStringResource = "Smart Time Blocking"
    static var description = IntentDescription("Automatically block time for unscheduled tasks based on priority and available slots")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Period", default: .today)
    var period: TimeBlockPeriodEntity

    @Parameter(title: "Auto-create Events", default: false)
    var autoCreate: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Block time for tasks \(\.$period)") {
            \.$autoCreate
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let tasks: [OptaTask]
        let events: [CalendarEvent]

        do {
            tasks = try await APIService.shared.fetchTodayTasks()
            events = try await APIService.shared.fetchCalendarEvents()
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "Couldn't fetch your schedule for time blocking.",
                view: NoTimeBlocksSnippetView()
            )
        }

        let incompleteTasks = tasks.filter { !$0.isCompleted }
            .sorted { $0.priority.rawValue > $1.priority.rawValue }

        if incompleteTasks.isEmpty {
            HapticManager.shared.notification(.success)
            return .result(
                dialog: "No incomplete tasks to schedule!",
                view: NoTimeBlocksSnippetView()
            )
        }

        let timeBlocks = generateTimeBlocks(tasks: incompleteTasks, existingEvents: events, period: period)

        if timeBlocks.isEmpty {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "No available time slots found for your tasks.",
                view: NoTimeBlocksSnippetView()
            )
        }

        // Auto-create calendar events if requested
        if autoCreate {
            let eventKitService = EventKitService.shared
            let hasAccess = await eventKitService.requestCalendarAccess()
            if hasAccess {
                for block in timeBlocks {
                    _ = try? eventKitService.createEvent(
                        title: "📋 \(block.taskContent)",
                        startDate: block.startTime,
                        endDate: block.endTime,
                        notes: "Auto-blocked by Opta for \(block.priority.displayName) priority task"
                    )
                }
            }
        }

        HapticManager.shared.notification(.success)

        let spoken = "I've found \(timeBlocks.count) time block\(timeBlocks.count == 1 ? "" : "s") for your tasks\(autoCreate ? " and added them to your calendar" : "")."

        return .result(
            dialog: IntentDialog(stringLiteral: spoken),
            view: TimeBlockingSnippetView(blocks: timeBlocks, autoCreated: autoCreate)
        )
    }

    // MARK: - Time Block Generation

    private func generateTimeBlocks(tasks: [OptaTask], existingEvents: [CalendarEvent], period: TimeBlockPeriodEntity) -> [TimeBlock] {
        let calendar = Calendar.current
        let now = Date()
        var blocks: [TimeBlock] = []

        // Work hours: 9 AM - 6 PM
        let workStart = 9
        let workEnd = 18

        // Get existing event times to avoid conflicts
        let busySlots: [(start: Date, end: Date)] = existingEvents.compactMap { event in
            guard let start = event.startDate, let end = event.endDate else { return nil }
            return (start, end)
        }

        // Duration estimation by priority
        func estimatedMinutes(for priority: TaskPriority) -> Int {
            switch priority {
            case .urgent: return 120
            case .high: return 90
            case .medium: return 60
            case .normal: return 45
            }
        }

        // Find available slots
        let targetDate = period == .tomorrow
            ? calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
            : calendar.startOfDay(for: now)

        var currentSlotStart = calendar.date(bySettingHour: workStart, minute: 0, second: 0, of: targetDate)!

        // If today and past work start, begin from next hour
        if period == .today && now > currentSlotStart {
            let nextHour = calendar.date(bySetting: .minute, value: 0, of: calendar.date(byAdding: .hour, value: 1, to: now)!)!
            currentSlotStart = nextHour
        }

        let dayEnd = calendar.date(bySettingHour: workEnd, minute: 0, second: 0, of: targetDate)!

        for task in tasks.prefix(6) { // Max 6 blocks per day
            let duration = estimatedMinutes(for: task.priority)
            let slotEnd = calendar.date(byAdding: .minute, value: duration, to: currentSlotStart)!

            guard slotEnd <= dayEnd else { break }

            // Check for conflicts
            let hasConflict = busySlots.contains { busy in
                currentSlotStart < busy.end && slotEnd > busy.start
            }

            if !hasConflict {
                blocks.append(TimeBlock(
                    taskContent: task.content,
                    startTime: currentSlotStart,
                    endTime: slotEnd,
                    duration: duration,
                    priority: task.priority
                ))
                currentSlotStart = calendar.date(byAdding: .minute, value: duration + 15, to: currentSlotStart)! // 15m buffer
            } else {
                // Skip to after the conflicting event
                if let conflictEnd = busySlots.first(where: { currentSlotStart < $0.end && slotEnd > $0.start })?.end {
                    currentSlotStart = calendar.date(byAdding: .minute, value: 15, to: conflictEnd)!
                }
            }
        }

        return blocks
    }
}

// MARK: - Entities

enum TimeBlockPeriodEntity: String, AppEnum {
    case today = "today"
    case tomorrow = "tomorrow"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Time Block Period")

    static var caseDisplayRepresentations: [TimeBlockPeriodEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .tomorrow: DisplayRepresentation(title: "Tomorrow")
    ]
}

// MARK: - Models

struct TimeBlock: Identifiable {
    let id = UUID()
    let taskContent: String
    let startTime: Date
    let endTime: Date
    let duration: Int // minutes
    let priority: TaskPriority

    var timeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "\(formatter.string(from: startTime)) – \(formatter.string(from: endTime))"
    }
}

// MARK: - Snippet Views

struct TimeBlockingSnippetView: View {
    let blocks: [TimeBlock]
    let autoCreated: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "rectangle.split.3x3")
                    .foregroundColor(.blue)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Time Blocks")
                        .font(.headline)
                    Text(autoCreated ? "Added to calendar" : "Suggested schedule")
                        .font(.caption)
                        .foregroundColor(autoCreated ? .green : .secondary)
                }
                Spacer()
                Text("\(blocks.count)")
                    .font(.title3.bold())
                    .foregroundColor(.blue)
            }

            ForEach(blocks) { block in
                HStack(spacing: 8) {
                    Rectangle()
                        .fill(Color(block.priority.color))
                        .frame(width: 3)
                        .cornerRadius(2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(block.taskContent)
                            .font(.caption.bold())
                            .lineLimit(1)
                        Text(block.timeRange)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Text("\(block.duration)m")
                        .font(.caption2.monospacedDigit())
                        .foregroundColor(.secondary)
                }
            }

            // Total time
            let totalMinutes = blocks.reduce(0) { $0 + $1.duration }
            HStack {
                Spacer()
                Text("Total: \(totalMinutes / 60)h \(totalMinutes % 60)m")
                    .font(.caption.bold())
                    .foregroundColor(.blue)
            }
        }
        .padding()
    }
}

struct NoTimeBlocksSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "rectangle.split.3x3")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("No time blocks to suggest")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
