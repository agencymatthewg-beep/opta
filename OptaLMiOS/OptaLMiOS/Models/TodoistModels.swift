import Foundation

// MARK: - Todoist Models

/// Todoist task representation from REST API v2
struct TodoistTask: Identifiable, Codable, Hashable {
    let id: String
    let content: String
    let description: String
    let projectId: String
    let sectionId: String?
    let parentId: String?
    let order: Int
    let priority: Int // 1-4 (4 is urgent)
    let due: TodoistDue?
    let labels: [String]
    let commentCount: Int
    let creatorId: String
    let createdAt: String
    let assigneeId: String?
    let assignerId: String?
    let isCompleted: Bool
    let url: String

    enum CodingKeys: String, CodingKey {
        case id, content, description, order, priority, due, labels, url
        case projectId = "project_id"
        case sectionId = "section_id"
        case parentId = "parent_id"
        case commentCount = "comment_count"
        case creatorId = "creator_id"
        case createdAt = "created_at"
        case assigneeId = "assignee_id"
        case assignerId = "assigner_id"
        case isCompleted = "is_completed"
    }

    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }

    /// Convert to OptaTask for unified display
    func toOptaTask(source: TaskSource = .todoist) -> OptaTask {
        let taskPriority: TaskPriority
        switch priority {
        case 4: taskPriority = .urgent
        case 3: taskPriority = .high
        case 2: taskPriority = .medium
        default: taskPriority = .normal
        }

        let taskDue = due.map { todoistDue -> TaskDue in
            TaskDue(
                date: todoistDue.date,
                string: todoistDue.string,
                datetime: todoistDue.datetime,
                timezone: nil,
                isRecurring: todoistDue.isRecurring
            )
        }

        return OptaTask(
            id: id,
            content: content,
            description: description.isEmpty ? nil : description,
            projectId: projectId,
            priority: taskPriority,
            due: taskDue,
            labels: labels,
            isCompleted: isCompleted,
            createdAt: createdDate,
            source: source,
            todoistId: id,
            lastSyncedAt: Date()
        )
    }
}

/// Todoist due date representation
struct TodoistDue: Codable, Hashable {
    let date: String // YYYY-MM-DD
    let string: String // Natural language ("tomorrow", "next Monday")
    let datetime: String? // ISO 8601 format with timezone
    let timezone: String?
    let isRecurring: Bool

    enum CodingKeys: String, CodingKey {
        case date, string, datetime, timezone
        case isRecurring = "is_recurring"
    }

    var displayDate: Date? {
        if let datetime = datetime {
            return ISO8601DateFormatter().date(from: datetime)
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: date)
    }
}

/// Todoist project representation
struct TodoistProject: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let color: String
    let parentId: String?
    let order: Int
    let commentCount: Int
    let isShared: Bool
    let isFavorite: Bool
    let isInboxProject: Bool
    let isTeamInbox: Bool
    let viewStyle: String
    let url: String

    enum CodingKeys: String, CodingKey {
        case id, name, color, order, url
        case parentId = "parent_id"
        case commentCount = "comment_count"
        case isShared = "is_shared"
        case isFavorite = "is_favorite"
        case isInboxProject = "is_inbox_project"
        case isTeamInbox = "is_team_inbox"
        case viewStyle = "view_style"
    }
}

/// Todoist section representation
struct TodoistSection: Identifiable, Codable, Hashable {
    let id: String
    let projectId: String
    let order: Int
    let name: String

    enum CodingKeys: String, CodingKey {
        case id, order, name
        case projectId = "project_id"
    }
}

/// Todoist label representation
struct TodoistLabel: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let color: String
    let order: Int
    let isFavorite: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, color, order
        case isFavorite = "is_favorite"
    }
}

// MARK: - OAuth Models

/// Todoist OAuth token response
struct TodoistTokenResponse: Codable {
    let accessToken: String
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
    }
}

/// Todoist OAuth error response
struct TodoistOAuthError: Codable, Error {
    let error: String
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
    }
}

// MARK: - Request/Response Models

/// Request to create a Todoist task
struct TodoistTaskRequest: Codable {
    let content: String
    let description: String?
    let projectId: String?
    let sectionId: String?
    let parentId: String?
    let order: Int?
    let labels: [String]?
    let priority: Int? // 1-4 (4 is urgent)
    let dueString: String?
    let dueDate: String?
    let dueDatetime: String?
    let dueLang: String?
    let assigneeId: String?

    enum CodingKeys: String, CodingKey {
        case content, description, order, labels, priority
        case projectId = "project_id"
        case sectionId = "section_id"
        case parentId = "parent_id"
        case dueString = "due_string"
        case dueDate = "due_date"
        case dueDatetime = "due_datetime"
        case dueLang = "due_lang"
        case assigneeId = "assignee_id"
    }

    init(content: String, dueString: String? = nil, priority: TaskPriority? = nil, description: String? = nil, projectId: String? = nil) {
        self.content = content
        self.description = description
        self.projectId = projectId
        self.sectionId = nil
        self.parentId = nil
        self.order = nil
        self.labels = nil
        self.dueString = dueString
        self.dueDate = nil
        self.dueDatetime = nil
        self.dueLang = "en"
        self.assigneeId = nil

        // Convert TaskPriority to Todoist priority (1-4)
        if let priority = priority {
            switch priority {
            case .urgent: self.priority = 4
            case .high: self.priority = 3
            case .medium: self.priority = 2
            case .normal: self.priority = 1
            }
        } else {
            self.priority = 1
        }
    }
}

/// Response from Todoist API (generic)
struct TodoistAPIResponse<T: Codable>: Codable {
    let data: T?
    let error: String?
}

// MARK: - Sync Models

/// Task source enum to track where tasks come from
enum TaskSource: String, Codable {
    case backend = "backend"        // Backend API (Google Tasks)
    case todoist = "todoist"        // Direct Todoist API
    case appleReminders = "apple"   // Apple Reminders (EventKit)
    case hybrid = "hybrid"          // Merged from multiple sources
}

/// Extended OptaTask with sync tracking (extension of existing Task.swift)
extension OptaTask {
    init(id: String, content: String, description: String?, projectId: String?, priority: TaskPriority, due: TaskDue?, labels: [String], isCompleted: Bool, createdAt: Date?, source: TaskSource = .backend, todoistId: String? = nil, ekReminderIdentifier: String? = nil, lastSyncedAt: Date? = nil) {
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
}

/// Pending task change for offline queue
struct PendingTaskChange: Identifiable, Codable {
    let id: String
    let type: ChangeType
    let taskId: String?
    let content: String?
    let dueString: String?
    let priority: TaskPriority?
    let timestamp: Date
    let retryCount: Int

    enum ChangeType: String, Codable {
        case create
        case complete
        case delete
        case update
    }

    init(id: String = UUID().uuidString, type: ChangeType, taskId: String? = nil, content: String? = nil, dueString: String? = nil, priority: TaskPriority? = nil, timestamp: Date = Date(), retryCount: Int = 0) {
        self.id = id
        self.type = type
        self.taskId = taskId
        self.content = content
        self.dueString = dueString
        self.priority = priority
        self.timestamp = timestamp
        self.retryCount = retryCount
    }
}

/// Rate limit tracker for Todoist API
struct RateLimitInfo {
    var requestsRemaining: Int
    var resetTime: Date

    var isLimited: Bool {
        requestsRemaining <= 0 && Date() < resetTime
    }

    mutating func recordRequest() {
        requestsRemaining = max(0, requestsRemaining - 1)
    }

    mutating func reset() {
        requestsRemaining = 450 // Todoist limit: 450 requests / 15 minutes
        resetTime = Date().addingTimeInterval(15 * 60) // 15 minutes from now
    }
}

// isoDate extension is defined in Date+Extensions.swift
