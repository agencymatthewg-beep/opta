//
//  FlatBuffersBridge.swift
//  OptaMenuBar
//
//  Bridge for parsing FlatBuffers binary data from Rust backend.
//  Provides zero-copy access to system metrics for 25Hz streaming.
//  Created for Opta - Plan 20-08
//

import Foundation
import FlatBuffers
import SwiftUI

// MARK: - FlatBuffers Bridge

/// Bridge for parsing FlatBuffers binary data from Rust backend.
/// Provides zero-copy access to system metrics for efficient 25Hz streaming.
final class FlatBuffersBridge: @unchecked Sendable {

    // MARK: - Properties

    /// Cached byte buffer for reuse
    private var buffer: ByteBuffer?

    /// Last parsed metrics for quick access
    private(set) var lastMetrics: SystemMetrics?

    // MARK: - Initialization

    init() {}

    // MARK: - Binary Parsing

    /// Parse binary metrics data from Rust backend.
    ///
    /// The data format follows the FlatBuffers schema in system_metrics.fbs.
    /// This method provides zero-copy access where possible.
    ///
    /// - Parameter data: Binary FlatBuffers data
    /// - Returns: Parsed SystemMetrics or nil if parsing fails
    func parseMetrics(data: Data) -> SystemMetrics? {
        // Fast path: try simple binary parse first
        if let metrics = SystemMetrics.parse(from: data) {
            lastMetrics = metrics
            return metrics
        }

        // Fallback: use FlatBuffers library for complex nested data
        var byteBuffer = ByteBuffer(data: data)
        return parseFromBuffer(&byteBuffer)
    }

    /// Parse metrics from a ByteBuffer using FlatBuffers library.
    ///
    /// - Parameter buffer: ByteBuffer containing FlatBuffers data
    /// - Returns: Parsed SystemMetrics or nil if parsing fails
    private func parseFromBuffer(_ buffer: inout ByteBuffer) -> SystemMetrics? {
        // For now, return nil and rely on simple binary parse
        // Full FlatBuffers parsing would require generated getRoot function
        return nil
    }

    // MARK: - Convenience Accessors

    /// Get CPU usage from last parsed metrics.
    /// Zero-copy access for performance-critical paths.
    ///
    /// - Parameter metrics: SystemMetrics to read from
    /// - Returns: CPU usage percentage (0-100)
    func getCPUUsage(from metrics: SystemMetrics) -> Float {
        return metrics.cpuUsage
    }

    /// Get memory usage from last parsed metrics.
    ///
    /// - Parameter metrics: SystemMetrics to read from
    /// - Returns: Memory usage percentage (0-100)
    func getMemoryUsage(from metrics: SystemMetrics) -> Float {
        return metrics.memoryUsage
    }

    /// Get memory in human-readable format.
    ///
    /// - Parameter metrics: SystemMetrics to read from
    /// - Returns: Formatted string like "12.4 / 32.0 GB"
    func getMemoryFormatted(from metrics: SystemMetrics) -> String {
        let usedGB = Double(metrics.memoryUsed) / (1024 * 1024 * 1024)
        let totalGB = Double(metrics.memoryTotal) / (1024 * 1024 * 1024)
        return String(format: "%.1f / %.1f GB", usedGB, totalGB)
    }

    // MARK: - Momentum Calculation

    /// Calculate momentum state from metrics for animation control.
    ///
    /// Momentum determines the visual state of the menu bar icon:
    /// - Idle: Low resource usage, calm purple glow
    /// - Active: Moderate usage, energetic cyan
    /// - Critical: High usage, urgent red
    ///
    /// - Parameter metrics: SystemMetrics to analyze
    /// - Returns: MomentumState for animation control
    func getMomentumState(from metrics: SystemMetrics) -> MomentumState {
        let cpu = metrics.cpuUsage
        let memory = metrics.memoryUsage
        let temp = metrics.cpuTemperature

        // Critical: High CPU, memory, or temperature
        if cpu > 90 || memory > 85 || temp > 90 {
            return MomentumState(
                intensity: 1.0,
                color: .critical,
                rotationSpeed: 3.0,
                pulseFrequency: 2.0
            )
        }

        // Active: Moderate usage
        if cpu > 60 || memory > 60 || temp > 70 {
            return MomentumState(
                intensity: 0.7,
                color: .active,
                rotationSpeed: 1.5,
                pulseFrequency: 1.0
            )
        }

        // Idle: Low usage
        return MomentumState(
            intensity: 0.3,
            color: .idle,
            rotationSpeed: 0.5,
            pulseFrequency: 0.5
        )
    }

    /// Calculate momentum intensity as a continuous value (0-1).
    /// Useful for smooth animation transitions.
    ///
    /// - Parameter metrics: SystemMetrics to analyze
    /// - Returns: Intensity value from 0 (idle) to 1 (critical)
    func getMomentumIntensity(from metrics: SystemMetrics) -> Float {
        let cpu = metrics.cpuUsage / 100.0
        let memory = metrics.memoryUsage / 100.0
        let temp = min(metrics.cpuTemperature / 100.0, 1.0)

        // Weighted average: CPU 50%, Memory 30%, Temperature 20%
        return (cpu * 0.5) + (memory * 0.3) + (temp * 0.2)
    }
}

// MARK: - SwiftUI Color Extension

extension MomentumColor {
    /// SwiftUI color for this momentum state
    var swiftUIColor: Color {
        switch self {
        case .idle:
            // Purple - matches Opta brand primary color
            return Color(red: 139/255, green: 92/255, blue: 246/255).opacity(0.5)
        case .active:
            // Cyan - energetic, attention-grabbing
            return Color(red: 6/255, green: 182/255, blue: 212/255)
        case .critical:
            // Red - urgent, warning state
            return Color(red: 239/255, green: 68/255, blue: 68/255)
        }
    }

    /// Gradient colors for glow effects
    var gradientColors: [Color] {
        switch self {
        case .idle:
            return [
                Color(red: 139/255, green: 92/255, blue: 246/255),
                Color(red: 99/255, green: 102/255, blue: 241/255)
            ]
        case .active:
            return [
                Color(red: 6/255, green: 182/255, blue: 212/255),
                Color(red: 34/255, green: 211/255, blue: 238/255)
            ]
        case .critical:
            return [
                Color(red: 239/255, green: 68/255, blue: 68/255),
                Color(red: 248/255, green: 113/255, blue: 113/255)
            ]
        }
    }
}

// MARK: - Data Serialization (Swift -> Rust)

extension FlatBuffersBridge {
    /// Serialize a command to send to Rust backend.
    ///
    /// Used for bidirectional IPC when Swift needs to request actions.
    ///
    /// - Parameter command: Command string to serialize
    /// - Returns: Binary data for IPC
    func serializeCommand(_ command: String) -> Data {
        // Simple binary format: [length: UInt32][utf8 bytes]
        var data = Data()
        let bytes = command.utf8
        var length = UInt32(bytes.count)

        withUnsafeBytes(of: &length) { data.append(contentsOf: $0) }
        data.append(contentsOf: bytes)

        return data
    }
}
