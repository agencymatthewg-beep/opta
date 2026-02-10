import AppIntents
import SwiftUI

// MARK: - Log Workout Intent

struct LogWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Workout"
    static var description = IntentDescription("Log a workout to Apple Health via Opta")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Workout Type", default: .run)
    var workoutType: WorkoutTypeEntity

    @Parameter(title: "Duration (minutes)")
    var durationMinutes: Int

    @Parameter(title: "Calories Burned")
    var calories: Double?

    @Parameter(title: "Distance (km)")
    var distance: Double?

    @Parameter(title: "Start Time")
    var startTime: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$workoutType) for \(\.$durationMinutes) minutes") {
            \.$calories
            \.$distance
            \.$startTime
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared; if false {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health service is not available."])
        }

        // Request Health write access
        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health access is required. Please enable it in Settings → Privacy → Health."])
        }

        // Use provided start time or default to now
        let workoutStartTime = startTime ?? Date()
        let duration = TimeInterval(durationMinutes * 60)

        // Log workout to HealthKit
        do {
            try await healthService.logWorkout(
                type: workoutType.rawValue,
                startDate: workoutStartTime,
                duration: duration,
                calories: calories,
                distance: distance
            )

            // Haptic feedback
            HapticManager.shared.notification(.success)

            // Generate response
            var response = "Logged \(workoutType.displayName) for \(durationMinutes) minutes"

            if let cal = calories {
                response += ", \(Int(cal)) calories burned"
            }

            if let dist = distance {
                response += ", \(String(format: "%.2f", dist)) km"
            }

            response += "."

            return .result(
                dialog: IntentDialog(stringLiteral: response),
                view: WorkoutLogSnippetView(
                    workoutType: workoutType,
                    duration: durationMinutes,
                    calories: calories,
                    distance: distance,
                    startTime: workoutStartTime
                )
            )

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to log workout: \(error.localizedDescription)"])
        }
    }
}

// MARK: - Workout Type Entity

enum WorkoutTypeEntity: String, AppEnum {
    case run = "running"
    case walk = "walking"
    case cycle = "cycling"
    case swim = "swimming"
    case yoga = "yoga"
    case strength = "strength training"
    case hiit = "HIIT"
    case dance = "dance"
    case sports = "sports"
    case other = "other"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Workout Type")

    static var caseDisplayRepresentations: [WorkoutTypeEntity: DisplayRepresentation] = [
        .run: DisplayRepresentation(title: "Running", image: .init(systemName: "figure.run")),
        .walk: DisplayRepresentation(title: "Walking", image: .init(systemName: "figure.walk")),
        .cycle: DisplayRepresentation(title: "Cycling", image: .init(systemName: "bicycle")),
        .swim: DisplayRepresentation(title: "Swimming", image: .init(systemName: "figure.pool.swim")),
        .yoga: DisplayRepresentation(title: "Yoga", image: .init(systemName: "figure.mind.and.body")),
        .strength: DisplayRepresentation(title: "Strength Training", image: .init(systemName: "dumbbell")),
        .hiit: DisplayRepresentation(title: "HIIT", image: .init(systemName: "bolt.heart")),
        .dance: DisplayRepresentation(title: "Dance", image: .init(systemName: "figure.dance")),
        .sports: DisplayRepresentation(title: "Sports", image: .init(systemName: "sportscourt")),
        .other: DisplayRepresentation(title: "Other", image: .init(systemName: "figure.mixed.cardio"))
    ]

    var displayName: String {
        switch self {
        case .run: return "a run"
        case .walk: return "a walk"
        case .cycle: return "a cycling session"
        case .swim: return "a swim"
        case .yoga: return "yoga"
        case .strength: return "strength training"
        case .hiit: return "a HIIT workout"
        case .dance: return "dancing"
        case .sports: return "sports"
        case .other: return "a workout"
        }
    }

    var icon: String {
        switch self {
        case .run: return "figure.run"
        case .walk: return "figure.walk"
        case .cycle: return "bicycle"
        case .swim: return "figure.pool.swim"
        case .yoga: return "figure.mind.and.body"
        case .strength: return "dumbbell"
        case .hiit: return "bolt.heart"
        case .dance: return "figure.dance"
        case .sports: return "sportscourt"
        case .other: return "figure.mixed.cardio"
        }
    }

    var color: Color {
        switch self {
        case .run: return .green
        case .walk: return .blue
        case .cycle: return .orange
        case .swim: return .cyan
        case .yoga: return .purple
        case .strength: return .red
        case .hiit: return .pink
        case .dance: return .indigo
        case .sports: return .yellow
        case .other: return .gray
        }
    }
}

// MARK: - Workout Log Snippet View

struct WorkoutLogSnippetView: View {
    let workoutType: WorkoutTypeEntity
    let duration: Int
    let calories: Double?
    let distance: Double?
    let startTime: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: workoutType.icon)
                    .foregroundColor(workoutType.color)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Workout Logged")
                        .font(.headline)
                    Text(workoutType.displayName.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            }

            // Workout details
            VStack(spacing: 12) {
                WorkoutDetailRow(
                    icon: "clock.fill",
                    label: "Duration",
                    value: formatDuration(duration),
                    color: .blue
                )

                if let cal = calories {
                    WorkoutDetailRow(
                        icon: "flame.fill",
                        label: "Calories",
                        value: "\(Int(cal)) kcal",
                        color: .red
                    )
                }

                if let dist = distance {
                    WorkoutDetailRow(
                        icon: "location.fill",
                        label: "Distance",
                        value: String(format: "%.2f km", dist),
                        color: .green
                    )
                }

                WorkoutDetailRow(
                    icon: "calendar",
                    label: "Started",
                    value: formatStartTime(startTime),
                    color: .purple
                )
            }

            // Success message
            HStack {
                Image(systemName: "heart.fill")
                    .foregroundColor(.pink)
                Text("Added to Apple Health")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.pink.opacity(0.1))
            .cornerRadius(6)
        }
        .padding()
    }

    private func formatDuration(_ minutes: Int) -> String {
        if minutes >= 60 {
            let hours = minutes / 60
            let mins = minutes % 60
            if mins > 0 {
                return "\(hours)h \(mins)m"
            } else {
                return "\(hours) hour\(hours == 1 ? "" : "s")"
            }
        } else {
            return "\(minutes) min"
        }
    }

    private func formatStartTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        if Calendar.current.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
            return "Today at \(formatter.string(from: date))"
        } else if Calendar.current.isDateInYesterday(date) {
            formatter.dateFormat = "h:mm a"
            return "Yesterday at \(formatter.string(from: date))"
        } else {
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
    }
}

// MARK: - Workout Detail Row Component

struct WorkoutDetailRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)

            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Extended HealthService

extension HealthService {
    func logWorkout(
        type: String,
        startDate: Date,
        duration: TimeInterval,
        calories: Double?,
        distance: Double?
    ) async throws {
        // Stub implementation
        // Phase 3 will implement: Create HKWorkout and save to HealthStore
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health workout logging not yet implemented"])
    }
}
