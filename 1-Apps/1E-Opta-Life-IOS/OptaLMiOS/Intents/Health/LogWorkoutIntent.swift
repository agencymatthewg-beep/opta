import AppIntents
import SwiftUI
import HealthKit

// MARK: - Log Workout Intent

struct LogWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Workout"
    static var description = IntentDescription("Log a workout to Apple Health")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Workout Type", default: .run)
    var workoutType: WorkoutTypeEntity

    @Parameter(title: "Duration (minutes)")
    var durationMinutes: Int

    @Parameter(title: "Calories Burned")
    var calories: Double?

    @Parameter(title: "Distance (km)")
    var distanceKm: Double?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$workoutType) for \(\.$durationMinutes) minutes") {
            \.$calories
            \.$distanceKm
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared

        guard healthService.isHealthDataAvailable else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "Health data isn't available on this device.",
                view: WorkoutUnavailableSnippetView()
            )
        }

        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "I need health access to log workouts. Please enable in Settings.",
                view: WorkoutUnavailableSnippetView()
            )
        }

        let endDate = Date()
        let startDate = Calendar.current.date(byAdding: .minute, value: -durationMinutes, to: endDate)!

        // Build workout
        let config = HKWorkoutConfiguration()
        config.activityType = workoutType.hkType

        let builder = HKWorkoutBuilder(healthStore: HKHealthStore(), configuration: config, device: .local())

        do {
            try await builder.beginCollection(at: startDate)

            // Add energy burned if provided
            if let cals = calories, cals > 0 {
                let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
                let energyQuantity = HKQuantity(unit: .kilocalorie(), doubleValue: cals)
                let energySample = HKQuantitySample(type: energyType, quantity: energyQuantity, start: startDate, end: endDate)
                try await builder.addSamples([energySample])
            }

            // Add distance if provided
            if let dist = distanceKm, dist > 0 {
                let distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
                let distanceQuantity = HKQuantity(unit: .meterUnit(with: .kilo), doubleValue: dist)
                let distanceSample = HKQuantitySample(type: distanceType, quantity: distanceQuantity, start: startDate, end: endDate)
                try await builder.addSamples([distanceSample])
            }

            try await builder.endCollection(at: endDate)
            try await builder.finishWorkout()

            HapticManager.shared.notification(.success)

            return .result(
                dialog: "Logged your \(workoutType.displayName) workout! \(durationMinutes) minutes recorded.",
                view: WorkoutLoggedSnippetView(
                    type: workoutType,
                    minutes: durationMinutes,
                    calories: calories,
                    distanceKm: distanceKm
                )
            )
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "Failed to log workout: \(error.localizedDescription)",
                view: WorkoutUnavailableSnippetView()
            )
        }
    }
}

// MARK: - Workout Type Entity

enum WorkoutTypeEntity: String, AppEnum {
    case run = "run"
    case walk = "walk"
    case cycle = "cycle"
    case swim = "swim"
    case yoga = "yoga"
    case strength = "strength"
    case hiit = "hiit"
    case dance = "dance"
    case sports = "sports"
    case other = "other"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Workout Type")

    static var caseDisplayRepresentations: [WorkoutTypeEntity: DisplayRepresentation] = [
        .run: DisplayRepresentation(title: "Run", image: .init(systemName: "figure.run")),
        .walk: DisplayRepresentation(title: "Walk", image: .init(systemName: "figure.walk")),
        .cycle: DisplayRepresentation(title: "Cycle", image: .init(systemName: "bicycle")),
        .swim: DisplayRepresentation(title: "Swim", image: .init(systemName: "figure.pool.swim")),
        .yoga: DisplayRepresentation(title: "Yoga", image: .init(systemName: "figure.yoga")),
        .strength: DisplayRepresentation(title: "Strength", image: .init(systemName: "dumbbell.fill")),
        .hiit: DisplayRepresentation(title: "HIIT", image: .init(systemName: "bolt.heart.fill")),
        .dance: DisplayRepresentation(title: "Dance", image: .init(systemName: "figure.dance")),
        .sports: DisplayRepresentation(title: "Sports", image: .init(systemName: "sportscourt")),
        .other: DisplayRepresentation(title: "Other", image: .init(systemName: "figure.mixed.cardio"))
    ]

    var displayName: String {
        switch self {
        case .run: return "Run"
        case .walk: return "Walk"
        case .cycle: return "Cycle"
        case .swim: return "Swim"
        case .yoga: return "Yoga"
        case .strength: return "Strength Training"
        case .hiit: return "HIIT"
        case .dance: return "Dance"
        case .sports: return "Sports"
        case .other: return "Workout"
        }
    }

    var icon: String {
        switch self {
        case .run: return "figure.run"
        case .walk: return "figure.walk"
        case .cycle: return "bicycle"
        case .swim: return "figure.pool.swim"
        case .yoga: return "figure.yoga"
        case .strength: return "dumbbell.fill"
        case .hiit: return "bolt.heart.fill"
        case .dance: return "figure.dance"
        case .sports: return "sportscourt"
        case .other: return "figure.mixed.cardio"
        }
    }

    var color: Color {
        switch self {
        case .run: return .green
        case .walk: return .mint
        case .cycle: return .orange
        case .swim: return .blue
        case .yoga: return .purple
        case .strength: return .red
        case .hiit: return .pink
        case .dance: return .yellow
        case .sports: return .teal
        case .other: return .gray
        }
    }

    var hkType: HKWorkoutActivityType {
        switch self {
        case .run: return .running
        case .walk: return .walking
        case .cycle: return .cycling
        case .swim: return .swimming
        case .yoga: return .yoga
        case .strength: return .traditionalStrengthTraining
        case .hiit: return .highIntensityIntervalTraining
        case .dance: return .dance
        case .sports: return .mixedCardio
        case .other: return .other
        }
    }
}

// MARK: - Snippet Views

struct WorkoutLoggedSnippetView: View {
    let type: WorkoutTypeEntity
    let minutes: Int
    let calories: Double?
    let distanceKm: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: type.icon)
                    .foregroundColor(type.color)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(type.displayName)
                        .font(.headline)
                    Text("Workout Logged ✓")
                        .font(.caption)
                        .foregroundColor(.green)
                }
                Spacer()
                Text("\(minutes) min")
                    .font(.title3.bold())
                    .foregroundColor(type.color)
            }

            HStack(spacing: 16) {
                if let cals = calories {
                    WorkoutDetailRow(icon: "flame.fill", value: "\(Int(cals)) kcal", color: .orange)
                }
                if let dist = distanceKm {
                    WorkoutDetailRow(icon: "location.fill", value: String(format: "%.1f km", dist), color: .blue)
                }
            }
        }
        .padding()
    }
}

struct WorkoutDetailRow: View {
    let icon: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(color)
            Text(value)
                .font(.caption.bold())
        }
    }
}

struct WorkoutUnavailableSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.run")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("Workout logging unavailable")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
