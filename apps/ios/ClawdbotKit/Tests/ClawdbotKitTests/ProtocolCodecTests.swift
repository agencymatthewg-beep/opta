//
//  ProtocolCodecTests.swift
//  ClawdbotKit
//
//  Tests for protocol encoder/decoder.
//

import XCTest
@testable import ClawdbotKit

final class ProtocolCodecTests: XCTestCase {

    let codec = ProtocolCodec()

    // MARK: - Encoding Tests

    func testEncodeChatMessage() throws {
        let message = ChatMessage(
            id: "msg-1",
            content: "Hello",
            sender: .user
        )

        let data = try codec.encode(message: message, sequence: 1)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(json?["type"] as? String, "chat.message")
        XCTAssertEqual(json?["version"] as? String, "1.0")
        XCTAssertEqual(json?["sequence"] as? Int, 1)
        XCTAssertNotNil(json?["payload"])
    }

    func testEncodePing() throws {
        let data = try codec.encodePing(sequence: 42)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(json?["type"] as? String, "system.ping")
        XCTAssertEqual(json?["sequence"] as? Int, 42)
    }

    func testEncodePong() throws {
        let data = try codec.encodePong(sequence: 42)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(json?["type"] as? String, "system.pong")
        XCTAssertEqual(json?["sequence"] as? Int, 42)
    }

    // MARK: - Decoding Tests

    func testDecodeChatMessage() throws {
        let json = """
        {
            "version": "1.0",
            "type": "chat.message",
            "sequence": 1,
            "payload": {
                "id": {"value": "msg-1"},
                "content": "Hello from bot",
                "sender": {"type": "bot", "name": "Opta"},
                "timestamp": "2024-01-30T12:00:00Z",
                "status": "delivered",
                "threadID": null,
                "replyTo": null
            },
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .chatMessage(let envelope) = decoded else {
            XCTFail("Expected chatMessage")
            return
        }

        XCTAssertEqual(envelope.payload.id.value, "msg-1")
        XCTAssertEqual(envelope.payload.content, "Hello from bot")
        XCTAssertEqual(envelope.payload.sender, .bot(name: "Opta"))
    }

    func testDecodeMessageAck() throws {
        let json = """
        {
            "version": "1.0",
            "type": "message.ack",
            "sequence": 5,
            "payload": {
                "messageID": {"value": "msg-123"},
                "status": "received",
                "serverTimestamp": "2024-01-30T12:00:00Z"
            },
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .messageAck(let envelope) = decoded else {
            XCTFail("Expected messageAck")
            return
        }

        XCTAssertEqual(envelope.payload.messageID.value, "msg-123")
        XCTAssertEqual(envelope.payload.status, .received)
    }

    func testDecodeBotState() throws {
        let json = """
        {
            "version": "1.0",
            "type": "bot.state",
            "sequence": 10,
            "payload": {
                "state": "thinking",
                "botName": "Opta",
                "detail": null,
                "timestamp": "2024-01-30T12:00:00Z"
            },
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .botState(let envelope) = decoded else {
            XCTFail("Expected botState")
            return
        }

        XCTAssertEqual(envelope.payload.state, .thinking)
        XCTAssertEqual(envelope.payload.botName, "Opta")
    }

    func testDecodeStreamingChunk() throws {
        let json = """
        {
            "version": "1.0",
            "type": "streaming.chunk",
            "sequence": 15,
            "payload": {
                "messageID": {"value": "msg-stream"},
                "chunkIndex": 3,
                "content": "Hello ",
                "isFinal": false
            },
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .streamingChunk(let envelope) = decoded else {
            XCTFail("Expected streamingChunk")
            return
        }

        XCTAssertEqual(envelope.payload.messageID.value, "msg-stream")
        XCTAssertEqual(envelope.payload.chunkIndex, 3)
        XCTAssertEqual(envelope.payload.content, "Hello ")
        XCTAssertFalse(envelope.payload.isFinal)
    }

    func testDecodePing() throws {
        let json = """
        {
            "version": "1.0",
            "type": "system.ping",
            "sequence": 100,
            "payload": {"timestamp": "2024-01-30T12:00:00Z"},
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .ping(let sequence) = decoded else {
            XCTFail("Expected ping")
            return
        }

        XCTAssertEqual(sequence, 100)
    }

    func testDecodePong() throws {
        let json = """
        {
            "version": "1.0",
            "type": "system.pong",
            "sequence": 100,
            "payload": {"timestamp": "2024-01-30T12:00:00Z"},
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .pong(let sequence) = decoded else {
            XCTFail("Expected pong")
            return
        }

        XCTAssertEqual(sequence, 100)
    }

    func testDecodeUnknownType() throws {
        let json = """
        {
            "version": "1.0",
            "type": "future.feature",
            "sequence": 1,
            "payload": {},
            "serverTimestamp": null
        }
        """

        let decoded = try codec.decode(json)

        guard case .unknown(let type, _) = decoded else {
            XCTFail("Expected unknown")
            return
        }

        XCTAssertEqual(type, "future.feature")
    }

    func testDecodeMissingType() {
        let json = """
        {
            "version": "1.0",
            "sequence": 1,
            "payload": {}
        }
        """

        XCTAssertThrowsError(try codec.decode(json)) { error in
            guard case ProtocolCodecError.missingTypeField = error else {
                XCTFail("Expected missingTypeField error")
                return
            }
        }
    }

    // MARK: - Streaming Fast Path Tests

    func testIsStreamingChunk() throws {
        let chunkJSON = """
        {"type": "streaming.chunk", "version": "1.0", "sequence": 1, "payload": {}}
        """.data(using: .utf8)!

        let messageJSON = """
        {"type": "chat.message", "version": "1.0", "sequence": 1, "payload": {}}
        """.data(using: .utf8)!

        XCTAssertTrue(codec.isStreamingChunk(chunkJSON))
        XCTAssertFalse(codec.isStreamingChunk(messageJSON))
    }

    // MARK: - Round-trip Tests

    func testEncodeDecodeRoundTrip() throws {
        let original = ChatMessage(
            id: "round-trip",
            content: "Test message",
            sender: .user,
            status: .pending
        )

        let encoded = try codec.encode(message: original, sequence: 99)
        let decoded = try codec.decode(encoded)

        guard case .chatMessage(let envelope) = decoded else {
            XCTFail("Expected chatMessage")
            return
        }

        XCTAssertEqual(envelope.payload.id, original.id)
        XCTAssertEqual(envelope.payload.content, original.content)
        XCTAssertEqual(envelope.payload.sender, original.sender)
        XCTAssertEqual(envelope.sequence, 99)
    }
}
