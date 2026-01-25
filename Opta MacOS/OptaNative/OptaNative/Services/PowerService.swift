//
//  PowerService.swift
//  OptaNative
//
//  Service for managing system power states and assertions.
//  Prevents sleep during game sessions to ensure uninterrupted performance.
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import Foundation
import IOKit.pwr_mgt

// MARK: - Models

enum PowerProfile: String, CaseIterable, Identifiable, Sendable {
    case balanced = "Balanced"
    case highPerformance = "High Performance"
    case powerSaver = "Power Saver"
    
    var id: String { rawValue }
    
    var description: String {
        switch self {
        case .balanced: return "Standard system behavior."
        case .highPerformance: return "Prevents sleep and display dimming."
        case .powerSaver: return "Allows aggressive sleeping."
        }
    }
}

// MARK: - Service

actor PowerService {
    
    // MARK: - Properties
    
    private var noSleepAssertionID: IOPMAssertionID = 0
    private var activeProfile: PowerProfile = .balanced
    
    // MARK: - Initialization
    
    init() {}
    
    // MARK: - Profile Management
    
    func setProfile(_ profile: PowerProfile) {
        self.activeProfile = profile
        
        switch profile {
        case .highPerformance:
            enableHighPerformance()
        case .balanced, .powerSaver:
            disableHighPerformance()
        }
    }
    
    func getActiveProfile() -> PowerProfile {
        return activeProfile
    }
    
    // MARK: - Implementation
    
    /// Prevents system sleep and display dimming
    private func enableHighPerformance() {
        guard noSleepAssertionID == 0 else { return }
        
        // PreventIdleSleep + PreventUserIdleDisplaySleep
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
        // Ensure assertion is released if service dies
        if noSleepAssertionID != 0 {
            IOPMAssertionRelease(noSleepAssertionID)
        }
    }
}
