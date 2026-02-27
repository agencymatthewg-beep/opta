//
//  PushTokenManager.swift
//  OptaMolt
//
//  Manages APNs device token registration with OpenClaw gateways.
//  When the app receives a device token from iOS/macOS, this manager
//  sends it to each connected gateway so they can deliver push notifications.
//
//  v1.0 — Shared (iOS + macOS)
//

import Foundation
import os.log

// MARK: - Push Token Manager

@MainActor
public final class PushTokenManager: ObservableObject {

    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "PushToken")

    public static let shared = PushTokenManager()

    /// The current APNs device token (hex string).
    @Published public private(set) var deviceToken: String?

    /// Whether the token has been registered with all gateways.
    @Published public private(set) var isRegistered = false

    /// Last registration error.
    @Published public private(set) var lastError: String?

    /// Gateways that have been notified of the current token.
    private var registeredGateways: Set<String> = []

    private let tokenKey = "optaplus.push.deviceToken"

    private init() {
        // Restore cached token
        deviceToken = UserDefaults.standard.string(forKey: tokenKey)
    }

    // MARK: - Token Management

    /// Called when iOS/macOS delivers a new APNs device token.
    /// Converts to hex string and triggers gateway registration.
    public func updateToken(_ tokenData: Data) {
        let hexToken = tokenData.map { String(format: "%02x", $0) }.joined()

        guard hexToken != deviceToken else {
            Self.logger.debug("Token unchanged, skipping registration")
            return
        }

        Self.logger.info("New APNs token: \(hexToken.prefix(16))...")
        deviceToken = hexToken
        UserDefaults.standard.set(hexToken, forKey: tokenKey)

        // Reset registration state — need to notify all gateways
        registeredGateways.removeAll()
        isRegistered = false
    }

    /// Register the current device token with a specific gateway client.
    /// Called when a bot connects or when a new token is received.
    public func registerWithGateway(_ client: OpenClawClient, gatewayId: String) async {
        guard let token = deviceToken else {
            Self.logger.debug("No device token available, skipping gateway registration")
            return
        }

        guard !registeredGateways.contains(gatewayId) else {
            Self.logger.debug("Already registered with gateway \(gatewayId)")
            return
        }

        do {
            let params = PushRegistrationParams(
                deviceToken: token,
                platform: currentPlatform,
                bundleId: Bundle.main.bundleIdentifier ?? "biz.optamize.OptaPlus"
            )
            _ = try await client.request("push.register", params: params)
            registeredGateways.insert(gatewayId)
            Self.logger.info("Push token registered with gateway \(gatewayId)")

            // Check if all known gateways are registered
            // (caller should check isRegistered after all bots connect)
            lastError = nil
        } catch {
            Self.logger.error("Failed to register push token with \(gatewayId): \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    /// Unregister push notifications from a gateway (e.g., on bot removal).
    public func unregisterFromGateway(_ client: OpenClawClient, gatewayId: String) async {
        guard let token = deviceToken else { return }

        do {
            let params = PushRegistrationParams(
                deviceToken: token,
                platform: currentPlatform,
                bundleId: Bundle.main.bundleIdentifier ?? "biz.optamize.OptaPlus"
            )
            _ = try await client.request("push.unregister", params: params)
            registeredGateways.remove(gatewayId)
            Self.logger.info("Push token unregistered from gateway \(gatewayId)")
        } catch {
            Self.logger.error("Failed to unregister push token: \(error.localizedDescription)")
        }
    }

    /// Mark registration as complete for UI tracking.
    public func markFullyRegistered() {
        isRegistered = true
    }

    // MARK: - Platform Detection

    private var currentPlatform: String {
        #if os(iOS)
        return "ios"
        #elseif os(macOS)
        return "macos"
        #else
        return "unknown"
        #endif
    }
}

// MARK: - Push Registration Params

public struct PushRegistrationParams: Codable, Sendable {
    public let deviceToken: String
    public let platform: String
    public let bundleId: String
}

// MARK: - Push Notification Payload

/// Decoded push notification payload from APNs.
public struct PushNotificationPayload: Codable {
    public let botId: String?
    public let botName: String?
    public let messageId: String?
    public let sessionKey: String?
    public let content: String?
    public let type: String?  // "message", "taskComplete", "error", "statusChange"

    enum CodingKeys: String, CodingKey {
        case botId, botName, messageId, sessionKey, content, type
    }
}
