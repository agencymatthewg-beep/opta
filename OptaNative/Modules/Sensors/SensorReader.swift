//
//  SensorReader.swift
//  OptaNative
//
//  High-level sensor reading service that combines SMC bridge
//  with chip-aware key lookup for CPU/GPU temperatures and fan speeds.
//

import Foundation

/// Sensor reading results
struct SensorReadings {
    let cpuTemperature: Double?
    let gpuTemperature: Double?
    let fanSpeeds: [Int]
    let pCoreTemperatures: [Double]
    let eCoreTemperatures: [Double]
    let timestamp: Date

    /// Average P-core temperature
    var averagePCoreTemp: Double? {
        guard !pCoreTemperatures.isEmpty else { return nil }
        return pCoreTemperatures.reduce(0, +) / Double(pCoreTemperatures.count)
    }

    /// Average E-core temperature
    var averageECoreTemp: Double? {
        guard !eCoreTemperatures.isEmpty else { return nil }
        return eCoreTemperatures.reduce(0, +) / Double(eCoreTemperatures.count)
    }

    /// Maximum CPU temperature
    var maxCPUTemp: Double? {
        let allTemps = pCoreTemperatures + eCoreTemperatures
        return allTemps.max()
    }

    /// Maximum fan speed
    var maxFanSpeed: Int? {
        return fanSpeeds.max()
    }
}

/// Service for reading hardware sensors
/// Combines SMC bridge with chip-specific sensor key mappings
final class SensorReader {

    // MARK: - Properties

    private let smc: SMCService
    private let chip: String
    private let chipInfo: ChipInfo
    private let queue = DispatchQueue(label: "com.opta.native.sensor-reader", qos: .utility)

    /// Whether the reader is connected to SMC
    private(set) var isConnected: Bool = false

    /// Last error encountered
    private(set) var lastError: Error?

    // MARK: - Initialization

    init() {
        self.smc = SMCService()
        self.chip = ChipDetection.getChipGeneration()
        self.chipInfo = ChipDetection.getChipInfo()

        // Attempt to open SMC connection
        do {
            try smc.open()
            isConnected = true
        } catch {
            lastError = error
            isConnected = false
            print("[SensorReader] Warning: Could not connect to SMC - \(error.localizedDescription)")
        }
    }

    deinit {
        smc.close()
    }

    // MARK: - Temperature Reading

    /// Get average CPU temperature
    /// Reads all available CPU cores and returns the average
    func getCPUTemperature() -> Double? {
        guard isConnected else { return nil }

        let keys = SensorKeys.cpuTemperatureKeys(chip: chip)
        let temps = keys.compactMap { smc.readTemperature($0) }

        guard !temps.isEmpty else { return nil }
        return temps.reduce(0, +) / Double(temps.count)
    }

    /// Get P-core (performance) temperatures
    func getPCoreTemperatures() -> [Double] {
        guard isConnected else { return [] }

        let keys = SensorKeys.pCoreTemperatureKeys(chip: chip)
        return keys.compactMap { smc.readTemperature($0) }
    }

    /// Get E-core (efficiency) temperatures
    func getECoreTemperatures() -> [Double] {
        guard isConnected else { return [] }

        let keys = SensorKeys.eCoreTemperatureKeys(chip: chip)
        return keys.compactMap { smc.readTemperature($0) }
    }

    /// Get average GPU temperature
    func getGPUTemperature() -> Double? {
        guard isConnected else { return nil }

        let keys = SensorKeys.gpuTemperatureKeys(chip: chip)
        let temps = keys.compactMap { smc.readTemperature($0) }

        guard !temps.isEmpty else { return nil }
        return temps.reduce(0, +) / Double(temps.count)
    }

    // MARK: - Fan Reading

    /// Get all fan speeds in RPM
    func getFanSpeeds() -> [Int] {
        guard isConnected else { return [] }

        // First, try to get the number of fans
        let fanCount = getFanCount()

        var speeds: [Int] = []
        let actualSpeedKeys = SensorKeys.fanActualSpeedKeys()

        // Read speeds for each fan
        for i in 0..<min(fanCount, actualSpeedKeys.count) {
            if let speed = smc.readFanSpeed(actualSpeedKeys[i]) {
                speeds.append(speed)
            }
        }

        return speeds
    }

    /// Get the number of fans
    func getFanCount() -> Int {
        guard isConnected else { return 0 }

        let countKey = SensorKeys.fanCountKey()
        return smc.readInteger(countKey) ?? 0
    }

    // MARK: - Comprehensive Reading

    /// Read all sensors at once
    /// Returns a complete snapshot of current sensor values
    func readAll() -> SensorReadings {
        return SensorReadings(
            cpuTemperature: getCPUTemperature(),
            gpuTemperature: getGPUTemperature(),
            fanSpeeds: getFanSpeeds(),
            pCoreTemperatures: getPCoreTemperatures(),
            eCoreTemperatures: getECoreTemperatures(),
            timestamp: Date()
        )
    }

    // MARK: - Async Reading

    /// Read CPU temperature asynchronously
    func getCPUTemperatureAsync(completion: @escaping (Double?) -> Void) {
        queue.async { [weak self] in
            let temp = self?.getCPUTemperature()
            DispatchQueue.main.async {
                completion(temp)
            }
        }
    }

    /// Read GPU temperature asynchronously
    func getGPUTemperatureAsync(completion: @escaping (Double?) -> Void) {
        queue.async { [weak self] in
            let temp = self?.getGPUTemperature()
            DispatchQueue.main.async {
                completion(temp)
            }
        }
    }

    /// Read all sensors asynchronously
    func readAllAsync(completion: @escaping (SensorReadings) -> Void) {
        queue.async { [weak self] in
            let readings = self?.readAll() ?? SensorReadings(
                cpuTemperature: nil,
                gpuTemperature: nil,
                fanSpeeds: [],
                pCoreTemperatures: [],
                eCoreTemperatures: [],
                timestamp: Date()
            )
            DispatchQueue.main.async {
                completion(readings)
            }
        }
    }

    // MARK: - Async/Await Support (Swift Concurrency)

    /// Read CPU temperature using async/await
    func cpuTemperature() async -> Double? {
        await withCheckedContinuation { continuation in
            getCPUTemperatureAsync { temp in
                continuation.resume(returning: temp)
            }
        }
    }

    /// Read GPU temperature using async/await
    func gpuTemperature() async -> Double? {
        await withCheckedContinuation { continuation in
            getGPUTemperatureAsync { temp in
                continuation.resume(returning: temp)
            }
        }
    }

    /// Read all sensors using async/await
    func allReadings() async -> SensorReadings {
        await withCheckedContinuation { continuation in
            readAllAsync { readings in
                continuation.resume(returning: readings)
            }
        }
    }

    // MARK: - Status

    /// Check if sensor reading is available
    var isAvailable: Bool {
        return isConnected && SMCService.isAvailable
    }

    /// Get chip information
    var chipInformation: ChipInfo {
        return chipInfo
    }

    /// Get chip generation string
    var chipGeneration: String {
        return chip
    }

    /// Attempt to reconnect to SMC
    func reconnect() -> Bool {
        smc.close()
        isConnected = false

        do {
            try smc.open()
            isConnected = true
            lastError = nil
            return true
        } catch {
            lastError = error
            return false
        }
    }
}

// MARK: - SensorReader Extensions for SwiftUI

#if canImport(SwiftUI)
import SwiftUI

extension SensorReader {
    /// Create an Observable object wrapper for SwiftUI
    /// Use this for reactive UI updates
    static func createObservable() -> SensorReaderObservable {
        return SensorReaderObservable()
    }
}

/// Observable wrapper for SensorReader for use with SwiftUI
@Observable
final class SensorReaderObservable {
    private let reader = SensorReader()
    private var timer: Timer?

    var cpuTemperature: Double?
    var gpuTemperature: Double?
    var fanSpeeds: [Int] = []
    var pCoreTemps: [Double] = []
    var eCoreTemps: [Double] = []
    var isConnected: Bool { reader.isConnected }
    var chipGeneration: String { reader.chipGeneration }

    init() {
        // Initial read
        refresh()
    }

    deinit {
        stopAutoRefresh()
    }

    /// Refresh all sensor readings
    func refresh() {
        reader.readAllAsync { [weak self] readings in
            self?.cpuTemperature = readings.cpuTemperature
            self?.gpuTemperature = readings.gpuTemperature
            self?.fanSpeeds = readings.fanSpeeds
            self?.pCoreTemps = readings.pCoreTemperatures
            self?.eCoreTemps = readings.eCoreTemperatures
        }
    }

    /// Start auto-refreshing at specified interval (default 1 second)
    func startAutoRefresh(interval: TimeInterval = 1.0) {
        stopAutoRefresh()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    /// Stop auto-refreshing
    func stopAutoRefresh() {
        timer?.invalidate()
        timer = nil
    }
}
#endif
