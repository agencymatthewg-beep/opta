import Foundation

struct Session: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let model: String
    let messageCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, model
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct SessionListResponse: Codable, Sendable {
    let sessions: [Session]
    let total: Int
}

struct SessionFull: Codable, Sendable {
    let id: String
    let title: String
    let model: String
    let messages: [SessionMessage]
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct SessionMessage: Codable, Sendable {
    let role: String
    let content: String
}
