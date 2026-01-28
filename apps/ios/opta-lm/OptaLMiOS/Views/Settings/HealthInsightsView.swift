import SwiftUI
import Charts

// MARK: - Health Insights View

struct HealthInsightsView: View {
    @StateObject private var viewModel = HealthInsightsViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Authorization status
                        if !viewModel.isAuthorized {
                            authorizationPrompt
                                .slideIn(delay: 0.1)
                        } else {
                            // Sleep quality card
                            if let sleepData = viewModel.todaySleep {
                                SleepQualityCard(data: sleepData)
                                    .slideIn(delay: 0.1)
                            } else if viewModel.isLoadingSleep {
                                LoadingCard(title: "Sleep Data")
                                    .slideIn(delay: 0.1)
                            }

                            // Activity summary card
                            if let activityData = viewModel.todayActivity {
                                ActivitySummaryCard(data: activityData)
                                    .slideIn(delay: 0.2)
                            } else if viewModel.isLoadingActivity {
                                LoadingCard(title: "Activity Data")
                                    .slideIn(delay: 0.2)
                            }

                            // Productivity correlation
                            if let insights = viewModel.productivityInsights {
                                ProductivityCorrelationCard(insights: insights)
                                    .slideIn(delay: 0.3)

                                RecommendationsCard(recommendations: insights.recommendations)
                                    .slideIn(delay: 0.4)
                            } else if viewModel.isLoadingInsights {
                                LoadingCard(title: "Productivity Insights")
                                    .slideIn(delay: 0.3)
                            }
                        }

                        // Privacy notice
                        privacyNotice
                            .slideIn(delay: 0.5)
                    }
                    .padding()
                }

                // Error banner
                if let error = viewModel.error {
                    VStack {
                        Spacer()
                        ErrorBanner(
                            message: error,
                            onDismiss: { viewModel.error = nil },
                            onRetry: { Task { await viewModel.refresh() } }
                        )
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            }
            .navigationTitle("Health Insights")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        HapticManager.shared.impact(.light)
                        dismiss()
                    }
                    .foregroundColor(.optaPrimary)
                }
            }
            .refreshable {
                HapticManager.shared.impact(.light)
                await viewModel.refresh()
            }
        }
        .task {
            await viewModel.loadData()
        }
    }

    // MARK: - Authorization Prompt

    private var authorizationPrompt: some View {
        VStack(spacing: 20) {
            Image(systemName: "heart.text.square.fill")
                .font(.system(size: 64))
                .foregroundColor(.optaNeonCyan)
                .optaGlow(.optaNeonCyan, radius: 20)

            Text("Connect Apple Health")
                .font(.title2.bold())
                .foregroundColor(.optaTextPrimary)

            Text("Opta uses your sleep and activity data to provide insights that help you optimize your productivity. All analysis is done on-device and your health data never leaves your iPhone.")
                .font(.subheadline)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button {
                HapticManager.shared.impact(.medium)
                Task {
                    await viewModel.requestAuthorization()
                }
            } label: {
                HStack {
                    Image(systemName: "lock.shield.fill")
                    Text("Grant Access")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: [.optaNeonCyan, .optaPrimary],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(12)
                .optaGlow(.optaNeonCyan, radius: 10)
            }
            .padding(.horizontal)
        }
        .frame(maxWidth: .infinity)
        .padding(30)
        .glassPanel()
    }

    // MARK: - Privacy Notice

    private var privacyNotice: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "lock.shield.fill")
                    .foregroundColor(.optaNeonCyan)
                Text("Privacy Guaranteed")
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)
            }

            Text("• All health analysis is performed on your device\n• Health data is never sent to our servers\n• Siri responses are intentionally vague to protect your privacy\n• Detailed data is only visible within this app")
                .font(.caption)
                .foregroundColor(.optaTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.optaNeonCyan.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaNeonCyan.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Sleep Quality Card

struct SleepQualityCard: View {
    let data: SleepData

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sleep Quality")
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)

                    Text(data.date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()

                Text(data.qualityEmoji)
                    .font(.system(size: 44))
            }

            // Total hours
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(String(format: "%.1f", data.totalHours))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(data.quality.color), Color(data.quality.color).opacity(0.7)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                Text("hours")
                    .font(.title3)
                    .foregroundColor(.optaTextMuted)
            }

            // Quality indicator
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(data.quality.color))
                    .frame(width: 8, height: 8)
                    .optaGlow(Color(data.quality.color), radius: 5)

                Text(data.quality.displayName)
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)

                Spacer()

                if let bedTime = data.bedTime, let wakeTime = data.wakeTime {
                    Text("\(bedTime.formatted(date: .omitted, time: .shortened)) - \(wakeTime.formatted(date: .omitted, time: .shortened))")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }

            Divider()
                .background(Color.optaGlassBorder)

            // Sleep stages
            VStack(spacing: 12) {
                Text("Sleep Stages")
                    .font(.subheadline.bold())
                    .foregroundColor(.optaTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                SleepStagesChart(stages: data.stages)
                    .frame(height: 120)

                HStack(spacing: 20) {
                    StageLegend(label: "REM", hours: data.stages.rem, percentage: data.stages.remPercentage, color: .optaNeonCyan)
                    StageLegend(label: "Deep", hours: data.stages.deep, percentage: data.stages.deepPercentage, color: .optaPrimary)
                    StageLegend(label: "Light", hours: data.stages.light, percentage: data.stages.lightPercentage, color: .optaNeonBlue)
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

// MARK: - Sleep Stages Chart

struct SleepStagesChart: View {
    let stages: SleepStages

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // REM
                if stages.rem > 0 {
                    Rectangle()
                        .fill(Color.optaNeonCyan.opacity(0.8))
                        .frame(width: geometry.size.width * (stages.remPercentage / 100))
                }

                // Deep
                if stages.deep > 0 {
                    Rectangle()
                        .fill(Color.optaPrimary.opacity(0.8))
                        .frame(width: geometry.size.width * (stages.deepPercentage / 100))
                }

                // Light
                if stages.light > 0 {
                    Rectangle()
                        .fill(Color.optaNeonBlue.opacity(0.8))
                        .frame(width: geometry.size.width * (stages.lightPercentage / 100))
                }
            }
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
        }
    }
}

struct StageLegend: View {
    let label: String
    let hours: Double
    let percentage: Double
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)

                Text(label)
                    .font(.caption2)
                    .foregroundColor(.optaTextMuted)
            }

            Text(String(format: "%.1fh", hours))
                .font(.caption.bold())
                .foregroundColor(.optaTextPrimary)

            Text(String(format: "%.0f%%", percentage))
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Activity Summary Card

struct ActivitySummaryCard: View {
    let data: ActivityData

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Activity Summary")
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)

                    Text(data.date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()

                Text(data.activityLevel.emoji)
                    .font(.system(size: 44))
            }

            // Activity metrics
            HStack(spacing: 16) {
                ActivityMetric(
                    icon: "figure.walk",
                    value: "\(data.steps.formatted())",
                    label: "Steps",
                    color: .optaNeonGreen
                )

                Divider()
                    .frame(height: 50)
                    .background(Color.optaGlassBorder)

                ActivityMetric(
                    icon: "flame.fill",
                    value: "\(Int(data.activeEnergyBurned))",
                    label: "kcal",
                    color: .optaNeonAmber
                )

                Divider()
                    .frame(height: 50)
                    .background(Color.optaGlassBorder)

                ActivityMetric(
                    icon: "timer",
                    value: "\(data.activeMinutes)",
                    label: "mins",
                    color: .optaNeonCyan
                )
            }

            // Activity level
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(data.activityLevel.color))
                    .frame(width: 8, height: 8)
                    .optaGlow(Color(data.activityLevel.color), radius: 5)

                Text("\(data.activityLevel.displayName) Activity")
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
            }

            // Workouts
            if !data.workouts.isEmpty {
                Divider()
                    .background(Color.optaGlassBorder)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Workouts Today")
                        .font(.subheadline.bold())
                        .foregroundColor(.optaTextSecondary)

                    ForEach(data.workouts) { workout in
                        WorkoutRow(workout: workout)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

struct ActivityMetric: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)

            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundColor(.optaTextPrimary)

            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

struct WorkoutRow: View {
    let workout: WorkoutSummary

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.optaNeonGreen)
                .frame(width: 6, height: 6)

            VStack(alignment: .leading, spacing: 2) {
                Text(workout.displayName)
                    .font(.subheadline)
                    .foregroundColor(.optaTextPrimary)

                Text("\(workout.durationMinutes) min • \(Int(workout.energyBurned)) kcal")
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Productivity Correlation Card

struct ProductivityCorrelationCard: View {
    let insights: ProductivityInsights

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                Text("Productivity Correlation")
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)

                Text(insights.summary)
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Correlation strength indicator
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(insights.correlationStrength.color))
                    .frame(width: 8, height: 8)
                    .optaGlow(Color(insights.correlationStrength.color), radius: 5)

                Text("\(insights.correlationStrength.displayName) Correlation")
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)

                Spacer()

                Text("r = \(String(format: "%.2f", insights.correlationCoefficient))")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(.optaTextMuted)
            }

            // Chart
            if !insights.correlationData.isEmpty {
                CorrelationChart(data: insights.correlationData)
                    .frame(height: 200)
            }

            // Statistics
            HStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text(String(format: "%.1f h", insights.averageSleepHours))
                        .font(.title3.bold().monospacedDigit())
                        .foregroundColor(.optaNeonCyan)

                    Text("Avg Sleep")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)

                Divider()
                    .frame(height: 40)
                    .background(Color.optaGlassBorder)

                VStack(spacing: 4) {
                    Text(String(format: "%.0f%%", insights.averageTaskCompletionRate))
                        .font(.title3.bold().monospacedDigit())
                        .foregroundColor(.optaNeonGreen)

                    Text("Completion")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)

                Divider()
                    .frame(height: 40)
                    .background(Color.optaGlassBorder)

                VStack(spacing: 4) {
                    Text("\(String(format: "%.1f", insights.optimalSleepRange.lowerBound))-\(String(format: "%.1f", insights.optimalSleepRange.upperBound))h")
                        .font(.title3.bold().monospacedDigit())
                        .foregroundColor(.optaPrimary)

                    Text("Optimal")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .glassPanel()
    }
}

// MARK: - Correlation Chart

struct CorrelationChart: View {
    let data: [ProductivityCorrelationPoint]

    var body: some View {
        Chart {
            ForEach(data) { point in
                LineMark(
                    x: .value("Sleep", point.sleepHours),
                    y: .value("Completion", point.taskCompletionRate)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [.optaNeonCyan, .optaPrimary],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineStyle(StrokeStyle(lineWidth: 2))

                PointMark(
                    x: .value("Sleep", point.sleepHours),
                    y: .value("Completion", point.taskCompletionRate)
                )
                .foregroundStyle(Color.optaPrimary)
                .symbolSize(50)
            }
        }
        .chartXAxis {
            AxisMarks(position: .bottom) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.optaGlassBorder)
                AxisValueLabel()
                    .foregroundStyle(Color.optaTextMuted)
                    .font(.caption2)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.optaGlassBorder)
                AxisValueLabel()
                    .foregroundStyle(Color.optaTextMuted)
                    .font(.caption2)
            }
        }
        .chartXAxisLabel("Sleep Hours", alignment: .center)
        .chartYAxisLabel("Task Completion %", alignment: .center)
    }
}

// MARK: - Recommendations Card

struct RecommendationsCard: View {
    let recommendations: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(.optaNeonAmber)
                Text("Recommendations")
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)
            }

            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(recommendations.enumerated()), id: \.offset) { index, recommendation in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1)")
                            .font(.caption.bold())
                            .foregroundColor(.optaNeonAmber)
                            .frame(width: 24, height: 24)
                            .background(Color.optaNeonAmber.opacity(0.2))
                            .cornerRadius(12)

                        Text(recommendation)
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

// MARK: - Loading Card

struct LoadingCard: View {
    let title: String

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(.optaPrimary)
                .scaleEffect(1.2)

            Text("Loading \(title)...")
                .font(.subheadline)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
        .glassPanel()
    }
}

// MARK: - View Model

@MainActor
class HealthInsightsViewModel: ObservableObject {
    @Published var todaySleep: SleepData?
    @Published var todayActivity: ActivityData?
    @Published var productivityInsights: ProductivityInsights?

    @Published var isAuthorized = false
    @Published var isLoadingSleep = false
    @Published var isLoadingActivity = false
    @Published var isLoadingInsights = false
    @Published var error: String?

    private let healthService = HealthService.shared

    func loadData() async {
        // Check authorization status
        isAuthorized = healthService.authorizationStatus.isAuthorized

        guard isAuthorized else { return }

        // Load all data in parallel
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadSleepData() }
            group.addTask { await self.loadActivityData() }
            group.addTask { await self.loadProductivityInsights() }
        }
    }

    func refresh() async {
        await loadData()
    }

    func requestAuthorization() async {
        let granted = await healthService.requestHealthAccess()
        isAuthorized = granted

        if granted {
            HapticManager.shared.notification(.success)
            await loadData()
        } else {
            HapticManager.shared.notification(.error)
            error = "Health access was denied. Please enable it in Settings."
        }
    }

    private func loadSleepData() async {
        isLoadingSleep = true
        defer { isLoadingSleep = false }

        do {
            todaySleep = try await healthService.fetchSleepData(for: Date())
        } catch {
            self.error = "Failed to load sleep data: \(error.localizedDescription)"
        }
    }

    private func loadActivityData() async {
        isLoadingActivity = true
        defer { isLoadingActivity = false }

        do {
            todayActivity = try await healthService.fetchActivityData(for: Date())
        } catch {
            self.error = "Failed to load activity data: \(error.localizedDescription)"
        }
    }

    private func loadProductivityInsights() async {
        isLoadingInsights = true
        defer { isLoadingInsights = false }

        do {
            // For demo purposes, pass empty tasks array
            // In production, fetch actual tasks from APIService or TaskSyncCoordinator
            let tasks: [OptaTask] = []
            productivityInsights = try await healthService.analyzeProductivityCorrelation(tasks: tasks, days: 30)
        } catch {
            // Don't show error for insights if there's insufficient data
            // self.error = "Failed to load productivity insights"
        }
    }
}

#Preview {
    HealthInsightsView()
}
