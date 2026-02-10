//
//  DefaultsOptimizerService.swift
//  OptaNative
//
//  One-click macOS optimizations via defaults commands.
//  Provides reversible system tweaks for improved responsiveness.
//
//  Created for Opta Native macOS - Phase 99
//

import Foundation

// MARK: - Optimization Category

enum OptimizationCategory: String, CaseIterable, Identifiable, Sendable {
    case dock = "Dock"
    case finder = "Finder"
    case screenshots = "Screenshots"
    case animations = "Animations"
    case keyboard = "Keyboard"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .dock: return "dock.rectangle"
        case .finder: return "folder.fill"
        case .screenshots: return "camera.viewfinder"
        case .animations: return "wand.and.stars"
        case .keyboard: return "keyboard"
        }
    }

    var description: String {
        switch self {
        case .dock: return "Speed up Dock animations and response"
        case .finder: return "Enhance Finder functionality"
        case .screenshots: return "Cleaner screenshot captures"
        case .animations: return "Reduce animation delays"
        case .keyboard: return "Faster key repeat and response"
        }
    }
}

// MARK: - Defaults Optimization

struct DefaultsOptimization: Identifiable, Sendable {
    let id: String
    let name: String
    let description: String
    let domain: String
    let key: String
    let optimizedValue: OptimizationValue
    let defaultValue: OptimizationValue
    let category: OptimizationCategory
    let requiresRestart: RestartRequirement
    let impactLevel: ImpactLevel

    enum RestartRequirement: Sendable {
        case none
        case killProcess(String)  // Process name to kill (e.g., "Dock", "Finder")
        case logout
    }

    enum ImpactLevel: String, Sendable {
        case low = "Low"
        case medium = "Medium"
        case high = "High"
    }
}

// MARK: - Optimization Value

enum OptimizationValue: Sendable, Equatable {
    case bool(Bool)
    case int(Int)
    case float(Double)
    case string(String)

    var stringRepresentation: String {
        switch self {
        case .bool(let v): return v ? "true" : "false"
        case .int(let v): return String(v)
        case .float(let v): return String(v)
        case .string(let v): return v
        }
    }

    var typeFlag: String {
        switch self {
        case .bool: return "-bool"
        case .int: return "-int"
        case .float: return "-float"
        case .string: return "-string"
        }
    }
}

// MARK: - Optimization State

struct OptimizationState: Sendable {
    let optimization: DefaultsOptimization
    var isApplied: Bool
    var currentValue: OptimizationValue?
}

// MARK: - Defaults Optimizer Service

actor DefaultsOptimizerService {

    // MARK: - Predefined Optimizations

    static let optimizations: [DefaultsOptimization] = [
        // MARK: Dock Optimizations
        DefaultsOptimization(
            id: "dock-autohide-delay",
            name: "Remove Dock Auto-Hide Delay",
            description: "Eliminates the 0.5s delay before the Dock appears when hidden",
            domain: "com.apple.dock",
            key: "autohide-delay",
            optimizedValue: .float(0.0),
            defaultValue: .float(0.5),
            category: .dock,
            requiresRestart: .killProcess("Dock"),
            impactLevel: .high
        ),
        DefaultsOptimization(
            id: "dock-animation-speed",
            name: "Faster Dock Animations",
            description: "Speeds up Dock show/hide animation from 0.5s to 0.15s",
            domain: "com.apple.dock",
            key: "autohide-time-modifier",
            optimizedValue: .float(0.15),
            defaultValue: .float(0.5),
            category: .dock,
            requiresRestart: .killProcess("Dock"),
            impactLevel: .medium
        ),
        DefaultsOptimization(
            id: "dock-minimize-effect",
            name: "Scale Minimize Effect",
            description: "Use faster scale effect instead of genie when minimizing windows",
            domain: "com.apple.dock",
            key: "mineffect",
            optimizedValue: .string("scale"),
            defaultValue: .string("genie"),
            category: .dock,
            requiresRestart: .killProcess("Dock"),
            impactLevel: .medium
        ),
        DefaultsOptimization(
            id: "dock-spring-loading",
            name: "Faster Spring Loading",
            description: "Reduce delay when dragging files over Dock folders",
            domain: "com.apple.dock",
            key: "springboard-show-duration",
            optimizedValue: .float(0.1),
            defaultValue: .float(0.5),
            category: .dock,
            requiresRestart: .killProcess("Dock"),
            impactLevel: .low
        ),

        // MARK: Finder Optimizations
        DefaultsOptimization(
            id: "finder-quit-menu",
            name: "Enable Finder Quit Option",
            description: "Adds Quit menu item to Finder (Cmd+Q)",
            domain: "com.apple.finder",
            key: "QuitMenuItem",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .finder,
            requiresRestart: .killProcess("Finder"),
            impactLevel: .low
        ),
        DefaultsOptimization(
            id: "finder-show-extensions",
            name: "Show All File Extensions",
            description: "Always display file extensions in Finder",
            domain: "NSGlobalDomain",
            key: "AppleShowAllExtensions",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .finder,
            requiresRestart: .killProcess("Finder"),
            impactLevel: .low
        ),
        DefaultsOptimization(
            id: "finder-show-hidden",
            name: "Show Hidden Files",
            description: "Display hidden files and folders in Finder",
            domain: "com.apple.finder",
            key: "AppleShowAllFiles",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .finder,
            requiresRestart: .killProcess("Finder"),
            impactLevel: .low
        ),
        DefaultsOptimization(
            id: "finder-path-bar",
            name: "Show Path Bar",
            description: "Display full path at bottom of Finder windows",
            domain: "com.apple.finder",
            key: "ShowPathbar",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .finder,
            requiresRestart: .killProcess("Finder"),
            impactLevel: .low
        ),

        // MARK: Screenshot Optimizations
        DefaultsOptimization(
            id: "screenshot-no-shadow",
            name: "Remove Screenshot Shadows",
            description: "Capture window screenshots without drop shadows",
            domain: "com.apple.screencapture",
            key: "disable-shadow",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .screenshots,
            requiresRestart: .none,
            impactLevel: .medium
        ),
        DefaultsOptimization(
            id: "screenshot-format-png",
            name: "PNG Screenshot Format",
            description: "Save screenshots as PNG (lossless) instead of JPEG",
            domain: "com.apple.screencapture",
            key: "type",
            optimizedValue: .string("png"),
            defaultValue: .string("png"),
            category: .screenshots,
            requiresRestart: .none,
            impactLevel: .low
        ),

        // MARK: Animation Optimizations
        DefaultsOptimization(
            id: "window-resize-speed",
            name: "Faster Window Resizing",
            description: "Speed up window resize animations",
            domain: "NSGlobalDomain",
            key: "NSWindowResizeTime",
            optimizedValue: .float(0.001),
            defaultValue: .float(0.2),
            category: .animations,
            requiresRestart: .none,
            impactLevel: .high
        ),
        DefaultsOptimization(
            id: "reduce-motion",
            name: "Reduce Motion Effects",
            description: "Minimize system-wide animations for snappier feel",
            domain: "com.apple.universalaccess",
            key: "reduceMotion",
            optimizedValue: .bool(true),
            defaultValue: .bool(false),
            category: .animations,
            requiresRestart: .none,
            impactLevel: .high
        ),
        DefaultsOptimization(
            id: "launchpad-animation",
            name: "Faster Launchpad Animation",
            description: "Speed up Launchpad open/close animation",
            domain: "com.apple.dock",
            key: "springboard-show-duration",
            optimizedValue: .float(0.1),
            defaultValue: .float(1.0),
            category: .animations,
            requiresRestart: .killProcess("Dock"),
            impactLevel: .medium
        ),

        // MARK: Keyboard Optimizations
        DefaultsOptimization(
            id: "key-repeat-rate",
            name: "Faster Key Repeat",
            description: "Increase keyboard repeat rate (lower = faster)",
            domain: "NSGlobalDomain",
            key: "KeyRepeat",
            optimizedValue: .int(1),
            defaultValue: .int(6),
            category: .keyboard,
            requiresRestart: .none,
            impactLevel: .high
        ),
        DefaultsOptimization(
            id: "key-repeat-delay",
            name: "Shorter Key Repeat Delay",
            description: "Reduce delay before key repeat starts",
            domain: "NSGlobalDomain",
            key: "InitialKeyRepeat",
            optimizedValue: .int(10),
            defaultValue: .int(25),
            category: .keyboard,
            requiresRestart: .none,
            impactLevel: .high
        ),
        DefaultsOptimization(
            id: "disable-press-hold",
            name: "Disable Press-and-Hold",
            description: "Allow key repeat instead of accent menu when holding keys",
            domain: "NSGlobalDomain",
            key: "ApplePressAndHoldEnabled",
            optimizedValue: .bool(false),
            defaultValue: .bool(true),
            category: .keyboard,
            requiresRestart: .none,
            impactLevel: .medium
        ),
    ]

    // MARK: - State

    private var appliedOptimizations: Set<String> = []

    // MARK: - Public API

    /// Get all optimizations with their current state
    func getAllOptimizations() async -> [OptimizationState] {
        var states: [OptimizationState] = []

        for optimization in Self.optimizations {
            let currentValue = await readCurrentValue(optimization)
            let isApplied = currentValue == optimization.optimizedValue

            states.append(OptimizationState(
                optimization: optimization,
                isApplied: isApplied,
                currentValue: currentValue
            ))
        }

        return states
    }

    /// Get optimizations grouped by category
    func getOptimizationsByCategory() async -> [OptimizationCategory: [OptimizationState]] {
        let states = await getAllOptimizations()
        return Dictionary(grouping: states) { $0.optimization.category }
    }

    /// Apply a single optimization
    func applyOptimization(_ optimization: DefaultsOptimization) async throws {
        try await writeValue(optimization.optimizedValue, to: optimization)
        await handleRestart(optimization.requiresRestart)
        appliedOptimizations.insert(optimization.id)
        print("DefaultsOptimizer: Applied \(optimization.name)")
    }

    /// Revert a single optimization to default
    func revertOptimization(_ optimization: DefaultsOptimization) async throws {
        try await writeValue(optimization.defaultValue, to: optimization)
        await handleRestart(optimization.requiresRestart)
        appliedOptimizations.remove(optimization.id)
        print("DefaultsOptimizer: Reverted \(optimization.name)")
    }

    /// Apply all optimizations in a category
    func applyCategory(_ category: OptimizationCategory) async throws {
        let categoryOptimizations = Self.optimizations.filter { $0.category == category }
        var needsRestart: Set<String> = []

        for optimization in categoryOptimizations {
            try await writeValue(optimization.optimizedValue, to: optimization)
            appliedOptimizations.insert(optimization.id)

            if case .killProcess(let process) = optimization.requiresRestart {
                needsRestart.insert(process)
            }
        }

        // Batch restart processes
        for process in needsRestart {
            await killProcess(process)
        }

        print("DefaultsOptimizer: Applied all \(category.rawValue) optimizations")
    }

    /// Revert all optimizations in a category
    func revertCategory(_ category: OptimizationCategory) async throws {
        let categoryOptimizations = Self.optimizations.filter { $0.category == category }
        var needsRestart: Set<String> = []

        for optimization in categoryOptimizations {
            try await writeValue(optimization.defaultValue, to: optimization)
            appliedOptimizations.remove(optimization.id)

            if case .killProcess(let process) = optimization.requiresRestart {
                needsRestart.insert(process)
            }
        }

        // Batch restart processes
        for process in needsRestart {
            await killProcess(process)
        }

        print("DefaultsOptimizer: Reverted all \(category.rawValue) optimizations")
    }

    /// Apply all optimizations
    func applyAll() async throws {
        for category in OptimizationCategory.allCases {
            try await applyCategory(category)
        }
    }

    /// Revert all optimizations to defaults
    func revertAll() async throws {
        for category in OptimizationCategory.allCases {
            try await revertCategory(category)
        }
    }

    /// Count applied optimizations
    func appliedCount() -> Int {
        appliedOptimizations.count
    }

    // MARK: - Private Helpers

    private func readCurrentValue(_ optimization: DefaultsOptimization) async -> OptimizationValue? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
        process.arguments = ["read", optimization.domain, optimization.key]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) else {
                return nil
            }

            // Parse based on expected type
            switch optimization.optimizedValue {
            case .bool:
                if output == "1" || output.lowercased() == "true" {
                    return .bool(true)
                } else if output == "0" || output.lowercased() == "false" {
                    return .bool(false)
                }
            case .int:
                if let intValue = Int(output) {
                    return .int(intValue)
                }
            case .float:
                if let doubleValue = Double(output) {
                    return .float(doubleValue)
                }
            case .string:
                return .string(output)
            }

            return nil
        } catch {
            return nil
        }
    }

    private func writeValue(_ value: OptimizationValue, to optimization: DefaultsOptimization) async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
        process.arguments = [
            "write",
            optimization.domain,
            optimization.key,
            value.typeFlag,
            value.stringRepresentation
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe

        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw DefaultsOptimizerError.writeFailure(optimization.key, errorMessage)
        }
    }

    private func handleRestart(_ requirement: DefaultsOptimization.RestartRequirement) async {
        switch requirement {
        case .none:
            break
        case .killProcess(let processName):
            await killProcess(processName)
        case .logout:
            // Don't auto-logout, just notify
            print("DefaultsOptimizer: Logout required to apply changes")
        }
    }

    private func killProcess(_ name: String) async {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
        process.arguments = [name]
        process.standardError = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            print("DefaultsOptimizer: Failed to restart \(name)")
        }
    }
}

// MARK: - Errors

enum DefaultsOptimizerError: Error, LocalizedError {
    case writeFailure(String, String)
    case readFailure(String)

    var errorDescription: String? {
        switch self {
        case .writeFailure(let key, let message):
            return "Failed to write \(key): \(message)"
        case .readFailure(let key):
            return "Failed to read \(key)"
        }
    }
}
