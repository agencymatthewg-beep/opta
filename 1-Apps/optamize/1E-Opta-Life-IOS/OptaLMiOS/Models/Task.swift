import Foundation

// MARK: - Task Model (Todoist)

struct OptaTask: Identifiable, Codable, Hashable {
    let id: String
    let content: String
    let description: String?
    let projectId: String?
    let priority: TaskPriority
    let due: TaskDue?
    let labels: [String]
    let isCompleted: Bool
    let createdAt: Date?

    // Sync tracking fields (will be enabled when TodoistModels.swift compiles correctly)
    var ekReminderIdentifier: String? = nil
    var todoistId: String? = nil
    var source: TaskSource = .backend
    var lastSyncedAt: Date? = nil
    
    enum CodingKeys: String, CodingKey {
        case id, content, description, priority, due, labels
        case projectId = "project_id"
        case isCompleted = "is_completed"
        case createdAt = "created_at"
    }
    
    // Memberwise initializer for programmatic creation
    init(
        id: String,
        content: String,
        description: String? = nil,
        projectId: String? = nil,
        priority: TaskPriority = .normal,
        due: TaskDue? = nil,
        labels: [String] = [],
        isCompleted: Bool = false,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.content = content
        self.description = description
        self.projectId = projectId
        self.priority = priority
        self.due = due
        self.labels = labels
        self.isCompleted = isCompleted
        self.createdAt = createdAt
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        content = try container.decode(String.self, forKey: .content)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        projectId = try container.decodeIfPresent(String.self, forKey: .projectId)
        
        let priorityInt = try container.decodeIfPresent(Int.self, forKey: .priority) ?? 1
        priority = TaskPriority(rawValue: priorityInt) ?? .normal
        
        due = try container.decodeIfPresent(TaskDue.self, forKey: .due)
        labels = try container.decodeIfPresent([String].self, forKey: .labels) ?? []
        isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
        
        if let dateString = try container.decodeIfPresent(String.self, forKey: .createdAt) {
            createdAt = dateString.isoDate
        } else {
            createdAt = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(content, forKey: .content)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(projectId, forKey: .projectId)
        try container.encode(priority.rawValue, forKey: .priority)
        try container.encodeIfPresent(due, forKey: .due)
        try container.encode(labels, forKey: .labels)
        try container.encode(isCompleted, forKey: .isCompleted)
    }
}

struct TaskDue: Codable, Hashable {
    let date: String
    let string: String
    let datetime: String?
    let timezone: String?
    let isRecurring: Bool
    
    enum CodingKeys: String, CodingKey {
        case date, string, datetime, timezone
        case isRecurring = "is_recurring"
    }
    
    var displayDate: Date? {
        datetime?.isoDate ?? date.isoDate
    }
}

enum TaskPriority: Int, Codable, CaseIterable {
    case normal = 1
    case medium = 2
    case high = 3
    case urgent = 4
    
    var color: String {
        switch self {
        case .normal: return "optaTextMuted"
        case .medium: return "optaNeonBlue"
        case .high: return "optaNeonAmber"
        case .urgent: return "optaNeonRed"
        }
    }
    
    var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .medium: return "Medium"
        case .high: return "High"
        case .urgent: return "Urgent"
        }
    }
}

// MARK: - Task Dashboard Data

struct TaskDashboardData: Codable {
    let todayTasks: [OptaTask]
    let overdueTasks: [OptaTask]
    let upcomingTasks: [OptaTask]
    let stats: TaskStats
}

struct TaskStats: Codable {
    let todayCount: Int
    let overdueCount: Int
    let upcomingCount: Int
    let totalActive: Int
}
