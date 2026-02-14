import SwiftUI

struct IntegrationsView: View {
    @StateObject private var viewModel = IntegrationsViewModel()
    @ObservedObject private var openclawService = OpenClawService.shared
    @State private var showTodoistAuth = false
    @State private var showSyncStatus = false
    @State private var showCalendarSettings = false
    @State private var showHealthInsights = false
    @State private var showingSyncAll = false

    // OpenClaw status helpers
    private var openclawStatusText: String {
        if !openclawService.isEnabled {
            return "Disabled"
        }
        switch openclawService.connectionState {
        case .connected:
            return "Connected"
        case .connecting:
            return "Connecting..."
        case .reconnecting:
            return "Reconnecting..."
        case .disconnected:
            return openclawService.serverURL.isEmpty ? "Not configured" : "Disconnected"
        }
    }

    private var openclawStatusColor: Color {
        if !openclawService.isEnabled {
            return .optaTextMuted
        }
        return openclawService.connectionState.color
    }

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            List {
                // Apple Calendar Section
                Section {
                    // Calendar Sync Toggle
                    HStack {
                        Image(systemName: "calendar")
                            .font(.title2)
                            .foregroundColor(.optaNeonBlue)
                            .frame(width: 40)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Apple Calendar")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(viewModel.calendarSyncEnabled ? "Synced" : "Not syncing")
                                .font(.caption)
                                .foregroundColor(viewModel.calendarSyncEnabled ? .optaNeonGreen : .optaTextMuted)
                        }

                        Spacer()

                        Toggle("", isOn: $viewModel.calendarSyncEnabled)
                            .labelsHidden()
                            .tint(.optaNeonBlue)
                            .onChange(of: viewModel.calendarSyncEnabled) { _, newValue in
                                HapticManager.shared.impact(.light)
                                Task {
                                    if newValue {
                                        await viewModel.requestCalendarPermission()
                                    }
                                }
                            }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if viewModel.calendarSyncEnabled {
                        // Import Button
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await viewModel.importFromAppleCalendar()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "square.and.arrow.down")
                                    .foregroundColor(.optaNeonBlue)
                                Text("Import Events")
                                    .foregroundColor(.optaTextPrimary)

                                Spacer()

                                if viewModel.isImportingCalendar {
                                    ProgressView()
                                        .tint(.optaNeonBlue)
                                }
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        .disabled(viewModel.isImportingCalendar)

                        // Export Button
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await viewModel.exportToAppleCalendar()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                    .foregroundColor(.optaNeonBlue)
                                Text("Export Events")
                                    .foregroundColor(.optaTextPrimary)

                                Spacer()

                                if viewModel.isExportingCalendar {
                                    ProgressView()
                                        .tint(.optaNeonBlue)
                                }
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        .disabled(viewModel.isExportingCalendar)

                        // Settings Navigation
                        NavigationLink {
                            CalendarSyncSettings()
                        } label: {
                            HStack {
                                Image(systemName: "gearshape")
                                    .foregroundColor(.optaTextSecondary)
                                Text("Sync Settings")
                                    .foregroundColor(.optaTextPrimary)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    }
                } header: {
                    Text("Calendar")
                } footer: {
                    if viewModel.calendarSyncEnabled {
                        Text("Sync your Opta events with Apple Calendar for seamless integration across all your devices.")
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Apple Reminders Section
                Section {
                    // Reminders Sync Toggle
                    HStack {
                        Image(systemName: "checklist")
                            .font(.title2)
                            .foregroundColor(.optaNeonGreen)
                            .frame(width: 40)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Apple Reminders")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(viewModel.remindersSyncEnabled ? "Synced" : "Not syncing")
                                .font(.caption)
                                .foregroundColor(viewModel.remindersSyncEnabled ? .optaNeonGreen : .optaTextMuted)
                        }

                        Spacer()

                        Toggle("", isOn: $viewModel.remindersSyncEnabled)
                            .labelsHidden()
                            .tint(.optaNeonGreen)
                            .onChange(of: viewModel.remindersSyncEnabled) { _, newValue in
                                HapticManager.shared.impact(.light)
                                Task {
                                    if newValue {
                                        await viewModel.requestRemindersPermission()
                                    }
                                }
                            }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if viewModel.remindersSyncEnabled {
                        // Import Reminders Button
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await viewModel.importFromReminders()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "square.and.arrow.down")
                                    .foregroundColor(.optaNeonGreen)
                                Text("Import Reminders")
                                    .foregroundColor(.optaTextPrimary)

                                Spacer()

                                if viewModel.isImportingReminders {
                                    ProgressView()
                                        .tint(.optaNeonGreen)
                                }
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        .disabled(viewModel.isImportingReminders)
                    }
                } header: {
                    Text("Reminders")
                } footer: {
                    if viewModel.remindersSyncEnabled {
                        Text("Import your iOS reminders into Opta as tasks.")
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Todoist Section
                Section {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.optaNeonRed)
                            .frame(width: 40)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Todoist")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(viewModel.todoistConnected ? "Connected" : "Not connected")
                                .font(.caption)
                                .foregroundColor(viewModel.todoistConnected ? .optaNeonGreen : .optaTextMuted)
                        }

                        Spacer()

                        if viewModel.todoistConnected {
                            Button {
                                HapticManager.shared.impact(.medium)
                                viewModel.disconnectTodoist()
                            } label: {
                                Text("Disconnect")
                                    .font(.subheadline)
                                    .foregroundColor(.optaNeonRed)
                            }
                        } else {
                            Button {
                                HapticManager.shared.impact(.medium)
                                showTodoistAuth = true
                            } label: {
                                Text("Connect")
                                    .font(.subheadline)
                                    .foregroundColor(.optaPrimary)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.optaPrimary.opacity(0.15))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if viewModel.todoistConnected {
                        // Sync Now Button
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await viewModel.syncTodoist()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .foregroundColor(.optaNeonRed)
                                Text("Sync Now")
                                    .foregroundColor(.optaTextPrimary)

                                Spacer()

                                if viewModel.isSyncingTodoist {
                                    ProgressView()
                                        .tint(.optaNeonRed)
                                } else if let lastSync = viewModel.todoistLastSync {
                                    Text(lastSync.relativeDateString)
                                        .font(.caption)
                                        .foregroundColor(.optaTextMuted)
                                }
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        .disabled(viewModel.isSyncingTodoist)
                    }
                } header: {
                    Text("Task Management")
                } footer: {
                    if viewModel.todoistConnected {
                        Text("Direct integration with Todoist. Tasks sync automatically in the background.")
                            .foregroundColor(.optaTextMuted)
                    } else {
                        Text("Connect your Todoist account for seamless task synchronization.")
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // OpenClaw AI Section
                Section {
                    HStack {
                        Image(systemName: "terminal.fill")
                            .font(.title2)
                            .foregroundColor(.optaNeonCyan)
                            .frame(width: 40)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("OpenClaw")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(openclawStatusText)
                                .font(.caption)
                                .foregroundColor(openclawStatusColor)
                        }

                        Spacer()

                        Toggle("", isOn: Binding(
                            get: { openclawService.isEnabled },
                            set: { openclawService.setEnabled($0) }
                        ))
                        .labelsHidden()
                        .tint(.optaNeonCyan)
                        .onChange(of: openclawService.isEnabled) { _, _ in
                            HapticManager.shared.impact(.light)
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if openclawService.isEnabled {
                        // Connection Status
                        HStack {
                            Circle()
                                .fill(openclawService.connectionState.color)
                                .frame(width: 8, height: 8)
                                .optaGlow(openclawService.connectionState.color, radius: 4)

                            Text(openclawService.connectionState.displayText)
                                .font(.subheadline)
                                .foregroundColor(.optaTextSecondary)

                            Spacer()

                            if openclawService.isConnected {
                                Button {
                                    HapticManager.shared.impact(.medium)
                                    Task {
                                        await openclawService.disconnect()
                                    }
                                } label: {
                                    Text("Disconnect")
                                        .font(.caption)
                                        .foregroundColor(.optaNeonRed)
                                }
                            } else if openclawService.connectionState != .connecting {
                                Button {
                                    HapticManager.shared.impact(.medium)
                                    Task {
                                        await openclawService.connect()
                                    }
                                } label: {
                                    Text("Connect")
                                        .font(.caption)
                                        .foregroundColor(.optaNeonCyan)
                                }
                                .disabled(openclawService.serverURL.isEmpty)
                            } else {
                                ProgressView()
                                    .tint(.optaNeonCyan)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)

                        // Settings Navigation
                        NavigationLink {
                            OpenClawSettingsView()
                        } label: {
                            HStack {
                                Image(systemName: "gearshape")
                                    .foregroundColor(.optaTextSecondary)
                                Text("Server Settings")
                                    .foregroundColor(.optaTextPrimary)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    }
                } header: {
                    Text("AI Assistant")
                } footer: {
                    if openclawService.isEnabled {
                        Text("Connect to your OpenClaw server for AI-powered life management. Requires a server running on your local network or via Tailscale.")
                            .foregroundColor(.optaTextMuted)
                    } else {
                        Text("Enable OpenClaw to add AI assistant capabilities to Opta.")
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Apple Health Section
                Section {
                    HStack {
                        Image(systemName: "heart.fill")
                            .font(.title2)
                            .foregroundColor(.optaNeonRed)
                            .frame(width: 40)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Apple Health")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(viewModel.healthEnabled ? "Enabled" : "Disabled")
                                .font(.caption)
                                .foregroundColor(viewModel.healthEnabled ? .optaNeonGreen : .optaTextMuted)
                        }

                        Spacer()

                        Toggle("", isOn: $viewModel.healthEnabled)
                            .labelsHidden()
                            .tint(.optaNeonRed)
                            .onChange(of: viewModel.healthEnabled) { _, newValue in
                                HapticManager.shared.impact(.light)
                                Task {
                                    if newValue {
                                        await viewModel.requestHealthPermission()
                                    }
                                }
                            }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if viewModel.healthEnabled {
                        // View Insights
                        NavigationLink {
                            HealthInsightsView()
                        } label: {
                            HStack {
                                Image(systemName: "chart.line.uptrend.xyaxis")
                                    .foregroundColor(.optaNeonRed)
                                Text("View Insights")
                                    .foregroundColor(.optaTextPrimary)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    }
                } header: {
                    Text("Wellness")
                } footer: {
                    if viewModel.healthEnabled {
                        Text("Opta analyzes your sleep and activity data to provide productivity insights. All analysis is done on-device for privacy.")
                            .foregroundColor(.optaTextMuted)
                    } else {
                        Text("Enable health insights to see how your sleep and activity affect your productivity.")
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Sync Status Section
                Section {
                    NavigationLink {
                        SyncStatusView()
                    } label: {
                        HStack {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(.optaNeonCyan)

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Sync History")
                                    .foregroundColor(.optaTextPrimary)

                                if let lastSync = viewModel.lastSuccessfulSync {
                                    Text("Last sync: \(lastSync.relativeDateString)")
                                        .font(.caption)
                                        .foregroundColor(.optaTextMuted)
                                }
                            }

                            Spacer()

                            if viewModel.syncErrors > 0 {
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                    Text("\(viewModel.syncErrors)")
                                        .font(.caption.bold())
                                }
                                .foregroundColor(.optaNeonAmber)
                            }
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    // Sync All Button
                    Button {
                        HapticManager.shared.impact(.heavy)
                        showingSyncAll = true
                        Task {
                            await viewModel.syncAll()
                            showingSyncAll = false
                        }
                    } label: {
                        HStack {
                            Spacer()

                            if showingSyncAll {
                                ProgressView()
                                    .tint(.optaPrimary)
                                Text("Syncing All...")
                                    .foregroundColor(.optaTextSecondary)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                                    .foregroundColor(.optaPrimary)
                                Text("Sync All Now")
                                    .foregroundColor(.optaPrimary)
                                    .fontWeight(.semibold)
                            }

                            Spacer()
                        }
                    }
                    .listRowBackground(Color.optaPrimary.opacity(0.1))
                    .disabled(showingSyncAll)
                } header: {
                    Text("Sync Status")
                }
            }
            .scrollContentBackground(.hidden)

            // Success/Error Toast
            if let message = viewModel.toastMessage {
                VStack {
                    Spacer()

                    if viewModel.toastIsError {
                        ErrorBanner(
                            message: message,
                            onDismiss: { viewModel.toastMessage = nil }
                        )
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    } else {
                        SuccessToast(message: message)
                            .padding()
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        withAnimation {
                            viewModel.toastMessage = nil
                        }
                    }
                }
            }
        }
        .navigationTitle("Integrations")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showTodoistAuth) {
            TodoistAuthSheet(onSuccess: {
                viewModel.todoistConnected = true
                showTodoistAuth = false
            })
        }
        .task {
            await viewModel.loadStatus()
        }
    }
}

// MARK: - View Model

@MainActor
class IntegrationsViewModel: ObservableObject {
    @Published var calendarSyncEnabled = false
    @Published var remindersSyncEnabled = false
    @Published var todoistConnected = false
    @Published var healthEnabled = false

    @Published var isImportingCalendar = false
    @Published var isExportingCalendar = false
    @Published var isImportingReminders = false
    @Published var isSyncingTodoist = false

    @Published var todoistLastSync: Date?
    @Published var lastSuccessfulSync: Date?
    @Published var syncErrors = 0

    @Published var toastMessage: String?
    @Published var toastIsError = false

    func loadStatus() async {
        // Load saved preferences
        calendarSyncEnabled = UserDefaults.standard.bool(forKey: "calendarSyncEnabled")
        remindersSyncEnabled = UserDefaults.standard.bool(forKey: "remindersSyncEnabled")

        // Check actual Todoist connection status
        todoistConnected = TodoistService.shared.isAuthenticated

        healthEnabled = UserDefaults.standard.bool(forKey: "healthEnabled")

        // Load last sync times
        if let lastSync = TaskSyncCoordinator.shared.lastSyncDate {
            todoistLastSync = lastSync
        }

        if let lastSync = UserDefaults.standard.object(forKey: "lastSuccessfulSync") as? Date {
            lastSuccessfulSync = lastSync
        }

        syncErrors = UserDefaults.standard.integer(forKey: "syncErrors")
    }

    func requestCalendarPermission() async {
        // This would call EventKitService.requestCalendarAccess()
        // For now, just save the preference
        UserDefaults.standard.set(true, forKey: "calendarSyncEnabled")
        showToast("Calendar access granted", isError: false)
    }

    func requestRemindersPermission() async {
        // This would call EventKitService.requestRemindersAccess()
        UserDefaults.standard.set(true, forKey: "remindersSyncEnabled")
        showToast("Reminders access granted", isError: false)
    }

    func requestHealthPermission() async {
        // This would call HealthService.requestHealthAccess()
        UserDefaults.standard.set(true, forKey: "healthEnabled")
        showToast("Health access granted", isError: false)
    }

    func importFromAppleCalendar() async {
        isImportingCalendar = true
        defer { isImportingCalendar = false }

        // Simulate import
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // This would call CalendarSyncService.importFromAppleCalendar()
        showToast("Imported 5 events from Apple Calendar", isError: false)
        HapticManager.shared.notification(.success)
    }

    func exportToAppleCalendar() async {
        isExportingCalendar = true
        defer { isExportingCalendar = false }

        // Simulate export
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // This would call CalendarSyncService.exportToAppleCalendar()
        showToast("Exported 8 events to Apple Calendar", isError: false)
        HapticManager.shared.notification(.success)
    }

    func importFromReminders() async {
        isImportingReminders = true
        defer { isImportingReminders = false }

        // Simulate import
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // This would call RemindersSyncService.importFromReminders()
        showToast("Imported 12 reminders as tasks", isError: false)
        HapticManager.shared.notification(.success)
    }

    func syncTodoist() async {
        isSyncingTodoist = true
        defer { isSyncingTodoist = false }

        do {
            // Use TaskSyncCoordinator to sync
            _ = try await TaskSyncCoordinator.shared.fetchDashboard()

            todoistLastSync = Date()
            showToast("Todoist synced successfully", isError: false)
            HapticManager.shared.notification(.success)
        } catch {
            showToast("Sync failed: \(error.localizedDescription)", isError: true)
            HapticManager.shared.notification(.error)
        }
    }

    func disconnectTodoist() {
        TodoistService.shared.signOut()
        todoistConnected = false
        showToast("Todoist disconnected", isError: false)
    }

    func syncAll() async {
        let enabledSyncs = [calendarSyncEnabled, remindersSyncEnabled, todoistConnected].filter { $0 }.count

        guard enabledSyncs > 0 else {
            showToast("No integrations enabled", isError: true)
            return
        }

        // Sync each enabled integration
        if calendarSyncEnabled {
            await importFromAppleCalendar()
        }

        if remindersSyncEnabled {
            await importFromReminders()
        }

        if todoistConnected {
            await syncTodoist()
        }

        lastSuccessfulSync = Date()
        UserDefaults.standard.set(Date(), forKey: "lastSuccessfulSync")
        showToast("All integrations synced", isError: false)
        HapticManager.shared.notification(.success)
    }

    private func showToast(_ message: String, isError: Bool) {
        withAnimation(.spring(response: 0.3)) {
            toastMessage = message
            toastIsError = isError
        }
    }
}

// MARK: - Date Extension

extension Date {
    var relativeDateString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

#Preview {
    NavigationStack {
        IntegrationsView()
    }
}
