import XCTest
@testable import OptaMolt

@MainActor
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
        let text = "Check this out: optaplus://pair?host=10.0.0.1&port=3000&fp=gw1&token=abc and more text"
        let info = PairingCoordinator.parseClipboardText(text)
        XCTAssertNotNil(info)
        XCTAssertEqual(info?.fingerprint, "gw1")
    }

    func testParseClipboardNoMatch() {
        let info = PairingCoordinator.parseClipboardText("hello world")
        XCTAssertNil(info)
    }
}
