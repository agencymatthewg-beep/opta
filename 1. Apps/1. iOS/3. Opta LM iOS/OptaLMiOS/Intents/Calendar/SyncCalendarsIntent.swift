import AppIntents
import SwiftUI

// MARK: - Sync Calendars Intent

struct SyncCalendarsIntent: AppIntent {
    static var title: LocalizedStringResource = "Sync Calendars"
    static var description = IntentDescription("Synchronize events between Opta backend and Apple Calendar")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Sync Direction", default: .bidirectional)
    var syncDirection: SyncDirectionEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Sync calendars \(\.$syncDirection)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        guard let calendarSyncService = try? CalendarSyncService() else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Calendar sync service is not available."])
        }

        // Request calendar access if needed
        if let eventKitService = EventKitService.shared {
            let hasAccess = await eventKitService.requestCalendarAccess()
            guard hasAccess else {
                throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Calendar access is required. Please enable it in Settings."])
            }
        }

        // Perform sync based on direction
        do {
            let result: SyncResult

            switch syncDirection {
            case .bidirectional:
                result = try await calendarSyncService.syncBidirectional()
            case .importFromApple:
                result = try await calendarSyncService.importFromAppleCalendar()
            case .exportToApple:
                result = try await calendarSyncService.exportToAppleCalendar()
            }

            // Haptic feedback
            if result.conflicts.isEmpty {
                HapticManager.shared.notification(.success)
            } else {
                HapticManager.shared.notification(.warning)
            }

            // Generate spoken response
            var spokenMessage = "Calendar sync complete. "
            if result.eventsAdded > 0 {
                spokenMessage += "Added \(result.eventsAdded) event\(result.eventsAdded == 1 ? "" : "s"). "
            }
            if result.eventsUpdated > 0 {
                spokenMessage += "Updated \(result.eventsUpdated) event\(result.eventsUpdated == 1 ? "" : "s"). "
            }
            if result.conflicts.count > 0 {
                spokenMessage += "Found \(result.conflicts.count) conflict\(result.conflicts.count == 1 ? "" : "s"). "
            }

            return .result(
                dialog: IntentDialog(stringLiteral: spokenMessage.trimmingCharacters(in: .whitespaces)),
                view: SyncResultSnippetView(result: result, direction: syncDirection)
            )

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Sync failed: \(error.localizedDescription)"])
        }
    }
}

// MARK: - Sync Direction Entity

enum SyncDirectionEntity: String, AppEnum {
    case bidirectional = "both ways"
    case importFromApple = "from Apple to Opta"
    case exportToApple = "from Opta to Apple"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sync Direction")

    static var caseDisplayRepresentations: [SyncDirectionEntity: DisplayRepresentation] = [
        .bidirectional: DisplayRepresentation(
            title: "Both Ways",
            subtitle: "Sync in both directions"
        ),
        .importFromApple: DisplayRepresentation(
            title: "Import from Apple",
            subtitle: "Apple Calendar → Opta"
        ),
        .exportToApple: DisplayRepresentation(
            title: "Export to Apple",
            subtitle: "Opta → Apple Calendar"
        )
    ]
}

// MARK: - Sync Result

struct SyncResult {
    let eventsAdded: Int
    let eventsUpdated: Int
    let eventsDeleted: Int
    let conflicts: [EventConflict]
    let syncDate: Date

    init(
        eventsAdded: Int = 0,
        eventsUpdated: Int = 0,
        eventsDeleted: Int = 0,
        conflicts: [EventConflict] = [],
        syncDate: Date = Date()
    ) {
        self.eventsAdded = eventsAdded
        self.eventsUpdated = eventsUpdated
        self.eventsDeleted = eventsDeleted
        self.conflicts = conflicts
        self.syncDate = syncDate
    }
}

// MARK: - Event Conflict

struct EventConflict: Identifiable {
    let id = UUID()
    let eventTitle: String
    let backendVersion: Date
    let appleVersion: Date
    let conflictType: ConflictType

    enum ConflictType {
        case timeConflict
        case contentConflict
        case deletionConflict
    }
}

// MARK: - Sync Result Snippet View

struct SyncResultSnippetView: View {
    let result: SyncResult
    let direction: SyncDirectionEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundColor(.blue)
                    .font(.title2)
                Text("Sync Complete")
                    .font(.headline)
                Spacer()
                Text(result.syncDate, style: .time)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Sync direction
            Text(directionDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Statistics
            VStack(spacing: 8) {
                if result.eventsAdded > 0 {
                    StatRow(
                        icon: "plus.circle.fill",
                        label: "Added",
                        value: "\(result.eventsAdded)",
                        color: .green
                    )
                }
                if result.eventsUpdated > 0 {
                    StatRow(
                        icon: "pencil.circle.fill",
                        label: "Updated",
                        value: "\(result.eventsUpdated)",
                        color: .blue
                    )
                }
                if result.eventsDeleted > 0 {
                    StatRow(
                        icon: "trash.circle.fill",
                        label: "Deleted",
                        value: "\(result.eventsDeleted)",
                        color: .red
                    )
                }
                if result.conflicts.count > 0 {
                    StatRow(
                        icon: "exclamationmark.triangle.fill",
                        label: "Conflicts",
                        value: "\(result.conflicts.count)",
                        color: .orange
                    )
                }
            }

            // Conflicts section
            if !result.conflicts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Conflicts Detected")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.orange)

                    ForEach(result.conflicts.prefix(3)) { conflict in
                        Text("• \(conflict.eventTitle)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if result.conflicts.count > 3 {
                        Text("+ \(result.conflicts.count - 3) more conflicts")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text("Open app to resolve conflicts")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .italic()
                }
                .padding(.top, 4)
            }

            // Summary
            if result.eventsAdded == 0 && result.eventsUpdated == 0 && result.eventsDeleted == 0 && result.conflicts.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Calendars are already in sync")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
    }

    private var directionDescription: String {
        switch direction {
        case .bidirectional:
            return "Synced both Opta and Apple Calendar"
        case .importFromApple:
            return "Imported from Apple Calendar to Opta"
        case .exportToApple:
            return "Exported from Opta to Apple Calendar"
        }
    }
}

// MARK: - Stat Row Component

struct StatRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 20)
            Text(label)
                .font(.subheadline)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Extended CalendarSyncService Stub

extension CalendarSyncService {
    func syncBidirectional() async throws -> SyncResult {
        // Stub implementation
        // Phase 1 will implement full bidirectional sync logic
        return SyncResult()
    }

    func importFromAppleCalendar() async throws -> SyncResult {
        // Stub implementation
        // Phase 1 will implement import logic
        return SyncResult()
    }

    func exportToAppleCalendar() async throws -> SyncResult {
        // Stub implementation
        // Phase 1 will implement export logic
        return SyncResult()
    }
}
