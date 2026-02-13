//
//  MetricsStore.swift
//  OptaMenuBar
//
//  Observable store for system metrics, bridging IPC to SwiftUI.
//  Receives binary data from Rust backend at 25Hz and updates
//  published properties for reactive UI updates.
//
//  Created for Opta - Plan 20-10
//

import SwiftUI
import Combine

// MARK: - MetricsStore

/// Observable store for system metrics.
/// Receives data from IPC and publishes updates to SwiftUI views.
@MainActor
@Observable
public final class MetricsStore {

    // MARK: - Core Metrics (Published via @Observable)

    /// Current CPU usage percentage (0-100)
    public private(set) var cpuUsage: Float = 0

    /// Current memory usage percentage (0-100)
    public private(set) var memoryUsage: Float = 0

    /// Total memory in bytes
    public private(set) var memoryTotal: UInt64 = 0

    /// Memory used in bytes
    public private(set) var memoryUsed: UInt64 = 0

    /// Disk usage percentage (0-100)
    public private(set) var diskUsage: Float = 0

    /// CPU temperature in Celsius
    public private(set) var cpuTemperature: Float = 0

    /// GPU temperature in Celsius
    public private(set) var gpuTemperature: Float = 0

    /// Timestamp of last update (milliseconds since epoch)
    public private(set) var timestamp: UInt64 = 0

    // MARK: - Derived State

    /// Current momentum state for border animation
    public private(set) var momentum: MomentumState = MomentumState()

    /// System health state
    public private(set) var systemState: SystemState = .healthy

    /// Top processes by resource usage
    public private(set) var topProcesses: [ProcessInfoSwift] = []

    /// Fan speeds in RPM
    public private(set) var fanSpeeds: [UInt32] = []

    // MARK: - Connection State

    /// Whether IPC is connected to Rust backend
    public private(set) var isConnected: Bool = false

    /// Last error message (if any)
    public private(set) var lastError: String?

    /// Number of metrics updates received
    public private(set) var updateCount: UInt64 = 0

    // MARK: - Private Properties

    /// IPC handler for socket communication
    private var ipcHandler: IPCHandler?

    /// FlatBuffers bridge for parsing
    private let bridge = FlatBuffersBridge()

    /// Full metrics snapshot (for advanced queries)
    public private(set) var currentMetrics: SystemMetrics?

    // MARK: - Initialization

    /// Initialize the metrics store and start IPC connection.
    public init() {
        setupIPC()
    }

    /// Initialize with custom socket path (for testing).
    public init(socketPath: String) {
        setupIPC(socketPath: socketPath)
    }

    // MARK: - IPC Setup

    /// Configure and start IPC handler.
    private func setupIPC(socketPath: String = "/tmp/opta-metrics.sock") {
        ipcHandler = IPCHandler(socketPath: socketPath) { [weak self] data in
            Task { @MainActor [weak self] in
                self?.handleMetricsData(data)
            }
        }

        ipcHandler?.onConnectionChange = { [weak self] connected in
            Task { @MainActor [weak self] in
                self?.isConnected = connected
                if connected {
                    self?.lastError = nil
                }
            }
        }
    }

    /// Handle received binary metrics data.
    private func handleMetricsData(_ data: Data) {
        // Parse using the binary protocol
        guard let metrics = SystemMetrics.parse(from: data) else {
            lastError = "Failed to parse metrics data"
            return
        }

        // Update all properties from metrics
        updateFromMetrics(metrics)
    }

    /// Update all properties from a SystemMetrics snapshot.
    private func updateFromMetrics(_ metrics: SystemMetrics) {
        // Core metrics
        cpuUsage = metrics.cpuUsage
        memoryUsage = metrics.memoryUsage
        memoryTotal = metrics.memoryTotal
        memoryUsed = metrics.memoryUsed
        diskUsage = metrics.diskUsage
        cpuTemperature = metrics.cpuTemperature
        gpuTemperature = metrics.gpuTemperature
        timestamp = metrics.timestamp

        // Derived state
        momentum = metrics.momentum
        systemState = metrics.systemState
        topProcesses = metrics.topProcesses
        fanSpeeds = metrics.fanSpeeds

        // Store full metrics
        currentMetrics = metrics

        // Increment update counter
        updateCount += 1

        // Clear any previous error
        lastError = nil
    }

    // MARK: - Computed Properties

    /// Memory used in gigabytes
    public var memoryUsedGB: Double {
        Double(memoryUsed) / (1024 * 1024 * 1024)
    }

    /// Memory total in gigabytes
    public var memoryTotalGB: Double {
        Double(memoryTotal) / (1024 * 1024 * 1024)
    }

    /// Memory available in gigabytes
    public var memoryAvailableGB: Double {
        memoryTotalGB - memoryUsedGB
    }

    /// Formatted memory string
    public var memoryFormatted: String {
        String(format: "%.1f / %.1f GB", memoryUsedGB, memoryTotalGB)
    }

    /// CPU usage formatted as percentage
    public var cpuUsageFormatted: String {
        String(format: "%.1f%%", cpuUsage)
    }

    /// Memory percentage formatted
    public var memoryPercentFormatted: String {
        String(format: "%.1f%%", memoryUsage)
    }

    /// CPU temperature formatted
    public var cpuTempFormatted: String {
        String(format: "%.1f°C", cpuTemperature)
    }

    /// GPU temperature formatted
    public var gpuTempFormatted: String {
        String(format: "%.1f°C", gpuTemperature)
    }

    // MARK: - Status Checks

    /// Whether CPU temperature is elevated (> 80°C)
    public var isCPUHot: Bool {
        cpuTemperature > 80
    }

    /// Whether GPU temperature is elevated (> 80°C)
    public var isGPUHot: Bool {
        gpuTemperature > 80
    }

    /// Whether memory usage is high (> 85%)
    public var isMemoryHigh: Bool {
        memoryUsage > 85
    }

    /// Whether CPU usage is high (> 80%)
    public var isCPUUsageHigh: Bool {
        cpuUsage > 80
    }

    /// Whether system is under heavy load
    public var isUnderHeavyLoad: Bool {
        systemState == .critical
    }

    // MARK: - Chromatic Aberration Integration

    /// Intensity for chromatic aberration effect based on system load.
    /// Used to create visual stress feedback on UI elements.
    public var chromaticIntensity: Float {
        switch systemState {
        case .critical: return 0.8
        case .elevated: return 0.4
        case .healthy: return 0.0
        }
    }

    // MARK: - Lifecycle

    /// Stop IPC connection.
    public func disconnect() {
        ipcHandler?.disconnect()
    }

    /// Reconnect to IPC.
    public func reconnect() {
        ipcHandler?.connect()
    }
}

// MARK: - Preview Support

#if DEBUG
extension MetricsStore {
    /// Creates a store with mock data for SwiftUI previews
    @MainActor
    public static var preview: MetricsStore {
        let store = MetricsStore(socketPath: "/tmp/opta-preview.sock")
        store.cpuUsage = 45.5
        store.memoryUsage = 62.0
        store.memoryTotal = 32 * 1024 * 1024 * 1024
        store.memoryUsed = 20 * 1024 * 1024 * 1024
        store.diskUsage = 50.0
        store.cpuTemperature = 55.0
        store.gpuTemperature = 48.0
        store.systemState = .elevated
        store.momentum = MomentumState(
            intensity: 0.7,
            color: .active,
            rotationSpeed: 1.5,
            pulseFrequency: 1.0
        )
        store.topProcesses = [
            ProcessInfoSwift(pid: 1234, name: "Safari", cpuPercent: 15.5, memoryMb: 512.0),
            ProcessInfoSwift(pid: 5678, name: "Xcode", cpuPercent: 12.0, memoryMb: 2048.0),
            ProcessInfoSwift(pid: 9012, name: "Simulator", cpuPercent: 8.5, memoryMb: 1024.0),
        ]
        store.fanSpeeds = [1200, 1180]
        store.isConnected = true
        return store
    }

    /// Creates a critical state store for previews
    @MainActor
    public static var criticalPreview: MetricsStore {
        let store = MetricsStore(socketPath: "/tmp/opta-preview.sock")
        store.cpuUsage = 95.0
        store.memoryUsage = 88.0
        store.memoryTotal = 32 * 1024 * 1024 * 1024
        store.memoryUsed = 28 * 1024 * 1024 * 1024
        store.cpuTemperature = 92.0
        store.systemState = .critical
        store.momentum = MomentumState(
            intensity: 1.0,
            color: .critical,
            rotationSpeed: 3.0,
            pulseFrequency: 2.0
        )
        store.isConnected = true
        return store
    }
}
#endif
