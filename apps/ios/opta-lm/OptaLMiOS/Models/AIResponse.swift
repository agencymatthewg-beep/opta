import Foundation

// MARK: - AI Response Model

struct AICommandResponse: Codable {
    let success: Bool
    let message: String
    let actionType: String?
    let payload: [String: AnyCodable]?
    let newState: [String: AnyCodable]?
}

struct AIBriefingResponse: Codable {
    let success: Bool
    let briefing: Briefing
}

struct Briefing: Codable {
    let greeting: String
    let summary: String
    let stats: BriefingStats
    let nextEvents: [BriefingEvent]
}

struct BriefingStats: Codable {
    let tasksToday: Int
    let tasksTotal: Int
    let upcomingEvents: Int
    let unreadEmails: Int
}

struct BriefingEvent: Codable {
    let summary: String
    let start: String?
    
    var startDate: Date? {
        start?.isoDate
    }
}

struct QuickStatusResponse: Codable {
    let success: Bool
    let status: QuickStatus
    let spokenResponse: String
}

struct QuickStatus: Codable {
    let tasksToday: Int
    let nextEvent: String?
    let nextEventTime: String?
}

// MARK: - Chat Message

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let role: MessageRole
    let text: String
    let actionType: String?
    let timestamp: Date
    
    init(role: MessageRole, text: String, actionType: String? = nil) {
        self.role = role
        self.text = text
        self.actionType = actionType
        self.timestamp = Date()
    }
}

enum MessageRole {
    case user
    case assistant
}

// MARK: - Codable Any Helper

struct AnyCodable: Codable, Hashable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array
        } else {
            value = NSNull()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let dict = value as? [String: AnyCodable] {
            try container.encode(dict)
        } else if let array = value as? [AnyCodable] {
            try container.encode(array)
        } else {
            try container.encodeNil()
        }
    }
    
    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        // Simple equality check for common types
        if let l = lhs.value as? String, let r = rhs.value as? String {
            return l == r
        }
        if let l = lhs.value as? Int, let r = rhs.value as? Int {
            return l == r
        }
        if let l = lhs.value as? Bool, let r = rhs.value as? Bool {
            return l == r
        }
        return false
    }
    
    func hash(into hasher: inout Hasher) {
        if let string = value as? String {
            hasher.combine(string)
        } else if let int = value as? Int {
            hasher.combine(int)
        }
    }
}
