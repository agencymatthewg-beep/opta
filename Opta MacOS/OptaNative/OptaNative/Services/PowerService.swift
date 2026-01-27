//
//  PowerService.swift
//  OptaNative
//
//  Service for managing system power states and assertions.
//  Enhanced with battery impact estimation and thermal indicators.
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import Foundation
import IOKit.pwr_mgt
import IOKit.ps

// MARK: - Battery Impact Models

enum BatteryImpact: String, Sendable {
    case minimal = "Minimal"
    case moderate = "Moderate"
    case significant = "Significant"
    case heavy = "Heavy"

    var icon: String {
        switch self {
        case .minimal: return "battery.100"
        case .moderate: return "battery.75"
        case .significant: return "battery.50"
        case .heavy: return "battery.25"
        }
    }

    var color: String {
        switch self {
        case .minimal: return "optaSuccess"
        case .moderate: return "optaElectricBlue"
        case .significant: return "optaWarning"
        case .heavy: return "optaDanger"
        }
    }
}

enum ThermalImpact: String, Sendable {
    case cool = "Cool"
    case warm = "Warm"
    case hot = "Hot"

    var icon: String {
        switch self {
        case .cool: return "thermometer.snowflake"
        case .warm: return "thermometer.medium"
        case .hot: return "thermometer.sun.fill"
        }
    }
}

// MARK: - Power Profile

enum PowerProfile: String, CaseIterable, Identifiable, Sendable {
    case balanced = "Balanced"
    case highPerformance = "High Performance"
    case powerSaver = "Power Saver"
    case gaming = "Gaming"
    case batteryHealth = "Battery Health"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .balanced: return "Standard system behavior with adaptive performance."
        case .highPerformance: return "Maximum CPU/GPU performance. Prevents sleep."
        case .powerSaver: return "Aggressive power saving. Reduced brightness."
        case .gaming: return "Sustained burst performance for games."
        case .batteryHealth: return "Conservative thermals, charge limiting."
        }
    }

    var icon: String {
        switch self {
        case .balanced: return "equal.circle.fill"
        case .highPerformance: return "bolt.fill"
        case .powerSaver: return "leaf.fill"
        case .gaming: return "gamecontroller.fill"
        case .batteryHealth: return "battery.100.bolt"
        }
    }

    /// Estimated power consumption in watts (relative to idle)
    var estimatedWatts: Double {
        switch self {
        case .powerSaver: return 8
        case .batteryHealth: return 10
        case .balanced: return 15
        case .highPerformance: return 35
        case .gaming: return 45
        }
    }

    /// Battery impact classification
    var batteryImpact: BatteryImpact {
        switch self {
        case .powerSaver, .batteryHealth: return .minimal
        case .balanced: return .moderate
        case .highPerformance: return .significant
        case .gaming: return .heavy
        }
    }

    /// Thermal impact classification
    var thermalImpact: ThermalImpact {
        switch self {
        case .powerSaver, .batteryHealth, .balanced: return .cool
        case .highPerformance: return .warm
        case .gaming: return .hot
        }
    }

    /// Estimated runtime on full battery (hours)
    func estimatedRuntime(batteryCapacityWh: Double) -> Double {
        // Simple calculation: capacity / power draw
        return batteryCapacityWh / estimatedWatts
    }
}

// MARK: - High Power Mode Status

struct HighPowerModeStatus: Sendable {
    let isSupported: Bool
    let isEnabled: Bool?
    let recommendation: String?
}

// MARK: - Battery Status

struct BatteryStatus: Sendable {
    let isPresent: Bool
    let isCharging: Bool
    let currentCapacity: Int       // 0-100%
    let maxCapacity: Int           // Wh
    let cycleCount: Int
    let health: Double             // 0.0-1.0
    let timeRemaining: Int?        // Minutes, nil if calculating

    var healthPercentage: Int { Int(health * 100) }

    var healthStatus: String {
        if health > 0.9 { return "Excellent" }
        if health > 0.8 { return "Good" }
        if health > 0.6 { return "Fair" }
        return "Service Recommended"
    }
}

// MARK: - Service

actor PowerService {

    // MARK: - Properties

    private var noSleepAssertionID: IOPMAssertionID = 0
    private var activeProfile: PowerProfile = .balanced
    private var autoSwitchEnabled: Bool = false

    // MARK: - Initialization

    init() {}

    // MARK: - Profile Management

    func setProfile(_ profile: PowerProfile) {
        self.activeProfile = profile

        switch profile {
        case .highPerformance, .gaming:
            enableHighPerformance()
        case .balanced, .powerSaver, .batteryHealth:
            disableHighPerformance()
        }
    }

    func getActiveProfile() -> PowerProfile {
        return activeProfile
    }

    // MARK: - Auto-Switch

    func setAutoSwitch(enabled: Bool) {
        self.autoSwitchEnabled = enabled
    }

    func isAutoSwitchEnabled() -> Bool {
        return autoSwitchEnabled
    }

    // MARK: - Battery Information

    /// Gets current battery status from IOKit
    func getBatteryStatus() -> BatteryStatus {
        guard let snapshot = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(snapshot)?.takeRetainedValue() as? [CFTypeRef],
              let source = sources.first,
              let info = IOPSGetPowerSourceDescription(snapshot, source)?.takeUnretainedValue() as? [String: Any]
        else {
            return BatteryStatus(
                isPresent: false,
                isCharging: false,
                currentCapacity: 0,
                maxCapacity: 0,
                cycleCount: 0,
                health: 1.0,
                timeRemaining: nil
            )
        }

        let isCharging = (info[kIOPSIsChargingKey] as? Bool) ?? false
        let currentCapacity = (info[kIOPSCurrentCapacityKey] as? Int) ?? 0
        let maxCapacity = (info[kIOPSMaxCapacityKey] as? Int) ?? 100
        let designCapacity = (info["DesignCapacity"] as? Int) ?? maxCapacity

        // Calculate health as current max / design max
        let health = designCapacity > 0 ? Double(maxCapacity) / Double(designCapacity) : 1.0

        // Get time remaining
        var timeRemaining: Int? = nil
        if let time = info[kIOPSTimeToEmptyKey] as? Int, time > 0 {
            timeRemaining = time
        } else if let time = info[kIOPSTimeToFullChargeKey] as? Int, time > 0 {
            timeRemaining = time
        }

        // Cycle count from different key
        let cycleCount = (info["CycleCount"] as? Int) ?? 0

        return BatteryStatus(
            isPresent: true,
            isCharging: isCharging,
            currentCapacity: currentCapacity,
            maxCapacity: maxCapacity,
            cycleCount: cycleCount,
            health: min(health, 1.0),
            timeRemaining: timeRemaining
        )
    }

    /// Estimates battery runtime for a given profile
    func estimateRuntime(for profile: PowerProfile) -> Double {
        let status = getBatteryStatus()
        guard status.isPresent else { return 0 }

        // Estimate Wh remaining
        let capacityWh = Double(status.maxCapacity) * (Double(status.currentCapacity) / 100.0)

        // Very rough estimate: assume maxCapacity is mAh at 11V nominal
        let estimatedWh = capacityWh * 11.0 / 1000.0 * 100 // Simplified

        return profile.estimatedRuntime(batteryCapacityWh: max(estimatedWh, 50)) // Assume at least 50Wh
    }

    // MARK: - Implementation

    /// Prevents system sleep and display dimming
    private func enableHighPerformance() {
        guard noSleepAssertionID == 0 else { return }

        let assertionName = "Opta High Performance Mode" as CFString
        let assertionType = kIOPMAssertionTypeNoDisplaySleep as CFString

        var assertionID: IOPMAssertionID = 0
        let result = IOPMAssertionCreateWithName(
            assertionType,
            IOPMAssertionLevel(kIOPMAssertionLevelOn),
            assertionName,
            &assertionID
        )

        if result == kIOReturnSuccess {
            self.noSleepAssertionID = assertionID
            print("PowerService: High Performance Mode Enabled (Assertion ID: \(assertionID))")
        } else {
            print("PowerService: Failed to enable High Performance Mode (Error: \(result))")
        }
    }

    /// Releases sleep assertions
    private func disableHighPerformance() {
        guard noSleepAssertionID != 0 else { return }

        let result = IOPMAssertionRelease(noSleepAssertionID)

        if result == kIOReturnSuccess {
            print("PowerService: High Performance Mode Disabled")
            self.noSleepAssertionID = 0
        } else {
            print("PowerService: Failed to release assertion (Error: \(result))")
        }
    }

    deinit {
        if noSleepAssertionID != 0 {
            IOPMAssertionRelease(noSleepAssertionID)
        }
    }

    // MARK: - High Power Mode

    /// Check High Power Mode support and status
    func getHighPowerModeStatus() -> HighPowerModeStatus {
        let isSupported = ChipDetection.supportsHighPowerMode
        let isEnabled = ChipDetection.isHighPowerModeEnabled()

        var recommendation: String? = nil

        if isSupported {
            if let enabled = isEnabled {
                if !enabled && activeProfile == .gaming {
                    recommendation = "Enable High Power Mode in System Settings → Battery for maximum gaming performance."
                }
            } else {
                recommendation = "Your Mac supports High Power Mode. Check System Settings → Battery."
            }
        }

        return HighPowerModeStatus(
            isSupported: isSupported,
            isEnabled: isEnabled,
            recommendation: recommendation
        )
    }

    /// Whether the device supports High Power Mode
    func supportsHighPowerMode() -> Bool {
        return ChipDetection.supportsHighPowerMode
    }
}
