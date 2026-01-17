//
//  SystemMetrics_generated.swift
//  OptaMenuBar
//
//  Swift types for system metrics IPC with custom binary protocol.
//  Matches the Rust serializer in src-tauri/src/ipc/serializer.rs
//
//  Binary Protocol Format:
//  - Header (12 bytes): magic(4) + version(2) + flags(2) + payload_len(4)
//  - Payload: metrics data (see parse(from:) for layout)
//
//  Created for Opta - Plan 20-10
//

import Foundation
import FlatBuffers

// MARK: - Constants

/// Magic number for protocol identification ("OPTA" in ASCII)
public let PROTOCOL_MAGIC: UInt32 = 0x4F505441

/// Protocol version
public let PROTOCOL_VERSION: UInt16 = 1

/// Header size in bytes
public let HEADER_SIZE = 12

// MARK: - Enums

/// Momentum state colors for visual feedback
public enum MomentumColor: Int8 {
    case idle = 0      // System calm - purple glow
    case active = 1    // Moderate activity - cyan glow
    case critical = 2  // High load - red glow

    public init(rawValue: Int8) {
        switch rawValue {
        case 0: self = .idle
        case 1: self = .active
        case 2: self = .critical
        default: self = .idle
        }
    }
}

/// System state for quick categorization
public enum SystemState: Int8 {
    case healthy = 0   // Low resource usage
    case elevated = 1  // Moderate resource usage
    case critical = 2  // High resource usage

    public init(rawValue: Int8) {
        switch rawValue {
        case 0: self = .healthy
        case 1: self = .elevated
        case 2: self = .critical
        default: self = .healthy
        }
    }
}

/// Message types for IPC protocol
public enum MessageType: Int8 {
    case metrics = 0   // SystemMetrics update
    case momentum = 1  // MomentumState update
    case command = 2   // Command from Swift to Rust
    case ack = 3       // Acknowledgment
}

// MARK: - ProcessInfo

/// Swift-native process info (for decoded data)
public struct ProcessInfoSwift: Identifiable {
    public var pid: UInt32
    public var name: String
    public var cpuPercent: Float
    public var memoryMb: Float

    public var id: UInt32 { pid }

    public init(pid: UInt32 = 0, name: String = "", cpuPercent: Float = 0, memoryMb: Float = 0) {
        self.pid = pid
        self.name = name
        self.cpuPercent = cpuPercent
        self.memoryMb = memoryMb
    }
}

// MARK: - MomentumState

/// Momentum state for animation control
public struct MomentumState {
    public var intensity: Float
    public var color: MomentumColor
    public var rotationSpeed: Float
    public var pulseFrequency: Float

    public init(
        intensity: Float = 0.3,
        color: MomentumColor = .idle,
        rotationSpeed: Float = 0.5,
        pulseFrequency: Float = 1.0
    ) {
        self.intensity = intensity
        self.color = color
        self.rotationSpeed = rotationSpeed
        self.pulseFrequency = pulseFrequency
    }

    /// Calculate momentum state from CPU and memory usage
    public static func from(cpuUsage: Float, memoryUsage: Float) -> MomentumState {
        if cpuUsage > 90 || memoryUsage > 85 {
            return MomentumState(intensity: 1.0, color: .critical, rotationSpeed: 3.0, pulseFrequency: 2.0)
        } else if cpuUsage > 60 || memoryUsage > 60 {
            return MomentumState(intensity: 0.7, color: .active, rotationSpeed: 1.5, pulseFrequency: 1.0)
        } else {
            return MomentumState(intensity: 0.3, color: .idle, rotationSpeed: 0.5, pulseFrequency: 0.5)
        }
    }
}

// MARK: - SystemMetrics

/// System-wide metrics snapshot
public struct SystemMetrics {
    public var cpuUsage: Float
    public var memoryUsage: Float
    public var memoryTotal: UInt64
    public var memoryUsed: UInt64
    public var diskUsage: Float
    public var cpuTemperature: Float
    public var gpuTemperature: Float
    public var timestamp: UInt64
    public var momentum: MomentumState
    public var systemState: SystemState
    public var topProcesses: [ProcessInfoSwift]
    public var fanSpeeds: [UInt32]

    public init(
        cpuUsage: Float = 0,
        memoryUsage: Float = 0,
        memoryTotal: UInt64 = 0,
        memoryUsed: UInt64 = 0,
        diskUsage: Float = 0,
        cpuTemperature: Float = 0,
        gpuTemperature: Float = 0,
        timestamp: UInt64 = 0,
        momentum: MomentumState = MomentumState(),
        systemState: SystemState = .healthy,
        topProcesses: [ProcessInfoSwift] = [],
        fanSpeeds: [UInt32] = []
    ) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.memoryTotal = memoryTotal
        self.memoryUsed = memoryUsed
        self.diskUsage = diskUsage
        self.cpuTemperature = cpuTemperature
        self.gpuTemperature = gpuTemperature
        self.timestamp = timestamp
        self.momentum = momentum
        self.systemState = systemState
        self.topProcesses = topProcesses
        self.fanSpeeds = fanSpeeds
    }

    /// Memory used in gigabytes
    public var memoryUsedGB: Double {
        return Double(memoryUsed) / (1024 * 1024 * 1024)
    }

    /// Memory total in gigabytes
    public var memoryTotalGB: Double {
        return Double(memoryTotal) / (1024 * 1024 * 1024)
    }

    /// Memory usage formatted string
    public var memoryFormatted: String {
        return String(format: "%.1f / %.1f GB", memoryUsedGB, memoryTotalGB)
    }

    /// Whether system is under heavy load
    public var isUnderHeavyLoad: Bool {
        return systemState == .critical
    }
}

// MARK: - Binary Parsing

extension SystemMetrics {
    /// Parse SystemMetrics from binary data using Opta binary protocol.
    ///
    /// Binary format (little-endian):
    /// - Header (12 bytes):
    ///   - magic: UInt32 (0x4F505441 = "OPTA")
    ///   - version: UInt16
    ///   - flags: UInt16
    ///   - payload_length: UInt32
    /// - Payload:
    ///   - cpu_usage: Float32
    ///   - memory_usage: Float32
    ///   - memory_total: UInt64
    ///   - memory_used: UInt64
    ///   - disk_usage: Float32
    ///   - temperature: Float32
    ///   - gpu_temperature: Float32
    ///   - timestamp: UInt64
    ///   - momentum_intensity: Float32
    ///   - momentum_color: UInt8
    ///   - momentum_rotation_speed: Float32
    ///   - system_state: UInt8
    ///   - process_count: UInt8
    ///   - processes: [ProcessInfo] (variable)
    ///   - fan_count: UInt8
    ///   - fan_speeds: [UInt32] (variable)
    ///
    /// - Parameter data: Raw binary data from IPC
    /// - Returns: Parsed SystemMetrics or nil if parsing fails
    public static func parse(from data: Data) -> SystemMetrics? {
        guard data.count >= HEADER_SIZE else {
            print("[SystemMetrics] Data too short for header: \(data.count) bytes")
            return nil
        }

        return data.withUnsafeBytes { ptr in
            guard let baseAddress = ptr.baseAddress else { return nil }

            var offset = 0

            // Read header
            let magic = baseAddress.load(fromByteOffset: offset, as: UInt32.self)
            offset += 4

            guard magic == PROTOCOL_MAGIC else {
                print("[SystemMetrics] Invalid magic: \(String(format: "0x%08X", magic))")
                return nil
            }

            let version = baseAddress.load(fromByteOffset: offset, as: UInt16.self)
            offset += 2

            guard version == PROTOCOL_VERSION else {
                print("[SystemMetrics] Unsupported version: \(version)")
                return nil
            }

            // Skip flags
            offset += 2

            let payloadLen = baseAddress.load(fromByteOffset: offset, as: UInt32.self)
            offset += 4

            guard data.count >= HEADER_SIZE + Int(payloadLen) else {
                print("[SystemMetrics] Data shorter than payload: \(data.count) < \(HEADER_SIZE + Int(payloadLen))")
                return nil
            }

            // Parse payload
            let cpuUsage = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let memoryUsage = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let memoryTotal = baseAddress.load(fromByteOffset: offset, as: UInt64.self)
            offset += 8

            let memoryUsed = baseAddress.load(fromByteOffset: offset, as: UInt64.self)
            offset += 8

            let diskUsage = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let temperature = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let gpuTemperature = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let timestamp = baseAddress.load(fromByteOffset: offset, as: UInt64.self)
            offset += 8

            // Momentum state
            let momentumIntensity = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            let momentumColorRaw = baseAddress.load(fromByteOffset: offset, as: UInt8.self)
            offset += 1

            let momentumRotationSpeed = baseAddress.load(fromByteOffset: offset, as: Float.self)
            offset += 4

            // System state
            let systemStateRaw = baseAddress.load(fromByteOffset: offset, as: UInt8.self)
            offset += 1

            // Processes
            let processCount = Int(baseAddress.load(fromByteOffset: offset, as: UInt8.self))
            offset += 1

            var topProcesses: [ProcessInfoSwift] = []
            topProcesses.reserveCapacity(processCount)

            for _ in 0..<processCount {
                let pid = baseAddress.load(fromByteOffset: offset, as: UInt32.self)
                offset += 4

                // Read string (length-prefixed)
                let nameLen = Int(baseAddress.load(fromByteOffset: offset, as: UInt8.self))
                offset += 1

                let nameBytes = Data(bytes: baseAddress.advanced(by: offset), count: nameLen)
                let name = String(data: nameBytes, encoding: .utf8) ?? ""
                offset += nameLen

                let cpuPercent = baseAddress.load(fromByteOffset: offset, as: Float.self)
                offset += 4

                let memoryMb = baseAddress.load(fromByteOffset: offset, as: Float.self)
                offset += 4

                topProcesses.append(ProcessInfoSwift(
                    pid: pid,
                    name: name,
                    cpuPercent: cpuPercent,
                    memoryMb: memoryMb
                ))
            }

            // Fan speeds
            let fanCount = Int(baseAddress.load(fromByteOffset: offset, as: UInt8.self))
            offset += 1

            var fanSpeeds: [UInt32] = []
            fanSpeeds.reserveCapacity(fanCount)

            for _ in 0..<fanCount {
                let speed = baseAddress.load(fromByteOffset: offset, as: UInt32.self)
                offset += 4
                fanSpeeds.append(speed)
            }

            let momentum = MomentumState(
                intensity: momentumIntensity,
                color: MomentumColor(rawValue: Int8(momentumColorRaw)),
                rotationSpeed: momentumRotationSpeed,
                pulseFrequency: momentumIntensity * 2.0  // Derived from intensity
            )

            return SystemMetrics(
                cpuUsage: cpuUsage,
                memoryUsage: memoryUsage,
                memoryTotal: memoryTotal,
                memoryUsed: memoryUsed,
                diskUsage: diskUsage,
                cpuTemperature: temperature,
                gpuTemperature: gpuTemperature,
                timestamp: timestamp,
                momentum: momentum,
                systemState: SystemState(rawValue: Int8(systemStateRaw)),
                topProcesses: topProcesses,
                fanSpeeds: fanSpeeds
            )
        }
    }
}

// MARK: - IPCMessage

/// IPC message wrapper
public struct IPCMessage {
    public var type: MessageType
    public var sequence: UInt32
    public var metrics: SystemMetrics?
    public var momentum: MomentumState?

    public init(
        type: MessageType = .metrics,
        sequence: UInt32 = 0,
        metrics: SystemMetrics? = nil,
        momentum: MomentumState? = nil
    ) {
        self.type = type
        self.sequence = sequence
        self.metrics = metrics
        self.momentum = momentum
    }
}

// MARK: - FlatBuffers Compatibility (Legacy)

/// Legacy helper struct for reading FlatBuffer data
public struct Struct {
    public let bb: ByteBuffer
    public let position: Int

    public init(bb: ByteBuffer, position: Int) {
        self.bb = bb
        self.position = position
    }

    public func readBuffer<T: Scalar>(of type: T.Type, at offset: Int) -> T {
        return bb.read(def: T.self, position: position + offset)
    }
}

/// Legacy protocol for FlatBuffer objects
public protocol FlatBufferObject {
    var __buffer: ByteBuffer! { get }
}

/// Legacy ProcessInfo for FlatBuffer compatibility
public struct ProcessInfo: FlatBufferObject {
    public var __buffer: ByteBuffer! { _accessor.bb }
    private var _accessor: Struct

    public static var size: Int { 16 }

    public init(_ bb: ByteBuffer, o: Int32) {
        _accessor = Struct(bb: bb, position: Int(o))
    }

    public var pid: UInt32 { _accessor.readBuffer(of: UInt32.self, at: 0) }
    public var cpuPercent: Float { _accessor.readBuffer(of: Float.self, at: 4) }
    public var memoryMb: Float { _accessor.readBuffer(of: Float.self, at: 8) }
    public var name: String? { nil }
}
