import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @EnvironmentObject var authManager: AuthManager
    @State private var showBriefingSheet = false
    @State private var showHealthInsights = false
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color.optaVoid
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Header with greeting
                        headerSection
                            .slideIn(delay: 0.1)
                        
                        // Opta Ring & Stats
                        statsSection
                            .slideIn(delay: 0.2)
                        
                        // Quick Actions
                        quickActionsRow
                            .slideIn(delay: 0.3)
                        
                        // Tasks Card
                        TasksCard(tasks: viewModel.todayTasks, isLoading: viewModel.isLoadingTasks)
                            .slideIn(delay: 0.4)

                        // Health Card (temporarily disabled)
                        /*
                        HealthCard(
                            sleepData: viewModel.todaySleep,
                            activityData: viewModel.todayActivity,
                            isLoading: viewModel.isLoadingHealth,
                            onTap: { showHealthInsights = true }
                        )
                        .slideIn(delay: 0.45)
                        */

                        // Two Column Layout
                        HStack(spacing: 16) {
                            CalendarCard(events: viewModel.upcomingEvents, isLoading: viewModel.isLoadingCalendar)
                            EmailCard(emails: viewModel.unreadEmails, isLoading: viewModel.isLoadingEmails)
                        }
                        .slideIn(delay: 0.5)
                        
                        // System Status
                        systemStatusCard
                            .slideIn(delay: 0.6)
                    }
                    .padding()
                }
                
                // Error banner overlay
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
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                HapticManager.shared.impact(.light)
                await viewModel.refresh()
            }
            .sheet(isPresented: $showBriefingSheet) {
                BriefingSheetView(briefing: viewModel.currentBriefing)
                    .presentationDetents([.medium, .large])
            }
            // Health insights sheet (temporarily disabled)
            /*
            .sheet(isPresented: $showHealthInsights) {
                HealthInsightsView()
            }
            */
        }
        .task {
            await viewModel.loadData()
        }
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        HStack {
            GreetingHeader(userName: authManager.currentUser?.name ?? "there")
            
            Spacer()
            
            // Profile button with notification badge
            Button {
                HapticManager.shared.impact(.light)
            } label: {
                ZStack(alignment: .topTrailing) {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [.optaPrimary.opacity(0.5), .optaVoid],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)
                        .overlay(
                            Circle()
                                .stroke(Color.optaGlassBorder, lineWidth: 1)
                        )
                        .overlay(
                            Image(systemName: "person.fill")
                                .foregroundColor(.optaTextSecondary)
                        )
                    
                    // Notification indicator
                    if viewModel.totalNotifications > 0 {
                        Circle()
                            .fill(Color.optaNeonRed)
                            .frame(width: 12, height: 12)
                            .overlay(
                                Text("\(min(viewModel.totalNotifications, 9))")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.white)
                            )
                            .offset(x: 2, y: -2)
                    }
                }
            }
        }
    }
    
    // MARK: - Stats Section
    
    private var statsSection: some View {
        VStack(spacing: 20) {
            // Animated Opta Ring
            // Enhanced Opta Ring
            EnhancedOptaRing(isActive: .constant(!viewModel.isLoading), size: 120)
                .onTapGesture {
                    HapticManager.shared.impact(.medium)
                    showBriefingSheet = true
                }
                .breathing(minScale: 0.98, maxScale: 1.02, duration: 4)
            
            // Briefing text
            VStack(spacing: 8) {
                Text("System Intelligence")
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)
                
                if viewModel.isLoadingBriefing {
                    SkeletonView(width: 200, height: 14)
                } else {
                    Text(viewModel.briefingSummary)
                        .font(.subheadline)
                        .foregroundColor(.optaTextMuted)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
            }
            
            // Stats row
            HStack(spacing: 24) {
                EnhancedStatCounter(
                    value: viewModel.stats.tasksToday,
                    label: "Tasks",
                    icon: "checkmark.circle",
                    color: .optaNeonGreen
                )
                
                EnhancedStatCounter(
                    value: viewModel.stats.eventsToday,
                    label: "Events",
                    icon: "calendar",
                    color: .optaNeonBlue
                )
                
                EnhancedStatCounter(
                    value: viewModel.stats.unreadEmails,
                    label: "Unread",
                    icon: "envelope",
                    color: .optaNeonAmber
                )
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
        .glassPanel()
    }
    
    // MARK: - Quick Actions
    
    private var quickActionsRow: some View {
        HStack(spacing: 12) {
            QuickActionButton(
                icon: "plus.circle.fill",
                label: "Add Task",
                color: .optaNeonGreen
            ) {
                HapticManager.shared.impact(.light)
                selectedTab = 2 // Switch to tasks tab
            }
            
            QuickActionButton(
                icon: "calendar.badge.plus",
                label: "Add Event",
                color: .optaNeonBlue
            ) {
                HapticManager.shared.impact(.light)
                selectedTab = 3 // Switch to calendar tab
            }
            
            QuickActionButton(
                icon: "sparkles",
                label: "Ask Opta",
                color: .optaPrimary
            ) {
                HapticManager.shared.impact(.light)
                selectedTab = 1 // Switch to chat tab
            }
            
            QuickActionButton(
                icon: "list.bullet.clipboard",
                label: "Briefing",
                color: .optaNeonCyan
            ) {
                HapticManager.shared.impact(.medium)
                showBriefingSheet = true
            }
        }
        .glassPanel(cornerRadius: 12)
        .padding(.vertical, 8)
    }
    
    // MARK: - System Status
    
    private var systemStatusCard: some View {
        HStack {
            HStack(spacing: 8) {
                Circle()
                    .fill(viewModel.allSystemsOnline ? Color.optaNeonGreen : Color.optaNeonAmber)
                    .frame(width: 8, height: 8)
                    .optaGlow(viewModel.allSystemsOnline ? .optaNeonGreen : .optaNeonAmber, radius: 5)
                
                Text(viewModel.allSystemsOnline ? "All Systems Operational" : "Partial Connectivity")
                    .font(.subheadline)
                    .foregroundColor(.optaTextPrimary)
            }
            
            Spacer()
            
            HStack(spacing: 16) {
                StatusIndicator(label: "Calendar", connected: viewModel.calendarConnected)
                StatusIndicator(label: "Email", connected: viewModel.emailConnected)
                StatusIndicator(label: "Todoist", connected: viewModel.todoistConnected)
            }
        }
        .padding()
        .glassPanel(cornerRadius: 12)
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .scaleEffect(isPressed ? 0.9 : 1)
                
                Text(label)
                    .font(.caption)
                    .foregroundColor(.optaTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
        .buttonStyle(MagneticButtonStyle(color: color))
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Status Indicator

struct StatusIndicator: View {
    let label: String
    let connected: Bool
    
    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
            
            Circle()
                .fill(connected ? Color.optaNeonGreen : Color.optaNeonRed)
                .frame(width: 6, height: 6)
        }
    }
}

// MARK: - Briefing Sheet

struct BriefingSheetView: View {
    let briefing: Briefing?
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Opta Ring
                        EnhancedOptaRing(isActive: .constant(true), size: 120)
                            .padding(.top, 20)
                        
                        if let briefing = briefing {
                            // Greeting
                            Text("Good \(briefing.greeting)")
                                .font(.title2.bold())
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.white, .optaPrimaryGlow],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                            
                            // Summary
                            Text(briefing.summary)
                                .font(.body)
                                .foregroundColor(.optaTextSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                            
                            // Stats grid
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                BriefingStatCard(
                                    icon: "checkmark.circle.fill",
                                    value: "\(briefing.stats.tasksToday)",
                                    label: "Tasks Today",
                                    color: .optaNeonGreen
                                )
                                
                                BriefingStatCard(
                                    icon: "calendar",
                                    value: "\(briefing.stats.upcomingEvents)",
                                    label: "Events",
                                    color: .optaNeonBlue
                                )
                                
                                BriefingStatCard(
                                    icon: "envelope.fill",
                                    value: "\(briefing.stats.unreadEmails)",
                                    label: "Unread Emails",
                                    color: .optaNeonAmber
                                )
                                
                                BriefingStatCard(
                                    icon: "bolt.fill",
                                    value: "\(briefing.stats.tasksTotal)",
                                    label: "Total Active",
                                    color: .optaPrimary
                                )
                            }
                            .padding()
                            
                            // Next events
                            if !briefing.nextEvents.isEmpty {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("COMING UP")
                                        .font(.caption.bold())
                                        .foregroundColor(.optaTextMuted)
                                        .tracking(2)
                                    
                                    ForEach(briefing.nextEvents, id: \.summary) { event in
                                        HStack(spacing: 12) {
                                            Circle()
                                                .fill(Color.optaNeonBlue)
                                                .frame(width: 8, height: 8)
                                            
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(event.summary)
                                                    .font(.subheadline)
                                                    .foregroundColor(.optaTextPrimary)
                                                
                                                if let date = event.startDate {
                                                    Text(date.formatted(date: .abbreviated, time: .shortened))
                                                        .font(.caption)
                                                        .foregroundColor(.optaTextMuted)
                                                }
                                            }
                                            
                                            Spacer()
                                        }
                                        .padding()
                                        .background(Color.optaGlassBackground)
                                        .cornerRadius(12)
                                    }
                                }
                                .padding()
                            }
                        } else {
                            ProgressView()
                                .tint(.optaPrimary)
                                .padding(40)
                        }
                        
                        Spacer(minLength: 40)
                    }
                }
            }
            .navigationTitle("Daily Briefing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(.optaPrimary)
                }
            }
        }
    }
}

struct BriefingStatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(value)
                .font(.title.bold().monospacedDigit())
                .foregroundColor(color)
            
            Text(label)
                .font(.caption)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(color.opacity(0.1))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(color.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - View Model

struct DashboardStats {
    var tasksToday: Int = 0
    var eventsToday: Int = 0
    var unreadEmails: Int = 0
}

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var todayTasks: [OptaTask] = []
    @Published var upcomingEvents: [CalendarEvent] = []
    @Published var unreadEmails: [Email] = []
    @Published var briefingSummary = "Tap the ring for your full briefing..."
    @Published var currentBriefing: Briefing?
    @Published var stats = DashboardStats()

    // Health data (temporarily disabled)
    // @Published var todaySleep: SleepData?
    // @Published var todayActivity: ActivityData?

    @Published var isLoading = false
    @Published var isLoadingTasks = false
    @Published var isLoadingCalendar = false
    @Published var isLoadingEmails = false
    @Published var isLoadingBriefing = false
    @Published var isLoadingHealth = false
    @Published var error: String?

    @Published var calendarConnected = true
    @Published var emailConnected = true
    @Published var todoistConnected = true
    
    var allSystemsOnline: Bool {
        calendarConnected && emailConnected && todoistConnected
    }
    
    var totalNotifications: Int {
        stats.unreadEmails + (todayTasks.filter { $0.priority == .urgent || $0.priority == .high }.count)
    }
    
    private let api = APIService.shared
    // private let healthService = HealthService.shared

    func loadData() async {
        isLoading = true

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadTasks() }
            group.addTask { await self.loadCalendar() }
            group.addTask { await self.loadEmails() }
            group.addTask { await self.loadBriefing() }
            // Health data loading temporarily disabled
            // group.addTask { await self.loadHealthData() }
        }

        isLoading = false
    }
    
    func refresh() async {
        await loadData()
    }
    
    private func loadTasks() async {
        isLoadingTasks = true
        defer { isLoadingTasks = false }
        
        do {
            let dashboard = try await api.fetchTasksDashboard()
            todayTasks = dashboard.todayTasks
            stats.tasksToday = dashboard.stats.todayCount
            todoistConnected = true
        } catch {
            self.error = error.localizedDescription
            todoistConnected = false
        }
    }
    
    private func loadCalendar() async {
        isLoadingCalendar = true
        defer { isLoadingCalendar = false }
        
        do {
            upcomingEvents = try await api.fetchCalendarEvents(range: "week")
            stats.eventsToday = upcomingEvents.filter { $0.startDate?.isToday ?? false }.count
            calendarConnected = true
        } catch {
            self.error = error.localizedDescription
            calendarConnected = false
        }
    }
    
    private func loadEmails() async {
        isLoadingEmails = true
        defer { isLoadingEmails = false }
        
        do {
            unreadEmails = try await api.fetchUnreadEmails()
            stats.unreadEmails = unreadEmails.count
            emailConnected = true
        } catch {
            self.error = error.localizedDescription
            emailConnected = false
        }
    }
    
    private func loadBriefing() async {
        isLoadingBriefing = true
        defer { isLoadingBriefing = false }

        do {
            let briefing = try await api.fetchBriefing()
            currentBriefing = briefing
            briefingSummary = briefing.summary
        } catch {
            briefingSummary = "Tap the ring for your full briefing"
        }
    }

    // Health data loading temporarily disabled (HealthService excluded from build)
    /*
    private func loadHealthData() async {
        // Only load if authorized
        guard healthService.authorizationStatus.isAuthorized else { return }

        isLoadingHealth = true
        defer { isLoadingHealth = false }

        do {
            // Load sleep and activity data in parallel
            async let sleep = healthService.fetchSleepData(for: Date())
            async let activity = healthService.fetchActivityData(for: Date())

            todaySleep = try await sleep
            todayActivity = try await activity
        } catch {
            // Silently fail - health data is optional
            // Users can manually refresh from health insights view
        }
    }
    */
}

#Preview {
    DashboardView()
        .environmentObject(AuthManager.shared)
        .environmentObject(APIService.shared)
}
