//
//  ProtocolCodec.swift
//  ClawdbotKit
//
//  Encoder/decoder for Clawdbot protocol messages.
//

import Foundation

/// Message types in the Clawdbot protocol
public enum ProtocolMessageType: String, Codable, Sendable {
    case chatMessage = "chat.message"
    case messageAck = "message.ack"
    case botState = "bot.state"
    case streamingChunk = "streaming.chunk"
    case ping = "system.ping"
    case pong = "system.pong"
}

/// Decoded protocol message with type information
public enum DecodedMessage: Sendable {
    case chatMessage(ProtocolEnvelope<ChatMessage>)
    case messageAck(ProtocolEnvelope<MessageAck>)
    case botState(ProtocolEnvelope<BotStateUpdate>)
    case streamingChunk(ProtocolEnvelope<StreamingChunk>)
    case ping(sequence: Int)
    case pong(sequence: Int)
    case unknown(type: String, data: Data)
}

/// Errors during protocol encoding/decoding
public enum ProtocolCodecError: Error, Sendable {
    case encodingFailed(Error)
    case decodingFailed(Error)
    case invalidJSON
    case missingTypeField
    case unknownMessageType(String)
}

/// Encodes and decodes Clawdbot protocol messages
public struct ProtocolCodec: Sendable {

    // MARK: - Configuration

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]  // Deterministic output
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    // MARK: - Encoding

    /// Encode a chat message for sending
    public func encode(message: ChatMessage, sequence: Int) throws -> Data {
        let envelope = ProtocolEnvelope(
            type: ProtocolMessageType.chatMessage.rawValue,
            sequence: sequence,
            payload: message
        )
        return try encodeEnvelope(envelope)
    }

    /// Encode a ping message
    public func encodePing(sequence: Int) throws -> Data {
        struct PingPayload: Codable {
            let timestamp: Date
        }
        let envelope = ProtocolEnvelope(
            type: ProtocolMessageType.ping.rawValue,
            sequence: sequence,
            payload: PingPayload(timestamp: Date())
        )
        return try encodeEnvelope(envelope)
    }

    /// Encode a pong response
    public func encodePong(sequence: Int) throws -> Data {
        struct PongPayload: Codable {
            let timestamp: Date
        }
        let envelope = ProtocolEnvelope(
            type: ProtocolMessageType.pong.rawValue,
            sequence: sequence,
            payload: PongPayload(timestamp: Date())
        )
        return try encodeEnvelope(envelope)
    }

    private func encodeEnvelope<T: Codable>(_ envelope: ProtocolEnvelope<T>) throws -> Data {
        do {
            return try encoder.encode(envelope)
        } catch {
            throw ProtocolCodecError.encodingFailed(error)
        }
    }

    // MARK: - Decoding

    /// Decode raw data into a typed message
    public func decode(_ data: Data) throws -> DecodedMessage {
        // First, peek at the type field
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let typeString = json["type"] as? String else {
            throw ProtocolCodecError.missingTypeField
        }

        guard let messageType = ProtocolMessageType(rawValue: typeString) else {
            return .unknown(type: typeString, data: data)
        }

        do {
            switch messageType {
            case .chatMessage:
                let envelope = try decoder.decode(ProtocolEnvelope<ChatMessage>.self, from: data)
                return .chatMessage(envelope)

            case .messageAck:
                let envelope = try decoder.decode(ProtocolEnvelope<MessageAck>.self, from: data)
                return .messageAck(envelope)

            case .botState:
                let envelope = try decoder.decode(ProtocolEnvelope<BotStateUpdate>.self, from: data)
                return .botState(envelope)

            case .streamingChunk:
                let envelope = try decoder.decode(ProtocolEnvelope<StreamingChunk>.self, from: data)
                return .streamingChunk(envelope)

            case .ping:
                let envelope = try decoder.decode(ProtocolEnvelope<EmptyPayload>.self, from: data)
                return .ping(sequence: envelope.sequence)

            case .pong:
                let envelope = try decoder.decode(ProtocolEnvelope<EmptyPayload>.self, from: data)
                return .pong(sequence: envelope.sequence)
            }
        } catch {
            throw ProtocolCodecError.decodingFailed(error)
        }
    }

    /// Decode a string message (convenience for WebSocket text messages)
    public func decode(_ string: String) throws -> DecodedMessage {
        guard let data = string.data(using: .utf8) else {
            throw ProtocolCodecError.invalidJSON
        }
        return try decode(data)
    }
}

/// Empty payload for ping/pong messages
private struct EmptyPayload: Codable {
    let timestamp: Date?
}

// MARK: - Streaming Support

extension ProtocolCodec {

    /// Check if data is a streaming chunk without full decode
    public func isStreamingChunk(_ data: Data) -> Bool {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let typeString = json["type"] as? String else {
            return false
        }
        return typeString == ProtocolMessageType.streamingChunk.rawValue
    }

    /// Fast path decode for streaming chunks
    public func decodeStreamingChunk(_ data: Data) throws -> StreamingChunk {
        let envelope = try decoder.decode(ProtocolEnvelope<StreamingChunk>.self, from: data)
        return envelope.payload
    }
}
