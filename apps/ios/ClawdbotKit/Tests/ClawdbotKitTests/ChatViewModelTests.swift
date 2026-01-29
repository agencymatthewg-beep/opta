//
//  ChatViewModelTests.swift
//  ClawdbotKit
//
//  Tests for ChatViewModel functionality.
//

import XCTest
import Combine
@testable import ClawdbotKit

@MainActor
final class ChatViewModelTests: XCTestCase {

    var handler: ProtocolHandler!
    var viewModel: ChatViewModel!
    var messageStore: MessageStore!
    var cancellables: Set<AnyCancellable>!
    var testConversationId: String!

    override func setUp() async throws {
        // Use unique conversation ID per test to prevent cross-contamination
        testConversationId = "test_viewmodel_\(UUID().uuidString)"
        messageStore = MessageStore(conversationId: testConversationId)
        handler = ProtocolHandler()
        viewModel = ChatViewModel(protocolHandler: handler, messageStore: messageStore)
        cancellables = Set<AnyCancellable>()

        // Wait for initial history load to complete
        try? await Task.sleep(for: .milliseconds(50))
    }

    override func tearDown() async throws {
        // Clean up test store
        await messageStore.clearHistory()
        cancellables = nil
        viewModel = nil
        messageStore = nil
        handler = nil
        testConversationId = nil
    }

    // MARK: - Send Tests

    func testSendAddsMessageToList() async {
        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Send a message
        await viewModel.send("Hello world")

        // Then: Message appears in list with pending status
        XCTAssertEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages.first?.content, "Hello world")
        XCTAssertEqual(viewModel.messages.first?.sender, .user)
        XCTAssertEqual(viewModel.messages.first?.status, .pending)
    }

    func testSendEmptyMessageIgnored() async {
        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Send empty message
        await viewModel.send("")

        // Then: No message added
        XCTAssertTrue(viewModel.messages.isEmpty)
    }

    func testSendWhitespaceOnlyMessageIgnored() async {
        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Send whitespace only
        await viewModel.send("   \n\t  ")

        // Then: No message added
        XCTAssertTrue(viewModel.messages.isEmpty)
    }

    // MARK: - Optimistic Update Tests

    func testOptimisticUpdateOccursBeforeAsyncComplete() async {
        // This test verifies the optimistic update pattern
        // Message should be in list immediately after send() is called

        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Start sending
        let sendTask = Task {
            await viewModel.send("Test message")
        }

        // Brief wait to allow optimistic update
        try? await Task.sleep(for: .milliseconds(10))

        // Then: Message is already in list (optimistic)
        XCTAssertEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages.first?.content, "Test message")
        XCTAssertEqual(viewModel.messages.first?.status, .pending)

        await sendTask.value
    }

    func testMultipleSendsAccumulate() async {
        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Send multiple messages
        await viewModel.send("First")
        await viewModel.send("Second")
        await viewModel.send("Third")

        // Then: All messages in order
        XCTAssertEqual(viewModel.messages.count, 3)
        XCTAssertEqual(viewModel.messages[0].content, "First")
        XCTAssertEqual(viewModel.messages[1].content, "Second")
        XCTAssertEqual(viewModel.messages[2].content, "Third")
    }

    // MARK: - Duplicate Handling Tests

    func testDuplicateMessageIDUpdatesExisting() async {
        // Given: Send a message (creates entry in list)
        await viewModel.send("Original message")
        let messageID = viewModel.messages.first!.id

        // When: Receive a message with same ID (e.g., server echo with updated status)
        // Note: We don't use this directly - we send via JSON to simulate server response
        _ = ChatMessage(
            id: messageID,
            content: "Original message",
            sender: .user,
            status: .delivered
        )

        // Simulate incoming message through handler
        let json = """
        {
            "version": "1.0",
            "type": "chat.message",
            "sequence": 1,
            "payload": {
                "id": {"value": "\(messageID.value)"},
                "content": "Original message",
                "sender": {"type": "user"},
                "timestamp": "\(ISO8601DateFormatter().string(from: Date()))",
                "status": "delivered",
                "threadID": null,
                "replyTo": null
            },
            "serverTimestamp": null
        }
        """
        await handler.handleIncoming(json)

        // Brief wait for Combine to propagate
        try? await Task.sleep(for: .milliseconds(50))

        // Then: Still one message, status updated
        XCTAssertEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages.first?.status, .delivered)
    }

    func testIncomingBotMessageAdded() async {
        // Given: Empty message list
        XCTAssertTrue(viewModel.messages.isEmpty)

        // When: Receive a bot message
        let json = """
        {
            "version": "1.0",
            "type": "chat.message",
            "sequence": 1,
            "payload": {
                "id": {"value": "bot-response-1"},
                "content": "Hello! How can I help?",
                "sender": {"type": "bot", "name": "Clawdbot"},
                "timestamp": "\(ISO8601DateFormatter().string(from: Date()))",
                "status": "delivered",
                "threadID": null,
                "replyTo": null
            },
            "serverTimestamp": null
        }
        """
        await handler.handleIncoming(json)

        // Brief wait for Combine to propagate
        try? await Task.sleep(for: .milliseconds(50))

        // Then: Bot message in list
        XCTAssertEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages.first?.content, "Hello! How can I help?")
        XCTAssertEqual(viewModel.messages.first?.sender, .bot(name: "Clawdbot"))
    }

    // MARK: - State Management Tests

    func testClearMessages() async {
        // Given: Messages in list
        await viewModel.send("Message 1")
        await viewModel.send("Message 2")
        XCTAssertEqual(viewModel.messages.count, 2)

        // When: Clear messages
        viewModel.clearMessages()

        // Then: List is empty
        XCTAssertTrue(viewModel.messages.isEmpty)
    }

    func testConnectionStateUpdate() async {
        // Given: Default disconnected state
        XCTAssertEqual(viewModel.connectionState, .disconnected)

        // When: Update connection state
        viewModel.updateConnectionState(.connected)

        // Then: State is updated
        XCTAssertEqual(viewModel.connectionState, .connected)
    }

    func testLoadingStateCompletesAfterInit() async {
        // Given: View model that was set up in setUp (which waited for load)
        // Then: No longer loading (history load completed)
        XCTAssertFalse(viewModel.isLoading)
    }

    // MARK: - Reply Tests

    func testSendReplyToMessage() async {
        // Given: A message to reply to
        await viewModel.send("Original question")
        let replyToID = viewModel.messages.first!.id

        // When: Send reply
        await viewModel.send("This is my reply", replyTo: replyToID)

        // Then: Reply has replyTo set
        XCTAssertEqual(viewModel.messages.count, 2)
        XCTAssertEqual(viewModel.messages[1].replyTo, replyToID)
    }
}
