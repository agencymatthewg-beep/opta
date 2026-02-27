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
