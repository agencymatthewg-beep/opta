import AppIntents
import SwiftUI

// MARK: - Create In Both Calendars Intent

struct CreateInBothCalendarsIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Event in Both Calendars"
    static var description = IntentDescription("Create an event in both Opta backend and Apple Calendar simultaneously")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Event Title")
    var title: String

    @Parameter(title: "Start Time")
    var startTime: Date

    @Parameter(title: "Duration (minutes)", default: 60)
    var durationMinutes: Int

    @Parameter(title: "Location")
    var location: String?

    @Parameter(title: "Notes")
    var notes: String?

    @Parameter(title: "All Day Event", default: false)
    var isAllDay: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Create \(\.$title) in both calendars") {
            \.$startTime
            \.$durationMinutes
            \.$location
            \.$notes
            \.$isAllDay
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let apiService = APIService.shared
        let eventKitService = EventKitService.shared

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Event title cannot be empty."]
            )
        }

        let safeDurationMinutes = min(max(durationMinutes, 1), 24 * 60)
        let calendar = Calendar.current
        let normalizedStart = isAllDay ? calendar.startOfDay(for: startTime) : startTime
        let endTime: Date

        if isAllDay {
            endTime = calendar.date(byAdding: .day, value: 1, to: normalizedStart) ?? normalizedStart
        } else {
            endTime = normalizedStart.addingTimeInterval(TimeInterval(safeDurationMinutes * 60))
        }

        let startString = ISO8601DateFormatter().string(from: normalizedStart)
        let endString = ISO8601DateFormatter().string(from: endTime)

        var createdInBackend = false
        var createdInApple = false
        var errors: [String] = []

        do {
            try await apiService.createCalendarEvent(
                summary: trimmedTitle,
                startTime: startString,
                endTime: endString
            )
            createdInBackend = true
        } catch {
            errors.append("Opta backend: \(error.localizedDescription)")
        }

        let hasAppleAccess = await eventKitService.requestCalendarAccess()
        if hasAppleAccess {
            do {
                _ = try eventKitService.createEvent(
                    title: trimmedTitle,
                    startDate: normalizedStart,
                    endDate: endTime,
                    isAllDay: isAllDay,
                    location: location.nilIfBlank,
                    notes: notes.nilIfBlank
                )
                createdInApple = true
            } catch {
                errors.append("Apple Calendar: \(error.localizedDescription)")
            }
        } else {
            errors.append("Apple Calendar access was denied.")
        }

        guard createdInBackend || createdInApple else {
            HapticManager.shared.notification(.error)
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create event in either calendar. \(errors.joined(separator: " "))"]
            )
        }

        let status: CreateBothCalendarsResult.CreationStatus
        switch (createdInBackend, createdInApple) {
        case (true, true):
            status = .both
            HapticManager.shared.notification(.success)
        case (true, false):
            status = .backendOnly
            HapticManager.shared.notification(.warning)
        case (false, true):
            status = .appleOnly
            HapticManager.shared.notification(.warning)
        case (false, false):
            status = .backendOnly
        }

        let statusMessage: String
        switch status {
        case .both:
            statusMessage = "Created in both Opta and Apple Calendar."
        case .backendOnly:
            statusMessage = "Created in Opta only."
        case .appleOnly:
            statusMessage = "Created in Apple Calendar only."
        }

        let errorSuffix = errors.isEmpty ? "" : " \(errors.joined(separator: " "))"
        let result = CreateBothCalendarsResult(
            title: trimmedTitle,
            startTime: normalizedStart,
            status: status,
            message: statusMessage + errorSuffix
        )

        return .result(
            dialog: IntentDialog(stringLiteral: result.message),
            view: CreateBothCalendarsSnippetView(result: result)
        )
    }
}

// MARK: - Create Both Calendars Result

struct CreateBothCalendarsResult {
    let title: String
    let startTime: Date
    let status: CreationStatus
    let message: String

    enum CreationStatus {
        case both
        case backendOnly
        case appleOnly
    }
}

// MARK: - Create Both Calendars Snippet View

struct CreateBothCalendarsSnippetView: View {
    let result: CreateBothCalendarsResult

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: statusIcon)
                    .foregroundColor(statusColor)
                    .font(.title2)
                Text("Event Created")
                    .font(.headline)
            }

            // Event details
            VStack(alignment: .leading, spacing: 8) {
                Text(result.title)
                    .font(.title3)
                    .fontWeight(.semibold)

                HStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(result.startTime, style: .date)
                        .font(.subheadline)
                    Text("at")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(result.startTime, style: .time)
                        .font(.subheadline)
                }
            }

            // Status badges
            HStack(spacing: 8) {
                if result.status == .both || result.status == .backendOnly {
                    StatusBadge(text: "Opta", color: .blue)
                }
                if result.status == .both || result.status == .appleOnly {
                    StatusBadge(text: "Apple Calendar", color: .green)
                }
            }

            // Message
            Text(result.message)
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
    }

    private var statusIcon: String {
        switch result.status {
        case .both: return "checkmark.circle.fill"
        case .backendOnly, .appleOnly: return "exclamationmark.triangle.fill"
        }
    }

    private var statusColor: Color {
        switch result.status {
        case .both: return .green
        case .backendOnly, .appleOnly: return .orange
        }
    }
}

// MARK: - Status Badge Component

struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .cornerRadius(6)
    }
}

private extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
