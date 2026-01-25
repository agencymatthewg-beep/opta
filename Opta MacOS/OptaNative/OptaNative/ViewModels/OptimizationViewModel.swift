//
//  OptimizationViewModel.swift
//  OptaNative
//
//  View model for Advanced Optimization (Network & Power).
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import SwiftUI

@Observable
@MainActor
class OptimizationViewModel {
    
    // MARK: - Published Properties
    
    // Power
    var activePowerProfile: PowerProfile = .balanced
    
    // Network
    var latencies: [LatencyResult] = []
    var isCheckingLatency: Bool = false
    var lastCheckDate: Date?
    
    // MARK: - Dependencies
    
    private let powerService = PowerService()
    private let networkService = NetworkLatencyService()
    
    // MARK: - Initialization
    
    init() {
        Task {
            await refreshState()
        }
    }
    
    // MARK: - Actions
    
    func setPowerProfile(_ profile: PowerProfile) {
        Task {
            await powerService.setProfile(profile)
            await refreshPowerState()
        }
    }
    
    func checkNetworkLatency() {
        guard !isCheckingLatency else { return }
        isCheckingLatency = true
        
        Task {
            let results = await networkService.pingAll()
            self.latencies = results
            self.lastCheckDate = Date()
            self.isCheckingLatency = false
        }
    }
    
    // MARK: - State Sync
    
    private func refreshState() async {
        await refreshPowerState()
        // Don't auto-ping on init to avoid traffic, wait for user or view appear
    }
    
    private func refreshPowerState() async {
        self.activePowerProfile = await powerService.getActiveProfile()
    }
}
