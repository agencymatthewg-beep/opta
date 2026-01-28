//
//  TelemetryService.swift
//  OptaNative
//
//  Actor-based service for collecting hardware telemetry data.
//  Uses SensorReader for SMC temperatures and BSD APIs for CPU/memory stats.
//  Created for Opta Native macOS - Plan 19-05
//

import Foundation
import Darwin

/// Hardware telemetry snapshot containing all monitored metrics
struct TelemetrySnapshot: Sendable {
    let cpuTemperature: Double?
    let gpuTemperature: Double?
    let cpuUsage: Double
    let memoryUsed: UInt64
    let memoryTotal: UInt64
    let fanSpeeds: [Int]
    let pCoreTemperatures: [Double]
    let eCoreTemperatures: [Double]
    let timestamp: Date

    /// Memory usage as a percentage (0-100)
    var memoryPercent: Double {
        guard memoryTotal > 0 else { return 0 }
        return (Double(memoryUsed) / Double(memoryTotal)) * 100.0
    }

    /// Memory used in gigabytes
    var memoryUsedGB: Double {
        return Double(memoryUsed) / (1024 * 1024 * 1024)
    }

    /// Memory total in gigabytes
    var memoryTotalGB: Double {
        return Double(memoryTotal) / (1024 * 1024 * 1024)
    }
}

/// Actor-based telemetry service for thread-safe hardware monitoring.
/// Polls at configurable intervals and delivers snapshots via callback.
actor TelemetryService {

    // MARK: - Properties

    private let sensorReader: SensorReader
    private var pollingTask: Task<Void, Never>?
    private var isPolling: Bool = false

    // CPU usage tracking (requires previous sample for delta)
    private var previousCPUInfo: host_cpu_load_info?

    // MARK: - Initialization

    init() {
        self.sensorReader = SensorReader()
    }

    // MARK: - Polling Control

    /// Starts polling for telemetry data at the specified interval.
    /// - Parameters:
    ///   - interval: Time between polls in seconds (default 1.0)
    ///   - onUpdate: Callback invoked with each new snapshot
    func startPolling(interval: TimeInterval = 1.0, onUpdate: @escaping @Sendable (TelemetrySnapshot) -> Void) {
        guard !isPolling else { return }

        isPolling = true
        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self = self else { break }

                let snapshot = await self.collectSnapshot()
                onUpdate(snapshot)

                do {
                    try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                } catch {
                    break
                }
            }
        }
    }

    /// Stops the polling loop.
    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
        isPolling = false
    }

    /// Returns whether polling is currently active.
    var polling: Bool {
        return isPolling
    }

    // MARK: - Single Snapshot

    /// Collects a single telemetry snapshot.
    /// Can be called independently of polling.
    func collectSnapshot() async -> TelemetrySnapshot {
        // Read sensor data (SMC)
        let sensorReadings = sensorReader.readAll()

        // Get CPU usage via host_processor_info
        let cpuUsage = getCPUUsage()

        // Get memory stats via host_statistics64
        let (memUsed, memTotal) = getMemoryStats()

        return TelemetrySnapshot(
            cpuTemperature: sensorReadings.cpuTemperature,
            gpuTemperature: sensorReadings.gpuTemperature,
            cpuUsage: cpuUsage,
            memoryUsed: memUsed,
            memoryTotal: memTotal,
            fanSpeeds: sensorReadings.fanSpeeds,
            pCoreTemperatures: sensorReadings.pCoreTemperatures,
            eCoreTemperatures: sensorReadings.eCoreTemperatures,
            timestamp: Date()
        )
    }

    // MARK: - CPU Usage

    /// Gets total CPU usage percentage across all cores.
    /// Uses delta between samples for accurate measurement.
    private func getCPUUsage() -> Double {
        var numCPUs: natural_t = 0
        var cpuInfo: processor_info_array_t?
        var numCPUInfo: mach_msg_type_number_t = 0

        let result = host_processor_info(
            mach_host_self(),
            PROCESSOR_CPU_LOAD_INFO,
            &numCPUs,
            &cpuInfo,
            &numCPUInfo
        )

        guard result == KERN_SUCCESS, let cpuInfo = cpuInfo else {
            return 0.0
        }

        defer {
            // Deallocate the CPU info
            let size = vm_size_t(numCPUInfo) * vm_size_t(MemoryLayout<Int32>.stride)
            vm_deallocate(mach_task_self_, vm_address_t(bitPattern: cpuInfo), size)
        }

        // Calculate current totals
        var totalUser: UInt64 = 0
        var totalSystem: UInt64 = 0
        var totalIdle: UInt64 = 0
        var totalNice: UInt64 = 0

        for i in 0..<Int(numCPUs) {
            let offset = Int(CPU_STATE_MAX) * i
            totalUser += UInt64(cpuInfo[offset + Int(CPU_STATE_USER)])
            totalSystem += UInt64(cpuInfo[offset + Int(CPU_STATE_SYSTEM)])
            totalIdle += UInt64(cpuInfo[offset + Int(CPU_STATE_IDLE)])
            totalNice += UInt64(cpuInfo[offset + Int(CPU_STATE_NICE)])
        }

        // Store current values for next calculation
        let current = host_cpu_load_info(
            cpu_ticks: (
                UInt32(totalUser & 0xFFFFFFFF),
                UInt32(totalSystem & 0xFFFFFFFF),
                UInt32(totalIdle & 0xFFFFFFFF),
                UInt32(totalNice & 0xFFFFFFFF)
            )
        )

        // If we have a previous sample, calculate delta
        guard let previous = previousCPUInfo else {
            previousCPUInfo = current
            return 0.0
        }

        let userDelta = totalUser - UInt64(previous.cpu_ticks.0)
        let systemDelta = totalSystem - UInt64(previous.cpu_ticks.1)
        let idleDelta = totalIdle - UInt64(previous.cpu_ticks.2)
        let niceDelta = totalNice - UInt64(previous.cpu_ticks.3)

        let totalDelta = userDelta + systemDelta + idleDelta + niceDelta

        previousCPUInfo = current

        guard totalDelta > 0 else { return 0.0 }

        let usedDelta = userDelta + systemDelta + niceDelta
        return (Double(usedDelta) / Double(totalDelta)) * 100.0
    }

    // MARK: - Memory Stats

    /// Gets memory usage statistics.
    /// - Returns: Tuple of (used bytes, total bytes)
    private func getMemoryStats() -> (used: UInt64, total: UInt64) {
        // Get total physical memory
        var totalMemory: UInt64 = 0
        var size = MemoryLayout<UInt64>.size
        sysctlbyname("hw.memsize", &totalMemory, &size, nil, 0)

        // Get VM statistics for used memory calculation
        var vmStats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)

        let result = withUnsafeMutablePointer(to: &vmStats) { ptr in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { statsPtr in
                host_statistics64(
                    mach_host_self(),
                    HOST_VM_INFO64,
                    statsPtr,
                    &count
                )
            }
        }

        guard result == KERN_SUCCESS else {
            return (0, totalMemory)
        }

        // Get page size
        let pageSize = UInt64(vm_kernel_page_size)

        // Calculate used memory
        // Active + Wired + Compressed - Purgeable gives a good "used" estimate
        let active = UInt64(vmStats.active_count) * pageSize
        let wired = UInt64(vmStats.wire_count) * pageSize
        let compressed = UInt64(vmStats.compressor_page_count) * pageSize

        // Speculative and inactive pages are effectively available
        let usedMemory = active + wired + compressed

        return (usedMemory, totalMemory)
    }

    // MARK: - Sensor Status

    /// Whether the underlying sensor reader is connected to SMC
    var isSensorConnected: Bool {
        return sensorReader.isConnected
    }

    /// Chip generation string
    var chipGeneration: String {
        return sensorReader.chipGeneration
    }
}
