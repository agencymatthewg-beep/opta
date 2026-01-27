import Foundation
import HealthKit
import SwiftUI

// MARK: - Health Service

@MainActor
final class HealthService: ObservableObject {
    static let shared = HealthService()

    // MARK: - Published Properties

    @Published var authorizationStatus: HealthAuthorizationStatus = .notDetermined
    @Published var isHealthDataAvailable: Bool = false
    @Published var lastError: String?

    // MARK: - Private Properties

    private let healthStore = HKHealthStore()

    private init() {
        self.isHealthDataAvailable = HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - Health Types

    /// Health data types we want READ-ONLY access to
    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()

        // Sleep analysis
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleepType)
        }

        // Step count
        if let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
            types.insert(stepType)
        }

        // Active energy burned
        if let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            types.insert(energyType)
        }

        // Exercise time
        if let exerciseType = HKObjectType.quantityType(forIdentifier: .appleExerciseTime) {
            types.insert(exerciseType)
        }

        // Workouts
        if let workoutType = HKObjectType.workoutType() as? HKObjectType {
            types.insert(workoutType)
        }

        return types
    }

    // MARK: - Authorization

    /// Request READ-ONLY access to HealthKit data
    func requestHealthAccess() async -> Bool {
        guard isHealthDataAvailable else {
            await MainActor.run {
                self.authorizationStatus = .unavailable
                self.lastError = "Health data is not available on this device"
            }
            return false
        }

        do {
            // Request READ-ONLY access (no write types)
            try await healthStore.requestAuthorization(toShare: Set<HKSampleType>(), read: readTypes)

            // Check authorization status for each type
            let authorized = await checkAuthorizationStatus()

            await MainActor.run {
                self.authorizationStatus = authorized ? .sharingAuthorized : .sharingDenied
            }

            return authorized
        } catch {
            await MainActor.run {
                self.lastError = "Failed to request health access: \(error.localizedDescription)"
                self.authorizationStatus = .sharingDenied
            }
            return false
        }
    }

    /// Check if we have authorization for all required types
    private func checkAuthorizationStatus() async -> Bool {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            return false
        }

        let sleepStatus = healthStore.authorizationStatus(for: sleepType)
        let stepStatus = healthStore.authorizationStatus(for: stepType)

        return sleepStatus == .sharingAuthorized && stepStatus == .sharingAuthorized
    }

    // MARK: - Fetch Sleep Data

    /// Fetch sleep data for a specific date
    func fetchSleepData(for date: Date) async throws -> SleepData {
        guard isHealthDataAvailable else {
            throw HealthServiceError.unavailable
        }

        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthServiceError.invalidType
        }

        // Create date range (entire day)
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        // Query sleep samples
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)
        let samples = try await querySamples(type: sleepType, predicate: predicate)

        // Process sleep samples
        return processSleepSamples(samples, for: date)
    }

    /// Process sleep samples into SleepData
    private func processSleepSamples(_ samples: [HKCategorySample], for date: Date) -> SleepData {
        var remTime: TimeInterval = 0
        var deepTime: TimeInterval = 0
        var lightTime: TimeInterval = 0
        var awakeTime: TimeInterval = 0
        var bedTime: Date?
        var wakeTime: Date?

        // Sort samples by start date
        let sortedSamples = samples.sorted { $0.startDate < $1.startDate }

        // Track earliest bed time and latest wake time
        if let firstSample = sortedSamples.first {
            bedTime = firstSample.startDate
        }

        if let lastSample = sortedSamples.last {
            wakeTime = lastSample.endDate
        }

        // Process each sample
        for sample in sortedSamples {
            let duration = sample.endDate.timeIntervalSince(sample.startDate)

            // Map HKCategoryValueSleepAnalysis to stages
            if #available(iOS 16.0, *) {
                switch sample.value {
                case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                    remTime += duration
                case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                    deepTime += duration
                case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                    lightTime += duration
                case HKCategoryValueSleepAnalysis.awake.rawValue:
                    awakeTime += duration
                case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue:
                    // Distribute unspecified sleep proportionally
                    lightTime += duration * 0.6
                    deepTime += duration * 0.2
                    remTime += duration * 0.2
                default:
                    break
                }
            } else {
                // Fallback for older iOS versions
                switch sample.value {
                case HKCategoryValueSleepAnalysis.asleep.rawValue:
                    // Estimate sleep stages
                    lightTime += duration * 0.6
                    deepTime += duration * 0.2
                    remTime += duration * 0.2
                case HKCategoryValueSleepAnalysis.awake.rawValue:
                    awakeTime += duration
                default:
                    break
                }
            }
        }

        // Convert to hours
        let remHours = remTime / 3600
        let deepHours = deepTime / 3600
        let lightHours = lightTime / 3600
        let awakeHours = awakeTime / 3600

        let stages = SleepStages(rem: remHours, deep: deepHours, light: lightHours, awake: awakeHours)
        let totalHours = remHours + deepHours + lightHours

        // Calculate quality
        let quality = SleepQuality.from(totalHours: totalHours)

        return SleepData(
            date: date,
            totalHours: totalHours,
            quality: quality,
            stages: stages,
            bedTime: bedTime,
            wakeTime: wakeTime
        )
    }

    // MARK: - Fetch Activity Data

    /// Fetch activity data for a specific date
    func fetchActivityData(for date: Date) async throws -> ActivityData {
        guard isHealthDataAvailable else {
            throw HealthServiceError.unavailable
        }

        // Fetch steps
        let steps = try await fetchStepCount(for: date)

        // Fetch active energy burned
        let energy = try await fetchActiveEnergy(for: date)

        // Fetch active minutes
        let activeMinutes = try await fetchActiveMinutes(for: date)

        // Fetch workouts
        let workouts = try await fetchWorkouts(for: date)

        return ActivityData(
            date: date,
            steps: steps,
            activeEnergyBurned: energy,
            activeMinutes: activeMinutes,
            workouts: workouts
        )
    }

    /// Fetch step count for a date
    private func fetchStepCount(for date: Date) async throws -> Int {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthServiceError.invalidType
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let total = try await queryStatistics(
            type: stepType,
            predicate: predicate,
            option: .cumulativeSum
        )

        return Int(total)
    }

    /// Fetch active energy burned for a date
    private func fetchActiveEnergy(for date: Date) async throws -> Double {
        guard let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            throw HealthServiceError.invalidType
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let total = try await queryStatistics(
            type: energyType,
            predicate: predicate,
            option: .cumulativeSum
        )

        return total
    }

    /// Fetch active minutes for a date
    private func fetchActiveMinutes(for date: Date) async throws -> Int {
        guard let exerciseType = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime) else {
            throw HealthServiceError.invalidType
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let total = try await queryStatistics(
            type: exerciseType,
            predicate: predicate,
            option: .cumulativeSum
        )

        return Int(total)
    }

    /// Fetch workouts for a date
    private func fetchWorkouts(for date: Date) async throws -> [WorkoutSummary] {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let workouts = try await queryWorkouts(predicate: predicate)

        return workouts.map { workout in
            WorkoutSummary(
                type: workout.workoutActivityType.name,
                startDate: workout.startDate,
                endDate: workout.endDate,
                duration: workout.duration,
                energyBurned: workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
            )
        }
    }

    // MARK: - Productivity Correlation

    /// Analyze correlation between sleep/activity and task completion
    func analyzeProductivityCorrelation(tasks: [OptaTask], days: Int = 30) async throws -> ProductivityInsights {
        guard isHealthDataAvailable else {
            throw HealthServiceError.unavailable
        }

        let calendar = Calendar.current
        let today = Date()
        var correlationData: [ProductivityCorrelationPoint] = []

        // Fetch data for the past N days
        for dayOffset in 0..<days {
            guard let date = calendar.date(byAdding: .day, value: -dayOffset, to: today) else {
                continue
            }

            // Fetch sleep data
            let sleepData: SleepData
            do {
                sleepData = try await fetchSleepData(for: date)
            } catch {
                // Skip days without sleep data
                continue
            }

            // Filter tasks for this day
            let dayTasks = tasks.filter { task in
                guard let createdAt = task.createdAt else { return false }
                return calendar.isDate(createdAt, inSameDayAs: date)
            }

            guard !dayTasks.isEmpty else { continue }

            let completedCount = dayTasks.filter { $0.isCompleted }.count
            let totalCount = dayTasks.count
            let completionRate = (Double(completedCount) / Double(totalCount)) * 100

            let point = ProductivityCorrelationPoint(
                date: date,
                sleepHours: sleepData.totalHours,
                taskCompletionRate: completionRate,
                tasksCompleted: completedCount,
                tasksTotal: totalCount
            )

            correlationData.append(point)
        }

        // Sort by date (oldest first)
        correlationData.sort { $0.date < $1.date }

        // Calculate averages
        let avgSleep = correlationData.reduce(0) { $0 + $1.sleepHours } / Double(max(correlationData.count, 1))
        let avgCompletionRate = correlationData.reduce(0) { $0 + $1.taskCompletionRate } / Double(max(correlationData.count, 1))

        // Determine optimal sleep range (hours with highest completion rate)
        let optimalRange = calculateOptimalSleepRange(from: correlationData)

        // Generate recommendations
        let recommendations = generateRecommendations(
            averageSleep: avgSleep,
            averageCompletionRate: avgCompletionRate,
            optimalRange: optimalRange,
            correlationData: correlationData
        )

        return ProductivityInsights(
            correlationData: correlationData,
            averageSleepHours: avgSleep,
            averageTaskCompletionRate: avgCompletionRate,
            optimalSleepRange: optimalRange,
            recommendations: recommendations
        )
    }

    /// Calculate optimal sleep range based on productivity
    private func calculateOptimalSleepRange(from data: [ProductivityCorrelationPoint]) -> ClosedRange<Double> {
        guard !data.isEmpty else { return 7.0...9.0 }

        // Group by sleep hours (rounded to nearest 0.5h)
        var sleepGroups: [Double: [Double]] = [:]

        for point in data {
            let roundedSleep = round(point.sleepHours * 2) / 2
            sleepGroups[roundedSleep, default: []].append(point.taskCompletionRate)
        }

        // Find sleep duration with highest average completion rate
        let optimalSleep = sleepGroups.max { a, b in
            let avgA = a.value.reduce(0, +) / Double(a.value.count)
            let avgB = b.value.reduce(0, +) / Double(b.value.count)
            return avgA < avgB
        }?.key ?? 7.5

        // Return range ±0.5 hours
        let lowerBound = max(optimalSleep - 0.5, 6.0)
        let upperBound = min(optimalSleep + 0.5, 10.0)

        return lowerBound...upperBound
    }

    /// Generate personalized recommendations
    private func generateRecommendations(
        averageSleep: Double,
        averageCompletionRate: Double,
        optimalRange: ClosedRange<Double>,
        correlationData: [ProductivityCorrelationPoint]
    ) -> [String] {
        var recommendations: [String] = []

        // Sleep duration recommendation
        if averageSleep < optimalRange.lowerBound {
            let deficit = optimalRange.lowerBound - averageSleep
            recommendations.append("Try getting \(String(format: "%.1f", deficit)) more hours of sleep for optimal productivity.")
        } else if averageSleep > optimalRange.upperBound {
            recommendations.append("You're getting plenty of sleep. Focus on sleep quality over quantity.")
        } else {
            recommendations.append("Your sleep duration is in the optimal range. Keep it up!")
        }

        // Consistency recommendation
        let sleepVariance = calculateVariance(correlationData.map { $0.sleepHours })
        if sleepVariance > 1.5 {
            recommendations.append("Try to maintain a consistent sleep schedule for better results.")
        }

        // Productivity trend
        if averageCompletionRate < 60 {
            recommendations.append("Focus on prioritizing your most important tasks each day.")
        } else if averageCompletionRate >= 80 {
            recommendations.append("Excellent task completion rate! You're crushing it.")
        }

        // Activity recommendation (if we have activity data)
        if correlationData.count >= 7 {
            recommendations.append("Regular physical activity can improve both sleep quality and productivity.")
        }

        return recommendations
    }

    /// Calculate variance for a set of values
    private func calculateVariance(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }

        let mean = values.reduce(0, +) / Double(values.count)
        let squaredDiffs = values.map { pow($0 - mean, 2) }
        return squaredDiffs.reduce(0, +) / Double(values.count)
    }

    // MARK: - Query Helpers

    /// Query category samples (e.g., sleep analysis)
    private func querySamples(type: HKCategoryType, predicate: NSPredicate) async throws -> [HKCategorySample] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                let categorySamples = samples as? [HKCategorySample] ?? []
                continuation.resume(returning: categorySamples)
            }

            healthStore.execute(query)
        }
    }

    /// Query statistics (e.g., sum of steps)
    private func queryStatistics(type: HKQuantityType, predicate: NSPredicate, option: HKStatisticsOptions) async throws -> Double {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: option
            ) { _, statistics, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                let value: Double

                switch option {
                case .cumulativeSum:
                    if type.identifier == HKQuantityTypeIdentifier.stepCount.rawValue {
                        value = statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                    } else if type.identifier == HKQuantityTypeIdentifier.activeEnergyBurned.rawValue {
                        value = statistics?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                    } else {
                        value = statistics?.sumQuantity()?.doubleValue(for: .minute()) ?? 0
                    }

                default:
                    value = 0
                }

                continuation.resume(returning: value)
            }

            healthStore.execute(query)
        }
    }

    /// Query workouts
    private func queryWorkouts(predicate: NSPredicate) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                let workouts = samples as? [HKWorkout] ?? []
                continuation.resume(returning: workouts)
            }

            healthStore.execute(query)
        }
    }
}

// MARK: - Health Service Error

enum HealthServiceError: LocalizedError {
    case unavailable
    case unauthorized
    case invalidType
    case queryFailed

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Health data is not available on this device"
        case .unauthorized:
            return "Health data access not authorized"
        case .invalidType:
            return "Invalid health data type"
        case .queryFailed:
            return "Failed to query health data"
        }
    }
}

// MARK: - HKWorkoutActivityType Extension

extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .walking: return "Walking"
        case .swimming: return "Swimming"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining: return "Strength Training"
        case .traditionalStrengthTraining: return "Strength Training"
        case .elliptical: return "Elliptical"
        case .stairClimbing: return "Stair Climbing"
        case .rowing: return "Rowing"
        case .hiking: return "Hiking"
        case .dance: return "Dance"
        case .basketball: return "Basketball"
        case .soccer: return "Soccer"
        case .tennis: return "Tennis"
        case .golf: return "Golf"
        case .other: return "Other"
        default: return "Workout"
        }
    }
}
