//
//  ConflictDetectionService.swift
//  OptaNative
//
//  Service for detecting competing optimization tools that may conflict with Opta.
//  Scans running processes against a known database of conflicting apps.
//  Created for Opta Native macOS - Plan 97-01 (v12.0)
//

import Foundation

// MARK: - Models

enum ConflictSeverity: String, Codable, Sendable {
    case high
    case medium
    case low
    
    var colorName: String {
        switch self {
        case .high: return "red"
        case .medium: return "orange"
        case .low: return "yellow"
        }
    }
}

struct ConflictInfo: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let description: String
    let severity: ConflictSeverity
    let recommendation: String
    let detectedProcesses: [String]
}

struct ConflictDefinition: Sendable {
    let id: String
    let name: String
    let description: String
    let severity: ConflictSeverity
    let recommendation: String
    let processNames: Set<String>
}

// MARK: - Service

actor ConflictDetectionService {
    
    // MARK: - Definitions
    
    /// Database of known conflicting applications
    private let definitions: [ConflictDefinition] = [
        ConflictDefinition(
            id: "cleanmymac",
            name: "CleanMyMac",
            description: "System optimization suite that may aggressively clear caches or helper processes Opta relies on.",
            severity: .medium,
            recommendation: "Ensure Opta is added to CleanMyMac's ignore list.",
            processNames: ["CleanMyMac X", "CleanMyMac-Menu", "com.macpaw.CleanMyMac4", "CleanMyMacXHealthMonitor"]
        ),
        ConflictDefinition(
            id: "istat_menus",
            name: "iStat Menus",
            description: "Menu bar monitoring tool. Running multiple high-frequency polls can increase CPU usage.",
            severity: .low,
            recommendation: "Consider disabling overlapping sensors (e.g. Memory) in one of the apps.",
            processNames: ["iStat Menus Status", "iStatMenusAgent", "com.bjango.istatmenus.status"]
        ),
        ConflictDefinition(
            id: "app_tamer",
            name: "App Tamer",
            description: "CPU throttling tool. May interfere with Opta's game prioritization logic.",
            severity: .high,
            recommendation: "Disable App Tamer while gaming or whitelist Opta/Game processes.",
            processNames: ["App Tamer", "AppTamerAgent"]
        ),
        ConflictDefinition(
            id: "sensei",
            name: "Sensei",
            description: "System monitor and optimizer.",
            severity: .medium,
            recommendation: "Avoid running concurrent optimization tasks.",
            processNames: ["Sensei", "Sensei Monitor"]
        ),
        ConflictDefinition(
            id: "crossover",
            name: "CrossOver",
            description: "Windows compatibility layer. Opta can optimize CrossOver bottles, but ensure not to double-inject overlays.",
            severity: .low,
            recommendation: "Opta is compatible, but monitor for stability.",
            processNames: ["CrossOver", "wineloader"]
        )
    ]
    
    // MARK: - Dependencies
    
    private let processService = ProcessService()
    
    // MARK: - Implementation
    
    /// Scans running processes for specific conflicts.
    func detectConflicts() -> [ConflictInfo] {
        let runningProcesses = processService.getRunningProcesses()
        let runningNames = Set(runningProcesses.map { $0.name })
        
        var detectedConflicts: [ConflictInfo] = []
        
        for def in definitions {
            // Find intersection
            let matches = def.processNames.intersection(runningNames)
            
            if !matches.isEmpty {
                let info = ConflictInfo(
                    id: def.id,
                    name: def.name,
                    description: def.description,
                    severity: def.severity,
                    recommendation: def.recommendation,
                    detectedProcesses: Array(matches).sorted()
                )
                detectedConflicts.append(info)
            }
        }
        
        return detectedConflicts.sorted { $0.severity == .high && $1.severity != .high }
    }
}
