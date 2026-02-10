//
//  OptaMenuBarTests.swift
//  OptaMenuBarTests
//
//  Unit tests for the Opta Menu Bar Swift plugin.
//  Created for Opta - Plan 20-08
//

import XCTest
@testable import OptaMenuBar

final class OptaMenuBarTests: XCTestCase {

    // MARK: - FlatBuffersBridge Tests

    func testFlatBuffersBridgeCreation() {
        let bridge = FlatBuffersBridge()
        XCTAssertNil(bridge.lastMetrics)
    }

    func testMomentumStateIdle() {
        let bridge = FlatBuffersBridge()
        let metrics = SystemMetrics(
            cpuUsage: 20,
            memoryUsage: 40,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: 12 * 1024 * 1024 * 1024,
            diskUsage: 50,
            cpuTemperature: 45,
            gpuTemperature: 40,
            timestamp: 1234567890
        )

        let momentum = bridge.getMomentumState(from: metrics)
        XCTAssertEqual(momentum.color, .idle)
        XCTAssertEqual(momentum.intensity, 0.3)
        XCTAssertEqual(momentum.rotationSpeed, 0.5)
    }

    func testMomentumStateActive() {
        let bridge = FlatBuffersBridge()
        let metrics = SystemMetrics(
            cpuUsage: 70,
            memoryUsage: 65,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: 20 * 1024 * 1024 * 1024,
            diskUsage: 50,
            cpuTemperature: 72,
            gpuTemperature: 55,
            timestamp: 1234567890
        )

        let momentum = bridge.getMomentumState(from: metrics)
        XCTAssertEqual(momentum.color, .active)
        XCTAssertEqual(momentum.intensity, 0.7)
        XCTAssertEqual(momentum.rotationSpeed, 1.5)
    }

    func testMomentumStateCritical() {
        let bridge = FlatBuffersBridge()
        let metrics = SystemMetrics(
            cpuUsage: 95,
            memoryUsage: 88,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: 28 * 1024 * 1024 * 1024,
            diskUsage: 90,
            cpuTemperature: 92,
            gpuTemperature: 85,
            timestamp: 1234567890
        )

        let momentum = bridge.getMomentumState(from: metrics)
        XCTAssertEqual(momentum.color, .critical)
        XCTAssertEqual(momentum.intensity, 1.0)
        XCTAssertEqual(momentum.rotationSpeed, 3.0)
    }

    func testMomentumIntensityCalculation() {
        let bridge = FlatBuffersBridge()
        let metrics = SystemMetrics(
            cpuUsage: 50,
            memoryUsage: 50,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: 16 * 1024 * 1024 * 1024,
            diskUsage: 50,
            cpuTemperature: 50,
            gpuTemperature: 50,
            timestamp: 1234567890
        )

        let intensity = bridge.getMomentumIntensity(from: metrics)
        // CPU (50%) * 0.5 + Memory (50%) * 0.3 + Temp (50%) * 0.2 = 0.5
        XCTAssertEqual(intensity, 0.5, accuracy: 0.01)
    }

    // MARK: - SystemMetrics Tests

    func testSystemMetricsDefaults() {
        let metrics = SystemMetrics()
        XCTAssertEqual(metrics.cpuUsage, 0)
        XCTAssertEqual(metrics.memoryUsage, 0)
        XCTAssertEqual(metrics.memoryTotal, 0)
        XCTAssertTrue(metrics.topProcesses.isEmpty)
    }

    func testSystemMetricsInitialization() {
        let metrics = SystemMetrics(
            cpuUsage: 45.5,
            memoryUsage: 62.3,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: 20 * 1024 * 1024 * 1024,
            diskUsage: 55.0,
            cpuTemperature: 52.0,
            gpuTemperature: 48.0,
            timestamp: 1234567890
        )

        XCTAssertEqual(metrics.cpuUsage, 45.5, accuracy: 0.01)
        XCTAssertEqual(metrics.memoryUsage, 62.3, accuracy: 0.01)
        XCTAssertEqual(metrics.cpuTemperature, 52.0, accuracy: 0.01)
    }

    // MARK: - MomentumState Tests

    func testMomentumStateDefaults() {
        let state = MomentumState()
        XCTAssertEqual(state.intensity, 0.3)
        XCTAssertEqual(state.color, .idle)
        XCTAssertEqual(state.rotationSpeed, 0.5)
        XCTAssertEqual(state.pulseFrequency, 1.0)
    }

    // MARK: - MomentumColor Tests

    func testMomentumColorValues() {
        XCTAssertEqual(MomentumColor.idle.rawValue, 0)
        XCTAssertEqual(MomentumColor.active.rawValue, 1)
        XCTAssertEqual(MomentumColor.critical.rawValue, 2)
    }

    func testMomentumColorGradients() {
        XCTAssertEqual(MomentumColor.idle.gradientColors.count, 2)
        XCTAssertEqual(MomentumColor.active.gradientColors.count, 2)
        XCTAssertEqual(MomentumColor.critical.gradientColors.count, 2)
    }

    // MARK: - Command Serialization Tests

    func testCommandSerialization() {
        let bridge = FlatBuffersBridge()
        let data = bridge.serializeCommand("test_command")

        // First 4 bytes should be length
        XCTAssertEqual(data.count, 4 + "test_command".count)

        // Verify length prefix
        let length = data.withUnsafeBytes { ptr in
            ptr.load(as: UInt32.self)
        }
        XCTAssertEqual(length, UInt32("test_command".count))
    }

    // MARK: - Binary Parsing Tests

    func testSystemMetricsBinaryParsing() {
        // Create test binary data matching the expected format
        var data = Data()

        // Header (4 bytes)
        var header: UInt32 = 4
        data.append(contentsOf: withUnsafeBytes(of: &header) { Array($0) })

        // cpuUsage (4 bytes)
        var cpuUsage: Float = 45.5
        data.append(contentsOf: withUnsafeBytes(of: &cpuUsage) { Array($0) })

        // memoryUsage (4 bytes)
        var memoryUsage: Float = 62.3
        data.append(contentsOf: withUnsafeBytes(of: &memoryUsage) { Array($0) })

        // memoryTotal (8 bytes)
        var memoryTotal: UInt64 = 32 * 1024 * 1024 * 1024
        data.append(contentsOf: withUnsafeBytes(of: &memoryTotal) { Array($0) })

        // memoryUsed (8 bytes)
        var memoryUsed: UInt64 = 20 * 1024 * 1024 * 1024
        data.append(contentsOf: withUnsafeBytes(of: &memoryUsed) { Array($0) })

        // diskUsage (4 bytes)
        var diskUsage: Float = 55.0
        data.append(contentsOf: withUnsafeBytes(of: &diskUsage) { Array($0) })

        // cpuTemperature (4 bytes)
        var cpuTemp: Float = 52.0
        data.append(contentsOf: withUnsafeBytes(of: &cpuTemp) { Array($0) })

        // gpuTemperature (4 bytes)
        var gpuTemp: Float = 48.0
        data.append(contentsOf: withUnsafeBytes(of: &gpuTemp) { Array($0) })

        // timestamp (8 bytes)
        var timestamp: UInt64 = 1234567890
        data.append(contentsOf: withUnsafeBytes(of: &timestamp) { Array($0) })

        // Parse the data
        let metrics = SystemMetrics.parse(from: data)

        XCTAssertNotNil(metrics)
        XCTAssertEqual(metrics?.cpuUsage ?? 0, 45.5, accuracy: 0.01)
        XCTAssertEqual(metrics?.memoryUsage ?? 0, 62.3, accuracy: 0.01)
        XCTAssertEqual(metrics?.cpuTemperature ?? 0, 52.0, accuracy: 0.01)
    }

    func testSystemMetricsParsingWithInsufficientData() {
        let data = Data(count: 10) // Too small
        let metrics = SystemMetrics.parse(from: data)
        XCTAssertNil(metrics)
    }
}
