//
//  PairingCoordinator.swift
//  OptaMolt
//
//  Unified pairing pipeline — handles deep links, QR codes, clipboard, and manual entry.
//  All pairing methods funnel through this coordinator.
//

import Foundation
import os.log

/// Parsed pairing info from a deep link, QR code, or clipboard.
public struct PairingInfo: Sendable {
    public let host: String?
    public let port: Int?
    public let remoteURL: String?
    public let fingerprint: String
    public let token: String

    public init(host: String?, port: Int?, remoteURL: String?, fingerprint: String, token: String) {
        self.host = host
        self.port = port
        self.remoteURL = remoteURL
        self.fingerprint = fingerprint
        self.token = token
    }
}

@MainActor
public final class PairingCoordinator: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Pairing")

    @Published public var isPairing: Bool = false
    @Published public var pendingPairingInfo: PairingInfo?
    @Published public var pairingError: String?

    private let store = BotPairingStore()

    public init() {}

    // MARK: - Deep Link Parsing

    public static func parseDeepLink(_ url: URL) -> PairingInfo? {
        guard url.scheme == "optaplus", url.host == "pair" else { return nil }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let items = components.queryItems else { return nil }

        var dict: [String: String] = [:]
        for item in items {
            if let value = item.value {
                dict[item.name] = value
            }
        }

        guard let fp = dict["fp"], let token = dict["token"] else { return nil }

        return PairingInfo(
            host: dict["host"],
            port: dict["port"].flatMap(Int.init),
            remoteURL: dict["remote"],
            fingerprint: fp,
            token: token
        )
    }

    // MARK: - Clipboard Detection

    public static func parseClipboardText(_ text: String) -> PairingInfo? {
        guard let range = text.range(of: "optaplus://pair"),
              let url = URL(string: String(text[range.lowerBound...])) else {
            return nil
        }
        return parseDeepLink(url)
    }

    // MARK: - Pair from Info

    public func pair(info: PairingInfo, botId: String, botName: String, botEmoji: String) {
        isPairing = true
        pairingError = nil

        let token = PairingToken(
            botId: botId,
            gatewayFingerprint: info.fingerprint,
            token: info.token,
            deviceId: DeviceIdentity.current.deviceId
        )
        store.saveToken(token)

        var node = BotNode(
            botId: botId,
            gatewayFingerprint: info.fingerprint,
            name: botName,
            emoji: botEmoji,
            gatewayHost: info.host,
            gatewayPort: info.port,
            remoteURL: info.remoteURL,
            state: .paired
        )
        node.lastSeen = Date()
        store.saveBotNode(node)

        isPairing = false
        Self.logger.info("Paired bot \(botId) on gateway \(info.fingerprint)")
    }

    public func unpair(botId: String, gatewayFingerprint: String) {
        store.deleteToken(botId: botId, gatewayFingerprint: gatewayFingerprint)
        store.removeBotNode(id: "\(gatewayFingerprint):\(botId)")
        Self.logger.info("Unpaired bot \(botId) from gateway \(gatewayFingerprint)")
    }
}
