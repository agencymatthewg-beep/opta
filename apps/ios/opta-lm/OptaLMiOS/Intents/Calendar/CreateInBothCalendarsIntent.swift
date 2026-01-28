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
        let endTime = startTime.addingTimeInterval(TimeInterval(durationMinutes * 60))

        var backendSuccess = false
        var appleSuccess = false
        var backendEventId: String?
        var appleEventId: String?

        // Create in backend (Opta)
        do {
            let api = APIService.shared
            let event = try await api.createCalendarEvent(
                title: title,
                startTime: startTime,
                endTime: endTime,
                location: location,
                description: notes,
                isAllDay: isAllDay
            )
            backendSuccess = true
            backendEventId = event.id
        } catch {
            print("Failed to create in backend: \(error)")
        }

        // Create in Apple Calendar
        if let eventKitService = EventKitService.shared {
            let hasAccess = await eventKitService.requestCalendarAccess()
            if hasAccess {
                do {
                    let eventId = try await eventKitService.createEvent(
                        title: title,
                        startDate: startTime,
                        endDate: endTime,
                        location: location,
                        notes: notes
                    )
                    appleSuccess = true
                    appleEventId = eventId
                } catch {
                    print("Failed to create in Apple Calendar: \(error)")
                }
            }
        }

        // Generate response based on success
        let result: CreateBothCalendarsResult
        if backendSuccess && appleSuccess {
            HapticManager.shared.notification(.success)
            result = CreateBothCalendarsResult(
                title: title,
                startTime: startTime,
                status: .both,
                message: "Created '\(title)' in both calendars successfully."
            )
        } else if backendSuccess && !appleSuccess {
            HapticManager.shared.notification(.warning)
            result = CreateBothCalendarsResult(
                title: title,
                startTime: startTime,
                status: .backendOnly,
                message: "Created '\(title)' in Opta. Apple Calendar access is not available."
            )
        } else if !backendSuccess && appleSuccess {
            HapticManager.shared.notification(.warning)
            result = CreateBothCalendarsResult(
                title: title,
                startTime: startTime,
                status: .appleOnly,
                message: "Created '\(title)' in Apple Calendar. Backend sync failed."
            )
        } else {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create event in both calendars. Please try again."])
        }

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
