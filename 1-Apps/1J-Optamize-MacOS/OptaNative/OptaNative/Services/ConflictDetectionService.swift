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
        // MARK: - High Severity (Direct Conflicts)
        ConflictDefinition(
            id: "app_tamer",
            name: "App Tamer",
            description: "CPU throttling tool. May interfere with Opta's game prioritization logic.",
            severity: .high,
            recommendation: "Disable App Tamer while gaming or whitelist Opta/Game processes.",
            processNames: ["App Tamer", "AppTamerAgent"]
        ),
        ConflictDefinition(
            id: "turbo_boost_switcher",
            name: "Turbo Boost Switcher",
            description: "Disables CPU Turbo Boost. Directly conflicts with Opta's performance optimization.",
            severity: .high,
            recommendation: "Enable Turbo Boost while gaming for best performance.",
            processNames: ["Turbo Boost Switcher", "tbswitcherd"]
        ),

        // MARK: - Medium Severity (Potential Conflicts)
        ConflictDefinition(
            id: "cleanmymac",
            name: "CleanMyMac",
            description: "System optimization suite that may aggressively clear caches or helper processes Opta relies on.",
            severity: .medium,
            recommendation: "Ensure Opta is added to CleanMyMac's ignore list.",
            processNames: ["CleanMyMac X", "CleanMyMac-Menu", "com.macpaw.CleanMyMac4", "CleanMyMacXHealthMonitor"]
        ),
        ConflictDefinition(
            id: "sensei",
            name: "Sensei",
            description: "System monitor and optimizer. May compete for optimization control.",
            severity: .medium,
            recommendation: "Avoid running concurrent optimization tasks.",
            processNames: ["Sensei", "Sensei Monitor"]
        ),
        ConflictDefinition(
            id: "onyx",
            name: "OnyX",
            description: "System maintenance utility that performs deep cleaning operations.",
            severity: .medium,
            recommendation: "Close OnyX before gaming sessions.",
            processNames: ["OnyX"]
        ),
        ConflictDefinition(
            id: "memory_clean",
            name: "Memory Clean",
            description: "Aggressive memory purger that can cause performance stutters during gaming.",
            severity: .medium,
            recommendation: "Disable automatic purging while Opta is active.",
            processNames: ["Memory Clean", "Memory Clean 3", "com.fiplab.memoryclean3"]
        ),
        ConflictDefinition(
            id: "dr_cleaner",
            name: "Dr. Cleaner",
            description: "System cleaner that runs background scans and may impact performance.",
            severity: .medium,
            recommendation: "Pause background scans during gaming.",
            processNames: ["Dr. Cleaner", "Dr. Unarchiver", "com.trend.cleaner"]
        ),

        // MARK: - Low Severity (Overlapping Features)
        ConflictDefinition(
            id: "istat_menus",
            name: "iStat Menus",
            description: "Menu bar monitoring tool. Running multiple high-frequency polls can increase CPU usage.",
            severity: .low,
            recommendation: "Consider disabling overlapping sensors (e.g. Memory) in one of the apps.",
            processNames: ["iStat Menus Status", "iStatMenusAgent", "com.bjango.istatmenus.status"]
        ),
        ConflictDefinition(
            id: "stats",
            name: "Stats",
            description: "Open-source system monitor. Minimal conflict but duplicates some Opta features.",
            severity: .low,
            recommendation: "Both can run together safely. Consider using Opta as your primary monitor.",
            processNames: ["Stats"]
        ),
        ConflictDefinition(
            id: "menumeters",
            name: "MenuMeters",
            description: "Menu bar resource monitor. Duplicates Opta's telemetry display.",
            severity: .low,
            recommendation: "Safe to run together, but uses extra resources.",
            processNames: ["MenuMeters", "MenuMetersApp"]
        ),
        ConflictDefinition(
            id: "crossover",
            name: "CrossOver",
            description: "Windows compatibility layer. Opta can optimize CrossOver bottles, but monitor for overlay conflicts.",
            severity: .low,
            recommendation: "Opta is compatible. Report any stability issues.",
            processNames: ["CrossOver", "wineloader"]
        ),
        ConflictDefinition(
            id: "parallels",
            name: "Parallels Desktop",
            description: "Virtual machine software. Opta detects and optimizes Parallels workloads.",
            severity: .low,
            recommendation: "Opta is compatible. Use Opta's VM-aware optimization profile.",
            processNames: ["Parallels Desktop", "prl_client_app", "prl_vm_app"]
        ),
        ConflictDefinition(
            id: "gfxcardstatus",
            name: "gfxCardStatus",
            description: "GPU switcher utility. May conflict with Opta's GPU management on Intel Macs.",
            severity: .low,
            recommendation: "Safe on Apple Silicon. On Intel Macs, let Opta manage GPU switching.",
            processNames: ["gfxCardStatus"]
        ),
        ConflictDefinition(
            id: "activity_monitor",
            name: "Activity Monitor",
            description: "Apple's built-in system monitor. Running with high refresh rate uses CPU.",
            severity: .low,
            recommendation: "Close Activity Monitor while gaming for best performance.",
            processNames: ["Activity Monitor"]
        )
    ]
    
    // MARK: - Dependencies
    
    private let processService = ProcessService()
    
    // MARK: - Implementation
    
    /// Scans running processes for specific conflicts.
    func detectConflicts() async -> [ConflictInfo] {
        let runningProcesses = await processService.getRunningProcesses()
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
