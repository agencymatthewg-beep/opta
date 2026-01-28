//
//  ProcessPriorityPresets.swift
//  OptaNative
//
//  Preset configurations for process priority management.
//  Gaming, Creative, Development modes that boost relevant apps and lower background processes.
//
//  Created for Opta Native macOS - Quick Win 4
//

import Foundation

// MARK: - Priority Preset

struct PriorityPreset: Identifiable, Sendable {
    let id: String
    let name: String
    let description: String
    let icon: String

    /// Processes to boost (lower nice value = higher priority)
    let boostProcesses: [ProcessPattern]

    /// Processes to lower priority
    let throttleProcesses: [ProcessPattern]

    /// Nice value for boosted processes (-20 to 0)
    let boostNiceValue: Int32

    /// Nice value for throttled processes (0 to 20)
    let throttleNiceValue: Int32
}

// MARK: - Process Pattern

struct ProcessPattern: Sendable {
    let name: String
    let matchType: MatchType

    enum MatchType: Sendable {
        case exact           // Exact process name match
        case prefix          // Process name starts with
        case contains        // Process name contains
        case bundleId        // Match by bundle identifier
    }
}

// MARK: - Built-in Presets

extension PriorityPreset {

    /// Gaming preset - boost games, reduce background processes
    static let gaming = PriorityPreset(
        id: "gaming",
        name: "Gaming",
        description: "Boost games and graphics, reduce background apps",
        icon: "gamecontroller.fill",
        boostProcesses: [
            // Game platforms
            ProcessPattern(name: "Steam", matchType: .exact),
            ProcessPattern(name: "steam_osx", matchType: .exact),
            ProcessPattern(name: "steamwebhelper", matchType: .exact),
            ProcessPattern(name: "Epic Games Launcher", matchType: .exact),
            ProcessPattern(name: "Battle.net", matchType: .exact),
            ProcessPattern(name: "GOG Galaxy", matchType: .exact),

            // Common games
            ProcessPattern(name: "Minecraft", matchType: .contains),
            ProcessPattern(name: "Baldur", matchType: .contains),
            ProcessPattern(name: "Divinity", matchType: .contains),
            ProcessPattern(name: "Civilization", matchType: .contains),

            // Graphics/GPU processes
            ProcessPattern(name: "MTLCompilerService", matchType: .exact),
            ProcessPattern(name: "com.apple.metal", matchType: .prefix)
        ],
        throttleProcesses: [
            // Sync services
            ProcessPattern(name: "Dropbox", matchType: .contains),
            ProcessPattern(name: "OneDrive", matchType: .contains),
            ProcessPattern(name: "Google Drive", matchType: .contains),
            ProcessPattern(name: "syncthing", matchType: .exact),

            // Indexing
            ProcessPattern(name: "mds", matchType: .exact),
            ProcessPattern(name: "mds_stores", matchType: .exact),
            ProcessPattern(name: "mdworker", matchType: .prefix),

            // Background apps
            ProcessPattern(name: "Slack", matchType: .exact),
            ProcessPattern(name: "Discord", matchType: .exact),
            ProcessPattern(name: "Microsoft Teams", matchType: .contains),
            ProcessPattern(name: "zoom.us", matchType: .contains),

            // Browsers (when gaming)
            ProcessPattern(name: "Safari", matchType: .exact),
            ProcessPattern(name: "Google Chrome", matchType: .contains),
            ProcessPattern(name: "Firefox", matchType: .exact)
        ],
        boostNiceValue: -10,
        throttleNiceValue: 10
    )

    /// Creative preset - boost Adobe and creative apps
    static let creative = PriorityPreset(
        id: "creative",
        name: "Creative",
        description: "Boost creative and design applications",
        icon: "paintbrush.fill",
        boostProcesses: [
            // Adobe Suite
            ProcessPattern(name: "Adobe Photoshop", matchType: .contains),
            ProcessPattern(name: "Adobe Illustrator", matchType: .contains),
            ProcessPattern(name: "Adobe Premiere", matchType: .contains),
            ProcessPattern(name: "After Effects", matchType: .contains),
            ProcessPattern(name: "Adobe Lightroom", matchType: .contains),
            ProcessPattern(name: "Adobe InDesign", matchType: .contains),
            ProcessPattern(name: "Adobe Media Encoder", matchType: .contains),

            // Other creative apps
            ProcessPattern(name: "Final Cut", matchType: .contains),
            ProcessPattern(name: "Logic Pro", matchType: .contains),
            ProcessPattern(name: "DaVinci Resolve", matchType: .contains),
            ProcessPattern(name: "Blender", matchType: .exact),
            ProcessPattern(name: "Figma", matchType: .exact),
            ProcessPattern(name: "Sketch", matchType: .exact),
            ProcessPattern(name: "Affinity", matchType: .prefix),

            // Rendering
            ProcessPattern(name: "Compressor", matchType: .exact),
            ProcessPattern(name: "HandBrake", matchType: .exact)
        ],
        throttleProcesses: [
            // Communication
            ProcessPattern(name: "Slack", matchType: .exact),
            ProcessPattern(name: "Discord", matchType: .exact),
            ProcessPattern(name: "Microsoft Teams", matchType: .contains),
            ProcessPattern(name: "Messages", matchType: .exact),
            ProcessPattern(name: "Mail", matchType: .exact),

            // Sync
            ProcessPattern(name: "Dropbox", matchType: .contains),
            ProcessPattern(name: "OneDrive", matchType: .contains)
        ],
        boostNiceValue: -10,
        throttleNiceValue: 8
    )

    /// Development preset - boost IDEs and build tools
    static let development = PriorityPreset(
        id: "development",
        name: "Development",
        description: "Boost IDEs, compilers, and dev tools",
        icon: "hammer.fill",
        boostProcesses: [
            // IDEs
            ProcessPattern(name: "Xcode", matchType: .exact),
            ProcessPattern(name: "Code", matchType: .exact),  // VS Code
            ProcessPattern(name: "IntelliJ", matchType: .contains),
            ProcessPattern(name: "WebStorm", matchType: .contains),
            ProcessPattern(name: "PyCharm", matchType: .contains),
            ProcessPattern(name: "Android Studio", matchType: .contains),
            ProcessPattern(name: "Cursor", matchType: .exact),

            // Build tools
            ProcessPattern(name: "swift", matchType: .exact),
            ProcessPattern(name: "swiftc", matchType: .exact),
            ProcessPattern(name: "clang", matchType: .exact),
            ProcessPattern(name: "SourceKitService", matchType: .exact),
            ProcessPattern(name: "swift-frontend", matchType: .exact),
            ProcessPattern(name: "IBAgent", matchType: .exact),

            // Package managers
            ProcessPattern(name: "node", matchType: .exact),
            ProcessPattern(name: "npm", matchType: .exact),
            ProcessPattern(name: "cargo", matchType: .exact),
            ProcessPattern(name: "rustc", matchType: .exact),

            // Simulators
            ProcessPattern(name: "Simulator", matchType: .exact),
            ProcessPattern(name: "simctl", matchType: .exact),

            // Terminals
            ProcessPattern(name: "Terminal", matchType: .exact),
            ProcessPattern(name: "iTerm2", matchType: .exact),
            ProcessPattern(name: "Warp", matchType: .exact)
        ],
        throttleProcesses: [
            // Communication
            ProcessPattern(name: "Slack", matchType: .exact),
            ProcessPattern(name: "Discord", matchType: .exact),
            ProcessPattern(name: "zoom.us", matchType: .contains),

            // Entertainment
            ProcessPattern(name: "Music", matchType: .exact),
            ProcessPattern(name: "Spotify", matchType: .exact),
            ProcessPattern(name: "TV", matchType: .exact)
        ],
        boostNiceValue: -8,
        throttleNiceValue: 5
    )

    /// Focus preset - minimal distractions
    static let focus = PriorityPreset(
        id: "focus",
        name: "Focus",
        description: "Minimize distractions, boost current app",
        icon: "eye.fill",
        boostProcesses: [],  // Current frontmost app
        throttleProcesses: [
            // All communication
            ProcessPattern(name: "Slack", matchType: .exact),
            ProcessPattern(name: "Discord", matchType: .exact),
            ProcessPattern(name: "Microsoft Teams", matchType: .contains),
            ProcessPattern(name: "zoom.us", matchType: .contains),
            ProcessPattern(name: "Messages", matchType: .exact),
            ProcessPattern(name: "Mail", matchType: .exact),
            ProcessPattern(name: "Telegram", matchType: .exact),
            ProcessPattern(name: "WhatsApp", matchType: .exact),

            // Social
            ProcessPattern(name: "Twitter", matchType: .contains),
            ProcessPattern(name: "Facebook", matchType: .contains),

            // Entertainment
            ProcessPattern(name: "Music", matchType: .exact),
            ProcessPattern(name: "Spotify", matchType: .exact),
            ProcessPattern(name: "TV", matchType: .exact),
            ProcessPattern(name: "Netflix", matchType: .contains)
        ],
        boostNiceValue: -5,
        throttleNiceValue: 15
    )

    /// All presets
    static let allPresets: [PriorityPreset] = [
        .gaming,
        .creative,
        .development,
        .focus
    ]
}

// MARK: - Priority Preset Service

actor PriorityPresetService {

    // MARK: - State

    private var activePreset: PriorityPreset?
    private var modifiedProcesses: [pid_t: Int32] = [:]  // PID -> original nice value

    // MARK: - Apply Preset

    /// Apply a priority preset
    func applyPreset(_ preset: PriorityPreset) async -> PresetResult {
        // First revert any existing preset
        if activePreset != nil {
            _ = await revertPreset()
        }

        var boostedCount = 0
        var throttledCount = 0
        var errors: [String] = []

        // Apply boosts
        for pattern in preset.boostProcesses {
            let pids = findProcesses(matching: pattern)
            for pid in pids {
                if adjustPriority(pid: pid, niceValue: preset.boostNiceValue) {
                    boostedCount += 1
                } else {
                    errors.append("Failed to boost PID \(pid)")
                }
            }
        }

        // Apply throttles
        for pattern in preset.throttleProcesses {
            let pids = findProcesses(matching: pattern)
            for pid in pids {
                if adjustPriority(pid: pid, niceValue: preset.throttleNiceValue) {
                    throttledCount += 1
                } else {
                    errors.append("Failed to throttle PID \(pid)")
                }
            }
        }

        activePreset = preset

        return PresetResult(
            success: errors.isEmpty,
            presetName: preset.name,
            boostedProcesses: boostedCount,
            throttledProcesses: throttledCount,
            errors: errors
        )
    }

    /// Revert all priority changes
    func revertPreset() async -> Bool {
        guard activePreset != nil else { return true }

        var allSuccess = true

        for (pid, originalNice) in modifiedProcesses {
            let result = setpriority(PRIO_PROCESS, id_t(pid), originalNice)
            if result != 0 {
                allSuccess = false
            }
        }

        modifiedProcesses.removeAll()
        activePreset = nil

        return allSuccess
    }

    /// Get active preset
    func getActivePreset() -> PriorityPreset? {
        return activePreset
    }

    // MARK: - Process Management

    private func findProcesses(matching pattern: ProcessPattern) -> [pid_t] {
        var pids: [pid_t] = []

        // Use pgrep to find matching processes
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")

        switch pattern.matchType {
        case .exact:
            task.arguments = ["-x", pattern.name]
        case .prefix:
            task.arguments = ["-f", "^\(pattern.name)"]
        case .contains:
            task.arguments = ["-f", pattern.name]
        case .bundleId:
            // For bundle IDs, we'd need a different approach
            task.arguments = ["-f", pattern.name]
        }

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                let pidStrings = output.components(separatedBy: .newlines)
                for pidStr in pidStrings {
                    if let pid = pid_t(pidStr.trimmingCharacters(in: .whitespaces)) {
                        pids.append(pid)
                    }
                }
            }
        } catch {
            print("PriorityPreset: Failed to find processes: \(error)")
        }

        return pids
    }

    private func adjustPriority(pid: pid_t, niceValue: Int32) -> Bool {
        // Get current priority
        errno = 0
        let currentNice = getpriority(PRIO_PROCESS, id_t(pid))
        if errno != 0 && currentNice == -1 {
            return false
        }

        // Store original if not already stored
        if modifiedProcesses[pid] == nil {
            modifiedProcesses[pid] = currentNice
        }

        // Set new priority
        let result = setpriority(PRIO_PROCESS, id_t(pid), niceValue)
        return result == 0
    }
}

// MARK: - Preset Result

struct PresetResult: Sendable {
    let success: Bool
    let presetName: String
    let boostedProcesses: Int
    let throttledProcesses: Int
    let errors: [String]

    var summary: String {
        if success {
            return "\(presetName) mode active: \(boostedProcesses) boosted, \(throttledProcesses) throttled"
        } else {
            return "\(presetName) mode partially applied: \(errors.count) errors"
        }
    }
}
