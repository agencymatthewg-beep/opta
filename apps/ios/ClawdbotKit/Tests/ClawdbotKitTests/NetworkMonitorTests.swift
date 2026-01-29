//
//  NetworkMonitorTests.swift
//  ClawdbotKit
//
//  Tests for NetworkMonitor and TailscaleDetector.
//

import XCTest
@testable import ClawdbotKit

final class NetworkMonitorTests: XCTestCase {

    // MARK: - NetworkStatus Tests

    func testNetworkStatusUsability() {
        XCTAssertTrue(NetworkStatus.connected.isUsable)
        XCTAssertFalse(NetworkStatus.disconnected.isUsable)
        XCTAssertFalse(NetworkStatus.requiresConnection.isUsable)
    }

    // MARK: - NetworkPath Tests

    func testNetworkPathPrimaryInterface() {
        let path = NetworkPath(
            status: .connected,
            interfaces: [.wifi, .cellular],
            isExpensive: false,
            isConstrained: false,
            supportsIPv4: true,
            supportsIPv6: true
        )

        XCTAssertEqual(path.primaryInterface, .wifi)
    }

    func testEmptyInterfacesPrimaryInterface() {
        let path = NetworkPath(
            status: .disconnected,
            interfaces: [],
            isExpensive: false,
            isConstrained: false,
            supportsIPv4: false,
            supportsIPv6: false
        )

        XCTAssertNil(path.primaryInterface)
    }

    func testVPNDetection() {
        // VPN connections appear as "other" interface
        let vpnPath = NetworkPath(
            status: .connected,
            interfaces: [.other, .wifi],
            isExpensive: false,
            isConstrained: false,
            supportsIPv4: true,
            supportsIPv6: true
        )

        XCTAssertTrue(vpnPath.usesVPN)

        let noVPNPath = NetworkPath(
            status: .connected,
            interfaces: [.wifi],
            isExpensive: false,
            isConstrained: false,
            supportsIPv4: true,
            supportsIPv6: true
        )

        XCTAssertFalse(noVPNPath.usesVPN)
    }

    // MARK: - NetworkMonitor Tests

    func testNetworkMonitorInitialState() {
        let monitor = NetworkMonitor()

        XCTAssertNil(monitor.currentPath)
        XCTAssertEqual(monitor.status, .disconnected)
    }

    // MARK: - TailscaleDetector Tests

    func testTailscaleKnownServers() {
        XCTAssertEqual(TailscaleDetector.KnownServers.macStudio, "100.75.167.36")
        XCTAssertEqual(TailscaleDetector.KnownServers.default, "100.75.167.36")
    }

    func testTailscaleDetectorInitialState() {
        let detector = TailscaleDetector()

        XCTAssertEqual(detector.info.status, .disconnected)
        XCTAssertNil(detector.info.localIP)
        XCTAssertFalse(detector.info.canReachServer)
        XCTAssertFalse(detector.isConnected)
    }

    func testTailscaleURLBuilding() {
        let detector = TailscaleDetector(serverIP: "100.75.167.36")

        // Should return nil when not connected
        XCTAssertNil(detector.buildWebSocketURL())
        XCTAssertNil(detector.buildSecureWebSocketURL())
    }

    // MARK: - TailscaleInfo Tests

    func testTailscaleInfoEquality() {
        let info1 = TailscaleInfo(
            status: .connected,
            localIP: "100.1.2.3",
            canReachServer: true,
            serverIP: "100.75.167.36",
            lastChecked: Date(timeIntervalSince1970: 0)
        )

        let info2 = TailscaleInfo(
            status: .connected,
            localIP: "100.1.2.3",
            canReachServer: true,
            serverIP: "100.75.167.36",
            lastChecked: Date(timeIntervalSince1970: 0)
        )

        XCTAssertEqual(info1, info2)
    }
}
