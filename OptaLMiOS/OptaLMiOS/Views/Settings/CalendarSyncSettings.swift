import SwiftUI

struct CalendarSyncSettings: View {
    @StateObject private var viewModel = CalendarSyncSettingsViewModel()
    @State private var showConflictResolution = false
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            List {
                // Sync Mode Section
                Section {
                    Picker("Sync Direction", selection: $viewModel.syncMode) {
                        ForEach(SyncMode.allCases, id: \.self) { mode in
                            HStack {
                                Image(systemName: mode.icon)
                                Text(mode.displayName)
                            }
                            .tag(mode)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.syncMode) { _, _ in
                        HapticManager.shared.selection()
                        viewModel.saveSyncMode()
                    }
                } header: {
                    Text("Sync Mode")
                } footer: {
                    Text(viewModel.syncMode.description)
                        .foregroundColor(.optaTextMuted)
                }

                // Sync Frequency Section
                Section {
                    Picker("Sync Frequency", selection: $viewModel.syncFrequency) {
                        ForEach(SyncFrequency.allCases, id: \.self) { frequency in
                            HStack {
                                Image(systemName: frequency.icon)
                                Text(frequency.displayName)
                            }
                            .tag(frequency)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.syncFrequency) { _, _ in
                        HapticManager.shared.selection()
                        viewModel.saveSyncFrequency()
                    }
                } header: {
                    Text("Automatic Sync")
                } footer: {
                    Text(viewModel.syncFrequency.description)
                        .foregroundColor(.optaTextMuted)
                }

                // Conflict Resolution Section
                Section {
                    Picker("Resolution Strategy", selection: $viewModel.conflictStrategy) {
                        ForEach(ConflictStrategy.allCases, id: \.self) { strategy in
                            HStack {
                                Image(systemName: strategy.icon)
                                Text(strategy.displayName)
                            }
                            .tag(strategy)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.conflictStrategy) { _, _ in
                        HapticManager.shared.selection()
                        viewModel.saveConflictStrategy()
                    }

                    if viewModel.hasUnresolvedConflicts {
                        Button {
                            HapticManager.shared.impact(.medium)
                            showConflictResolution = true
                        } label: {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.optaNeonAmber)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Resolve Conflicts")
                                        .foregroundColor(.optaTextPrimary)

                                    Text("\(viewModel.unresolvedConflictsCount) events need attention")
                                        .font(.caption)
                                        .foregroundColor(.optaTextMuted)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            }
                        }
                        .listRowBackground(Color.optaNeonAmber.opacity(0.1))
                    }
                } header: {
                    Text("Conflict Resolution")
                } footer: {
                    Text(viewModel.conflictStrategy.description)
                        .foregroundColor(.optaTextMuted)
                }

                // Sync Status Section
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Last Sync")
                                .font(.subheadline)
                                .foregroundColor(.optaTextSecondary)

                            if let lastSync = viewModel.lastSyncDate {
                                Text(lastSync.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            } else {
                                Text("Never")
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            }
                        }

                        Spacer()

                        HStack(spacing: 4) {
                            Image(systemName: viewModel.syncState.icon)
                                .font(.caption)
                            Text(viewModel.syncState.displayName)
                                .font(.caption)
                        }
                        .foregroundColor(syncStateColor)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(syncStateColor.opacity(0.15))
                        .cornerRadius(8)
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if let syncError = viewModel.syncError {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.optaNeonRed)

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Sync Error")
                                    .font(.subheadline)
                                    .foregroundColor(.optaTextPrimary)

                                Text(syncError)
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .listRowBackground(Color.optaNeonRed.opacity(0.1))
                    }

                    // Force Sync Button
                    Button {
                        HapticManager.shared.impact(.heavy)
                        Task {
                            await viewModel.forceSync()
                        }
                    } label: {
                        HStack {
                            Spacer()

                            if viewModel.isSyncing {
                                ProgressView()
                                    .tint(.optaPrimary)
                                Text("Syncing...")
                                    .foregroundColor(.optaTextSecondary)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .foregroundColor(.optaPrimary)
                                Text("Force Sync Now")
                                    .foregroundColor(.optaPrimary)
                                    .fontWeight(.semibold)
                            }

                            Spacer()
                        }
                    }
                    .listRowBackground(Color.optaPrimary.opacity(0.1))
                    .disabled(viewModel.isSyncing)
                } header: {
                    Text("Status")
                }

                // Advanced Settings Section
                Section {
                    Toggle(isOn: $viewModel.syncAllDayEvents) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Sync All-Day Events")
                                .foregroundColor(.optaTextPrimary)
                            Text("Include all-day events in sync")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.syncAllDayEvents) { _, _ in
                        HapticManager.shared.impact(.light)
                        viewModel.saveAdvancedSettings()
                    }

                    Toggle(isOn: $viewModel.syncPastEvents) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Sync Past Events")
                                .foregroundColor(.optaTextPrimary)
                            Text("Sync events from the past 30 days")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.syncPastEvents) { _, _ in
                        HapticManager.shared.impact(.light)
                        viewModel.saveAdvancedSettings()
                    }

                    Toggle(isOn: $viewModel.notifyOnConflicts) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Notify on Conflicts")
                                .foregroundColor(.optaTextPrimary)
                            Text("Get notified when conflicts are detected")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                    .onChange(of: viewModel.notifyOnConflicts) { _, _ in
                        HapticManager.shared.impact(.light)
                        viewModel.saveAdvancedSettings()
                    }
                } header: {
                    Text("Advanced")
                }
            }
            .scrollContentBackground(.hidden)

            // Success Toast
            if let message = viewModel.toastMessage {
                VStack {
                    Spacer()
                    SuccessToast(message: message)
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        withAnimation {
                            viewModel.toastMessage = nil
                        }
                    }
                }
            }
        }
        .navigationTitle("Calendar Sync")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showConflictResolution) {
            ConflictResolutionView(conflicts: viewModel.unresolvedConflicts) {
                viewModel.loadConflicts()
            }
        }
        .task {
            await viewModel.loadSettings()
        }
    }

    private var syncStateColor: Color {
        switch viewModel.syncState {
        case .idle:
            return .optaTextMuted
        case .syncing:
            return .optaNeonBlue
        case .success:
            return .optaNeonGreen
        case .error, .conflicted:
            return .optaNeonRed
        }
    }
}

// MARK: - Enums

enum SyncMode: String, CaseIterable, Codable {
    case twoWay = "two_way"
    case oneWayToApple = "one_way_to_apple"
    case oneWayFromApple = "one_way_from_apple"

    var displayName: String {
        switch self {
        case .twoWay: return "Two-Way Sync"
        case .oneWayToApple: return "Opta → Apple"
        case .oneWayFromApple: return "Apple → Opta"
        }
    }

    var icon: String {
        switch self {
        case .twoWay: return "arrow.left.arrow.right"
        case .oneWayToApple: return "arrow.right"
        case .oneWayFromApple: return "arrow.left"
        }
    }

    var description: String {
        switch self {
        case .twoWay:
            return "Changes sync in both directions. Events created or modified in either app will be reflected in the other."
        case .oneWayToApple:
            return "Changes only sync from Opta to Apple Calendar. Changes made in Apple Calendar won't affect Opta."
        case .oneWayFromApple:
            return "Changes only sync from Apple Calendar to Opta. Changes made in Opta won't affect Apple Calendar."
        }
    }
}

enum SyncFrequency: String, CaseIterable, Codable {
    case manual = "manual"
    case every15Minutes = "15_minutes"
    case hourly = "hourly"
    case daily = "daily"

    var displayName: String {
        switch self {
        case .manual: return "Manual"
        case .every15Minutes: return "Every 15 minutes"
        case .hourly: return "Every hour"
        case .daily: return "Daily"
        }
    }

    var icon: String {
        switch self {
        case .manual: return "hand.tap"
        case .every15Minutes: return "clock"
        case .hourly: return "clock.badge"
        case .daily: return "calendar.badge.clock"
        }
    }

    var description: String {
        switch self {
        case .manual:
            return "Sync only when you manually trigger it. No automatic syncing in the background."
        case .every15Minutes:
            return "Automatically sync every 15 minutes when the app is active or in the background."
        case .hourly:
            return "Automatically sync once per hour. Balances freshness with battery life."
        case .daily:
            return "Automatically sync once per day. Best for battery life."
        }
    }

    var interval: TimeInterval? {
        switch self {
        case .manual: return nil
        case .every15Minutes: return 15 * 60
        case .hourly: return 60 * 60
        case .daily: return 24 * 60 * 60
        }
    }
}

enum ConflictStrategy: String, CaseIterable, Codable {
    case lastWriteWins = "last_write_wins"
    case askUser = "ask_user"
    case preferOpta = "prefer_opta"
    case preferApple = "prefer_apple"

    var displayName: String {
        switch self {
        case .lastWriteWins: return "Last Write Wins"
        case .askUser: return "Ask Me"
        case .preferOpta: return "Prefer Opta"
        case .preferApple: return "Prefer Apple"
        }
    }

    var icon: String {
        switch self {
        case .lastWriteWins: return "clock.arrow.circlepath"
        case .askUser: return "questionmark.circle"
        case .preferOpta: return "checkmark.circle"
        case .preferApple: return "apple.logo"
        }
    }

    var description: String {
        switch self {
        case .lastWriteWins:
            return "When a conflict occurs, the most recently modified version wins automatically."
        case .askUser:
            return "When a conflict occurs, you'll be asked to choose which version to keep."
        case .preferOpta:
            return "When a conflict occurs, always keep the Opta version."
        case .preferApple:
            return "When a conflict occurs, always keep the Apple Calendar version."
        }
    }
}

// MARK: - View Model

@MainActor
class CalendarSyncSettingsViewModel: ObservableObject {
    @Published var syncMode: SyncMode = .twoWay
    @Published var syncFrequency: SyncFrequency = .hourly
    @Published var conflictStrategy: ConflictStrategy = .lastWriteWins

    @Published var syncAllDayEvents = true
    @Published var syncPastEvents = false
    @Published var notifyOnConflicts = true

    @Published var syncState: SyncState = .idle
    @Published var lastSyncDate: Date?
    @Published var syncError: String?

    @Published var isSyncing = false
    @Published var toastMessage: String?

    @Published var unresolvedConflicts: [EventConflict] = []

    var hasUnresolvedConflicts: Bool {
        !unresolvedConflicts.isEmpty
    }

    var unresolvedConflictsCount: Int {
        unresolvedConflicts.count
    }

    func loadSettings() async {
        // Load from UserDefaults
        if let modeRaw = UserDefaults.standard.string(forKey: "calendarSyncMode"),
           let mode = SyncMode(rawValue: modeRaw) {
            syncMode = mode
        }

        if let frequencyRaw = UserDefaults.standard.string(forKey: "calendarSyncFrequency"),
           let frequency = SyncFrequency(rawValue: frequencyRaw) {
            syncFrequency = frequency
        }

        if let strategyRaw = UserDefaults.standard.string(forKey: "calendarConflictStrategy"),
           let strategy = ConflictStrategy(rawValue: strategyRaw) {
            conflictStrategy = strategy
        }

        syncAllDayEvents = UserDefaults.standard.bool(forKey: "calendarSyncAllDay")
        syncPastEvents = UserDefaults.standard.bool(forKey: "calendarSyncPast")
        notifyOnConflicts = UserDefaults.standard.bool(forKey: "calendarNotifyConflicts")

        if let lastSync = UserDefaults.standard.object(forKey: "calendarLastSync") as? Date {
            lastSyncDate = lastSync
        }

        if let errorString = UserDefaults.standard.string(forKey: "calendarSyncError") {
            syncError = errorString
            syncState = .error
        }

        loadConflicts()
    }

    func loadConflicts() {
        // This would load from CalendarSyncService
        // For now, simulate some conflicts
        unresolvedConflicts = []
    }

    func saveSyncMode() {
        UserDefaults.standard.set(syncMode.rawValue, forKey: "calendarSyncMode")
        showToast("Sync mode updated")
    }

    func saveSyncFrequency() {
        UserDefaults.standard.set(syncFrequency.rawValue, forKey: "calendarSyncFrequency")
        showToast("Sync frequency updated")

        // Update background sync schedule
        // BackgroundSyncManager.shared.updateSchedule(frequency: syncFrequency)
    }

    func saveConflictStrategy() {
        UserDefaults.standard.set(conflictStrategy.rawValue, forKey: "calendarConflictStrategy")
        showToast("Conflict strategy updated")
    }

    func saveAdvancedSettings() {
        UserDefaults.standard.set(syncAllDayEvents, forKey: "calendarSyncAllDay")
        UserDefaults.standard.set(syncPastEvents, forKey: "calendarSyncPast")
        UserDefaults.standard.set(notifyOnConflicts, forKey: "calendarNotifyConflicts")
    }

    func forceSync() async {
        isSyncing = true
        syncState = .syncing
        defer { isSyncing = false }

        // Simulate sync
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // This would call CalendarSyncService.sync()
        syncState = .success
        lastSyncDate = Date()
        syncError = nil

        UserDefaults.standard.set(Date(), forKey: "calendarLastSync")
        UserDefaults.standard.removeObject(forKey: "calendarSyncError")

        showToast("Calendar synced successfully")
        HapticManager.shared.notification(.success)
    }

    private func showToast(_ message: String) {
        withAnimation(.spring(response: 0.3)) {
            toastMessage = message
        }
    }
}

// MARK: - Conflict Resolution View

struct ConflictResolutionView: View {
    let conflicts: [EventConflict]
    let onResolved: () -> Void
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                if conflicts.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.optaNeonGreen)

                        Text("All Conflicts Resolved")
                            .font(.headline)
                            .foregroundColor(.optaTextPrimary)

                        Text("No conflicts to resolve")
                            .font(.subheadline)
                            .foregroundColor(.optaTextMuted)
                    }
                } else {
                    List {
                        ForEach(conflicts) { conflict in
                            ConflictRow(conflict: conflict) { choice in
                                // Handle resolution
                                HapticManager.shared.notification(.success)
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Resolve Conflicts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        onResolved()
                        dismiss()
                    }
                    .foregroundColor(.optaPrimary)
                }
            }
        }
    }
}

struct ConflictRow: View {
    let conflict: EventConflict
    let onResolve: (ConflictChoice) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.optaNeonAmber)

                Text(conflict.conflictType.displayName)
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)
            }

            // Opta Version
            Button {
                HapticManager.shared.impact(.medium)
                onResolve(.keepOpta)
            } label: {
                ConflictOptionCard(
                    title: "Opta Version",
                    event: conflict.backendEvent,
                    icon: "checkmark.circle",
                    color: .optaPrimary
                )
            }

            // Apple Version
            Button {
                HapticManager.shared.impact(.medium)
                onResolve(.keepApple)
            } label: {
                ConflictOptionCard(
                    title: "Apple Calendar Version",
                    snapshot: conflict.appleEvent,
                    icon: "calendar",
                    color: .optaNeonBlue
                )
            }
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .listRowBackground(Color.clear)
    }
}

struct ConflictOptionCard: View {
    let title: String
    var event: CalendarEvent? = nil
    var snapshot: CalendarEventSnapshot? = nil
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)

                if let event = event {
                    Text(event.summary)
                        .font(.subheadline)
                        .foregroundColor(.optaTextPrimary)

                    if let date = event.startDate {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption)
                            .foregroundColor(.optaTextSecondary)
                    }
                } else if let snapshot = snapshot {
                    Text(snapshot.title)
                        .font(.subheadline)
                        .foregroundColor(.optaTextPrimary)

                    if let date = snapshot.startDate {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption)
                            .foregroundColor(.optaTextSecondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.optaTextMuted)
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }
}

enum ConflictChoice {
    case keepOpta
    case keepApple
}

#Preview {
    NavigationStack {
        CalendarSyncSettings()
    }
}
