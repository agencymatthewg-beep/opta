import Foundation

struct ChatMessage: Identifiable, Codable, Sendable {
    let id: String
    let role: MessageRole
    var content: String
    let model: String?
    let tokensUsed: Int?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, role, content, model
        case tokensUsed = "tokens_used"
        case createdAt = "created_at"
    }

    init(id: String = UUID().uuidString, role: MessageRole, content: String, model: String? = nil, tokensUsed: Int? = nil, createdAt: Date = .now) {
        self.id = id
        self.role = role
        self.content = content
        self.model = model
        self.tokensUsed = tokensUsed
        self.createdAt = createdAt
    }
}

enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
    case system
}

// MARK: - OpenAI-compatible request/response types

struct ChatCompletionRequest: Codable, Sendable {
    let model: String
    let messages: [ChatMessageParam]
    let stream: Bool
    let temperature: Double?
    let maxTokens: Int?

    enum CodingKeys: String, CodingKey {
        case model, messages, stream, temperature
        case maxTokens = "max_tokens"
    }
}

struct ChatMessageParam: Codable, Sendable {
    let role: String
    let content: String
}

struct ChatCompletionChunk: Codable, Sendable {
    let choices: [ChunkChoice]
}

struct ChunkChoice: Codable, Sendable {
    let delta: ChunkDelta
}

struct ChunkDelta: Codable, Sendable {
    let content: String?
}
