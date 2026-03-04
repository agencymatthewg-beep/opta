import XCTest
@testable import OptaPlusMacOS

@MainActor
final class OptaPlusMacOSTests: XCTestCase {

    func testRecoveryPairingCallbackPostsBotMapNotification() {
        let appState = AppState()
        guard let bot = appState.bots.first else {
            XCTFail("Expected at least one bot in AppState defaults")
            return
        }

        let vm = appState.viewModel(for: bot)
        let exp = expectation(description: "toggleBotMap notification posted")
        let observer = NotificationCenter.default.addObserver(
            forName: .toggleBotMap,
            object: nil,
            queue: .main
        ) { _ in
            exp.fulfill()
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        vm.onRequestPairing?()
        wait(for: [exp], timeout: 1.0)
    }

    func testRecoverySettingsCallbackIsConfigured() {
        let appState = AppState()
        guard let bot = appState.bots.first else {
            XCTFail("Expected at least one bot in AppState defaults")
            return
        }

        let vm = appState.viewModel(for: bot)
        XCTAssertNotNil(vm.onRequestSettings)
    }
}
