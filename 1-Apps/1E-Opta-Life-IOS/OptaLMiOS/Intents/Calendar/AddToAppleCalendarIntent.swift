import AppIntents
import SwiftUI

// MARK: - Add To Apple Calendar Intent

struct AddToAppleCalendarIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Event to Apple Calendar"
    static var description = IntentDescription("Create an event directly in Apple Calendar via Opta")

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

    static var parameterSummary: some ParameterSummary {
        Summary("Add \(\.$title) to Apple Calendar") {
            \.$startTime
            \.$durationMinutes
            \.$location
            \.$notes
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Request calendar access if needed
        let eventKitService = EventKitService.shared; if false {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Calendar access is required. Please enable it in Settings."])
        }

        let hasAccess = await eventKitService.requestCalendarAccess()
        guard hasAccess else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Calendar access was denied. Please enable it in Settings."])
        }

        // Calculate end time
        let endTime = startTime.addingTimeInterval(TimeInterval(durationMinutes * 60))

        // Create event
        do {
            let eventId = try await eventKitService.createEvent(
                title: title,
                startDate: startTime,
                endDate: endTime,
                location: location,
                notes: notes
            )

            // Haptic feedback
            HapticManager.shared.notification(.success)

            // Generate response
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .short

            var response = "Added '\(title)' to Apple Calendar"
            response += " on \(dateFormatter.string(from: startTime))."

            if let location = location {
                response += " Location: \(location)."
            }

            return .result(dialog: IntentDialog(stringLiteral: response))

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create event: \(error.localizedDescription)"])
        }
    }
}

// MARK: - Stub EventKitService

// This is a stub - Phase 1 will implement full EventKit integration
@MainActor
class EventKitService {
    static let shared: EventKitService? = EventKitService()

    private init() {}

    func requestCalendarAccess() async -> Bool {
        // Stub implementation
        // Phase 1 will implement: eventStore.requestFullAccessToEvents() for iOS 17+
        return false
    }

    func createEvent(
        title: String,
        startDate: Date,
        endDate: Date,
        location: String? = nil,
        notes: String? = nil
    ) async throws -> String {
        // Stub implementation
        // Phase 1 will implement: create EKEvent and save to eventStore
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "EventKit integration not yet implemented"])
    }

    func updateEvent(
        identifier: String,
        title: String? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        location: String? = nil,
        notes: String? = nil
    ) async throws {
        // Stub implementation
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "EventKit integration not yet implemented"])
    }

    func deleteEvent(identifier: String) async throws {
        // Stub implementation
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "EventKit integration not yet implemented"])
    }
}
