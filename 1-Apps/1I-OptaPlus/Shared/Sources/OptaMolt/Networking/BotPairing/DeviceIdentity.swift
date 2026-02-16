//
//  DeviceIdentity.swift
//  OptaMolt
//
//  Persistent device identity for pairing attribution.
//

import Foundation
#if canImport(UIKit)
import UIKit
#endif

public struct DeviceIdentity: Codable, Sendable {
    public let deviceId: String
    public let deviceName: String
    public let platform: Platform
    public let lastActive: Date

    public enum Platform: String, Codable, Sendable {
        case iOS
        case macOS
    }

    private static let keychainKey = "optaplus.device.identity"

    public static var current: DeviceIdentity {
        if let saved = loadFromKeychain() { return saved }
        let identity = DeviceIdentity(
            deviceId: UUID().uuidString,
            deviceName: Self.systemName,
            platform: Self.currentPlatform,
            lastActive: Date()
        )
        saveToKeychain(identity)
        return identity
    }

    private static var systemName: String {
        #if canImport(UIKit)
        UIDevice.current.name
        #else
        Host.current().localizedName ?? "Mac"
        #endif
    }

    private static var currentPlatform: Platform {
        #if os(iOS)
        .iOS
        #else
        .macOS
        #endif
    }

    private static func loadFromKeychain() -> DeviceIdentity? {
        guard let json = SecureStorage.shared.load(key: keychainKey),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(DeviceIdentity.self, from: data)
    }

    private static func saveToKeychain(_ identity: DeviceIdentity) {
        guard let data = try? JSONEncoder().encode(identity),
              let json = String(data: data, encoding: .utf8) else { return }
        SecureStorage.shared.save(key: keychainKey, value: json)
    }
}
