//
//  ThermalPredictionService.swift
//  OptaNative
//
//  Thermal intelligence system that predicts time-to-throttle
//  and provides thermal management recommendations.
//
//  Created for Opta Native macOS - Phase 98-01
//

import Foundation

// MARK: - Device Form Factor

enum DeviceFormFactor: String, Sendable {
    case macBookAir = "MacBook Air"
    case macBookPro = "MacBook Pro"
    case macMini = "Mac mini"
    case macStudio = "Mac Studio"
    case macPro = "Mac Pro"
    case iMac = "iMac"
    case unknown = "Unknown"

    /// Whether the device has passive cooling (no fans)
    var hasPassiveCooling: Bool {
        switch self {
        case .macBookAir: return true
        default: return false
        }
    }

    /// Whether the device supports High Power Mode (M4 Pro/Max only)
    var supportsHighPowerMode: Bool {
        switch self {
        case .macBookPro, .macStudio, .macPro:
            // Only Pro/Max/Ultra chips in these form factors support High Power Mode
            let variant = ChipDetection.getChipVariant()
            return variant == .pro || variant == .max || variant == .ultra
        default:
            return false
        }
    }

    /// Default throttle temperature for this form factor
    var throttleTemperature: Double {
        switch self {
        case .macBookAir: return 100.0  // Throttles early due to passive cooling
        case .macBookPro: return 105.0  // Active cooling allows higher temps
        case .macMini: return 100.0
        case .macStudio: return 105.0
        case .macPro: return 105.0
        case .iMac: return 100.0
        case .unknown: return 100.0
        }
    }
}

// MARK: - Thermal State

enum ThermalState: String, Sendable {
    case cool = "Cool"
    case warm = "Warm"
    case hot = "Hot"
    case critical = "Critical"
    case throttling = "Throttling"

    /// Color for UI representation
    var severity: Int {
        switch self {
        case .cool: return 0
        case .warm: return 1
        case .hot: return 2
        case .critical: return 3
        case .throttling: return 4
        }
    }
}

// MARK: - Thermal Prediction

struct ThermalPrediction: Sendable {
    let currentTemperature: Double
    let state: ThermalState
    let secondsToThrottle: Double?
    let temperatureTrend: Double  // °C per minute
    let formFactor: DeviceFormFactor
    let recommendation: String?
    let timestamp: Date

    /// Whether throttling is imminent (less than 60 seconds)
    var throttleImminent: Bool {
        guard let seconds = secondsToThrottle else { return false }
        return seconds < 60 && seconds > 0
    }
}

// MARK: - Thermal History Sample

private struct ThermalSample: Sendable {
    let temperature: Double
    let timestamp: Date
}

// MARK: - Thermal Prediction Service

actor ThermalPredictionService {

    // MARK: - Configuration

    /// History window in seconds (60 samples at 1Hz)
    private static let historyWindowSeconds = 60

    /// Temperature thresholds for state determination
    private static let coolThreshold: Double = 50.0
    private static let warmThreshold: Double = 70.0
    private static let hotThreshold: Double = 85.0
    private static let criticalThreshold: Double = 95.0

    // MARK: - State

    private var temperatureHistory: [ThermalSample] = []
    private var formFactor: DeviceFormFactor = .unknown
    private var throttleTemperature: Double = 100.0
    private var lastPrediction: ThermalPrediction?

    // MARK: - Initialization

    init() {
        // Form factor detection happens on first use to avoid actor isolation issues
    }

    /// Initialize the service (call once on first use)
    func initialize() {
        if formFactor == .unknown {
            detectFormFactor()
        }
    }

    // MARK: - Device Detection

    /// Detects the Mac form factor from system model identifier
    private func detectFormFactor() {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)

        guard size > 0 else {
            formFactor = .unknown
            return
        }

        var model = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &model, &size, nil, 0)
        let modelString = String(cString: model)

        // Parse model identifier
        if modelString.hasPrefix("MacBookAir") {
            formFactor = .macBookAir
        } else if modelString.hasPrefix("MacBookPro") {
            formFactor = .macBookPro
        } else if modelString.hasPrefix("Macmini") {
            formFactor = .macMini
        } else if modelString.hasPrefix("MacStudio") || modelString.hasPrefix("Mac14,13") || modelString.hasPrefix("Mac14,14") {
            formFactor = .macStudio
        } else if modelString.hasPrefix("MacPro") {
            formFactor = .macPro
        } else if modelString.hasPrefix("iMac") {
            formFactor = .iMac
        } else {
            formFactor = .unknown
        }

        throttleTemperature = formFactor.throttleTemperature
        print("ThermalPrediction: Detected form factor: \(formFactor.rawValue) (throttle: \(throttleTemperature)°C)")
    }

    // MARK: - Public API

    /// Record a new temperature sample and generate prediction
    func recordTemperature(_ temperature: Double) -> ThermalPrediction {
        // Ensure form factor is detected on first use
        if formFactor == .unknown {
            detectFormFactor()
        }

        let now = Date()
        let sample = ThermalSample(temperature: temperature, timestamp: now)

        // Add to history
        temperatureHistory.append(sample)

        // Trim old samples (keep only last 60 seconds)
        let cutoff = now.addingTimeInterval(-Double(Self.historyWindowSeconds))
        temperatureHistory = temperatureHistory.filter { $0.timestamp > cutoff }

        // Generate prediction
        let prediction = generatePrediction(currentTemp: temperature, at: now)
        lastPrediction = prediction
        return prediction
    }

    /// Get the current form factor
    func getFormFactor() -> DeviceFormFactor {
        return formFactor
    }

    /// Get the last prediction without recording a new sample
    func getLastPrediction() -> ThermalPrediction? {
        return lastPrediction
    }

    /// Whether the device has passive cooling
    func hasPassiveCooling() -> Bool {
        return formFactor.hasPassiveCooling
    }

    /// Whether the device supports High Power Mode
    func supportsHighPowerMode() -> Bool {
        return formFactor.supportsHighPowerMode
    }

    /// Get temperature history for charting
    func getTemperatureHistory() -> [(temperature: Double, timestamp: Date)] {
        return temperatureHistory.map { ($0.temperature, $0.timestamp) }
    }

    // MARK: - Prediction Logic

    private func generatePrediction(currentTemp: Double, at timestamp: Date) -> ThermalPrediction {
        let state = determineThermalState(currentTemp)
        let trend = calculateTemperatureTrend()
        let timeToThrottle = predictTimeToThrottle(currentTemp: currentTemp, trend: trend)
        let recommendation = generateRecommendation(state: state, trend: trend, timeToThrottle: timeToThrottle)

        return ThermalPrediction(
            currentTemperature: currentTemp,
            state: state,
            secondsToThrottle: timeToThrottle,
            temperatureTrend: trend,
            formFactor: formFactor,
            recommendation: recommendation,
            timestamp: timestamp
        )
    }

    private func determineThermalState(_ temperature: Double) -> ThermalState {
        if temperature >= throttleTemperature {
            return .throttling
        } else if temperature >= Self.criticalThreshold {
            return .critical
        } else if temperature >= Self.hotThreshold {
            return .hot
        } else if temperature >= Self.warmThreshold {
            return .warm
        } else {
            return .cool
        }
    }

    /// Calculate temperature trend using linear regression
    private func calculateTemperatureTrend() -> Double {
        guard temperatureHistory.count >= 2 else { return 0 }

        // Use the last 30 seconds for trend calculation
        let recentHistory = temperatureHistory.suffix(30)
        guard recentHistory.count >= 2 else { return 0 }

        // Linear regression: y = mx + b
        // Convert timestamps to seconds from first sample
        let first = recentHistory.first!.timestamp
        let points: [(x: Double, y: Double)] = recentHistory.map {
            (x: $0.timestamp.timeIntervalSince(first), y: $0.temperature)
        }

        let n = Double(points.count)
        let sumX = points.reduce(0) { $0 + $1.x }
        let sumY = points.reduce(0) { $0 + $1.y }
        let sumXY = points.reduce(0) { $0 + $1.x * $1.y }
        let sumXX = points.reduce(0) { $0 + $1.x * $1.x }

        let denominator = n * sumXX - sumX * sumX
        guard denominator != 0 else { return 0 }

        // Slope in °C per second, convert to °C per minute
        let slope = (n * sumXY - sumX * sumY) / denominator
        return slope * 60.0
    }

    /// Predict time until throttle temperature is reached
    private func predictTimeToThrottle(currentTemp: Double, trend: Double) -> Double? {
        // If already throttling or cooling down, no prediction
        guard currentTemp < throttleTemperature else { return 0 }
        guard trend > 0.5 else { return nil }  // Only predict if warming up significantly

        // Temperature needed to reach throttle
        let tempDelta = throttleTemperature - currentTemp

        // Time = delta / (rate per minute) * 60 seconds
        let trendPerSecond = trend / 60.0
        guard trendPerSecond > 0 else { return nil }

        return tempDelta / trendPerSecond
    }

    /// Generate user-facing recommendation
    private func generateRecommendation(state: ThermalState, trend: Double, timeToThrottle: Double?) -> String? {
        switch state {
        case .throttling:
            return "CPU is throttling. Close intensive apps to reduce heat."
        case .critical:
            if formFactor.hasPassiveCooling {
                return "Near throttle threshold. Consider a cooling pad."
            } else {
                return "Near throttle threshold. Ensure vents are clear."
            }
        case .hot:
            if let seconds = timeToThrottle, seconds < 120 {
                let minutes = Int(seconds / 60)
                if minutes > 0 {
                    return "May throttle in ~\(minutes) min at current rate."
                } else {
                    return "May throttle soon at current rate."
                }
            }
            return nil
        case .warm:
            if trend > 3.0 {
                return "Temperature rising quickly."
            }
            return nil
        case .cool:
            return nil
        }
    }
}
