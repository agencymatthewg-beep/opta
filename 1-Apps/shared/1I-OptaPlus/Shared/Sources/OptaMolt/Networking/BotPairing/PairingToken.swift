//
//  PairingToken.swift
//  OptaMolt
//
//  Represents a stored pairing credential for a bot.
//

import Foundation

public struct PairingToken: Codable, Sendable, Hashable {
    public let botId: String
    public let gatewayFingerprint: String
    public let token: String
    public let createdAt: Date
    public let deviceId: String
    public var syncedToCloud: Bool

    public var keychainKey: String { "pairing.\(gatewayFingerprint).\(botId)" }

    public init(
        botId: String,
        gatewayFingerprint: String,
        token: String,
        deviceId: String,
        createdAt: Date = Date(),
        syncedToCloud: Bool = false
    ) {
        self.botId = botId
        self.gatewayFingerprint = gatewayFingerprint
        self.token = token
        self.deviceId = deviceId
        self.createdAt = createdAt
        self.syncedToCloud = syncedToCloud
    }
}
