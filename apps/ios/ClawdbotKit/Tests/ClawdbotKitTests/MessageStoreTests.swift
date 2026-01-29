//
//  MessageStoreTests.swift
//  ClawdbotKit
//
//  Tests for MessageStore persistence functionality.
//

import XCTest
@testable import ClawdbotKit

final class MessageStoreTests: XCTestCase {

    // MARK: - Properties

    /// Unique conversation ID for each test to prevent cross-contamination
    private var testConversationId: String!

    // MARK: - Setup/Teardown

    override func setUp() async throws {
        // Generate unique conversation ID for this test run
        testConversationId = "test_\(UUID().uuidString)"
    }

    override func tearDown() async throws {
        // Clean up test data
        let store = MessageStore(conversationId: testConversationId)
        await store.clearHistory()
        testConversationId = nil
    }

    // MARK: - Save and Load Tests

    func testSaveAndLoadMessages() async {
        // Given: A store with no messages
        let store1 = MessageStore(conversationId: testConversationId)

        // When: Save a message
        let message = ChatMessage(
            content: "Hello, world!",
            sender: .user,
            status: .delivered
        )
        await store1.save(message)

        // Then: Create new store instance and load messages
        let store2 = MessageStore(conversationId: testConversationId)
        let loaded = await store2.loadMessages()

        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.content, "Hello, world!")
        XCTAssertEqual(loaded.first?.sender, .user)
        XCTAssertEqual(loaded.first?.id, message.id)
    }

    func testPersistenceAcrossInstances() async {
        // Given: Save multiple messages
        let store1 = MessageStore(conversationId: testConversationId)

        let message1 = ChatMessage(content: "First message", sender: .user, status: .delivered)
        let message2 = ChatMessage(content: "Second message", sender: .bot(name: "Clawdbot"), status: .delivered)
        let message3 = ChatMessage(content: "Third message", sender: .user, status: .pending)

        await store1.save(message1)
        await store1.save(message2)
        await store1.save(message3)

        // When: Create completely new store instance
        let store2 = MessageStore(conversationId: testConversationId)
        let loaded = await store2.loadMessages()

        // Then: All messages persist correctly
        XCTAssertEqual(loaded.count, 3)
        XCTAssertEqual(loaded[0].content, "First message")
        XCTAssertEqual(loaded[1].content, "Second message")
        XCTAssertEqual(loaded[2].content, "Third message")
        XCTAssertEqual(loaded[1].sender, .bot(name: "Clawdbot"))
    }

    // MARK: - Empty State Tests

    func testEmptyStateReturnsEmptyArray() async {
        // Given: A store for a conversation that doesn't exist
        let unknownId = "nonexistent_\(UUID().uuidString)"
        let store = MessageStore(conversationId: unknownId)

        // When: Load messages
        let loaded = await store.loadMessages()

        // Then: Returns empty array, not error
        XCTAssertTrue(loaded.isEmpty)

        // Cleanup
        await store.clearHistory()
    }

    func testLoadMessagesReturnsCacheOnSecondCall() async {
        // Given: Store with one message
        let store = MessageStore(conversationId: testConversationId)
        let message = ChatMessage(content: "Cached message", sender: .user, status: .delivered)
        await store.save(message)

        // When: Load messages twice
        let firstLoad = await store.loadMessages()
        let secondLoad = await store.loadMessages()

        // Then: Both return same data (cache hit on second)
        XCTAssertEqual(firstLoad.count, secondLoad.count)
        XCTAssertEqual(firstLoad.first?.id, secondLoad.first?.id)
    }

    // MARK: - Clear History Tests

    func testClearHistoryRemovesAllMessages() async {
        // Given: Store with messages
        let store = MessageStore(conversationId: testConversationId)
        await store.save(ChatMessage(content: "Message 1", sender: .user, status: .delivered))
        await store.save(ChatMessage(content: "Message 2", sender: .user, status: .delivered))

        // Verify messages exist
        var loaded = await store.loadMessages()
        XCTAssertEqual(loaded.count, 2)

        // When: Clear history
        await store.clearHistory()

        // Then: Messages are gone
        loaded = await store.loadMessages()
        XCTAssertTrue(loaded.isEmpty)
    }

    func testClearHistoryPersistsAcrossInstances() async {
        // Given: Store with messages
        let store1 = MessageStore(conversationId: testConversationId)
        await store1.save(ChatMessage(content: "To be deleted", sender: .user, status: .delivered))

        // When: Clear history
        await store1.clearHistory()

        // Then: New instance also sees empty state
        let store2 = MessageStore(conversationId: testConversationId)
        let loaded = await store2.loadMessages()
        XCTAssertTrue(loaded.isEmpty)
    }

    // MARK: - Date Encoding Tests

    func testDateEncodingPrecision() async {
        // Given: A message with specific timestamp
        let specificDate = Date(timeIntervalSince1970: 1704067200) // 2024-01-01 00:00:00 UTC
        let store1 = MessageStore(conversationId: testConversationId)

        let message = ChatMessage(
            content: "Timestamped message",
            sender: .user,
            timestamp: specificDate,
            status: .delivered
        )
        await store1.save(message)

        // When: Load from new instance
        let store2 = MessageStore(conversationId: testConversationId)
        let loaded = await store2.loadMessages()

        // Then: Timestamp preserved with ISO8601 precision
        XCTAssertEqual(loaded.count, 1)
        // Compare timestamps within 1 second tolerance (ISO8601 second precision)
        let timeDiff = abs(loaded.first!.timestamp.timeIntervalSince(specificDate))
        XCTAssertLessThan(timeDiff, 1.0)
    }

    // MARK: - SaveAll Tests

    func testSaveAllMultipleMessages() async {
        // Given: Store with no messages
        let store = MessageStore(conversationId: testConversationId)

        // When: Save multiple messages at once
        let messages = [
            ChatMessage(content: "Batch 1", sender: .user, status: .delivered),
            ChatMessage(content: "Batch 2", sender: .bot(name: "Bot"), status: .delivered),
            ChatMessage(content: "Batch 3", sender: .user, status: .pending)
        ]
        await store.saveAll(messages)

        // Then: All messages saved
        let loaded = await store.loadMessages()
        XCTAssertEqual(loaded.count, 3)
        XCTAssertEqual(loaded.map { $0.content }, ["Batch 1", "Batch 2", "Batch 3"])
    }

    // MARK: - Duplicate Handling Tests

    func testSaveDuplicateUpdatesExisting() async {
        // Given: Store with a message
        let store = MessageStore(conversationId: testConversationId)
        let originalMessage = ChatMessage(
            content: "Original",
            sender: .user,
            status: .pending
        )
        await store.save(originalMessage)

        // When: Save message with same ID but different status
        var updatedMessage = originalMessage
        updatedMessage.status = .delivered
        await store.save(updatedMessage)

        // Then: Only one message, with updated status
        let loaded = await store.loadMessages()
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.status, .delivered)
    }

    // MARK: - Conversation Isolation Tests

    func testDifferentConversationsAreSeparate() async {
        // Given: Two different conversation stores
        let conversationA = "conversation_a_\(UUID().uuidString)"
        let conversationB = "conversation_b_\(UUID().uuidString)"

        let storeA = MessageStore(conversationId: conversationA)
        let storeB = MessageStore(conversationId: conversationB)

        // When: Save to each
        await storeA.save(ChatMessage(content: "Message in A", sender: .user, status: .delivered))
        await storeB.save(ChatMessage(content: "Message in B", sender: .user, status: .delivered))
        await storeB.save(ChatMessage(content: "Another in B", sender: .user, status: .delivered))

        // Then: Each conversation has its own messages
        let loadedA = await storeA.loadMessages()
        let loadedB = await storeB.loadMessages()

        XCTAssertEqual(loadedA.count, 1)
        XCTAssertEqual(loadedA.first?.content, "Message in A")

        XCTAssertEqual(loadedB.count, 2)
        XCTAssertEqual(loadedB.first?.content, "Message in B")

        // Cleanup
        await storeA.clearHistory()
        await storeB.clearHistory()
    }

    // MARK: - Bot Message Tests

    func testBotMessagePersistence() async {
        // Given: Store with bot message
        let store = MessageStore(conversationId: testConversationId)
        let botMessage = ChatMessage(
            content: "Hello from the bot!",
            sender: .bot(name: "TestBot"),
            status: .delivered
        )
        await store.save(botMessage)

        // When: Load from new instance
        let loaded = await store.loadMessages()

        // Then: Bot name preserved
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.sender, .bot(name: "TestBot"))
    }
}
