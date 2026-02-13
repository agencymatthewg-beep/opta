import SwiftUI

struct SyncStatusView: View {
    @StateObject private var viewModel = SyncStatusViewModel()
    @State private var showClearConfirmation = false

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Stats Header
                statsHeader
                    .padding()
                    .background(Color.optaGlassBackground)

                // Sync History List
                if viewModel.isLoading {
                    loadingView
                } else if viewModel.syncHistory.isEmpty {
                    emptyState
                } else {
                    syncHistoryList
                }
            }
        }
        .navigationTitle("Sync History")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }

                    Divider()

                    Button(role: .destructive) {
                        showClearConfirmation = true
                    } label: {
                        Label("Clear History", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundColor(.optaTextSecondary)
                }
            }
        }
        .confirmationDialog("Clear Sync History", isPresented: $showClearConfirmation) {
            Button("Clear All History", role: .destructive) {
                HapticManager.shared.notification(.warning)
                viewModel.clearHistory()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will remove all sync history records. This action cannot be undone.")
        }
        .task {
            await viewModel.loadHistory()
        }
    }

    // MARK: - Stats Header

    private var statsHeader: some View {
        VStack(spacing: 16) {
            // Title
            HStack {
                Text("Today's Sync Activity")
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)

                Spacer()

                if viewModel.isLoading {
                    ProgressView()
                        .tint(.optaPrimary)
                }
            }

            // Stats Grid
            HStack(spacing: 12) {
                StatBadge(
                    value: "\(viewModel.todayStats.totalSyncs)",
                    label: "Total",
                    icon: "arrow.triangle.2.circlepath",
                    color: .optaNeonBlue
                )

                StatBadge(
                    value: "\(viewModel.todayStats.successCount)",
                    label: "Success",
                    icon: "checkmark.circle",
                    color: .optaNeonGreen
                )

                StatBadge(
                    value: "\(viewModel.todayStats.errorCount)",
                    label: "Errors",
                    icon: "exclamationmark.triangle",
                    color: .optaNeonRed
                )

                StatBadge(
                    value: "\(viewModel.todayStats.conflictsResolved)",
                    label: "Conflicts",
                    icon: "exclamationmark.arrow.triangle.2.circlepath",
                    color: .optaNeonAmber
                )
            }
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                SkeletonView(width: UIScreen.main.bounds.width - 40, height: 80)
                    .padding(.horizontal)
            }
            Spacer()
        }
        .padding(.top)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)

            Text("No Sync History")
                .font(.headline)
                .foregroundColor(.optaTextPrimary)

            Text("Your sync operations will appear here")
                .font(.subheadline)
                .foregroundColor(.optaTextMuted)

            Spacer()
        }
    }

    // MARK: - Sync History List

    private var syncHistoryList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.syncHistory) { record in
                    SyncRecordRow(record: record)
                        .transition(.asymmetric(
                            insertion: .move(edge: .leading).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                }
            }
            .padding()
        }
    }
}

// MARK: - Stat Badge

struct StatBadge: View {
    let value: String
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(color)

            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundColor(color)

            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Sync Record Row

struct SyncRecordRow: View {
    let record: SyncRecord
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Main Row
            Button {
                withAnimation(.spring(response: 0.3)) {
                    isExpanded.toggle()
                }
                HapticManager.shared.impact(.light)
            } label: {
                HStack(spacing: 12) {
                    // Status Icon
                    ZStack {
                        Circle()
                            .fill(statusColor.opacity(0.2))
                            .frame(width: 40, height: 40)

                        Image(systemName: statusIcon)
                            .font(.caption)
                            .foregroundColor(statusColor)
                    }

                    // Content
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(record.source.displayName)
                                .font(.subheadline.bold())
                                .foregroundColor(.optaTextPrimary)

                            Spacer()

                            Text(record.timestamp.formatted(date: .omitted, time: .shortened))
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }

                        HStack(spacing: 8) {
                            Text(record.status.displayName)
                                .font(.caption)
                                .foregroundColor(statusColor)

                            Text("•")
                                .foregroundColor(.optaTextMuted)

                            Text(record.durationString)
                                .font(.caption)
                                .foregroundColor(.optaTextSecondary)

                            if record.itemsProcessed > 0 {
                                Text("•")
                                    .foregroundColor(.optaTextMuted)

                                Text("\(record.itemsProcessed) items")
                                    .font(.caption)
                                    .foregroundColor(.optaTextSecondary)
                            }
                        }
                    }

                    // Expand Indicator
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding()
            }

            // Expanded Details
            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    Divider()
                        .background(Color.optaGlassBorder)

                    if let error = record.errorMessage {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.optaNeonRed)

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Error Details")
                                    .font(.caption.bold())
                                    .foregroundColor(.optaTextPrimary)

                                Text(error)
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Metrics
                    VStack(spacing: 8) {
                        MetricRow(label: "Items Added", value: "\(record.itemsAdded)")
                        MetricRow(label: "Items Updated", value: "\(record.itemsUpdated)")
                        MetricRow(label: "Items Deleted", value: "\(record.itemsDeleted)")

                        if record.conflictsResolved > 0 {
                            MetricRow(
                                label: "Conflicts Resolved",
                                value: "\(record.conflictsResolved)",
                                highlight: true
                            )
                        }
                    }
                    .padding(.horizontal)

                    // Timestamp
                    Text("Completed at \(record.timestamp.formatted(date: .abbreviated, time: .complete))")
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                        .padding(.horizontal)
                }
                .padding(.bottom, 12)
                .transition(.opacity)
            }
        }
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(statusColor.opacity(0.3), lineWidth: 1)
        )
    }

    private var statusIcon: String {
        switch record.status {
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        case .inProgress:
            return "arrow.triangle.2.circlepath"
        case .conflicted:
            return "exclamationmark.arrow.triangle.2.circlepath"
        }
    }

    private var statusColor: Color {
        switch record.status {
        case .success:
            return .optaNeonGreen
        case .error:
            return .optaNeonRed
        case .inProgress:
            return .optaNeonBlue
        case .conflicted:
            return .optaNeonAmber
        }
    }
}

struct MetricRow: View {
    let label: String
    let value: String
    var highlight: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.optaTextSecondary)

            Spacer()

            Text(value)
                .font(.caption.bold().monospacedDigit())
                .foregroundColor(highlight ? .optaNeonAmber : .optaTextPrimary)
        }
    }
}

// MARK: - Models

struct SyncRecord: Identifiable, Codable {
    let id: UUID
    let timestamp: Date
    let source: SyncSource
    let status: SyncRecordStatus
    let duration: TimeInterval
    let itemsProcessed: Int
    let itemsAdded: Int
    let itemsUpdated: Int
    let itemsDeleted: Int
    let conflictsResolved: Int
    let errorMessage: String?

    var durationString: String {
        if duration < 1 {
            return "<1s"
        } else if duration < 60 {
            return "\(Int(duration))s"
        } else {
            let minutes = Int(duration / 60)
            let seconds = Int(duration.truncatingRemainder(dividingBy: 60))
            return "\(minutes)m \(seconds)s"
        }
    }
}

enum SyncSource: String, Codable {
    case calendar
    case reminders
    case todoist
    case health

    var displayName: String {
        switch self {
        case .calendar: return "Apple Calendar"
        case .reminders: return "Apple Reminders"
        case .todoist: return "Todoist"
        case .health: return "Apple Health"
        }
    }
}

enum SyncRecordStatus: String, Codable {
    case success
    case error
    case inProgress
    case conflicted

    var displayName: String {
        switch self {
        case .success: return "Success"
        case .error: return "Failed"
        case .inProgress: return "In Progress"
        case .conflicted: return "Conflicts"
        }
    }
}

struct SyncStats {
    var totalSyncs: Int = 0
    var successCount: Int = 0
    var errorCount: Int = 0
    var conflictsResolved: Int = 0
}

// MARK: - View Model

@MainActor
class SyncStatusViewModel: ObservableObject {
    @Published var syncHistory: [SyncRecord] = []
    @Published var todayStats = SyncStats()
    @Published var isLoading = false

    func loadHistory() async {
        isLoading = true
        defer { isLoading = false }

        // Simulate loading from persistence
        try? await Task.sleep(nanoseconds: 500_000_000)

        // Generate sample data
        syncHistory = generateSampleHistory()
        calculateTodayStats()
    }

    func refresh() async {
        await loadHistory()
    }

    func clearHistory() {
        withAnimation {
            syncHistory = []
            todayStats = SyncStats()
        }

        // Would also clear from persistence
        HapticManager.shared.notification(.success)
    }

    private func calculateTodayStats() {
        let today = Calendar.current.startOfDay(for: Date())
        let todayRecords = syncHistory.filter {
            Calendar.current.isDate($0.timestamp, inSameDayAs: today)
        }

        todayStats = SyncStats(
            totalSyncs: todayRecords.count,
            successCount: todayRecords.filter { $0.status == .success }.count,
            errorCount: todayRecords.filter { $0.status == .error }.count,
            conflictsResolved: todayRecords.reduce(0) { $0 + $1.conflictsResolved }
        )
    }

    private func generateSampleHistory() -> [SyncRecord] {
        var records: [SyncRecord] = []

        // Today's syncs
        records.append(SyncRecord(
            id: UUID(),
            timestamp: Date().addingTimeInterval(-3600),
            source: .calendar,
            status: .success,
            duration: 2.3,
            itemsProcessed: 15,
            itemsAdded: 2,
            itemsUpdated: 5,
            itemsDeleted: 0,
            conflictsResolved: 0,
            errorMessage: nil
        ))

        records.append(SyncRecord(
            id: UUID(),
            timestamp: Date().addingTimeInterval(-7200),
            source: .todoist,
            status: .success,
            duration: 1.8,
            itemsProcessed: 23,
            itemsAdded: 4,
            itemsUpdated: 8,
            itemsDeleted: 1,
            conflictsResolved: 1,
            errorMessage: nil
        ))

        records.append(SyncRecord(
            id: UUID(),
            timestamp: Date().addingTimeInterval(-10800),
            source: .reminders,
            status: .error,
            duration: 0.5,
            itemsProcessed: 0,
            itemsAdded: 0,
            itemsUpdated: 0,
            itemsDeleted: 0,
            conflictsResolved: 0,
            errorMessage: "Failed to access Reminders. Permission may have been revoked."
        ))

        records.append(SyncRecord(
            id: UUID(),
            timestamp: Date().addingTimeInterval(-14400),
            source: .health,
            status: .success,
            duration: 3.1,
            itemsProcessed: 7,
            itemsAdded: 7,
            itemsUpdated: 0,
            itemsDeleted: 0,
            conflictsResolved: 0,
            errorMessage: nil
        ))

        // Yesterday's syncs
        records.append(SyncRecord(
            id: UUID(),
            timestamp: Date().addingTimeInterval(-86400),
            source: .calendar,
            status: .success,
            duration: 2.1,
            itemsProcessed: 18,
            itemsAdded: 3,
            itemsUpdated: 7,
            itemsDeleted: 2,
            conflictsResolved: 0,
            errorMessage: nil
        ))

        return records.sorted { $0.timestamp > $1.timestamp }
    }
}

#Preview {
    NavigationStack {
        SyncStatusView()
    }
}
