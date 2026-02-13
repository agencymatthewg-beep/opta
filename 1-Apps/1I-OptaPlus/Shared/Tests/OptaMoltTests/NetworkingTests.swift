//
//  NetworkingTests.swift
//  OptaMoltTests
//
//  Tests for protocol message encoding/decoding and connection state types.
//

import XCTest
@testable import OptaMolt

final class NetworkingTests: XCTestCase {

    // MARK: - Frame Type Encoding

    func testFrameTypeRawValues() {
        XCTAssertEqual(FrameType.req.rawValue, "req")
        XCTAssertEqual(FrameType.res.rawValue, "res")
        XCTAssertEqual(FrameType.event.rawValue, "event")
    }

    // MARK: - RequestFrame

    func testRequestFrameEncoding() throws {
        let frame = RequestFrame(method: "chat.send", params: nil)
        XCTAssertEqual(frame.type, "req")
        XCTAssertEqual(frame.method, "chat.send")
        XCTAssertFalse(frame.id.isEmpty)

        let data = try JSONEncoder().encode(frame)
        let decoded = try JSONDecoder().decode(RequestFrame.self, from: data)
        XCTAssertEqual(decoded.method, "chat.send")
        XCTAssertEqual(decoded.type, "req")
        XCTAssertEqual(decoded.id, frame.id)
    }

    func testRequestFrameWithParams() throws {
        let params = AnyCodable(["message": "hello"])
        let frame = RequestFrame(method: "chat.send", params: params)
        let data = try JSONEncoder().encode(frame)
        XCTAssertTrue(data.count > 0)

        let decoded = try JSONDecoder().decode(RequestFrame.self, from: data)
        XCTAssertEqual(decoded.method, "chat.send")
        XCTAssertNotNil(decoded.params)
    }

    // MARK: - ResponseFrame

    func testResponseFrameDecoding() throws {
        let json = """
        {"type":"res","id":"abc-123","ok":true,"payload":null,"error":null}
        """
        let data = json.data(using: .utf8)!
        let frame = try JSONDecoder().decode(ResponseFrame.self, from: data)
        XCTAssertEqual(frame.type, "res")
        XCTAssertEqual(frame.id, "abc-123")
        XCTAssertTrue(frame.ok)
        XCTAssertNil(frame.error)
    }

    func testResponseFrameWithError() throws {
        let json = """
        {"type":"res","id":"xyz","ok":false,"payload":null,"error":{"message":"not found","code":"404"}}
        """
        let data = json.data(using: .utf8)!
        let frame = try JSONDecoder().decode(ResponseFrame.self, from: data)
        XCTAssertFalse(frame.ok)
        XCTAssertEqual(frame.error?.message, "not found")
        XCTAssertEqual(frame.error?.code, "404")
    }

    // MARK: - EventFrame

    func testEventFrameDecoding() throws {
        let json = """
        {"type":"event","event":"agent.stream","payload":null,"seq":42}
        """
        let data = json.data(using: .utf8)!
        let frame = try JSONDecoder().decode(EventFrame.self, from: data)
        XCTAssertEqual(frame.type, "event")
        XCTAssertEqual(frame.event, "agent.stream")
        XCTAssertEqual(frame.seq, 42)
    }

    // MARK: - ConnectionState

    func testConnectionStateEquality() {
        XCTAssertEqual(ConnectionState.disconnected, ConnectionState.disconnected)
        XCTAssertEqual(ConnectionState.connected, ConnectionState.connected)
        XCTAssertNotEqual(ConnectionState.connecting, ConnectionState.connected)
    }

    // MARK: - ConnectParams

    func testConnectParamsEncoding() throws {
        let params = ConnectParams(token: "test-token")
        let data = try JSONEncoder().encode(params)
        XCTAssertTrue(data.count > 0)

        let decoded = try JSONDecoder().decode(ConnectParams.self, from: data)
        XCTAssertEqual(decoded.minProtocol, 3)
        XCTAssertEqual(decoded.maxProtocol, 3)
        XCTAssertEqual(decoded.role, "operator")
    }
}
