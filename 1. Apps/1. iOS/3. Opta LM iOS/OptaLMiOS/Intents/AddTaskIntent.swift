import AppIntents

// MARK: - Add Task Intent

struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task to Opta"
    static var description = IntentDescription("Add a new task to your Opta dashboard")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Task")
    var taskContent: String
    
    @Parameter(title: "Due Date")
    var dueDate: Date?
    
    @Parameter(title: "Priority", default: .normal)
    var priority: TaskPriorityEntity
    
    static var parameterSummary: some ParameterSummary {
        Summary("Add \(\.$taskContent)") {
            \.$dueDate
            \.$priority
        }
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        // Convert due date to string
        var dueString: String? = nil
        if let date = dueDate {
            if Calendar.current.isDateInToday(date) {
                dueString = "today"
            } else if Calendar.current.isDateInTomorrow(date) {
                dueString = "tomorrow"
            } else {
                dueString = date.todoistDateString
            }
        }
        
        do {
            let task = try await api.createTask(
                content: taskContent,
                dueString: dueString,
                priority: priority.rawPriority
            )
            
            var response = "Added '\(task.content)' to your tasks."
            if let due = task.due {
                response += " Due \(due.string)."
            }
            
            return .result(dialog: IntentDialog(stringLiteral: response))
            
        } catch {
            return .result(dialog: "Sorry, I couldn't add that task. Please try again.")
        }
    }
}

// MARK: - Task Priority Entity

enum TaskPriorityEntity: String, AppEnum {
    case normal, medium, high, urgent
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Priority")
    
    static var caseDisplayRepresentations: [TaskPriorityEntity: DisplayRepresentation] = [
        .normal: DisplayRepresentation(title: "Normal"),
        .medium: DisplayRepresentation(title: "Medium"),
        .high: DisplayRepresentation(title: "High"),
        .urgent: DisplayRepresentation(title: "Urgent")
    ]
    
    var rawPriority: Int {
        switch self {
        case .normal: return 1
        case .medium: return 2
        case .high: return 3
        case .urgent: return 4
        }
    }
}

// MARK: - Complete Task Intent

struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task in Opta"
    static var description = IntentDescription("Mark a task as complete")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Task")
    var task: TaskEntity?
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let task = task else {
            // If no task specified, complete the first task for today
            let api = APIService.shared
            
            do {
                let tasks = try await api.fetchTodayTasks()
                
                guard let firstTask = tasks.first else {
                    return .result(dialog: "You have no tasks for today.")
                }
                
                try await api.completeTask(taskId: firstTask.id)
                return .result(dialog: "Completed '\(firstTask.content)'.")
                
            } catch {
                return .result(dialog: "Sorry, I couldn't complete that task.")
            }
        }
        
        // Complete the specified task
        let api = APIService.shared
        do {
            try await api.completeTask(taskId: task.id)
            return .result(dialog: "Completed '\(task.name)'.")
        } catch {
            return .result(dialog: "Sorry, I couldn't complete that task.")
        }
    }
}

// MARK: - Task Entity for Siri

struct TaskEntity: AppEntity {
    var id: String
    var name: String
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Task")
    static var defaultQuery = TaskEntityQuery()
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: LocalizedStringResource(stringLiteral: name))
    }
}

struct TaskEntityQuery: EntityQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [TaskEntity] {
        // Fetch tasks and return matching ones
        let api = APIService.shared
        let dashboard = try await api.fetchTasksDashboard()
        
        let allTasks = dashboard.todayTasks + dashboard.overdueTasks + dashboard.upcomingTasks
        
        return allTasks
            .filter { identifiers.contains($0.id) }
            .map { TaskEntity(id: $0.id, name: $0.content) }
    }
    
    @MainActor
    func suggestedEntities() async throws -> [TaskEntity] {
        // Return today's tasks as suggestions
        let api = APIService.shared
        let tasks = try await api.fetchTodayTasks()
        
        return tasks.prefix(5).map { TaskEntity(id: $0.id, name: $0.content) }
    }
}
