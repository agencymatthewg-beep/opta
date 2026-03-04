import XCTest
@testable import OptaMolt

@MainActor
final class ChatErrorRecoveryTests: XCTestCase {

    private func makeViewModel() -> ChatViewModel {
        ChatViewModel(
            botConfig: BotConfig(
                name: "Test Bot",
                port: 18793,
                token: "test-token"
            )
        )
    }

    func testNotPairedErrorPromptsForPairing() {
        let viewModel = makeViewModel()
        viewModel.onRequestPairing = {}

        viewModel.handleError(OpenClawError.notPaired, context: "send message")

        let kinds = viewModel.errorRecoveryPrompt?.actions.map(\.kind) ?? []
        XCTAssertTrue(kinds.contains(.pairDevice))
        XCTAssertTrue(kinds.contains(.dismiss))
    }

    func testAuthenticationErrorPromptsForSettings() {
        let viewModel = makeViewModel()
        viewModel.onRequestSettings = {}

        viewModel.handleError(OpenClawError.authenticationFailed("token expired"), context: "load history")

        let kinds = viewModel.errorRecoveryPrompt?.actions.map(\.kind) ?? []
        XCTAssertTrue(kinds.contains(.openSettings))
        XCTAssertTrue(kinds.contains(.reconnect))
        XCTAssertTrue(kinds.contains(.dismiss))
    }

    func testTimeoutDuringHistoryLoadOffersRetry() {
        let viewModel = makeViewModel()

        viewModel.handleError(OpenClawError.timeout, context: "load history")

        let kinds = viewModel.errorRecoveryPrompt?.actions.map(\.kind) ?? []
        XCTAssertTrue(kinds.contains(.retry))
        XCTAssertTrue(kinds.contains(.reconnect))
    }

    func testSendMessageErrorOffersRetry() {
        let viewModel = makeViewModel()

        viewModel.handleError(OpenClawError.notConnected, context: "send message")

        let kinds = viewModel.errorRecoveryPrompt?.actions.map(\.kind) ?? []
        XCTAssertTrue(kinds.contains(.retry))
        XCTAssertTrue(kinds.contains(.reconnect))
        XCTAssertTrue(kinds.contains(.dismiss))
    }

    func testRetrySendReusesFailedMessageWithoutDuplication() async {
        let viewModel = makeViewModel()
        viewModel.offlineQueue.clear()

        let failed = ChatMessage(
            content: "Retry me",
            sender: .user,
            status: .failed,
            source: .optaplus
        )
        viewModel.messages = [failed]

        await viewModel.retrySend(failed)

        XCTAssertEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages.first?.id, failed.id)
        XCTAssertEqual(viewModel.messages.first?.status, .pending)
        XCTAssertEqual(viewModel.offlineQueue.count, 1)
        XCTAssertEqual(viewModel.offlineQueue.messages.first?.chatMessageId, failed.id)
    }

    func testRetryAttachmentOnlyMessageQueuesEmptyWireText() async {
        let viewModel = makeViewModel()
        viewModel.offlineQueue.clear()

        let previousDeviceName = UserDefaults.standard.string(forKey: "optaplus.deviceName")
        UserDefaults.standard.removeObject(forKey: "optaplus.deviceName")
        defer {
            if let previousDeviceName {
                UserDefaults.standard.set(previousDeviceName, forKey: "optaplus.deviceName")
            } else {
                UserDefaults.standard.removeObject(forKey: "optaplus.deviceName")
            }
        }

        let attachment = ChatAttachment(
            filename: "note.txt",
            mimeType: "text/plain",
            sizeBytes: 4,
            data: Data("test".utf8)
        )
        let failed = ChatMessage(
            content: "[1 file]",
            sender: .user,
            status: .failed,
            source: .optaplus,
            attachments: [attachment]
        )
        viewModel.messages = [failed]

        await viewModel.retrySend(failed)

        XCTAssertEqual(viewModel.offlineQueue.count, 1)
        XCTAssertEqual(viewModel.offlineQueue.messages.first?.text, "")
        XCTAssertEqual(viewModel.offlineQueue.messages.first?.chatMessageId, failed.id)
    }

    func testPairDeviceActionInvokesConfiguredCallback() {
        let viewModel = makeViewModel()
        var called = false
        viewModel.onRequestPairing = { called = true }

        viewModel.handleErrorRecoveryAction(.pairDevice)

        XCTAssertTrue(called)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.errorRecoveryPrompt)
    }

    func testOpenSettingsActionInvokesConfiguredCallback() {
        let viewModel = makeViewModel()
        var called = false
        viewModel.onRequestSettings = { called = true }

        viewModel.handleErrorRecoveryAction(.openSettings)

        XCTAssertTrue(called)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.errorRecoveryPrompt)
    }

    func testDismissClearsErrorAndPrompt() {
        let viewModel = makeViewModel()
        viewModel.handleError(OpenClawError.notConnected, context: "load history")

        viewModel.dismissErrorPrompt()

        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.errorRecoveryPrompt)
    }
}
