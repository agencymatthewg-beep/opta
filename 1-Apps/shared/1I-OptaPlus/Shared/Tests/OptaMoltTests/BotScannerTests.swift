import XCTest
@testable import OptaMolt

@MainActor
final class BotScannerTests: XCTestCase {

    func testMergeDiscoveredWithPaired() {
        let paired = [
            BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖", state: .paired),
            BotNode(botId: "b2", gatewayFingerprint: "gw1", name: "Nova", emoji: "🌟", state: .paired)
        ]
        let discovered = [
            DiscoveredGateway(fingerprint: "gw1", name: "Home", host: "192.168.1.50", port: 3000, botCount: 3, protocolVersion: 3)
        ]
        let merged = BotScanner.merge(paired: paired, discovered: discovered)
        let gw1Bot = merged.first { $0.id == "gw1:b1" }
        XCTAssertEqual(gw1Bot?.gatewayHost, "192.168.1.50")
        XCTAssertEqual(gw1Bot?.gatewayPort, 3000)
    }

    func testDeduplication() {
        let old = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Old", emoji: "🤖", lastSeen: Date(timeIntervalSince1970: 1000))
        let new = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "New", emoji: "🤖", lastSeen: Date(timeIntervalSince1970: 2000))
        let deduped = BotScanner.deduplicate([old, new])
        XCTAssertEqual(deduped.count, 1)
        XCTAssertEqual(deduped.first?.name, "New")
    }

    func testMergePreservesUnmatchedPaired() {
        let paired = [
            BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖", state: .paired)
        ]
        let discovered: [DiscoveredGateway] = []  // Nothing discovered
        let merged = BotScanner.merge(paired: paired, discovered: discovered)
        XCTAssertEqual(merged.count, 1)
        XCTAssertEqual(merged.first?.name, "Jarvis")
    }
}
