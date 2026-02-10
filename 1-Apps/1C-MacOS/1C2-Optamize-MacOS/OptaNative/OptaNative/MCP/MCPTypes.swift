//
//  MCPTypes.swift
//  OptaNative
//
//  Shared Model Context Protocol types for JSON-RPC 2.0 communication.
//
//  Created for Opta Native macOS - MCP Foundation
//

import Foundation

// MARK: - JSON-RPC 2.0 Types

/// JSON-RPC 2.0 Request
struct MCPRequest: Codable {
    let jsonrpc: String
    let id: Int?
    let method: String
    let params: [String: AnyCodable]?
}

/// JSON-RPC 2.0 Response
struct MCPResponse: Codable {
    let jsonrpc: String
    let id: Int?
    let result: AnyCodable?
    let error: MCPError?
}

/// MCP Error
struct MCPError: Codable {
    let code: Int
    let message: String
    let data: AnyCodable?
}

// MARK: - Type-Erased Codable Wrapper

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unable to decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encode(String(describing: value))
        }
    }
}

// MARK: - MCP Tool Definition

struct MCPTool: Codable {
    let name: String
    let description: String
    let inputSchema: MCPInputSchema
}

struct MCPInputSchema: Codable {
    let type: String
    let properties: [String: MCPProperty]
    let required: [String]?
}

struct MCPProperty: Codable {
    let type: String
    let description: String
    let `enum`: [String]?
}

// MARK: - MCP Resource Definition

struct MCPResource: Codable {
    let uri: String
    let name: String
    let description: String
    let mimeType: String
}

// MARK: - MCP Notification

struct MCPNotification: Codable {
    let jsonrpc: String
    let method: String
    let params: NotificationParams?

    init(method: String, params: [String: Any]? = nil) {
        self.jsonrpc = "2.0"
        self.method = method
        self.params = params.map { NotificationParams(dict: $0) }
    }
}

struct NotificationParams: Codable {
    private var storage: [String: AnyCodable]

    init(dict: [String: Any]) {
        self.storage = dict.mapValues { AnyCodable($0) }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        storage = try container.decode([String: AnyCodable].self)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(storage)
    }
}

// MARK: - Notification Factory

extension MCPNotification {

    /// Create a thermal state change notification
    static func thermalStateChange(
        previousState: String,
        currentState: String,
        temperature: Double,
        recommendation: String?
    ) -> MCPNotification {
        var params: [String: Any] = [
            "previousState": previousState,
            "currentState": currentState,
            "temperature": temperature,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        if let rec = recommendation {
            params["recommendation"] = rec
        }
        return MCPNotification(method: "notifications/thermal/stateChange", params: params)
    }

    /// Create a memory pressure notification
    static func memoryPressure(
        level: String,
        usagePercent: Double,
        recommendation: String
    ) -> MCPNotification {
        return MCPNotification(method: "notifications/memory/pressure", params: [
            "level": level,
            "usagePercent": usagePercent,
            "recommendation": recommendation,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ])
    }

    /// Create a power profile change notification
    static func powerProfileChange(
        previousProfile: String,
        currentProfile: String
    ) -> MCPNotification {
        return MCPNotification(method: "notifications/power/profileChange", params: [
            "previousProfile": previousProfile,
            "currentProfile": currentProfile,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ])
    }
}
