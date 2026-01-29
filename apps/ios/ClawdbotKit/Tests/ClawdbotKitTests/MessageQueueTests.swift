//
//  MessageQueueTests.swift
//  ClawdbotKit
//
//  Tests for outgoing message queue.
//

import XCTest
@testable import ClawdbotKit

/// Mock delegate for testing
final class MockQueueDelegate: MessageQueueDelegate, @unchecked Sendable {
    var sentMessages: [ChatMessage] = []
    var deliveredIDs: [MessageID] = []
    var failedIDs: [MessageID] = []

    func messageQueue(_ queue: OutgoingMessageQueue, shouldSend message: ChatMessage) async {
        sentMessages.append(message)
    }

    func messageQueue(_ queue: OutgoingMessageQueue, didDeliver messageID: MessageID) {
        deliveredIDs.append(messageID)
    }

    func messageQueue(_ queue: OutgoingMessageQueue, didFail messageID: MessageID, error: Error?) {
        failedIDs.append(messageID)
    }

    func reset() {
        sentMessages.removeAll()
        deliveredIDs.removeAll()
        failedIDs.removeAll()
    }
}

final class MessageQueueTests: XCTestCase {

    var queue: OutgoingMessageQueue!
    var delegate: MockQueueDelegate!

    override func setUp() async throws {
        delegate = MockQueueDelegate()
        queue = OutgoingMessageQueue(config: .default)
        await queue.setDelegate(delegate)
    }

    // MARK: - Config Tests

    func testDefaultConfig() {
        let config = MessageQueueConfig.default
        XCTAssertEqual(config.maxRetries, 3)
        XCTAssertEqual(config.baseRetryDelay, 1.0)
        XCTAssertEqual(config.maxRetryDelay, 10.0)
        XCTAssertEqual(config.deliveryTimeout, 30.0)
    }

    // MARK: - Enqueue Tests

    func testEnqueueTriggersDelegate() async {
        let message = ChatMessage(content: "Test", sender: .user)

        await queue.enqueue(message)

        // Allow async processing
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertEqual(delegate.sentMessages.count, 1)
        XCTAssertEqual(delegate.sentMessages.first?.content, "Test")
    }

    func testEnqueueIncrementsSequence() async {
        let seq1 = await queue.nextSequence()
        let seq2 = await queue.nextSequence()
        let seq3 = await queue.nextSequence()

        XCTAssertEqual(seq1, 1)
        XCTAssertEqual(seq2, 2)
        XCTAssertEqual(seq3, 3)
    }

    // MARK: - Status Tests

    func testMarkSentUpdatesStatus() async {
        let message = ChatMessage(id: "msg-1", content: "Test", sender: .user)
        await queue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        await queue.markSent("msg-1")

        let queued = await queue.message(for: "msg-1")
        XCTAssertEqual(queued?.status, .awaitingAck)
    }

    func testConfirmDeliveryUpdatesStatus() async {
        let message = ChatMessage(id: "msg-1", content: "Test", sender: .user)
        await queue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        await queue.markSent("msg-1")
        await queue.confirmDelivery("msg-1")

        let queued = await queue.message(for: "msg-1")
        XCTAssertEqual(queued?.status, .delivered)
        XCTAssertTrue(delegate.deliveredIDs.contains("msg-1"))
    }

    // MARK: - Retry Tests

    func testRetryOnFailure() async {
        let fastConfig = MessageQueueConfig(
            maxRetries: 2,
            baseRetryDelay: 0.1,
            maxRetryDelay: 0.2,
            deliveryTimeout: 0.5
        )
        let testQueue = OutgoingMessageQueue(config: fastConfig)
        let testDelegate = MockQueueDelegate()
        await testQueue.setDelegate(testDelegate)

        let message = ChatMessage(id: "retry-msg", content: "Retry test", sender: .user)
        await testQueue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        // First send happens
        XCTAssertEqual(testDelegate.sentMessages.count, 1)

        // Simulate failure
        await testQueue.handleSendFailure("retry-msg", error: nil)
        try? await Task.sleep(nanoseconds: 200_000_000)  // Wait for retry delay

        // Should have retried
        XCTAssertEqual(testDelegate.sentMessages.count, 2)
    }

    func testMaxRetriesExceeded() async {
        let fastConfig = MessageQueueConfig(
            maxRetries: 1,
            baseRetryDelay: 0.01,
            maxRetryDelay: 0.02,
            deliveryTimeout: 0.5
        )
        let testQueue = OutgoingMessageQueue(config: fastConfig)
        let testDelegate = MockQueueDelegate()
        await testQueue.setDelegate(testDelegate)

        let message = ChatMessage(id: "fail-msg", content: "Fail test", sender: .user)
        await testQueue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Fail once (retry count = 1, equals maxRetries)
        await testQueue.handleSendFailure("fail-msg", error: nil)

        let queued = await testQueue.message(for: "fail-msg")
        XCTAssertEqual(queued?.status, .failed)
        XCTAssertTrue(testDelegate.failedIDs.contains("fail-msg"))
    }

    // MARK: - Query Tests

    func testPendingMessages() async {
        let msg1 = ChatMessage(id: "msg-1", content: "Test 1", sender: .user)
        let msg2 = ChatMessage(id: "msg-2", content: "Test 2", sender: .user)

        await queue.enqueue(msg1)
        await queue.enqueue(msg2)
        try? await Task.sleep(nanoseconds: 100_000_000)

        await queue.markSent("msg-1")
        await queue.confirmDelivery("msg-1")

        let pending = await queue.pendingMessages()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.id.value, "msg-2")
    }

    func testPendingCount() async {
        let msg1 = ChatMessage(content: "Test 1", sender: .user)
        let msg2 = ChatMessage(content: "Test 2", sender: .user)
        let msg3 = ChatMessage(content: "Test 3", sender: .user)

        await queue.enqueue(msg1)
        await queue.enqueue(msg2)
        await queue.enqueue(msg3)
        try? await Task.sleep(nanoseconds: 100_000_000)

        let count = await queue.pendingCount()
        XCTAssertEqual(count, 3)
    }

    // MARK: - Clear Tests

    func testClear() async {
        let message = ChatMessage(content: "Test", sender: .user)
        await queue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        await queue.clear()

        let all = await queue.allMessages()
        XCTAssertTrue(all.isEmpty)
    }

    func testRetryFailed() async {
        let fastConfig = MessageQueueConfig(
            maxRetries: 1,
            baseRetryDelay: 0.01,
            maxRetryDelay: 0.02,
            deliveryTimeout: 0.5
        )
        let testQueue = OutgoingMessageQueue(config: fastConfig)
        let testDelegate = MockQueueDelegate()
        await testQueue.setDelegate(testDelegate)

        let message = ChatMessage(id: "retry-all", content: "Test", sender: .user)
        await testQueue.enqueue(message)
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Fail to mark as failed
        await testQueue.handleSendFailure("retry-all", error: nil)

        var queued = await testQueue.message(for: "retry-all")
        XCTAssertEqual(queued?.status, .failed)

        // Retry all failed
        testDelegate.reset()
        await testQueue.retryFailed()
        try? await Task.sleep(nanoseconds: 100_000_000)

        queued = await testQueue.message(for: "retry-all")
        XCTAssertNotEqual(queued?.status, .failed)
        XCTAssertEqual(testDelegate.sentMessages.count, 1)
    }
}
