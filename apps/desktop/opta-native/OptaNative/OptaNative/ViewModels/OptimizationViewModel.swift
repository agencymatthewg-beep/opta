//
//  OptimizationViewModel.swift
//  OptaNative
//
//  View model for Advanced Optimization (Network & Power).
//  Enhanced with auto-switch, battery monitoring, and network analysis.
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import SwiftUI

@Observable
@MainActor
class OptimizationViewModel {

    // MARK: - Published Properties

    // Power
    var activePowerProfile: PowerProfile = .balanced
    var batteryStatus: BatteryStatus?
    var autoSwitchEnabled: Bool = false
    var highPowerModeStatus: HighPowerModeStatus?

    // Network
    var networkAnalysis: NetworkAnalysis?
    var isAnalyzingNetwork: Bool = false
    var lastAnalysisDate: Date?

    // Legacy compatibility
    var latencies: [LatencyResult] {
        networkAnalysis?.results ?? []
    }
    var isCheckingLatency: Bool {
        isAnalyzingNetwork
    }
    var lastCheckDate: Date? {
        lastAnalysisDate
    }

    // MARK: - Dependencies

    private let powerService = PowerService()
    private let networkService = NetworkLatencyService()
    private let patternService = PatternLearningService()

    // MARK: - Initialization

    init() {
        Task {
            await refreshState()
        }
    }

    // MARK: - Power Actions

    func setPowerProfile(_ profile: PowerProfile, forGame gameName: String? = nil) {
        let previousProfile = activePowerProfile

        Task {
            await powerService.setProfile(profile)
            await refreshPowerState()

            // Track optimization patterns
            let context = gameName ?? "System"

            // Gaming or High Performance mode = optimization ON
            if (profile == .gaming || profile == .highPerformance) &&
               (previousProfile != .gaming && previousProfile != .highPerformance) {
                await patternService.trackEvent(.optimizeOn, context: context)
            }

            // Switching away from gaming/high perf = optimization OFF
            if (previousProfile == .gaming || previousProfile == .highPerformance) &&
               (profile != .gaming && profile != .highPerformance) {
                await patternService.trackEvent(.optimizeOff, context: context)
            }
        }
    }

    func toggleAutoSwitch() {
        autoSwitchEnabled.toggle()
        Task {
            await powerService.setAutoSwitch(enabled: autoSwitchEnabled)
        }
    }

    // MARK: - Network Actions

    func checkNetworkLatency() {
        analyzeNetwork()
    }

    func analyzeNetwork() {
        guard !isAnalyzingNetwork else { return }
        isAnalyzingNetwork = true

        Task {
            let analysis = await networkService.analyzeNetwork()
            self.networkAnalysis = analysis
            self.lastAnalysisDate = Date()
            self.isAnalyzingNetwork = false
        }
    }

    // MARK: - Battery Info

    func refreshBatteryStatus() {
        Task {
            self.batteryStatus = await powerService.getBatteryStatus()
        }
    }

    /// Get estimated runtime for a profile
    func estimatedRuntime(for profile: PowerProfile) -> String {
        guard let battery = batteryStatus, battery.isPresent else {
            return "N/A"
        }

        // Use power service for more accurate estimate
        Task {
            let hours = await powerService.estimateRuntime(for: profile)
            // This is async but we need sync result - use approximation
        }

        // Fallback: rough estimate based on current capacity and profile watts
        let capacityPercent = Double(battery.currentCapacity) / 100.0
        let estimatedWh = 70.0 * capacityPercent // Assume ~70Wh battery
        let hours = estimatedWh / profile.estimatedWatts

        if hours < 1 {
            return String(format: "%.0f min", hours * 60)
        }
        return String(format: "%.1f hrs", hours)
    }

    // MARK: - State Sync

    private func refreshState() async {
        await refreshPowerState()
        self.batteryStatus = await powerService.getBatteryStatus()
        self.highPowerModeStatus = await powerService.getHighPowerModeStatus()
        self.autoSwitchEnabled = await powerService.isAutoSwitchEnabled()
    }

    private func refreshPowerState() async {
        self.activePowerProfile = await powerService.getActiveProfile()
        self.highPowerModeStatus = await powerService.getHighPowerModeStatus()
    }

    // MARK: - Auto-Switch Logic

    /// Check if profile should auto-switch based on patterns
    func checkAutoSwitch(for context: String) async -> PowerProfile? {
        guard autoSwitchEnabled else { return nil }

        let shouldOptimize = await patternService.shouldSuggestOptimization(for: context)
        if shouldOptimize {
            return .gaming
        }
        return nil
    }
}
