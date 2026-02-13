//
//  OpenClawProtocol.swift
//  OptaMolt
//
//  OpenClaw Gateway WebSocket protocol types (Protocol v3).
//  Defines all frame types, methods, and event payloads for
//  communicating with the OpenClaw Gateway.
//

import Foundation

// MARK: - Frame Types

/// Base frame type identifier sent over the WebSocket.
public enum FrameType: String, Codable, Sendable {
    case req
    case res
    case event
}

/// A request frame sent from client → gateway.
public struct RequestFrame: Codable, Sendable {
    public let type: String // always "req"
    public let id: String
    public let method: String
    public let params: AnyCodable?
    
    public init(method: String, params: AnyCodable? = nil) {
        self.type = "req"
        self.id = UUID().uuidString
        self.method = method
        self.params = params
    }
}

/// A response frame received from gateway → client.
public struct ResponseFrame: Codable, Sendable {
    public let type: String // always "res"
    public let id: String
    public let ok: Bool
    public let payload: AnyCodable?
    public let error: ResponseError?
    
    public struct ResponseError: Codable, Sendable {
        public let message: String
        public let code: String?
    }
}

/// An event frame received from gateway → client.
public struct EventFrame: Codable, Sendable {
    public let type: String // always "event"
    public let event: String
    public let payload: AnyCodable?
    public let seq: Int?
}

// MARK: - Connect

/// Parameters for the `connect` request (handshake).
/// Must match gateway's ConnectParamsSchema exactly (additionalProperties: false).
public struct ConnectParams: Codable, Sendable {
    public let minProtocol: Int
    public let maxProtocol: Int
    public let client: ClientInfo
    public let role: String
    public let scopes: [String]
    public let auth: ConnectAuth?
    public let locale: String?
    
    public init(
        token: String?,
        clientId: String = "openclaw-control-ui",
        clientVersion: String = "0.1.0"
    ) {
        self.minProtocol = 3
        self.maxProtocol = 3
        #if os(iOS)
        let platformName = "iOS"
        #elseif os(macOS)
        let platformName = "macOS"
        #else
        let platformName = "unknown"
        #endif
        self.client = ClientInfo(
            id: clientId,
            version: clientVersion,
            platform: platformName,
            mode: "webchat"
        )
        self.role = "operator"
        self.scopes = ["operator.admin", "operator.approvals", "operator.pairing"]
        self.auth = token.map { ConnectAuth(token: $0) }
        self.locale = Locale.current.identifier
    }
}

public struct ClientInfo: Codable, Sendable {
    public let id: String
    public let version: String
    public let platform: String
    public let mode: String
}

public struct ConnectAuth: Codable, Sendable {
    public let token: String
}

// MARK: - Chat Methods

/// Parameters for `chat.history` request.
public struct ChatHistoryParams: Codable, Sendable {
    public let sessionKey: String
    public let limit: Int
    public let before: String?
    
    public init(sessionKey: String, limit: Int = 200, before: String? = nil) {
        self.sessionKey = sessionKey
        self.limit = limit
        self.before = before
    }
}

/// Response from `chat.history`.
public struct ChatHistoryResponse: Sendable {
    public let messages: [GatewayMessage]
    public let thinkingLevel: String?
}

/// A message from the gateway history.
public struct GatewayMessage: Identifiable, Sendable {
    public let id: String
    public let role: String // "user" | "assistant"
    public let content: String
    public let timestamp: Date?
    public let runId: String?
    
    public init(id: String = UUID().uuidString, role: String, content: String, timestamp: Date? = nil, runId: String? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.runId = runId
    }
}

/// Parameters for `chat.send` request.
public struct ChatSendParams: Codable, Sendable {
    public let sessionKey: String
    public let message: String
    public let deliver: Bool
    public let idempotencyKey: String
    public let attachments: [ChatSendAttachment]?

    public init(sessionKey: String, message: String, deliver: Bool = false, attachments: [ChatSendAttachment]? = nil) {
        self.sessionKey = sessionKey
        self.message = message
        self.deliver = deliver
        self.idempotencyKey = UUID().uuidString
        self.attachments = attachments?.isEmpty == true ? nil : attachments
    }
}

/// Base64-encoded attachment for the chat.send payload.
public struct ChatSendAttachment: Codable, Sendable {
    public let filename: String
    public let mimeType: String
    public let data: String // base64-encoded

    public init(filename: String, mimeType: String, base64Data: String) {
        self.filename = filename
        self.mimeType = mimeType
        self.data = base64Data
    }

    /// Create from a ChatAttachment model.
    public init?(from attachment: ChatAttachment) {
        guard let rawData = attachment.data else { return nil }
        self.filename = attachment.filename
        self.mimeType = attachment.mimeType
        self.data = rawData.base64EncodedString()
    }
}

// MARK: - Session Mode

/// How a chat session routes messages relative to external channels (e.g. Telegram).
public enum SessionMode: String, Codable, Sendable, CaseIterable {
    /// Messages are mirrored to/from the external channel (e.g. Telegram).
    /// Sends use `deliver: true`. Incoming channel messages appear in the session.
    case synced
    
    /// Messages go directly to the gateway — no channel delivery.
    /// Uses the same session key (shares context) but responses stay in OptaPlus.
    case direct
    
    /// A completely independent session with its own context.
    /// No shared history with the main session or external channels.
    case isolated
    
    public var label: String {
        switch self {
        case .synced: return "Synced"
        case .direct: return "Direct"
        case .isolated: return "Isolated"
        }
    }
    
    public var icon: String {
        switch self {
        case .synced: return "link"
        case .direct: return "bolt"
        case .isolated: return "lock.shield"
        }
    }
    
    public var description: String {
        switch self {
        case .synced: return "Messages sync with Telegram"
        case .direct: return "Direct to bot, same context"
        case .isolated: return "Separate conversation"
        }
    }
    
    /// Whether chat.send should set deliver: true
    public var shouldDeliver: Bool {
        self == .synced
    }
}

/// A chat session within a bot connection.
public struct ChatSession: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public var name: String
    public var sessionKey: String
    public var mode: SessionMode
    public var createdAt: Date
    public var isPinned: Bool
    
    public init(
        id: String = UUID().uuidString,
        name: String,
        sessionKey: String = "main",
        mode: SessionMode = .synced,
        createdAt: Date = Date(),
        isPinned: Bool = false
    ) {
        self.id = id
        self.name = name
        self.sessionKey = sessionKey
        self.mode = mode
        self.createdAt = createdAt
        self.isPinned = isPinned
    }
    
    /// The default synced session for a bot.
    public static func defaultSynced(botName: String) -> ChatSession {
        ChatSession(
            name: "Telegram",
            sessionKey: "main",
            mode: .synced,
            isPinned: true
        )
    }
}

/// Parameters for `chat.abort` request.
public struct ChatAbortParams: Codable, Sendable {
    public let sessionKey: String
    
    public init(sessionKey: String) {
        self.sessionKey = sessionKey
    }
}

// MARK: - Chat Events

/// State of a streaming chat event.
public enum ChatEventState: String, Sendable {
    case delta
    case final_ = "final"
    case aborted
    case error
}

// MARK: - Sessions

/// Parameters for `sessions.list` request.
public struct SessionsListParams: Codable, Sendable {
    public let activeMinutes: Int?
    
    public init(activeMinutes: Int? = 120) {
        self.activeMinutes = activeMinutes
    }
}

/// A session entry from the gateway.
public struct GatewaySession: Identifiable, Sendable {
    public let id: String // sessionKey
    public let agentId: String?
    public let kind: String?
    public let label: String?
    public let lastActiveAt: Date?
    public let channel: String?
    
    public var displayName: String {
        if let label = label, !label.isEmpty { return label }
        if let agentId = agentId, !agentId.isEmpty {
            return agentId.capitalized
        }
        return id
    }
}

// MARK: - AnyCodable (lightweight type-erased JSON)

/// A type-erased `Codable` wrapper for arbitrary JSON values.
/// Used to handle the dynamic payloads in the OpenClaw protocol.
public struct AnyCodable: Codable, Sendable, @unchecked Sendable {
    public let value: Any
    
    public init(_ value: Any) {
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map(\.value)
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues(\.value)
        } else {
            self.value = NSNull()
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
    
    // MARK: - Convenience Accessors
    
    /// Access as dictionary.
    public var dict: [String: Any]? { value as? [String: Any] }
    
    /// Access as array.
    public var array: [Any]? { value as? [Any] }
    
    /// Access as string.
    public var string: String? { value as? String }
    
    /// Access as int.
    public var int: Int? { value as? Int }
    
    /// Access as bool.
    public var bool: Bool? { value as? Bool }
    
    /// Access nested key.
    public subscript(key: String) -> Any? {
        (value as? [String: Any])?[key]
    }
}

// MARK: - JSON Helpers

/// Encode a Codable value to AnyCodable for use in request params.
public func encodeParams<T: Encodable>(_ value: T) -> AnyCodable? {
    guard let data = try? JSONEncoder().encode(value),
          let json = try? JSONSerialization.jsonObject(with: data) else {
        return nil
    }
    return AnyCodable(json)
}
