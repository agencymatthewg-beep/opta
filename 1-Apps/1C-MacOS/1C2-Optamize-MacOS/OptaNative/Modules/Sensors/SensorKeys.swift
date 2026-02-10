//
//  SensorKeys.swift
//  OptaNative
//
//  SMC sensor key mappings for different Apple chip generations.
//  Keys vary significantly between M1, M2, M3, M4, and Intel chips.
//
//  Reference: https://github.com/acidanthera/VirtualSMC/blob/master/Docs/SMCSensorKeys.txt
//  Reference: https://github.com/exelban/stats
//

import Foundation

/// SMC sensor key mappings for different chip generations
enum SensorKeys {

    // MARK: - CPU Temperature Keys

    /// Get CPU temperature sensor keys for the specified chip
    /// Returns array of SMC keys that report P-core and E-core temperatures
    static func cpuTemperatureKeys(chip: String) -> [String] {
        switch chip {
        case "M1":
            // M1 CPU cores
            return [
                // E-cores (efficiency)
                "Tp09", "Tp0T",
                // P-cores (performance)
                "Tp01", "Tp05", "Tp0D", "Tp0H", "Tp0L", "Tp0P", "Tp0X", "Tp0b"
            ]

        case "M2":
            // M2 CPU cores
            return [
                // E-cores
                "Tp1h", "Tp1t", "Tp1p", "Tp1l",
                // P-cores
                "Tp01", "Tp05", "Tp09", "Tp0D", "Tp0X", "Tp0b", "Tp0f", "Tp0j"
            ]

        case "M3":
            // M3 CPU cores - different key structure
            return [
                // E-cores
                "Te05", "Te0L", "Te0P", "Te0S",
                // P-cores
                "Tf04", "Tf09", "Tf0A", "Tf0B", "Tf0D", "Tf0E",
                "Tf44", "Tf49", "Tf4A", "Tf4B", "Tf4D", "Tf4E"
            ]

        case "M4":
            // M4 keys - preliminary, based on early reports
            // These may need adjustment as more data becomes available
            return [
                // E-cores (estimated based on M3 pattern)
                "Te05", "Te0L", "Te0P", "Te0S",
                // P-cores (estimated)
                "Tf04", "Tf09", "Tf0A", "Tf0B", "Tf0D", "Tf0E",
                "Tf44", "Tf49", "Tf4A", "Tf4B", "Tf4D", "Tf4E"
            ]

        case "Intel":
            // Intel Mac CPU sensors
            return [
                "TC0D", "TC0E", "TC0F",  // CPU die temperatures
                "TC0H", "TC0P",          // CPU proximity/heatsink
                "TC1C", "TC2C", "TC3C", "TC4C"  // Per-core temps (varies by model)
            ]

        default:
            // Fallback - try common keys
            if ChipDetection.isAppleSilicon {
                return ["Tp01", "Tp05", "Tp09"]
            }
            return ["TC0D", "TC0E", "TC0F"]
        }
    }

    /// Get P-core (performance) temperature keys
    static func pCoreTemperatureKeys(chip: String) -> [String] {
        switch chip {
        case "M1":
            return ["Tp01", "Tp05", "Tp0D", "Tp0H", "Tp0L", "Tp0P", "Tp0X", "Tp0b"]
        case "M2":
            return ["Tp01", "Tp05", "Tp09", "Tp0D", "Tp0X", "Tp0b", "Tp0f", "Tp0j"]
        case "M3", "M4":
            return ["Tf04", "Tf09", "Tf0A", "Tf0B", "Tf0D", "Tf0E",
                    "Tf44", "Tf49", "Tf4A", "Tf4B", "Tf4D", "Tf4E"]
        default:
            return []
        }
    }

    /// Get E-core (efficiency) temperature keys
    static func eCoreTemperatureKeys(chip: String) -> [String] {
        switch chip {
        case "M1":
            return ["Tp09", "Tp0T"]
        case "M2":
            return ["Tp1h", "Tp1t", "Tp1p", "Tp1l"]
        case "M3", "M4":
            return ["Te05", "Te0L", "Te0P", "Te0S"]
        default:
            return []
        }
    }

    // MARK: - GPU Temperature Keys

    /// Get GPU temperature sensor keys for the specified chip
    static func gpuTemperatureKeys(chip: String) -> [String] {
        switch chip {
        case "M1":
            return ["Tg05", "Tg0D", "Tg0L", "Tg0T"]

        case "M2":
            return ["Tg0f", "Tg0j"]

        case "M3":
            return ["Tf14", "Tf18", "Tf19", "Tf1A", "Tf24", "Tf28", "Tf29", "Tf2A"]

        case "M4":
            // M4 GPU keys - preliminary
            return ["Tf14", "Tf18", "Tf19", "Tf1A", "Tf24", "Tf28", "Tf29", "Tf2A"]

        case "Intel":
            // Intel integrated/discrete GPU
            return [
                "TG0D", "TG0H", "TG0P",  // GPU die/heatsink/proximity
                "TGDD"                    // Discrete GPU (if present)
            ]

        default:
            if ChipDetection.isAppleSilicon {
                return ["Tg05", "Tg0D"]
            }
            return ["TG0D", "TG0H"]
        }
    }

    // MARK: - Fan Keys

    /// Get fan speed keys (RPM)
    /// These are relatively consistent across chips
    static func fanKeys() -> [String] {
        return [
            // Fan actual speed (RPM)
            "F0Ac", "F1Ac", "F2Ac",
            // Fan target speed
            "F0Tg", "F1Tg", "F2Tg",
            // Fan minimum speed
            "F0Mn", "F1Mn", "F2Mn",
            // Fan maximum speed
            "F0Mx", "F1Mx", "F2Mx"
        ]
    }

    /// Get actual fan speed keys only
    static func fanActualSpeedKeys() -> [String] {
        return ["F0Ac", "F1Ac", "F2Ac"]
    }

    /// Get number of fans key
    static func fanCountKey() -> String {
        return "FNum"
    }

    // MARK: - Power Keys

    /// Get power consumption keys
    static func powerKeys(chip: String) -> [String] {
        switch chip {
        case "M1", "M2", "M3", "M4":
            return [
                "PSTR",  // System total power
                "PCPT",  // CPU power
                "PGTR",  // GPU power
                "PDTR",  // DRAM power
                "PTHC"   // Thermal throttle
            ]

        case "Intel":
            return [
                "PC0C", "PC1C",  // CPU package power
                "PCPT", "PCPG",  // CPU total power
                "PG0R",          // GPU power
                "PDTR"           // DRAM power
            ]

        default:
            return ["PSTR", "PCPT", "PGTR"]
        }
    }

    // MARK: - Memory Keys

    /// Get memory temperature keys
    static func memoryTemperatureKeys() -> [String] {
        return [
            "TM0P", "TM0S",  // Memory proximity/sensor
            "TM1P", "TM1S",
            "Tm0P", "Tm1P"   // Alternative memory keys
        ]
    }

    // MARK: - Battery Keys (MacBooks)

    /// Get battery temperature keys
    static func batteryTemperatureKeys() -> [String] {
        return [
            "TB0T", "TB1T", "TB2T",  // Battery temperatures
            "TBXT"                    // Battery extra temp
        ]
    }

    /// Get battery charge keys
    static func batteryChargeKeys() -> [String] {
        return [
            "BATP",  // Battery present
            "B0AC",  // Battery current
            "B0AV",  // Battery voltage
            "B0CT",  // Battery charge
            "B0FC",  // Battery full charge capacity
            "B0DC"   // Battery design capacity
        ]
    }

    // MARK: - SSD/Storage Keys

    /// Get SSD temperature keys
    static func ssdTemperatureKeys() -> [String] {
        return [
            "TH0A", "TH0B", "TH0C",  // HDD/SSD temps
            "TH0F", "TH0J",
            "TH0P",                   // Storage proximity
            "Ts0P", "Ts0S", "Ts1P"   // SSD specific
        ]
    }

    // MARK: - Utility Functions

    /// Get all temperature keys for the current system
    static func allTemperatureKeys(chip: String) -> [String] {
        var keys: [String] = []
        keys.append(contentsOf: cpuTemperatureKeys(chip: chip))
        keys.append(contentsOf: gpuTemperatureKeys(chip: chip))
        keys.append(contentsOf: memoryTemperatureKeys())
        keys.append(contentsOf: ssdTemperatureKeys())

        // Add battery temps for laptops
        keys.append(contentsOf: batteryTemperatureKeys())

        return keys
    }

    /// Check if a key is a temperature sensor
    static func isTemperatureKey(_ key: String) -> Bool {
        // Temperature keys typically start with 'T' or end with temperature indicators
        return key.hasPrefix("T") || key.hasPrefix("t")
    }

    /// Check if a key is a fan sensor
    static func isFanKey(_ key: String) -> Bool {
        return key.hasPrefix("F")
    }

    /// Check if a key is a power sensor
    static func isPowerKey(_ key: String) -> Bool {
        return key.hasPrefix("P")
    }
}
