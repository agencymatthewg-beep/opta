//
//  ProtocolHandlerTests.swift
//  ClawdbotKit
//
//  Integration tests for protocol handler.
//

import XCTest
import Combine
@testable import ClawdbotKit

/// Mock delegate for testing
final class MockProtocolDelegate: ProtocolHandlerDelegate, @unchecked Sendable {
    var receivedMessages: [ChatMessage] = []
    var receivedStates: [BotStateUpdate] = []
    var receivedChunks: [StreamingChunk] = []
    var deliveredIDs: [MessageID] = []
    var failedIDs: [MessageID] = []

    func protocolHandler(_ handler: ProtocolHandler, didReceiveMessage message: ChatMessage) {
        receivedMessages.append(message)
    }

    func protocolHandler(_ handler: ProtocolHandler, didReceiveBotState state: BotStateUpdate) {
        receivedStates.append(state)
    }

    func protocolHandler(_ handler: ProtocolHandler, didReceiveChunk chunk: StreamingChunk) {
        receivedChunks.append(chunk)
    }

    func protocolHandler(_ handler: ProtocolHandler, didDeliverMessage messageID: MessageID) {
        deliveredIDs.append(messageID)
    }

    func protocolHandler(_ handler: ProtocolHandler, didFailMessage messageID: MessageID, error: Error?) {
        failedIDs.append(messageID)
    }
}

final class ProtocolHandlerTests: XCTestCase {

    var handler: ProtocolHandler!
    var delegate: MockProtocolDelegate!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        handler = ProtocolHandler()
        delegate = MockProtocolDelegate()
        cancellables = Set<AnyCancellable>()
        await handler.setDelegate(delegate)
    }

    override func tearDown() async throws {
        cancellables = nil
        delegate = nil
        handler = nil
    }

    // MARK: - Incoming Message Tests

    func testHandleChatMessage() async {
        let json = """
        {
            "version": "1.0",
            "type": "chat.message",
            "sequence": 1,
            "payload": {
                "id": {"value": "incoming-1"},
                "content": "Hello from Opta",
                "sender": {"type": "bot", "name": "Opta"},
                "timestamp": "2024-01-30T12:00:00Z",
                "status": "delivered",
                "threadID": null,
                "replyTo": null
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(json)

        XCTAssertEqual(delegate.receivedMessages.count, 1)
        XCTAssertEqual(delegate.receivedMessages.first?.content, "Hello from Opta")
        XCTAssertEqual(delegate.receivedMessages.first?.sender, .bot(name: "Opta"))
    }

    func testHandleBotState() async {
        let json = """
        {
            "version": "1.0",
            "type": "bot.state",
            "sequence": 5,
            "payload": {
                "state": "thinking",
                "botName": "Opta",
                "detail": "Processing your request...",
                "timestamp": "2024-01-30T12:00:00Z"
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(json)

        XCTAssertEqual(delegate.receivedStates.count, 1)
        XCTAssertEqual(delegate.receivedStates.first?.state, .thinking)
        XCTAssertEqual(delegate.receivedStates.first?.botName, "Opta")
        XCTAssertEqual(delegate.receivedStates.first?.detail, "Processing your request...")
    }

    func testHandleStreamingChunks() async {
        // Send multiple chunks
        let chunk1 = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 10,
            "payload": {
                "messageID": {"value": "stream-1"},
                "chunkIndex": 0,
                "content": "Hello ",
                "isFinal": false
            },
            "serverTimestamp": null
        }
        """

        let chunk2 = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 11,
            "payload": {
                "messageID": {"value": "stream-1"},
                "chunkIndex": 1,
                "content": "World!",
                "isFinal": true
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(chunk1)
        await handler.handleIncoming(chunk2)

        XCTAssertEqual(delegate.receivedChunks.count, 2)

        // Final chunk should trigger complete message
        XCTAssertEqual(delegate.receivedMessages.count, 1)
        XCTAssertEqual(delegate.receivedMessages.first?.content, "Hello World!")
    }

    func testHandleUnknownMessageType() async {
        let json = """
        {
            "version": "1.0",
            "type": "future.feature",
            "sequence": 99,
            "payload": {"data": "unknown"},
            "serverTimestamp": null
        }
        """

        // Should not crash
        await handler.handleIncoming(json)

        // Should not call any delegate methods
        XCTAssertTrue(delegate.receivedMessages.isEmpty)
        XCTAssertTrue(delegate.receivedStates.isEmpty)
    }

    func testHandleInvalidJSON() async {
        let invalid = "not valid json {"

        // Should not crash
        await handler.handleIncoming(invalid)

        // Should not call any delegate methods
        XCTAssertTrue(delegate.receivedMessages.isEmpty)
    }

    // MARK: - Module Tests

    func testProtocolVersion() {
        XCTAssertEqual(ClawdbotProtocol.version, "1.0.0")
        XCTAssertEqual(ClawdbotProtocol.status, "implemented")
    }

    func testBotNames() {
        XCTAssertEqual(ClawdbotProtocol.Bots.opta, "Opta")
        XCTAssertEqual(ClawdbotProtocol.Bots.mono, "Mono")
    }

    func testMessageTypeConstants() {
        XCTAssertEqual(ClawdbotProtocol.MessageTypes.chatMessage, "chat.message")
        XCTAssertEqual(ClawdbotProtocol.MessageTypes.messageAck, "message.ack")
        XCTAssertEqual(ClawdbotProtocol.MessageTypes.botState, "bot.state")
        XCTAssertEqual(ClawdbotProtocol.MessageTypes.streamingChunk, "streaming.chunk")
    }

    // MARK: - State Tests

    func testStreamingContentRetrieval() async {
        let chunk1 = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 10,
            "payload": {
                "messageID": {"value": "test-stream"},
                "chunkIndex": 0,
                "content": "First chunk ",
                "isFinal": false
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(chunk1)

        let content = await handler.streamingContent(for: "test-stream")
        XCTAssertEqual(content, "First chunk ")
    }

    func testPendingMessageCount() async {
        let count = await handler.pendingMessageCount()
        XCTAssertEqual(count, 0)
    }

    func testResetStreaming() async {
        let chunk = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 10,
            "payload": {
                "messageID": {"value": "reset-test"},
                "chunkIndex": 0,
                "content": "Some content",
                "isFinal": false
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(chunk)

        // Content should exist
        var content = await handler.streamingContent(for: "reset-test")
        XCTAssertFalse(content.isEmpty)

        // Reset
        await handler.resetStreaming()

        // Content should be empty after reset
        content = await handler.streamingContent(for: "reset-test")
        XCTAssertTrue(content.isEmpty)
    }

    // MARK: - Combine Publisher Tests

    func testStreamingChunksPublisher() async {
        // Given: Subscribe to streaming chunks publisher
        var receivedChunks: [StreamingChunk] = []
        let expectation = XCTestExpectation(description: "Receive streaming chunk via publisher")

        handler.streamingChunks
            .sink { chunk in
                receivedChunks.append(chunk)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When: Send a streaming chunk
        let json = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 10,
            "payload": {
                "messageID": {"value": "publisher-test"},
                "chunkIndex": 0,
                "content": "Test chunk content",
                "isFinal": false
            },
            "serverTimestamp": null
        }
        """

        await handler.handleIncoming(json)

        // Then: Chunk received via publisher
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedChunks.count, 1)
        XCTAssertEqual(receivedChunks.first?.content, "Test chunk content")
        XCTAssertEqual(receivedChunks.first?.messageID.value, "publisher-test")
    }

    func testStreamingChunksPublisherReceivesMultipleChunks() async {
        // Given: Subscribe to streaming chunks publisher
        var receivedChunks: [StreamingChunk] = []
        let expectation = XCTestExpectation(description: "Receive multiple streaming chunks")
        expectation.expectedFulfillmentCount = 3

        handler.streamingChunks
            .sink { chunk in
                receivedChunks.append(chunk)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When: Send multiple streaming chunks
        for i in 0..<3 {
            let json = """
            {
                "version": "1.0",
                "type": "streaming.chunk",
                "sequence": \(10 + i),
                "payload": {
                    "messageID": {"value": "multi-chunk-test"},
                    "chunkIndex": \(i),
                    "content": "Chunk \(i)",
                    "isFinal": \(i == 2 ? "true" : "false")
                },
                "serverTimestamp": null
            }
            """
            await handler.handleIncoming(json)
        }

        // Then: All chunks received via publisher
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedChunks.count, 3)
        XCTAssertEqual(receivedChunks[0].content, "Chunk 0")
        XCTAssertEqual(receivedChunks[1].content, "Chunk 1")
        XCTAssertEqual(receivedChunks[2].content, "Chunk 2")
        XCTAssertTrue(receivedChunks[2].isFinal)
    }
}
