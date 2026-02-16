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
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // TODO: Full implementation in Phase 2
        return .result(dialog: "This feature is coming soon. Please use the app directly.")
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
