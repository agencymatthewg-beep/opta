//
//  TelemetryViewModel.swift
//  OptaNative
//
//  Observable view model bridging TelemetryService to SwiftUI.
//  Uses @Observable macro (macOS 14+) for automatic UI updates.
//  Created for Opta Native macOS - Plan 19-05
//

import SwiftUI

/// View model for real-time hardware telemetry display.
/// Bridges the actor-based TelemetryService to SwiftUI views.
@Observable
@MainActor
class TelemetryViewModel {

    // MARK: - Published Properties (auto-observed by @Observable)

    /// CPU temperature in Celsius
    var cpuTemperature: Double = 0

    /// GPU temperature in Celsius
    var gpuTemperature: Double = 0

    /// CPU usage percentage (0-100)
    var cpuUsage: Double = 0

    /// Memory used in gigabytes
    var memoryUsedGB: Double = 0

    /// Total memory in gigabytes
    var memoryTotalGB: Double = 0

    /// Memory usage percentage (0-100)
    var memoryPercent: Double = 0

    /// Fan speeds in RPM
    var fanSpeeds: [Int] = []

    /// P-core temperatures array
    var pCoreTemperatures: [Double] = []

    /// E-core temperatures array
    var eCoreTemperatures: [Double] = []

    /// Whether monitoring is active
    var isMonitoring: Bool = false

    /// Detected chip name (e.g., "M3 Pro")
    var chipName: String = "Unknown"

    /// Whether the sensor reader is connected to SMC
    var isSensorConnected: Bool = false

    /// Timestamp of last update
    var lastUpdate: Date?

    // MARK: - Private Properties

    private let service = TelemetryService()
    private var monitoringTask: Task<Void, Never>?

    // MARK: - Initialization

    init() {
        // Initialize chip name
        Task {
            await self.initializeChipInfo()
        }
    }

    // MARK: - Lifecycle

    /// Initialize chip information from the service
    private func initializeChipInfo() async {
        let generation = await service.chipGeneration
        let connected = await service.isSensorConnected

        chipName = ChipDetection.getChipInfo().displayName
        isSensorConnected = connected
    }

    // MARK: - Monitoring Control

    /// Starts real-time monitoring at 1-second intervals.
    func startMonitoring() {
        guard !isMonitoring else { return }

        isMonitoring = true

        monitoringTask = Task { [weak self] in
            guard let self else { return }
            await self.service.startPolling(interval: 1.0) { [weak self] snapshot in
                Task { @MainActor [weak self] in
                    self?.updateFromSnapshot(snapshot)
                }
            }
        }
    }

    /// Stops real-time monitoring.
    func stopMonitoring() {
        monitoringTask?.cancel()
        monitoringTask = nil

        Task {
            await service.stopPolling()
        }

        isMonitoring = false
    }

    /// Toggles monitoring state.
    func toggleMonitoring() {
        if isMonitoring {
            stopMonitoring()
        } else {
            startMonitoring()
        }
    }

    // MARK: - Manual Refresh

    /// Fetches a single snapshot without starting continuous monitoring.
    func refresh() async {
        let snapshot = await service.collectSnapshot()
        updateFromSnapshot(snapshot)
    }

    // MARK: - Snapshot Processing

    /// Updates all properties from a telemetry snapshot.
    private func updateFromSnapshot(_ snapshot: TelemetrySnapshot) {
        cpuTemperature = snapshot.cpuTemperature ?? 0
        gpuTemperature = snapshot.gpuTemperature ?? 0
        cpuUsage = snapshot.cpuUsage
        memoryUsedGB = snapshot.memoryUsedGB
        memoryTotalGB = snapshot.memoryTotalGB
        memoryPercent = snapshot.memoryPercent
        fanSpeeds = snapshot.fanSpeeds
        pCoreTemperatures = snapshot.pCoreTemperatures
        eCoreTemperatures = snapshot.eCoreTemperatures
        lastUpdate = snapshot.timestamp
    }

    // MARK: - Computed Properties

    /// Maximum P-core temperature
    var maxPCoreTemp: Double? {
        return pCoreTemperatures.max()
    }

    /// Maximum E-core temperature
    var maxECoreTemp: Double? {
        return eCoreTemperatures.max()
    }

    /// Average P-core temperature
    var avgPCoreTemp: Double? {
        guard !pCoreTemperatures.isEmpty else { return nil }
        return pCoreTemperatures.reduce(0, +) / Double(pCoreTemperatures.count)
    }

    /// Average E-core temperature
    var avgECoreTemp: Double? {
        guard !eCoreTemperatures.isEmpty else { return nil }
        return eCoreTemperatures.reduce(0, +) / Double(eCoreTemperatures.count)
    }

    /// Maximum fan speed
    var maxFanSpeed: Int? {
        return fanSpeeds.max()
    }

    /// Memory available in GB
    var memoryAvailableGB: Double {
        return memoryTotalGB - memoryUsedGB
    }

    /// Whether CPU temperature is elevated (> 80C)
    var isCPUHot: Bool {
        return cpuTemperature > 80
    }

    /// Whether GPU temperature is elevated (> 80C)
    var isGPUHot: Bool {
        return gpuTemperature > 80
    }

    /// Whether memory usage is high (> 85%)
    var isMemoryHigh: Bool {
        return memoryPercent > 85
    }

    /// Whether CPU usage is high (> 80%)
    var isCPUUsageHigh: Bool {
        return cpuUsage > 80
    }

    // MARK: - Formatted Strings

    /// CPU temperature formatted with degree symbol
    var cpuTempFormatted: String {
        return String(format: "%.1f°C", cpuTemperature)
    }

    /// GPU temperature formatted with degree symbol
    var gpuTempFormatted: String {
        return String(format: "%.1f°C", gpuTemperature)
    }

    /// CPU usage formatted as percentage
    var cpuUsageFormatted: String {
        return String(format: "%.1f%%", cpuUsage)
    }

    /// Memory usage formatted string
    var memoryFormatted: String {
        return String(format: "%.1f / %.1f GB", memoryUsedGB, memoryTotalGB)
    }

    /// Memory percentage formatted
    var memoryPercentFormatted: String {
        return String(format: "%.1f%%", memoryPercent)
    }

    /// Fan speeds formatted as comma-separated RPM values
    var fanSpeedsFormatted: String {
        if fanSpeeds.isEmpty {
            return "No fans"
        }
        return fanSpeeds.map { "\($0) RPM" }.joined(separator: ", ")
    }
}

// MARK: - Preview Support

#if DEBUG
extension TelemetryViewModel {
    /// Creates a view model with mock data for SwiftUI previews
    static var preview: TelemetryViewModel {
        let vm = TelemetryViewModel()
        vm.cpuTemperature = 45.5
        vm.gpuTemperature = 42.3
        vm.cpuUsage = 23.5
        vm.memoryUsedGB = 12.4
        vm.memoryTotalGB = 32.0
        vm.memoryPercent = 38.75
        vm.fanSpeeds = [1200, 1180]
        vm.chipName = "M3 Pro"
        vm.isSensorConnected = true
        vm.isMonitoring = true
        vm.lastUpdate = Date()
        return vm
    }
}
#endif
