# Bot Pairing & Discovery — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:frontend-design for ALL UI tasks (Tasks 8-13).

**Goal:** Implement AirPods-like bot pairing — Bonjour auto-discovery, Bot Map constellation UI, iCloud Keychain sync, QR/deep link fallbacks.

**Architecture:** New models (`BotNode`, `PairingToken`, `DeviceIdentity`) replace `BotConfig` as the source of truth for paired bots. `BotScanner` wraps `NWBrowser` for Bonjour discovery. `BotMapView` renders a Canvas-based constellation. `PairingCoordinator` unifies all pairing methods. Supabase sync is opt-in via `OptaAccountService`.

**Tech Stack:** Swift 5.9, SwiftUI, Network.framework (NWBrowser), Security.framework (Keychain), VisionKit (QR scanning), XCTest. Zero external dependencies.

**Design document:** `docs/plans/2026-02-16-bot-pairing-discovery-design.md`

---

## Task 1: BotNode & PairingToken Models

**Files:**
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/BotNode.swift`
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/PairingToken.swift`
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/DeviceIdentity.swift`
- Test: `Shared/Tests/OptaMoltTests/BotPairingTests.swift`

**Step 1: Write failing tests for models**

```swift
// BotPairingTests.swift
import XCTest
@testable import OptaMolt

final class BotPairingTests: XCTestCase {

    // MARK: - BotNode

    func testBotNodeId() {
        let node = BotNode(botId: "jarvis", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖")
        XCTAssertEqual(node.id, "gw1:jarvis")
    }

    func testBotNodeCodable() throws {
        let node = BotNode(botId: "jarvis", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖")
        let data = try JSONEncoder().encode(node)
        let decoded = try JSONDecoder().decode(BotNode.self, from: data)
        XCTAssertEqual(decoded.id, node.id)
        XCTAssertEqual(decoded.emoji, "🤖")
    }

    func testBotNodeDefaultState() {
        let node = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Bot", emoji: "🤖")
        XCTAssertEqual(node.state, .discovered)
    }

    // MARK: - PairingToken

    func testPairingTokenKeyFormat() {
        let token = PairingToken(botId: "jarvis", gatewayFingerprint: "gw1", token: "abc123", deviceId: "dev1")
        XCTAssertEqual(token.keychainKey, "pairing.gw1.jarvis")
    }

    func testPairingTokenCodable() throws {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "tok", deviceId: "dev")
        let data = try JSONEncoder().encode(token)
        let decoded = try JSONDecoder().decode(PairingToken.self, from: data)
        XCTAssertEqual(decoded.token, "tok")
    }

    // MARK: - DeviceIdentity

    func testDeviceIdentityGeneration() {
        let id1 = DeviceIdentity.current
        let id2 = DeviceIdentity.current
        XCTAssertEqual(id1.deviceId, id2.deviceId, "Should return same ID across calls")
        XCTAssertFalse(id1.deviceName.isEmpty)
    }

    // MARK: - BotConnectionState transitions

    func testStateTransitions() {
        XCTAssertTrue(BotConnectionState.discovered.canTransitionTo(.pairing))
        XCTAssertTrue(BotConnectionState.paired.canTransitionTo(.connecting))
        XCTAssertFalse(BotConnectionState.discovered.canTransitionTo(.connected))
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `swift test --filter BotPairingTests 2>&1 | head -30`
Expected: Compilation error — types don't exist yet.

**Step 3: Implement BotNode**

```swift
// BotNode.swift
import Foundation
import SwiftUI

public struct BotNode: Identifiable, Codable, Hashable, Sendable {
    public let botId: String
    public let gatewayFingerprint: String
    public var name: String
    public var emoji: String
    public var gatewayHost: String?
    public var gatewayPort: Int?
    public var remoteURL: String?
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
        self.state = state
        self.lastSeen = lastSeen
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
```

**Step 4: Implement PairingToken**

```swift
// PairingToken.swift
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
```

**Step 5: Implement DeviceIdentity**

```swift
// DeviceIdentity.swift
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
```

**Step 6: Run tests to verify they pass**

Run: `swift test --filter BotPairingTests 2>&1 | tail -20`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/ Shared/Tests/OptaMoltTests/BotPairingTests.swift
git commit -m "feat(pairing): add BotNode, PairingToken, DeviceIdentity models"
```

---

## Task 2: BotPairingStore — Keychain CRUD

**Files:**
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/BotPairingStore.swift`
- Modify: `Shared/Sources/OptaMolt/Storage/SecureStorage.swift` (add iCloud sync method)
- Test: `Shared/Tests/OptaMoltTests/BotPairingStoreTests.swift`

**Step 1: Write failing tests**

```swift
// BotPairingStoreTests.swift
import XCTest
@testable import OptaMolt

final class BotPairingStoreTests: XCTestCase {

    var store: BotPairingStore!

    override func setUp() {
        store = BotPairingStore()
        store.removeAll()
    }

    func testSaveAndLoadToken() {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "abc", deviceId: "dev1")
        store.saveToken(token)
        let loaded = store.loadToken(botId: "b1", gatewayFingerprint: "gw1")
        XCTAssertEqual(loaded?.token, "abc")
    }

    func testDeleteToken() {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "abc", deviceId: "dev1")
        store.saveToken(token)
        store.deleteToken(botId: "b1", gatewayFingerprint: "gw1")
        XCTAssertNil(store.loadToken(botId: "b1", gatewayFingerprint: "gw1"))
    }

    func testLoadAllTokens() {
        store.saveToken(PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d"))
        store.saveToken(PairingToken(botId: "b2", gatewayFingerprint: "gw1", token: "t2", deviceId: "d"))
        let all = store.allTokens()
        XCTAssertEqual(all.count, 2)
    }

    func testSaveAndLoadBotNodes() {
        var node = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖")
        node.state = .paired
        store.saveBotNode(node)
        let loaded = store.loadBotNodes()
        XCTAssertEqual(loaded.first?.name, "Jarvis")
    }

    func testMigrationFromBotConfig() {
        // Create a legacy BotConfig-style token
        SecureStorage.shared.saveBotToken("legacy-token", botId: "old-bot")
        let configs = [BotConfig(name: "OldBot", port: 3000, token: "legacy-token", emoji: "🤖")]
        let migrated = store.migrateFromBotConfigs(configs, gatewayFingerprint: "unknown")
        XCTAssertEqual(migrated.count, 1)
        XCTAssertEqual(migrated.first?.token, "legacy-token")
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `swift test --filter BotPairingStoreTests 2>&1 | head -20`
Expected: Compilation error.

**Step 3: Add iCloud Keychain save method to SecureStorage**

Add to `SecureStorage.swift` after the existing `save(key:value:)` method:

```swift
/// Save a string value to Keychain with iCloud sync enabled.
/// Use for pairing tokens that should persist across Apple devices.
@discardableResult
public func saveSyncable(key: String, value: String) -> Bool {
    guard let data = value.data(using: .utf8) else { return false }
    delete(key: key)
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: serviceName,
        kSecAttrAccount as String: key,
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
        kSecAttrSynchronizable as String: true
    ]
    let status = SecItemAdd(query as CFDictionary, nil)
    return status == errSecSuccess
}
```

**Step 4: Implement BotPairingStore**

```swift
// BotPairingStore.swift
import Foundation
import os.log

public final class BotPairingStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "BotPairing")
    private let storage = SecureStorage.shared
    private let nodesKey = "optaplus.paired.botnodes"

    public init() {}

    // MARK: - Token CRUD

    public func saveToken(_ token: PairingToken) {
        guard let data = try? JSONEncoder().encode(token),
              let json = String(data: data, encoding: .utf8) else { return }
        storage.saveSyncable(key: token.keychainKey, value: json)
        // Also track in the token index
        var index = tokenIndex()
        index.insert(token.keychainKey)
        saveTokenIndex(index)
        Self.logger.info("Saved pairing token for \(token.botId)")
    }

    public func loadToken(botId: String, gatewayFingerprint: String) -> PairingToken? {
        let key = "pairing.\(gatewayFingerprint).\(botId)"
        guard let json = storage.load(key: key),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PairingToken.self, from: data)
    }

    public func deleteToken(botId: String, gatewayFingerprint: String) {
        let key = "pairing.\(gatewayFingerprint).\(botId)"
        storage.delete(key: key)
        var index = tokenIndex()
        index.remove(key)
        saveTokenIndex(index)
    }

    public func allTokens() -> [PairingToken] {
        tokenIndex().compactMap { key in
            guard let json = storage.load(key: key),
                  let data = json.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(PairingToken.self, from: data)
        }
    }

    public func removeAll() {
        for key in tokenIndex() {
            storage.delete(key: key)
        }
        saveTokenIndex([])
        UserDefaults.standard.removeObject(forKey: nodesKey)
    }

    // MARK: - BotNode Persistence

    public func saveBotNode(_ node: BotNode) {
        var nodes = loadBotNodes()
        nodes.removeAll { $0.id == node.id }
        nodes.append(node)
        saveBotNodes(nodes)
    }

    public func loadBotNodes() -> [BotNode] {
        guard let data = UserDefaults.standard.data(forKey: nodesKey) else { return [] }
        return (try? JSONDecoder().decode([BotNode].self, from: data)) ?? []
    }

    public func removeBotNode(id: String) {
        var nodes = loadBotNodes()
        nodes.removeAll { $0.id == id }
        saveBotNodes(nodes)
    }

    private func saveBotNodes(_ nodes: [BotNode]) {
        guard let data = try? JSONEncoder().encode(nodes) else { return }
        UserDefaults.standard.set(data, forKey: nodesKey)
    }

    // MARK: - Migration

    public func migrateFromBotConfigs(_ configs: [BotConfig], gatewayFingerprint: String) -> [PairingToken] {
        let deviceId = DeviceIdentity.current.deviceId
        var tokens: [PairingToken] = []
        for config in configs {
            guard !config.token.isEmpty else { continue }
            let token = PairingToken(
                botId: config.id,
                gatewayFingerprint: gatewayFingerprint,
                token: config.token,
                deviceId: deviceId
            )
            saveToken(token)
            let node = BotNode(
                botId: config.id,
                gatewayFingerprint: gatewayFingerprint,
                name: config.name,
                emoji: config.emoji,
                gatewayHost: config.host,
                gatewayPort: config.port,
                remoteURL: config.remoteURL,
                state: .paired
            )
            saveBotNode(node)
            tokens.append(token)
        }
        Self.logger.info("Migrated \(configs.count) BotConfigs to pairing tokens")
        return tokens
    }

    // MARK: - Private: Token Index

    private let indexKey = "optaplus.pairing.token.index"

    private func tokenIndex() -> Set<String> {
        guard let json = storage.load(key: indexKey),
              let data = json.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(keys)
    }

    private func saveTokenIndex(_ index: Set<String>) {
        guard let data = try? JSONEncoder().encode(Array(index)),
              let json = String(data: data, encoding: .utf8) else { return }
        storage.save(key: indexKey, value: json)
    }
}
```

**Step 5: Run tests to verify they pass**

Run: `swift test --filter BotPairingStoreTests 2>&1 | tail -20`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/BotPairingStore.swift Shared/Sources/OptaMolt/Storage/SecureStorage.swift Shared/Tests/OptaMoltTests/BotPairingStoreTests.swift
git commit -m "feat(pairing): add BotPairingStore with iCloud Keychain sync"
```

---

## Task 3: Gateway Protocol — Discovery & Pairing Methods

**Files:**
- Modify: `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift` (add new types)
- Modify: `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` (add convenience methods)
- Test: `Shared/Tests/OptaMoltTests/BotPairingProtocolTests.swift`

**Step 1: Write failing tests**

```swift
// BotPairingProtocolTests.swift
import XCTest
@testable import OptaMolt

final class BotPairingProtocolTests: XCTestCase {

    func testDiscoverResponseDecoding() throws {
        let json = """
        {"gatewayFingerprint":"abc","gatewayName":"Home","bots":[{"botId":"b1","name":"Jarvis","emoji":"🤖","status":"online"}],"pairingRequired":true}
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(GatewayDiscoverResponse.self, from: json)
        XCTAssertEqual(response.gatewayFingerprint, "abc")
        XCTAssertEqual(response.bots.count, 1)
        XCTAssertEqual(response.bots[0].emoji, "🤖")
    }

    func testDevicePairParamsEncoding() throws {
        let params = DevicePairParams(
            deviceId: "dev1",
            deviceName: "iPhone",
            platform: "ios",
            requestedBots: ["b1", "b2"]
        )
        let data = try JSONEncoder().encode(params)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(dict?["deviceId"] as? String, "dev1")
        XCTAssertEqual((dict?["requestedBots"] as? [String])?.count, 2)
    }

    func testDevicePairResponseDecoding() throws {
        let json = """
        {"pairings":[{"botId":"b1","token":"tok123","name":"Jarvis","emoji":"🤖"}],"gatewayFingerprint":"gw1"}
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(DevicePairResponse.self, from: json)
        XCTAssertEqual(response.pairings.count, 1)
        XCTAssertEqual(response.pairings[0].token, "tok123")
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `swift test --filter BotPairingProtocolTests 2>&1 | head -20`
Expected: Compilation error — types don't exist yet.

**Step 3: Add protocol types to OpenClawProtocol.swift**

Append before the final closing brace or at the end of the file:

```swift
// MARK: - Device Pairing

public struct GatewayDiscoverResponse: Codable, Sendable {
    public let gatewayFingerprint: String
    public let gatewayName: String
    public let bots: [DiscoveredBot]
    public let pairingRequired: Bool
}

public struct DiscoveredBot: Codable, Sendable, Identifiable {
    public let botId: String
    public let name: String
    public let emoji: String
    public let status: String
    public var id: String { botId }
}

public struct DevicePairParams: Codable, Sendable {
    public let deviceId: String
    public let deviceName: String
    public let platform: String
    public let requestedBots: [String]
}

public struct DevicePairResponse: Codable, Sendable {
    public let pairings: [BotPairing]
    public let gatewayFingerprint: String
}

public struct BotPairing: Codable, Sendable {
    public let botId: String
    public let token: String
    public let name: String
    public let emoji: String
}

public struct DeviceUnpairParams: Codable, Sendable {
    public let deviceId: String
    public let botIds: [String]
}
```

**Step 4: Add convenience methods to OpenClawClient.swift**

Add inside `OpenClawClient` class:

```swift
// MARK: - Device Pairing

/// Discover available bots without authentication.
public func gatewayDiscover() async throws -> GatewayDiscoverResponse {
    let result = try await request("gateway.discover", params: AnyCodable.null)
    guard let data = try? JSONSerialization.data(withJSONObject: result?.rawValue ?? [:]),
          let response = try? JSONDecoder().decode(GatewayDiscoverResponse.self, from: data) else {
        throw OpenClawError.invalidResponse
    }
    return response
}

/// Pair this device with specific bots on the gateway.
public func devicePair(params: DevicePairParams) async throws -> DevicePairResponse {
    let result = try await request("device.pair", params: params)
    guard let dict = result?.dict,
          let data = try? JSONSerialization.data(withJSONObject: dict),
          let response = try? JSONDecoder().decode(DevicePairResponse.self, from: data) else {
        throw OpenClawError.invalidResponse
    }
    return response
}

/// Unpair this device from specific bots.
public func deviceUnpair(params: DeviceUnpairParams) async throws {
    _ = try await request("device.unpair", params: params)
}
```

**Step 5: Run tests to verify they pass**

Run: `swift test --filter BotPairingProtocolTests 2>&1 | tail -20`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift Shared/Sources/OptaMolt/Networking/OpenClawClient.swift Shared/Tests/OptaMoltTests/BotPairingProtocolTests.swift
git commit -m "feat(pairing): add gateway.discover and device.pair protocol methods"
```

---

## Task 4: BotScanner — Bonjour Discovery

**Files:**
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/BotScanner.swift`
- Test: `Shared/Tests/OptaMoltTests/BotScannerTests.swift`

**Step 1: Write failing tests**

```swift
// BotScannerTests.swift
import XCTest
@testable import OptaMolt

final class BotScannerTests: XCTestCase {

    func testMergeDiscoveredWithPaired() {
        let paired = [
            BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖", state: .paired),
            BotNode(botId: "b2", gatewayFingerprint: "gw1", name: "Nova", emoji: "🌟", state: .paired)
        ]
        let discovered = [
            DiscoveredGateway(fingerprint: "gw1", name: "Home", host: "192.168.1.50", port: 3000, botCount: 3, protocolVersion: 3),
            DiscoveredGateway(fingerprint: "gw2", name: "Office", host: "10.0.0.5", port: 3000, botCount: 1, protocolVersion: 3)
        ]
        let merged = BotScanner.merge(paired: paired, discovered: discovered)
        // gw1 bots should update host/port; gw2 should appear as new
        let gw1Bot = merged.first { $0.id == "gw1:b1" }
        XCTAssertEqual(gw1Bot?.gatewayHost, "192.168.1.50")
    }

    func testDeduplication() {
        let nodes = [
            BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖"),
            BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis Updated", emoji: "🤖")
        ]
        let deduped = BotScanner.deduplicate(nodes)
        XCTAssertEqual(deduped.count, 1)
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `swift test --filter BotScannerTests 2>&1 | head -20`
Expected: Compilation error.

**Step 3: Implement BotScanner**

```swift
// BotScanner.swift
import Foundation
import Network
import os.log

public struct DiscoveredGateway: Identifiable, Sendable {
    public let fingerprint: String
    public let name: String
    public let host: String
    public let port: Int
    public let botCount: Int
    public let protocolVersion: Int
    public var bots: [DiscoveredBot]?

    public var id: String { fingerprint }

    public init(fingerprint: String, name: String, host: String, port: Int, botCount: Int, protocolVersion: Int, bots: [DiscoveredBot]? = nil) {
        self.fingerprint = fingerprint
        self.name = name
        self.host = host
        self.port = port
        self.botCount = botCount
        self.protocolVersion = protocolVersion
        self.bots = bots
    }
}

@MainActor
public final class BotScanner: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "BotScanner")
    private static let serviceType = "_openclaw._tcp"

    @Published public var discoveredGateways: [DiscoveredGateway] = []
    @Published public var isScanning: Bool = false
    @Published public var scanProgress: Double = 0 // 0...1 for radar animation

    private var browser: NWBrowser?
    private var scanTimer: Timer?

    public init() {}

    // MARK: - Passive Browsing

    public func startPassiveBrowsing() {
        guard browser == nil else { return }
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: .bonjour(type: Self.serviceType, domain: nil), using: params)

        browser?.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                switch state {
                case .ready:
                    Self.logger.info("Bonjour browser ready")
                case .failed(let error):
                    Self.logger.error("Bonjour browser failed: \(error.localizedDescription)")
                    self?.browser = nil
                default:
                    break
                }
            }
        }

        browser?.browseResultsChangedHandler = { [weak self] results, changes in
            Task { @MainActor in
                self?.handleBrowseResults(results)
            }
        }

        browser?.start(queue: .main)
    }

    public func stopBrowsing() {
        browser?.cancel()
        browser = nil
    }

    // MARK: - Active Scan (User-triggered, with radar animation)

    public func startActiveScan(duration: TimeInterval = 3.0) {
        isScanning = true
        scanProgress = 0
        discoveredGateways = []

        // Start/restart Bonjour
        stopBrowsing()
        startPassiveBrowsing()

        // Animate progress over duration
        let startTime = Date()
        scanTimer?.invalidate()
        scanTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] timer in
            Task { @MainActor [weak self] in
                guard let self else { timer.invalidate(); return }
                let elapsed = Date().timeIntervalSince(startTime)
                self.scanProgress = min(elapsed / duration, 1.0)
                if elapsed >= duration {
                    timer.invalidate()
                    self.isScanning = false
                }
            }
        }
    }

    // MARK: - Merge Logic

    /// Merge paired bots with discovered gateways — paired bots get host/port updated,
    /// discovered gateways without paired bots remain as new entries.
    public static func merge(paired: [BotNode], discovered: [DiscoveredGateway]) -> [BotNode] {
        var result = paired
        for gateway in discovered {
            for i in result.indices where result[i].gatewayFingerprint == gateway.fingerprint {
                result[i].gatewayHost = gateway.host
                result[i].gatewayPort = gateway.port
                result[i].lastSeen = Date()
            }
        }
        return result
    }

    /// Remove duplicates, keeping the most recently seen.
    public static func deduplicate(_ nodes: [BotNode]) -> [BotNode] {
        var seen: [String: BotNode] = [:]
        for node in nodes {
            if let existing = seen[node.id] {
                seen[node.id] = node.lastSeen > existing.lastSeen ? node : existing
            } else {
                seen[node.id] = node
            }
        }
        return Array(seen.values)
    }

    // MARK: - Private

    private func handleBrowseResults(_ results: Set<NWBrowser.Result>) {
        var gateways: [DiscoveredGateway] = []
        for result in results {
            if case .service(let name, _, _, _) = result.endpoint {
                let txt = parseTXTRecords(result.metadata)
                let gateway = DiscoveredGateway(
                    fingerprint: txt["fp"] ?? name,
                    name: txt["name"] ?? name,
                    host: name,  // Will be resolved on connect
                    port: Int(txt["port"] ?? "3000") ?? 3000,
                    botCount: Int(txt["bots"] ?? "0") ?? 0,
                    protocolVersion: Int(txt["ver"] ?? "3") ?? 3
                )
                gateways.append(gateway)
            }
        }
        discoveredGateways = gateways
        Self.logger.info("Discovered \(gateways.count) gateways via Bonjour")
    }

    private func parseTXTRecords(_ metadata: NWBrowser.Result.Metadata?) -> [String: String] {
        guard case .bonjour(let txtRecord) = metadata else { return [:] }
        var dict: [String: String] = [:]
        for key in txtRecord.dictionary.keys {
            if let value = txtRecord.dictionary[key] {
                dict[key] = String(data: value, encoding: .utf8)
            }
        }
        return dict
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `swift test --filter BotScannerTests 2>&1 | tail -20`
Expected: All tests PASS. (Bonjour network tests are static/merge tests only — no live network needed.)

**Step 5: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/BotScanner.swift Shared/Tests/OptaMoltTests/BotScannerTests.swift
git commit -m "feat(pairing): add BotScanner with Bonjour discovery and merge logic"
```

---

## Task 5: PairingCoordinator — Unified Pairing Pipeline

**Files:**
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/PairingCoordinator.swift`
- Test: `Shared/Tests/OptaMoltTests/PairingCoordinatorTests.swift`

**Step 1: Write failing tests**

```swift
// PairingCoordinatorTests.swift
import XCTest
@testable import OptaMolt

final class PairingCoordinatorTests: XCTestCase {

    func testParseDeepLink() {
        let url = URL(string: "optaplus://pair?host=192.168.1.50&port=3000&fp=abc123&token=xyz")!
        let info = PairingCoordinator.parseDeepLink(url)
        XCTAssertNotNil(info)
        XCTAssertEqual(info?.host, "192.168.1.50")
        XCTAssertEqual(info?.port, 3000)
        XCTAssertEqual(info?.fingerprint, "abc123")
        XCTAssertEqual(info?.token, "xyz")
        XCTAssertNil(info?.remoteURL)
    }

    func testParseDeepLinkRemote() {
        let url = URL(string: "optaplus://pair?remote=wss%3A%2F%2Fbot.example.com&fp=abc&token=tok")!
        let info = PairingCoordinator.parseDeepLink(url)
        XCTAssertNotNil(info)
        XCTAssertEqual(info?.remoteURL, "wss://bot.example.com")
        XCTAssertNil(info?.host)
    }

    func testParseInvalidDeepLink() {
        let url = URL(string: "optaplus://settings")!
        let info = PairingCoordinator.parseDeepLink(url)
        XCTAssertNil(info)
    }

    func testParseClipboard() {
        let text = "optaplus://pair?host=10.0.0.1&port=3000&fp=gw1&token=abc"
        let info = PairingCoordinator.parseClipboardText(text)
        XCTAssertNotNil(info)
        XCTAssertEqual(info?.fingerprint, "gw1")
    }

    func testParseClipboardNoMatch() {
        let info = PairingCoordinator.parseClipboardText("hello world")
        XCTAssertNil(info)
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `swift test --filter PairingCoordinatorTests 2>&1 | head -20`
Expected: Compilation error.

**Step 3: Implement PairingCoordinator**

```swift
// PairingCoordinator.swift
import Foundation
import os.log

/// Parsed pairing info from a deep link or QR code.
public struct PairingInfo: Sendable {
    public let host: String?
    public let port: Int?
    public let remoteURL: String?
    public let fingerprint: String
    public let token: String
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

    /// Complete the pairing from any source (deep link, QR, manual, Bonjour).
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

    /// Remove a pairing.
    public func unpair(botId: String, gatewayFingerprint: String) {
        store.deleteToken(botId: botId, gatewayFingerprint: gatewayFingerprint)
        store.removeBotNode(id: "\(gatewayFingerprint):\(botId)")
        Self.logger.info("Unpaired bot \(botId) from gateway \(gatewayFingerprint)")
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `swift test --filter PairingCoordinatorTests 2>&1 | tail -20`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/PairingCoordinator.swift Shared/Tests/OptaMoltTests/PairingCoordinatorTests.swift
git commit -m "feat(pairing): add PairingCoordinator with deep link and clipboard parsing"
```

---

## Task 6: Info.plist — Bonjour & URL Scheme Registration

**Files:**
- Modify: `iOS/OptaPlusIOS/Info.plist`
- Modify: `macOS/OptaPlusMacOS/Info.plist`

**Step 1: Add Bonjour and URL scheme entries to iOS Info.plist**

Add these keys to the existing `<dict>` in `iOS/OptaPlusIOS/Info.plist`:

```xml
<key>NSBonjourServices</key>
<array>
    <string>_openclaw._tcp</string>
</array>
<key>NSLocalNetworkUsageDescription</key>
<string>OptaPlus searches your local network to discover OpenClaw bots for automatic pairing.</string>
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>optaplus</string>
        </array>
        <key>CFBundleURLName</key>
        <string>biz.optamize.optaplus</string>
    </dict>
</array>
```

**Step 2: Add Bonjour and URL scheme entries to macOS Info.plist**

Same keys added to `macOS/OptaPlusMacOS/Info.plist`:

```xml
<key>NSBonjourServices</key>
<array>
    <string>_openclaw._tcp</string>
</array>
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>optaplus</string>
        </array>
        <key>CFBundleURLName</key>
        <string>biz.optamize.optaplus</string>
    </dict>
</array>
```

**Step 3: Verify builds**

Run: `xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'generic/platform=iOS' build 2>&1 | tail -5`
Run: `xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS build 2>&1 | tail -5`
Expected: Both BUILD SUCCEEDED.

**Step 4: Commit**

```bash
git add iOS/OptaPlusIOS/Info.plist macOS/OptaPlusMacOS/Info.plist
git commit -m "feat(pairing): register Bonjour service and optaplus:// URL scheme"
```

---

## Task 7: Deep Link Handler in App Entry Points

**Files:**
- Modify: `iOS/OptaPlusIOS/OptaPlusIOSApp.swift` (add `.onOpenURL` handler)
- Modify: `macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift` (add `.onOpenURL` handler)

**Step 1: Read current app entry points to understand structure**

Read: `iOS/OptaPlusIOS/OptaPlusIOSApp.swift`
Read: `macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift`

**Step 2: Add `@StateObject var pairingCoordinator` to each app**

In both app structs, add:
```swift
@StateObject private var pairingCoordinator = PairingCoordinator()
```

**Step 3: Add `.onOpenURL` modifier to the main content view**

```swift
.onOpenURL { url in
    if let info = PairingCoordinator.parseDeepLink(url) {
        pairingCoordinator.pendingPairingInfo = info
    }
}
```

**Step 4: Pass `pairingCoordinator` into ContentView via `.environmentObject()`**

```swift
.environmentObject(pairingCoordinator)
```

**Step 5: Verify builds compile**

Run both platform builds.

**Step 6: Commit**

```bash
git add iOS/OptaPlusIOS/OptaPlusIOSApp.swift macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift
git commit -m "feat(pairing): handle optaplus:// deep links on app launch"
```

---

## Task 8: Bot Map — Constellation View (iOS)

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Create: `iOS/OptaPlusIOS/Views/BotMapView.swift`
- Modify: `iOS/OptaPlusIOS/ContentView.swift` (add Bot Map tab)

**Design brief for frontend-design skill:**

Build a `BotMapView` that shows:
- User's device at center (device emoji + name from `DeviceIdentity.current`)
- Paired bots arranged radially around center
- Green gradient tether lines for `.connected` bots, red dashed for `.disconnected`, amber pulsing for `.connecting`
- Bot emoji inside a glowing circle (use `optaPrimary` glow for connected, `optaDanger` for disconnected)
- Background: subtle star field on `optaVoid`
- Tap a bot node → show bot detail sheet
- Empty state: "No bots paired yet" with scan/QR/manual buttons

**Animations (A04 spring-only):**
- Bot nodes scale in with `.optaSpring`
- Tether lines draw with `.optaGentle`
- State changes (connected → disconnected) use `.optaSpring`

**Data sources:**
- `@StateObject var scanner: BotScanner`
- `@EnvironmentObject var pairingCoordinator: PairingCoordinator`
- `BotPairingStore().loadBotNodes()` for paired bots

**Layout:**
- GeometryReader for sizing
- Bots positioned at angles: `index * (2 * .pi / count)` at radius `min(width, height) * 0.35`
- Center device at `(width/2, height/2)`

**Step 1: Create BotMapView with constellation layout**
**Step 2: Add tether line drawing with state-based colors**
**Step 3: Add bot node views with emoji + glow**
**Step 4: Add empty state**
**Step 5: Add Bot Map as new tab in ContentView (between Dashboard and Chat)**
**Step 6: Verify iOS build**
**Step 7: Commit**

```bash
git add iOS/OptaPlusIOS/Views/BotMapView.swift iOS/OptaPlusIOS/ContentView.swift
git commit -m "feat(pairing): add Bot Map constellation view (iOS)"
```

---

## Task 9: Radar Scan Animation

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Create: `Shared/Sources/OptaMolt/Chat/RadarScanView.swift` (shared Canvas component)
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift` (integrate radar)

**Design brief:**

Build a `RadarScanView` using `Canvas` + `TimelineView(.animation)`:
- Renders a 120-degree gradient arc from `optaPrimary` (full opacity) to transparent
- Arc sweeps 360 degrees over 3 seconds
- Concentric rings pulse outward from center (faint, `optaPrimary` at 0.1 opacity)
- Spring-eased start/stop (not linear rotation — use spring-driven angle interpolation)
- Triggered by `BotScanner.startActiveScan()`

**Integration:**
- Scan button in BotMapView toolbar
- When `scanner.isScanning`: show RadarScanView overlay
- When scanner discovers new bot during sweep: scale-in the bot node with `.optaSpring` as the arc passes its angle position

**Step 1: Build RadarScanView Canvas component**
**Step 2: Integrate into BotMapView with scan button**
**Step 3: Add bot reveal animation synced to radar angle**
**Step 4: Verify iOS build**
**Step 5: Commit**

```bash
git add Shared/Sources/OptaMolt/Chat/RadarScanView.swift iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(pairing): add radar scan animation with Canvas sweep"
```

---

## Task 10: Bot Detail Sheet

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Create: `Shared/Sources/OptaMolt/Chat/BotDetailSheet.swift`
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift` (present sheet on tap)

**Design brief:**

Build a `BotDetailSheet` shown when tapping a bot node:
- Bot emoji (large) + name
- Connection status badge (green/red/amber dot + text)
- Gateway info: host:port or remote URL
- Latency display (if connected)
- Last seen timestamp
- Actions: Connect / Disconnect / Forget (with confirmation for Forget)
- Uses glass surface styling (`optaElevated` background, `optaGlass` modifiers if available)

**Step 1: Build BotDetailSheet**
**Step 2: Wire tap gesture on bot nodes to present sheet**
**Step 3: Implement Connect/Disconnect/Forget actions**
**Step 4: Verify iOS build**
**Step 5: Commit**

```bash
git add Shared/Sources/OptaMolt/Chat/BotDetailSheet.swift iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(pairing): add bot detail sheet with connection management"
```

---

## Task 11: Bot Map — macOS Port

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Create: `macOS/OptaPlusMacOS/BotMapView.swift`
- Modify: `macOS/OptaPlusMacOS/ContentView.swift` (add Bot Map section)

**Design brief:**

Port the Bot Map to macOS with enhancements:
- Same constellation layout and radar animation
- Richer particle effects on tethers (subtle flowing dots along connected tethers)
- Keyboard shortcut: `Cmd+M` to toggle Bot Map
- Larger canvas area (sidebar integration or dedicated view)
- Right-click on bot node for context menu (Connect, Disconnect, Forget, Copy Token)

**Step 1: Create macOS BotMapView (adapt from iOS version)**
**Step 2: Add particle effects on tethers**
**Step 3: Integrate into macOS ContentView**
**Step 4: Add keyboard shortcut**
**Step 5: Verify macOS build**
**Step 6: Commit**

```bash
git add macOS/OptaPlusMacOS/BotMapView.swift macOS/OptaPlusMacOS/ContentView.swift
git commit -m "feat(pairing): add Bot Map constellation view (macOS)"
```

---

## Task 12: QR Code Scanner (iOS)

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Create: `iOS/OptaPlusIOS/Views/QRScannerView.swift`
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift` (add QR scan button)

**Design brief:**

Build a QR scanner using `DataScannerViewController` (VisionKit):
- Full-screen camera preview with scan region indicator
- Recognizes `optaplus://pair?...` URLs from QR codes
- On recognition: dismiss scanner, parse deep link, show pairing confirmation
- Cancel button to dismiss
- Requires iOS 16+ and camera permission (check `DataScannerViewController.isSupported`)

**Implementation notes:**
- Wrap `DataScannerViewController` in a `UIViewControllerRepresentable`
- Configure with `recognizedDataTypes: [.barcode(symbologies: [.qr])]`
- Use delegate to receive recognized items
- Parse the recognized string through `PairingCoordinator.parseDeepLink()`

**Step 1: Build QRScannerView wrapping DataScannerViewController**
**Step 2: Add scan button to BotMapView empty state and toolbar**
**Step 3: Wire QR result → PairingCoordinator**
**Step 4: Verify iOS build**
**Step 5: Commit**

```bash
git add iOS/OptaPlusIOS/Views/QRScannerView.swift iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(pairing): add QR code scanner for bot pairing (iOS)"
```

---

## Task 13: Updated Onboarding Flow

> **REQUIRED SUB-SKILL:** Use `superpowers:frontend-design` for this task.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/OnboardingView.swift` (redesign around Bot Map)

**Design brief:**

Redesign the 3-page onboarding to center on the Bot Map:
- Page 1: Welcome (keep existing hero)
- Page 2: "Discover Your Bots" — embedded Bot Map with auto-scan running. If bots found, show them with "Pair" buttons. If none: show QR/manual options.
- Page 3: Remove or simplify — if bot was paired on page 2, go straight to app. If manual entry, show the form.

**Key change:** The onboarding IS the Bot Map now. First-time users see the same constellation view they'll use ongoing.

**Step 1: Redesign Page 2 with embedded BotMapView and auto-scan**
**Step 2: Simplify Page 3 to only show when needed (manual entry)**
**Step 3: Update completion logic**
**Step 4: Verify iOS build**
**Step 5: Commit**

```bash
git add iOS/OptaPlusIOS/Views/OnboardingView.swift
git commit -m "feat(pairing): redesign onboarding around Bot Map discovery"
```

---

## Task 14: Clipboard Detection

**Files:**
- Modify: `iOS/OptaPlusIOS/ContentView.swift` (add foreground clipboard check)
- Modify: `macOS/OptaPlusMacOS/ContentView.swift` (add clipboard check)

**Step 1: Add `.onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification))` to iOS ContentView**

Check clipboard for `optaplus://pair` URL. If found, set `pairingCoordinator.pendingPairingInfo` and show a banner: "Pairing link found — tap to pair."

**Step 2: Add similar logic for macOS using `NSApplication.didBecomeActiveNotification`**

**Step 3: Verify both builds**

**Step 4: Commit**

```bash
git add iOS/OptaPlusIOS/ContentView.swift macOS/OptaPlusMacOS/ContentView.swift
git commit -m "feat(pairing): detect pairing links from clipboard on foreground"
```

---

## Task 15: BotConfig Migration Bridge

**Files:**
- Modify: `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` (accept BotNode alongside BotConfig)
- Modify: `iOS/OptaPlusIOS/OptaPlusIOSApp.swift` (run migration on first launch)
- Modify: `macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift` (run migration on first launch)

**Step 1: Add a `convenience init(botNode: BotNode, token: String)` to BotConfig**

This allows the existing ChatViewModel to work with the new BotNode data by converting to BotConfig:

```swift
extension BotConfig {
    public init(botNode: BotNode, token: String) {
        self.init(
            id: botNode.botId,
            name: botNode.name,
            host: botNode.gatewayHost ?? "127.0.0.1",
            port: botNode.gatewayPort ?? 3000,
            token: token,
            emoji: botNode.emoji,
            remoteURL: botNode.remoteURL
        )
    }
}
```

**Step 2: Add migration call in app entry points**

In both app entry points, at startup:
```swift
let store = BotPairingStore()
if !UserDefaults.standard.bool(forKey: "optaplus.v2.migrated") {
    _ = store.migrateFromBotConfigs(appState.bots, gatewayFingerprint: "legacy")
    UserDefaults.standard.set(true, forKey: "optaplus.v2.migrated")
}
```

**Step 3: Verify both builds**

**Step 4: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/ChatViewModel.swift iOS/OptaPlusIOS/OptaPlusIOSApp.swift macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift
git commit -m "feat(pairing): bridge BotConfig to BotNode with migration"
```

---

## Task 16: Supabase Sync Layer

**Files:**
- Modify: `Shared/Sources/OptaMolt/Networking/OptaAccountService.swift` (add Supabase client, sync methods)
- Create: `Shared/Sources/OptaMolt/Networking/BotPairing/BotPairingSyncService.swift`
- Test: `Shared/Tests/OptaMoltTests/BotPairingSyncTests.swift`

**Step 1: Write failing tests for sync merge logic**

```swift
// BotPairingSyncTests.swift
import XCTest
@testable import OptaMolt

final class BotPairingSyncTests: XCTestCase {

    func testMergePrefersMostRecent() {
        let local = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "local-tok", deviceId: "d1", createdAt: Date(timeIntervalSince1970: 1000))
        let remote = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "remote-tok", deviceId: "d2", createdAt: Date(timeIntervalSince1970: 2000))

        let winner = BotPairingSyncService.resolveConflict(local: local, remote: remote)
        XCTAssertEqual(winner.token, "remote-tok", "Most recent should win")
    }

    func testMergeLocalAndRemoteTokens() {
        let local = [
            PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d1"),
            PairingToken(botId: "b2", gatewayFingerprint: "gw1", token: "t2", deviceId: "d1")
        ]
        let remote = [
            PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1-new", deviceId: "d2", createdAt: Date().addingTimeInterval(100)),
            PairingToken(botId: "b3", gatewayFingerprint: "gw2", token: "t3", deviceId: "d2")
        ]
        let merged = BotPairingSyncService.mergeTokens(local: local, remote: remote)
        XCTAssertEqual(merged.count, 3, "Should have b1 (resolved), b2 (local-only), b3 (remote-only)")
    }
}
```

**Step 2: Implement BotPairingSyncService**

```swift
// BotPairingSyncService.swift
import Foundation
import os.log

public final class BotPairingSyncService {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "PairingSync")

    /// Resolve conflict between local and remote tokens — most recent wins.
    public static func resolveConflict(local: PairingToken, remote: PairingToken) -> PairingToken {
        remote.createdAt > local.createdAt ? remote : local
    }

    /// Merge local and remote token lists.
    public static func mergeTokens(local: [PairingToken], remote: [PairingToken]) -> [PairingToken] {
        var result: [String: PairingToken] = [:]
        for token in local {
            result[token.keychainKey] = token
        }
        for token in remote {
            if let existing = result[token.keychainKey] {
                result[token.keychainKey] = resolveConflict(local: existing, remote: token)
            } else {
                result[token.keychainKey] = token
            }
        }
        return Array(result.values)
    }

    /// Upload local tokens to Supabase. Requires authenticated session.
    /// Implementation note: Uses Supabase REST API directly (no SDK dependency).
    public static func uploadTokens(_ tokens: [PairingToken], supabaseURL: String, accessToken: String) async throws {
        // Supabase REST: POST /rest/v1/bot_pairings with upsert
        // Each token encrypted client-side before upload
        // Implementation deferred to sync sprint — this is the interface
        logger.info("Would upload \(tokens.count) tokens to Supabase")
    }

    /// Download tokens from Supabase.
    public static func downloadTokens(supabaseURL: String, accessToken: String) async throws -> [PairingToken] {
        // Supabase REST: GET /rest/v1/bot_pairings
        // Decrypt tokens client-side after download
        logger.info("Would download tokens from Supabase")
        return []
    }
}
```

**Step 3: Run tests**

Run: `swift test --filter BotPairingSyncTests 2>&1 | tail -20`
Expected: All PASS.

**Step 4: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/BotPairingSyncService.swift Shared/Tests/OptaMoltTests/BotPairingSyncTests.swift
git commit -m "feat(pairing): add sync merge logic and Supabase sync service skeleton"
```

---

## Task 17: Integration Build & Smoke Test

**Files:** None new — verification only.

**Step 1: Run full test suite**

Run: `swift test 2>&1 | tail -30`
Expected: All tests PASS including new BotPairing*, BotScanner*, PairingCoordinator*, BotPairingSync* suites.

**Step 2: Build iOS for device**

Run: `xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS,id=FF8A0B5A-5124-55AA-928E-B6D8C96DA329' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED.

**Step 3: Build macOS**

Run: `xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED.

**Step 4: Install on iPhone and verify Bot Map tab appears**

Run: `xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS,id=FF8A0B5A-5124-55AA-928E-B6D8C96DA329' install 2>&1 | tail -5`

**Step 5: Commit (if any fixes needed)**

```bash
git commit -m "fix(pairing): integration fixes from smoke test"
```

---

## Summary

| Task | Description | Estimated Lines | Test Coverage |
|------|-------------|-----------------|---------------|
| 1 | BotNode, PairingToken, DeviceIdentity models | ~150 | BotPairingTests (7 tests) |
| 2 | BotPairingStore — Keychain CRUD | ~130 | BotPairingStoreTests (5 tests) |
| 3 | Gateway protocol types + client methods | ~80 | BotPairingProtocolTests (3 tests) |
| 4 | BotScanner — Bonjour discovery | ~160 | BotScannerTests (2 tests) |
| 5 | PairingCoordinator — unified pipeline | ~100 | PairingCoordinatorTests (5 tests) |
| 6 | Info.plist — Bonjour + URL scheme | ~20 | Build verification |
| 7 | Deep link handler in app entry points | ~20 | Build verification |
| 8 | Bot Map constellation view (iOS) | ~200 | Visual verification |
| 9 | Radar scan animation | ~120 | Visual verification |
| 10 | Bot detail sheet | ~100 | Visual verification |
| 11 | Bot Map — macOS port | ~220 | Visual verification |
| 12 | QR code scanner (iOS) | ~80 | Manual testing |
| 13 | Updated onboarding flow | ~100 | Visual verification |
| 14 | Clipboard detection | ~30 | Manual testing |
| 15 | BotConfig migration bridge | ~40 | Build verification |
| 16 | Supabase sync layer | ~80 | BotPairingSyncTests (2 tests) |
| 17 | Integration build & smoke test | 0 | Full suite run |

**Total: ~1,630 lines of code, 24 tests, 17 commits**
