//
//  MessageTypesTests.swift
//  ClawdbotKit
//
//  Tests for message type definitions.
//

import XCTest
@testable import ClawdbotKit

final class MessageTypesTests: XCTestCase {

    // MARK: - MessageID Tests

    func testMessageIDGeneration() {
        let id1 = MessageID.generate()
        let id2 = MessageID.generate()
        XCTAssertNotEqual(id1, id2, "Generated IDs should be unique")
    }

    func testMessageIDStringLiteral() {
        let id: MessageID = "test-id"
        XCTAssertEqual(id.value, "test-id")
    }

    func testMessageIDCodable() throws {
        let id = MessageID("test-123")
        let data = try JSONEncoder().encode(id)
        let decoded = try JSONDecoder().decode(MessageID.self, from: data)
        XCTAssertEqual(id, decoded)
    }

    // MARK: - MessageSender Tests

    func testMessageSenderUserCodable() throws {
        let sender = MessageSender.user
        let data = try JSONEncoder().encode(sender)
        let decoded = try JSONDecoder().decode(MessageSender.self, from: data)
        XCTAssertEqual(sender, decoded)
    }

    func testMessageSenderBotCodable() throws {
        let sender = MessageSender.bot(name: "Opta")
        let data = try JSONEncoder().encode(sender)
        let decoded = try JSONDecoder().decode(MessageSender.self, from: data)
        XCTAssertEqual(sender, decoded)
    }

    // MARK: - ChatMessage Tests

    func testChatMessageDefaults() {
        let message = ChatMessage(
            content: "Hello",
            sender: .user
        )
        XCTAssertEqual(message.status, .pending)
        XCTAssertNil(message.threadID)
        XCTAssertNil(message.replyTo)
    }

    func testChatMessageCodable() throws {
        let message = ChatMessage(
            id: "msg-123",
            content: "Test message",
            sender: .bot(name: "Opta"),
            timestamp: Date(timeIntervalSince1970: 1706644800),
            status: .delivered,
            threadID: "thread-1",
            replyTo: "msg-100"
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(ChatMessage.self, from: data)

        XCTAssertEqual(message.id, decoded.id)
        XCTAssertEqual(message.content, decoded.content)
        XCTAssertEqual(message.sender, decoded.sender)
        XCTAssertEqual(message.status, decoded.status)
        XCTAssertEqual(message.threadID, decoded.threadID)
        XCTAssertEqual(message.replyTo, decoded.replyTo)
    }

    // MARK: - ProtocolEnvelope Tests

    func testProtocolEnvelopeCodable() throws {
        let envelope = ProtocolEnvelope(
            version: "1.0",
            type: "chat.message",
            sequence: 42,
            payload: ChatMessage(content: "Test", sender: .user),
            serverTimestamp: nil
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(envelope)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(ProtocolEnvelope<ChatMessage>.self, from: data)

        XCTAssertEqual(envelope.version, decoded.version)
        XCTAssertEqual(envelope.type, decoded.type)
        XCTAssertEqual(envelope.sequence, decoded.sequence)
        XCTAssertEqual(envelope.payload.content, decoded.payload.content)
    }

    // MARK: - MessageAck Tests

    func testMessageAckCodable() throws {
        let ack = MessageAck(
            messageID: "msg-123",
            status: .received
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(ack)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(MessageAck.self, from: data)

        XCTAssertEqual(ack.messageID, decoded.messageID)
        XCTAssertEqual(ack.status, decoded.status)
    }
}

final class StreamingTypesTests: XCTestCase {

    // MARK: - BotState Tests

    func testBotStateCodable() throws {
        for state in [BotState.idle, .thinking, .typing, .toolUse] {
            let data = try JSONEncoder().encode(state)
            let decoded = try JSONDecoder().decode(BotState.self, from: data)
            XCTAssertEqual(state, decoded)
        }
    }

    // MARK: - StreamingChunk Tests

    func testStreamingChunkCodable() throws {
        let chunk = StreamingChunk(
            messageID: "msg-1",
            chunkIndex: 5,
            content: "Hello ",
            isFinal: false
        )

        let data = try JSONEncoder().encode(chunk)
        let decoded = try JSONDecoder().decode(StreamingChunk.self, from: data)

        XCTAssertEqual(chunk.messageID, decoded.messageID)
        XCTAssertEqual(chunk.chunkIndex, decoded.chunkIndex)
        XCTAssertEqual(chunk.content, decoded.content)
        XCTAssertEqual(chunk.isFinal, decoded.isFinal)
    }

    // MARK: - StreamingMessageAssembler Tests

    func testAssemblerAggregatesChunks() async {
        let assembler = StreamingMessageAssembler()
        let messageID: MessageID = "test-msg"

        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 0, content: "Hello "))
        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 1, content: "World"))

        let content = await assembler.currentContent(for: messageID)
        XCTAssertEqual(content, "Hello World")
    }

    func testAssemblerHandlesOutOfOrder() async {
        let assembler = StreamingMessageAssembler()
        let messageID: MessageID = "test-msg"

        // Add chunks out of order
        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 2, content: "!"))
        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 0, content: "Hello "))
        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 1, content: "World"))

        let content = await assembler.currentContent(for: messageID)
        XCTAssertEqual(content, "Hello World!")
    }

    func testAssemblerDetectsCompletion() async {
        let assembler = StreamingMessageAssembler()
        let messageID: MessageID = "test-msg"

        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 0, content: "Hi"))
        var isComplete = await assembler.isComplete(messageID: messageID)
        XCTAssertFalse(isComplete)

        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 1, content: "!", isFinal: true))
        isComplete = await assembler.isComplete(messageID: messageID)
        XCTAssertTrue(isComplete)
    }

    func testAssemblerComplete() async {
        let assembler = StreamingMessageAssembler()
        let messageID: MessageID = "test-msg"

        await assembler.addChunk(StreamingChunk(messageID: messageID, chunkIndex: 0, content: "Done", isFinal: true))

        let result = await assembler.complete(messageID: messageID)
        XCTAssertEqual(result, "Done")

        // Should be cleared
        let remaining = await assembler.currentContent(for: messageID)
        XCTAssertEqual(remaining, "")
    }
}
