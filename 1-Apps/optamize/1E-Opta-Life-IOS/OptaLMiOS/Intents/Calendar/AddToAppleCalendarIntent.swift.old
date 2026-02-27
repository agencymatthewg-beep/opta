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
        let eventKitService = EventKitService.shared

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
