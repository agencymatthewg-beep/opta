import SwiftUI

struct TasksListView: View {
    @StateObject private var viewModel = TasksListViewModel()
    @State private var showAddTask = false
    @State private var selectedView: TaskViewMode = .today
    @State private var searchText = ""
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Search bar
                    searchBar
                    
                    // View Selector
                    viewSelector
                    
                    // Task List
                    if viewModel.isLoading {
                        loadingView
                    } else if filteredTasks.isEmpty {
                        EmptyStateView(
                            icon: selectedView.emptyIcon,
                            title: selectedView.emptyMessage,
                            subtitle: selectedView == .today ? "Add a task to get started" : "Nothing here yet",
                            actionLabel: selectedView == .today ? "Add Task" : nil,
                            action: selectedView == .today ? { showAddTask = true } : nil
                        )
                    } else {
                        tasksList
                    }
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        HapticManager.shared.impact(.medium)
                        showAddTask = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.optaPrimary)
                            .font(.title3)
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task { await viewModel.refresh() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        
                        Divider()
                        
                        Menu("Sort by") {
                            Button {
                                viewModel.sortBy = .priority
                            } label: {
                                Label("Priority", systemImage: viewModel.sortBy == .priority ? "checkmark" : "")
                            }
                            
                            Button {
                                viewModel.sortBy = .dueDate
                            } label: {
                                Label("Due Date", systemImage: viewModel.sortBy == .dueDate ? "checkmark" : "")
                            }
                            
                            Button {
                                viewModel.sortBy = .alphabetical
                            } label: {
                                Label("Alphabetical", systemImage: viewModel.sortBy == .alphabetical ? "checkmark" : "")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.optaTextSecondary)
                    }
                }
            }
            .sheet(isPresented: $showAddTask) {
                AddTaskSheet(onAdd: { content, dueString, priority in
                    Task {
                        HapticManager.shared.notification(.success)
                        await viewModel.createTask(
                            content: content,
                            dueString: dueString,
                            priority: priority
                        )
                    }
                })
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
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
    
    // MARK: - Search Bar
    
    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.optaTextMuted)
            
            TextField("Search tasks...", text: $searchText)
                .textFieldStyle(.plain)
                .foregroundColor(.optaTextPrimary)
            
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.optaTextMuted)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.optaGlassBackground)
        .cornerRadius(10)
        .padding(.horizontal)
        .padding(.top, 8)
    }
    
    // MARK: - View Selector
    
    private var viewSelector: some View {
        HStack(spacing: 8) {
            ForEach(TaskViewMode.allCases, id: \.self) { mode in
                TaskViewTab(
                    mode: mode,
                    isSelected: selectedView == mode,
                    count: countFor(mode)
                ) {
                    HapticManager.shared.selection()
                    withAnimation(.spring(response: 0.3)) {
                        selectedView = mode
                    }
                }
            }
            
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }
    
    private func countFor(_ mode: TaskViewMode) -> Int {
        switch mode {
        case .today: return viewModel.dashboard?.stats.todayCount ?? 0
        case .upcoming: return viewModel.dashboard?.stats.upcomingCount ?? 0
        case .overdue: return viewModel.dashboard?.stats.overdueCount ?? 0
        }
    }
    
    private var displayedTasks: [OptaTask] {
        guard let dashboard = viewModel.dashboard else { return [] }
        let tasks: [OptaTask]
        
        switch selectedView {
        case .today: tasks = dashboard.todayTasks
        case .upcoming: tasks = dashboard.upcomingTasks
        case .overdue: tasks = dashboard.overdueTasks
        }
        
        return viewModel.sortTasks(tasks)
    }
    
    private var filteredTasks: [OptaTask] {
        if searchText.isEmpty {
            return displayedTasks
        }
        return displayedTasks.filter { task in
            task.content.localizedCaseInsensitiveContains(searchText) ||
            task.labels.contains { $0.localizedCaseInsensitiveContains(searchText) }
        }
    }
    
    // MARK: - Loading View
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { i in
                TaskRowSkeleton()
                    .padding(.horizontal)
            }
            Spacer()
        }
        .padding(.top)
    }
    
    // MARK: - Tasks List
    
    private var tasksList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(Array(filteredTasks.enumerated()), id: \.element.id) { index, task in
                    TaskRowFull(
                        task: task,
                        onComplete: {
                            Task {
                                HapticManager.shared.notification(.success)
                                await viewModel.completeTask(taskId: task.id)
                            }
                        },
                        onDelete: {
                            // TODO: Implement delete
                        }
                    )
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
                    .staggeredAppear(index: index)
                }
            }
            .padding()
            .animation(.spring(response: 0.3), value: filteredTasks.map { $0.id })
        }
    }
}

// MARK: - Task View Tab

struct TaskViewTab: View {
    let mode: TaskViewMode
    let isSelected: Bool
    let count: Int
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: mode.icon)
                    .font(.caption)
                
                Text(mode.title)
                    .font(.caption.weight(.medium))
                
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.bold().monospacedDigit())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            isSelected
                                ? Color.white.opacity(0.2)
                                : mode.color.opacity(0.2)
                        )
                        .cornerRadius(8)
                }
            }
            .foregroundColor(isSelected ? .white : mode.color)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                isSelected
                    ? mode.color
                    : mode.color.opacity(0.1)
            )
            .cornerRadius(12)
        }
    }
}

// MARK: - Task Row Full

struct TaskRowFull: View {
    let task: OptaTask
    let onComplete: () -> Void
    let onDelete: () -> Void
    
    @State private var isCompleting = false
    @State private var offset: CGFloat = 0
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Swipe actions background
            HStack(spacing: 0) {
                Spacer()
                
                Button {
                    onComplete()
                } label: {
                    Image(systemName: "checkmark")
                        .font(.title3.bold())
                        .foregroundColor(.white)
                        .frame(width: 60, height: 60)
                }
                .background(Color.optaNeonGreen)
            }
            .cornerRadius(12)
            
            // Main content
            HStack(spacing: 12) {
                // Completion button
                Button {
                    withAnimation(.spring(response: 0.3)) {
                        isCompleting = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        onComplete()
                    }
                } label: {
                    ZStack {
                        Circle()
                            .stroke(priorityColor, lineWidth: 2)
                            .frame(width: 26, height: 26)
                        
                        if isCompleting {
                            Image(systemName: "checkmark")
                                .font(.caption.bold())
                                .foregroundColor(priorityColor)
                                .transition(.scale)
                        }
                    }
                    .rippleEffect(color: priorityColor, trigger: isCompleting)
                }
                .disabled(isCompleting)
                
                // Content
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.content)
                        .font(.body)
                        .foregroundColor(isCompleting ? .optaTextMuted : .optaTextPrimary)
                        .strikethrough(isCompleting)
                    
                    HStack(spacing: 12) {
                        if let due = task.due {
                            HStack(spacing: 4) {
                                Image(systemName: "clock")
                                    .font(.caption2)
                                Text(due.string)
                                    .font(.caption)
                            }
                            .foregroundColor(isDueUrgent ? .optaNeonRed : .optaTextMuted)
                        }
                        
                        if !task.labels.isEmpty {
                            HStack(spacing: 4) {
                                ForEach(task.labels.prefix(2), id: \.self) { label in
                                    TagPill(text: label, color: .optaNeonBlue)
                                }
                            }
                        }
                    }
                }
                
                Spacer()
                
                // Priority flag
                if task.priority.rawValue > 1 {
                    VStack {
                        Image(systemName: "flag.fill")
                            .font(.subheadline)
                            .foregroundColor(priorityColor)
                            .breathing(minScale: 0.8, maxScale: 1.2, duration: 1.5)
                        
                        Text(task.priority.displayName)
                            .font(.system(size: 8))
                            .foregroundColor(.optaTextMuted)
                    }
                }
            }
            .padding()
            .background(priorityBackground)
            .glassPanel(cornerRadius: 12)
            .opacity(isCompleting ? 0.6 : 1)
            .offset(x: offset)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if value.translation.width < 0 {
                            offset = max(-70, value.translation.width)
                        }
                    }
                    .onEnded { value in
                        withAnimation(.spring(response: 0.3)) {
                            if value.translation.width < -50 {
                                offset = -70
                            } else {
                                offset = 0
                            }
                        }
                    }
            )
        }
    }
    
    private var priorityColor: Color {
        switch task.priority {
        case .urgent: return .optaNeonRed
        case .high: return .optaNeonAmber
        case .medium: return .optaNeonBlue
        case .normal: return .optaTextMuted
        }
    }
    
    private var priorityBackground: Color {
        switch task.priority {
        case .urgent: return .optaNeonRed.opacity(0.05)
        case .high: return .optaNeonAmber.opacity(0.05)
        case .medium: return .optaNeonBlue.opacity(0.03)
        case .normal: return .clear
        }
    }
    
    private var isDueUrgent: Bool {
        guard let date = task.due?.displayDate else { return false }
        return date < Date()
    }
}

// MARK: - Add Task Sheet

struct AddTaskSheet: View {
    @Environment(\.dismiss) var dismiss
    
    let onAdd: (String, String?, Int?) -> Void
    
    @State private var content = ""
    @State private var dueOption = DueOption.none
    @State private var priority: TaskPriority = .normal
    @FocusState private var isFocused: Bool
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Content field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("What needs to be done?")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            
                            TextField("Enter task...", text: $content, axis: .vertical)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .foregroundColor(.optaTextPrimary)
                                .lineLimit(1...3)
                                .padding()
                                .background(Color.optaGlassBackground)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(isFocused ? Color.optaPrimary : Color.optaGlassBorder, lineWidth: 1)
                                )
                                .focused($isFocused)
                        }
                        
                        // Due date
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Due Date")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(DueOption.allCases, id: \.self) { option in
                                        DueOptionButton(
                                            option: option,
                                            isSelected: dueOption == option
                                        ) {
                                            HapticManager.shared.selection()
                                            dueOption = option
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Priority
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Priority")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            
                            HStack(spacing: 8) {
                                ForEach(TaskPriority.allCases.reversed(), id: \.rawValue) { p in
                                    PriorityButton(
                                        priority: p,
                                        isSelected: priority == p
                                    ) {
                                        HapticManager.shared.selection()
                                        priority = p
                                    }
                                }
                            }
                        }
                        
                        // Quick suggestions
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Quick Add")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                                QuickAddButton(text: "Buy groceries 🛒") { content = "Buy groceries" }
                                QuickAddButton(text: "Call mom 📞") { content = "Call mom" }
                                QuickAddButton(text: "Exercise 💪") { content = "Exercise" }
                                QuickAddButton(text: "Review PR 💻") { content = "Review PR" }
                            }
                        }
                        
                        Spacer(minLength: 40)
                    }
                    .padding()
                }
            }
            .navigationTitle("Add Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.optaTextSecondary)
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add") {
                        onAdd(content, dueOption.value, priority.rawValue)
                        dismiss()
                    }
                    .disabled(content.trimmingCharacters(in: .whitespaces).isEmpty)
                    .foregroundColor(.optaPrimary)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                isFocused = true
            }
        }
    }
}

struct DueOptionButton: View {
    let option: DueOption
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: option.icon)
                    .font(.caption2)
                Text(option.label)
                    .font(.caption)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(isSelected ? Color.optaPrimary.opacity(0.2) : Color.optaGlassBackground)
            .foregroundColor(isSelected ? .optaPrimary : .optaTextSecondary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.optaPrimary.opacity(0.5) : Color.optaGlassBorder, lineWidth: 1)
            )
        }
    }
}

struct PriorityButton: View {
    let priority: TaskPriority
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if priority.rawValue > 1 {
                    Image(systemName: "flag.fill")
                        .font(.caption2)
                }
                Text(priority.displayName)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(isSelected ? priorityColor.opacity(0.2) : Color.optaGlassBackground)
            .foregroundColor(isSelected ? priorityColor : .optaTextSecondary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? priorityColor.opacity(0.5) : Color.optaGlassBorder, lineWidth: 1)
            )
        }
    }
    
    private var priorityColor: Color {
        switch priority {
        case .urgent: return .optaNeonRed
        case .high: return .optaNeonAmber
        case .medium: return .optaNeonBlue
        case .normal: return .optaTextMuted
        }
    }
}

struct QuickAddButton: View {
    let text: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.caption)
                .foregroundColor(.optaTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.optaGlassBackground)
                .cornerRadius(8)
        }
    }
}

enum DueOption: CaseIterable {
    case none, today, tomorrow, nextWeek, custom
    
    var label: String {
        switch self {
        case .none: return "None"
        case .today: return "Today"
        case .tomorrow: return "Tomorrow"
        case .nextWeek: return "Next Week"
        case .custom: return "Custom"
        }
    }
    
    var icon: String {
        switch self {
        case .none: return "calendar.badge.minus"
        case .today: return "sun.max"
        case .tomorrow: return "sunrise"
        case .nextWeek: return "calendar"
        case .custom: return "calendar.badge.plus"
        }
    }
    
    var value: String? {
        switch self {
        case .none: return nil
        case .today: return "today"
        case .tomorrow: return "tomorrow"
        case .nextWeek: return "next week"
        case .custom: return nil
        }
    }
}

enum TaskViewMode: CaseIterable {
    case today, upcoming, overdue
    
    var title: String {
        switch self {
        case .today: return "Today"
        case .upcoming: return "Upcoming"
        case .overdue: return "Overdue"
        }
    }
    
    var icon: String {
        switch self {
        case .today: return "sun.max.fill"
        case .upcoming: return "calendar"
        case .overdue: return "exclamationmark.triangle.fill"
        }
    }
    
    var emptyIcon: String {
        switch self {
        case .today: return "checkmark.circle"
        case .upcoming: return "calendar"
        case .overdue: return "party.popper"
        }
    }
    
    var color: Color {
        switch self {
        case .today: return .optaNeonGreen
        case .upcoming: return .optaNeonBlue
        case .overdue: return .optaNeonRed
        }
    }
    
    var emptyMessage: String {
        switch self {
        case .today: return "No tasks for today"
        case .upcoming: return "No upcoming tasks"
        case .overdue: return "All caught up!"
        }
    }
}

enum TaskSortOption {
    case priority, dueDate, alphabetical
}

// MARK: - View Model

@MainActor
class TasksListViewModel: ObservableObject {
    @Published var dashboard: TaskDashboardData?
    @Published var isLoading = false
    @Published var error: String?
    @Published var sortBy: TaskSortOption = .priority
    
    private let api = APIService.shared
    
    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            dashboard = try await api.fetchTasksDashboard()

            // Schedule notification reminders for all tasks
            let allTasks = (dashboard?.todayTasks ?? []) +
                          (dashboard?.overdueTasks ?? []) +
                          (dashboard?.upcomingTasks ?? [])

            for task in allTasks {
                await MainActor.run {
                    NotificationManager.shared.scheduleTaskReminder(for: task)
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func refresh() async {
        await loadData()
    }
    
    func createTask(content: String, dueString: String?, priority: Int?) async {
        do {
            _ = try await api.createTask(
                content: content,
                dueString: dueString,
                priority: priority
            )
            await loadData()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func completeTask(taskId: String) async {
        do {
            try await api.completeTask(taskId: taskId)
            
            // Optimistically update UI
            if var dashboard = dashboard {
                let updatedStats = TaskStats(
                    todayCount: max(0, dashboard.stats.todayCount - 1),
                    overdueCount: dashboard.stats.overdueCount,
                    upcomingCount: dashboard.stats.upcomingCount,
                    totalActive: max(0, dashboard.stats.totalActive - 1)
                )
                
                self.dashboard = TaskDashboardData(
                    todayTasks: dashboard.todayTasks.filter { $0.id != taskId },
                    overdueTasks: dashboard.overdueTasks.filter { $0.id != taskId },
                    upcomingTasks: dashboard.upcomingTasks.filter { $0.id != taskId },
                    stats: updatedStats
                )
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func sortTasks(_ tasks: [OptaTask]) -> [OptaTask] {
        switch sortBy {
        case .priority:
            return tasks.sorted { $0.priority.rawValue > $1.priority.rawValue }
        case .dueDate:
            return tasks.sorted { (lhs, rhs) in
                guard let lhsDate = lhs.due?.displayDate else { return false }
                guard let rhsDate = rhs.due?.displayDate else { return true }
                return lhsDate < rhsDate
            }
        case .alphabetical:
            return tasks.sorted { $0.content < $1.content }
        }
    }
}

#Preview {
    TasksListView()
}
