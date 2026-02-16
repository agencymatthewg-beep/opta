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
    public let type: FrameType
    public let id: String
    public let method: String
    public let params: AnyCodable?

    public init(method: String, params: AnyCodable? = nil) {
        self.type = .req
        self.id = UUID().uuidString
        self.method = method
        self.params = params
    }
}

/// A response frame received from gateway → client.
public struct ResponseFrame: Codable, Sendable {
    public let type: FrameType
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
    public let type: FrameType
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

// MARK: - Channel Type

/// The communication channel a session is routed through.
public enum ChannelType: String, Codable, Sendable, CaseIterable, Identifiable {
    case telegram
    case direct
    case whatsapp
    case discord

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .telegram: return "Telegram"
        case .direct: return "Direct"
        case .whatsapp: return "WhatsApp"
        case .discord: return "Discord"
        }
    }

    public var icon: String {
        switch self {
        case .telegram: return "paperplane.fill"
        case .direct: return "bolt.fill"
        case .whatsapp: return "phone.fill"
        case .discord: return "gamecontroller.fill"
        }
    }

    public var accentColor: String {
        switch self {
        case .telegram: return "optaBlue"
        case .direct: return "optaCoral"
        case .whatsapp: return "optaGreen"
        case .discord: return "optaIndigo"
        }
    }

    /// Whether chat.send should set deliver: true for this channel.
    public var shouldDeliver: Bool {
        switch self {
        case .telegram: return true
        case .direct: return false
        case .whatsapp: return true
        case .discord: return true
        }
    }
}

// MARK: - Chat Session Color

/// Color palette for custom chat sessions (max 5 per bot).
public enum ChatSessionColor: String, CaseIterable, Codable, Sendable {
    case purple, teal, pink, amber, cyan

    public var displayName: String { rawValue.capitalized }

    public var swiftUIColor: String {
        switch self {
        case .purple: return "optaNeonPurple"
        case .teal: return "optaCyan"
        case .pink: return "optaPink"
        case .amber: return "optaAmber"
        case .cyan: return "optaBlue"
        }
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
    public var channelType: ChannelType?
    public var colorTag: String?

    enum CodingKeys: String, CodingKey {
        case id, name, sessionKey, mode, createdAt, isPinned, channelType, colorTag
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        sessionKey = try container.decode(String.self, forKey: .sessionKey)
        mode = try container.decode(SessionMode.self, forKey: .mode)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        isPinned = try container.decode(Bool.self, forKey: .isPinned)
        channelType = try container.decodeIfPresent(ChannelType.self, forKey: .channelType)
        colorTag = try container.decodeIfPresent(String.self, forKey: .colorTag)
    }

    public init(
        id: String = UUID().uuidString,
        name: String,
        sessionKey: String = "main",
        mode: SessionMode = .synced,
        createdAt: Date = Date(),
        isPinned: Bool = false,
        channelType: ChannelType? = nil,
        colorTag: String? = nil
    ) {
        self.id = id
        self.name = name
        self.sessionKey = sessionKey
        self.mode = mode
        self.createdAt = createdAt
        self.isPinned = isPinned
        self.channelType = channelType
        self.colorTag = colorTag
    }

    /// The default synced session for a bot.
    public static func defaultSynced(botName: String) -> ChatSession {
        ChatSession(
            name: "Telegram",
            sessionKey: "main",
            mode: .synced,
            isPinned: true,
            channelType: .telegram
        )
    }

    /// Resolve deliver flag: channelType takes precedence over mode.
    public var resolvedShouldDeliver: Bool {
        channelType?.shouldDeliver ?? mode.shouldDeliver
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

// MARK: - SendableJSON (type-safe, Sendable JSON value)

/// A recursive, fully Sendable representation of a JSON value.
/// Replaces `Any` with a closed enum so `AnyCodable` can be properly `Sendable`.
public enum SendableJSON: Sendable, Equatable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([SendableJSON])
    case object([String: SendableJSON])

    /// Convert from an arbitrary `Any` (e.g. from JSONSerialization).
    /// Unknown types become `.null`.
    public static func from(_ value: Any) -> SendableJSON {
        switch value {
        case is NSNull:
            return .null
        case let b as Bool:
            return .bool(b)
        case let i as Int:
            return .int(i)
        case let d as Double:
            return .double(d)
        case let s as String:
            return .string(s)
        case let arr as [Any]:
            return .array(arr.map { from($0) })
        case let dict as [String: Any]:
            return .object(dict.mapValues { from($0) })
        default:
            return .null
        }
    }

    /// Convert back to untyped `Any` for legacy callers that expect `[String: Any]` etc.
    public var anyValue: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let b): return b
        case .int(let i): return i
        case .double(let d): return d
        case .string(let s): return s
        case .array(let arr): return arr.map(\.anyValue)
        case .object(let dict): return dict.mapValues(\.anyValue)
        }
    }
}

// MARK: - AnyCodable (lightweight type-erased JSON)

/// A type-erased `Codable` wrapper for arbitrary JSON values.
/// Used to handle the dynamic payloads in the OpenClaw protocol.
/// Internally stores a `SendableJSON` enum for proper `Sendable` conformance.
public struct AnyCodable: Codable, Sendable {
    public let storage: SendableJSON

    /// The underlying value as `Any` (for legacy callers).
    public var value: Any { storage.anyValue }

    public init(_ value: Any) {
        self.storage = SendableJSON.from(value)
    }

    init(storage: SendableJSON) {
        self.storage = storage
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.storage = .null
        } else if let bool = try? container.decode(Bool.self) {
            self.storage = .bool(bool)
        } else if let int = try? container.decode(Int.self) {
            self.storage = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self.storage = .double(double)
        } else if let string = try? container.decode(String.self) {
            self.storage = .string(string)
        } else if let array = try? container.decode([AnyCodable].self) {
            self.storage = .array(array.map(\.storage))
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.storage = .object(dict.mapValues(\.storage))
        } else {
            self.storage = .null
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch storage {
        case .null:
            try container.encodeNil()
        case .bool(let b):
            try container.encode(b)
        case .int(let i):
            try container.encode(i)
        case .double(let d):
            try container.encode(d)
        case .string(let s):
            try container.encode(s)
        case .array(let arr):
            try container.encode(arr.map { AnyCodable(storage: $0) })
        case .object(let dict):
            try container.encode(dict.mapValues { AnyCodable(storage: $0) })
        }
    }

    // MARK: - Convenience Accessors

    /// Access as dictionary.
    public var dict: [String: Any]? { value as? [String: Any] }

    /// Access as array.
    public var array: [Any]? { value as? [Any] }

    /// Access as string.
    public var string: String? {
        if case .string(let s) = storage { return s }
        return nil
    }

    /// Access as int.
    public var int: Int? {
        if case .int(let i) = storage { return i }
        return nil
    }

    /// Access as bool.
    public var bool: Bool? {
        if case .bool(let b) = storage { return b }
        return nil
    }

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

// MARK: - Gateway Config

/// Response from `config.get` — raw config text + hash for optimistic concurrency.
/// Uses `SendableJSON` internally for proper `Sendable` conformance.
public struct GatewayConfig: Sendable {
    public let raw: String
    public let hash: String
    private let _parsed: SendableJSON

    /// Parsed config as `[String: Any]` (convenience accessor for legacy callers).
    public var parsed: [String: Any] {
        _parsed.anyValue as? [String: Any] ?? [:]
    }

    public init(raw: String, hash: String, parsed: [String: Any]) {
        self.raw = raw
        self.hash = hash
        self._parsed = SendableJSON.from(parsed)
    }
}

/// Parameters for `config.patch` — partial config update.
public struct ConfigPatchParams: Codable, Sendable {
    public let raw: String
    public let baseHash: String
    public let note: String?

    public init(raw: String, baseHash: String, note: String? = nil) {
        self.raw = raw
        self.baseHash = baseHash
        self.note = note
    }
}

/// Parameters for `gateway.restart` — full config replacement + restart.
public struct GatewayRestartParams: Codable, Sendable {
    public let raw: String
    public let baseHash: String?
    public let note: String?

    public init(raw: String, baseHash: String? = nil, note: String? = nil) {
        self.raw = raw
        self.baseHash = baseHash
        self.note = note
    }
}

// MARK: - Gateway Health & Status

/// Response from `health` RPC.
public struct GatewayHealth: Sendable {
    public let status: String
    public let uptime: Double
    public let version: String
    public let model: String?
    public let sessions: Int
    public let cronJobs: Int

    public init(status: String, uptime: Double, version: String,
                model: String? = nil, sessions: Int = 0, cronJobs: Int = 0) {
        self.status = status
        self.uptime = uptime
        self.version = version
        self.model = model
        self.sessions = sessions
        self.cronJobs = cronJobs
    }
}

/// Response from `status` RPC.
public struct GatewayStatus: Sendable {
    public let version: String
    public let model: String?
    public let channels: [String: ChannelStatus]

    public init(version: String, model: String? = nil, channels: [String: ChannelStatus] = [:]) {
        self.version = version
        self.model = model
        self.channels = channels
    }
}

public struct ChannelStatus: Sendable {
    public let connected: Bool
    public let type: String

    public init(connected: Bool, type: String) {
        self.connected = connected
        self.type = type
    }
}

// MARK: - Models

/// A model available on the gateway.
public struct GatewayModel: Identifiable, Sendable {
    public let id: String
    public let name: String?
    public let provider: String?

    public init(id: String, name: String? = nil, provider: String? = nil) {
        self.id = id
        self.name = name
        self.provider = provider
    }
}

// MARK: - Cron Job Creation

/// Parameters for `cron.add` — new job.
public struct CronJobCreate: Codable, Sendable {
    public let name: String?
    public let schedule: CronScheduleCreate
    public let sessionTarget: String
    public let payload: CronPayloadCreate
    public let delivery: CronDeliveryCreate?
    public let enabled: Bool

    public init(name: String?, schedule: CronScheduleCreate,
                sessionTarget: String = "main", payload: CronPayloadCreate,
                delivery: CronDeliveryCreate? = nil, enabled: Bool = true) {
        self.name = name
        self.schedule = schedule
        self.sessionTarget = sessionTarget
        self.payload = payload
        self.delivery = delivery
        self.enabled = enabled
    }
}

public struct CronScheduleCreate: Codable, Sendable {
    public let kind: String
    public let expression: String?
    public let intervalMs: Int?
    public let date: Double?
    public let tz: String?

    public init(kind: String, expression: String? = nil, intervalMs: Int? = nil,
                date: Double? = nil, tz: String? = nil) {
        self.kind = kind
        self.expression = expression
        self.intervalMs = intervalMs
        self.date = date
        self.tz = tz
    }
}

public struct CronPayloadCreate: Codable, Sendable {
    public let kind: String
    public let message: String?

    public init(kind: String, message: String? = nil) {
        self.kind = kind
        self.message = message
    }
}

public struct CronDeliveryCreate: Codable, Sendable {
    public let mode: String
    public let channel: String?
    public let to: String?

    public init(mode: String = "none", channel: String? = nil, to: String? = nil) {
        self.mode = mode
        self.channel = channel
        self.to = to
    }
}

// MARK: - Cron Run History

/// A single execution record from `cron.runs`.
public struct CronRun: Identifiable, Sendable {
    public let id: String
    public let startedAt: Date?
    public let finishedAt: Date?
    public let status: String
    public let error: String?

    public init(id: String, startedAt: Date? = nil, finishedAt: Date? = nil,
                status: String = "ok", error: String? = nil) {
        self.id = id
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.status = status
        self.error = error
    }
}

// MARK: - Sessions Patch

/// Parameters for `sessions.patch`.
public struct SessionsPatchParams: Codable, Sendable {
    public let sessionKey: String
    public let patch: AnyCodable

    public init(sessionKey: String, patch: [String: Any]) {
        self.sessionKey = sessionKey
        self.patch = AnyCodable(patch)
    }
}

// MARK: - Device Pairing

/// Response from `gateway.discover` — lists available bots on a gateway.
public struct GatewayDiscoverResponse: Codable, Sendable {
    public let gatewayFingerprint: String
    public let gatewayName: String
    public let bots: [DiscoveredBot]
    public let pairingRequired: Bool
}

/// A bot discovered via `gateway.discover`.
public struct DiscoveredBot: Codable, Sendable, Identifiable {
    public let botId: String
    public let name: String
    public let emoji: String
    public let status: String
    public var id: String { botId }
}

/// Parameters for `device.pair` — pair this device with specific bots.
public struct DevicePairParams: Codable, Sendable {
    public let deviceId: String
    public let deviceName: String
    public let platform: String
    public let requestedBots: [String]
}

/// Response from `device.pair` — contains tokens for each paired bot.
public struct DevicePairResponse: Codable, Sendable {
    public let pairings: [BotPairingResult]
    public let gatewayFingerprint: String
}

/// A single bot pairing result with its token.
public struct BotPairingResult: Codable, Sendable {
    public let botId: String
    public let token: String
    public let name: String
    public let emoji: String
}

/// Parameters for `device.unpair` — remove pairing for specific bots.
public struct DeviceUnpairParams: Codable, Sendable {
    public let deviceId: String
    public let botIds: [String]
}
