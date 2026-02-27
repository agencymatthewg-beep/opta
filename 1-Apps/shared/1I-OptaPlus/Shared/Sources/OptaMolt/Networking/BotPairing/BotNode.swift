//
//  BotNode.swift
//  OptaMolt
//
//  Core model representing a bot in the pairing constellation.
//

import Foundation

public struct BotNode: Identifiable, Codable, Hashable, Sendable {
    public let botId: String
    public let gatewayFingerprint: String
    public var name: String
    public var emoji: String
    public var gatewayHost: String?
    public var gatewayPort: Int?
    public var remoteURL: String?
    public var connectionMode: BotConfig.ConnectionMode
    public var state: BotConnectionState
    public var lastSeen: Date
    public var lastLatency: TimeInterval?

    public var id: String { "\(gatewayFingerprint):\(botId)" }

    public init(
        botId: String,
        gatewayFingerprint: String,
        name: String,
        emoji: String,
        gatewayHost: String? = nil,
        gatewayPort: Int? = nil,
        remoteURL: String? = nil,
        connectionMode: BotConfig.ConnectionMode = .auto,
        state: BotConnectionState = .discovered,
        lastSeen: Date = Date()
    ) {
        self.botId = botId
        self.gatewayFingerprint = gatewayFingerprint
        self.name = name
        self.emoji = emoji
        self.gatewayHost = gatewayHost
        self.gatewayPort = gatewayPort
        self.remoteURL = remoteURL
        self.connectionMode = connectionMode
        self.state = state
        self.lastSeen = lastSeen
    }

    // Codable migration: handle missing connectionMode from old persisted data
    enum CodingKeys: String, CodingKey {
        case botId, gatewayFingerprint, name, emoji, gatewayHost, gatewayPort
        case remoteURL, connectionMode, state, lastSeen, lastLatency
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        botId = try container.decode(String.self, forKey: .botId)
        gatewayFingerprint = try container.decode(String.self, forKey: .gatewayFingerprint)
        name = try container.decode(String.self, forKey: .name)
        emoji = try container.decode(String.self, forKey: .emoji)
        gatewayHost = try container.decodeIfPresent(String.self, forKey: .gatewayHost)
        gatewayPort = try container.decodeIfPresent(Int.self, forKey: .gatewayPort)
        remoteURL = try container.decodeIfPresent(String.self, forKey: .remoteURL)
        connectionMode = try container.decodeIfPresent(BotConfig.ConnectionMode.self, forKey: .connectionMode) ?? .auto
        state = try container.decode(BotConnectionState.self, forKey: .state)
        lastSeen = try container.decode(Date.self, forKey: .lastSeen)
        lastLatency = try container.decodeIfPresent(TimeInterval.self, forKey: .lastLatency)
    }
}

public enum BotConnectionState: String, Codable, Sendable, Hashable {
    case discovered
    case pairing
    case paired
    case connecting
    case connected
    case disconnected
    case error

    public func canTransitionTo(_ next: BotConnectionState) -> Bool {
        switch (self, next) {
        case (.discovered, .pairing): return true
        case (.pairing, .paired), (.pairing, .error): return true
        case (.paired, .connecting): return true
        case (.connecting, .connected), (.connecting, .disconnected), (.connecting, .error): return true
        case (.connected, .disconnected): return true
        case (.disconnected, .connecting): return true
        case (.error, .pairing), (.error, .connecting): return true
        default: return false
        }
    }
}
