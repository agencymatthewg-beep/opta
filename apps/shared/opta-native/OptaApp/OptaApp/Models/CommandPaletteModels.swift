//
//  CommandPaletteModels.swift
//  OptaApp
//
//  Command palette action types, registry, and fuzzy search logic.
//  Supports navigation, quick actions, settings toggles, and quality levels.
//

import Foundation

// MARK: - Command Category

/// Categories for organizing commands in the palette
enum CommandCategory: String, CaseIterable {
    case navigation = "Navigation"
    case action = "Actions"
    case settings = "Settings"
    case quality = "Quality"

    var sortOrder: Int {
        switch self {
        case .navigation: return 0
        case .action: return 1
        case .settings: return 2
        case .quality: return 3
        }
    }
}

// MARK: - Command Action

/// A single command that can be executed from the palette
struct CommandAction: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String
    let category: CommandCategory
    let shortcut: String?
    let action: () -> Void
}

// MARK: - Command Palette View Model

/// Observable view model managing the command palette state
@Observable
class CommandPaletteViewModel {

    // MARK: - State

    /// Whether the palette overlay is visible
    var isPresented: Bool = false

    /// Current search text for filtering commands
    var searchText: String = ""

    /// Index of the currently selected/highlighted command
    var selectedIndex: Int = 0

    /// Recently used command IDs (max 5, persisted)
    var recentCommandIds: [String] = []

    /// All registered commands
    private(set) var registry: [CommandAction] = []

    // MARK: - Constants

    private let maxRecents = 5
    private let recentsKey = "CommandPalette.recentCommandIds"

    // MARK: - Init

    init() {
        loadRecents()
    }

    // MARK: - Computed

    /// Commands filtered by search text, ordered by relevance
    var filteredCommands: [CommandAction] {
        if searchText.isEmpty {
            // Show recents first, then all commands grouped by category
            let recents = recentCommandIds.compactMap { id in
                registry.first { $0.id == id }
            }
            let remaining = registry.filter { cmd in
                !recentCommandIds.contains(cmd.id)
            }.sorted { $0.category.sortOrder < $1.category.sortOrder }

            return recents + remaining
        } else {
            // Fuzzy filter by search text
            return registry.filter { cmd in
                fuzzyMatch(searchText, in: cmd.title) ||
                fuzzyMatch(searchText, in: cmd.category.rawValue) ||
                (cmd.subtitle.map { fuzzyMatch(searchText, in: $0) } ?? false)
            }.sorted { lhs, rhs in
                // Exact prefix matches first
                let lhsPrefix = lhs.title.lowercased().hasPrefix(searchText.lowercased())
                let rhsPrefix = rhs.title.lowercased().hasPrefix(searchText.lowercased())
                if lhsPrefix != rhsPrefix { return lhsPrefix }
                return lhs.category.sortOrder < rhs.category.sortOrder
            }
        }
    }

    /// Whether recents section should be shown
    var showRecents: Bool {
        searchText.isEmpty && !recentCommandIds.isEmpty
    }

    /// Number of recent commands displayed
    var recentsCount: Int {
        recentCommandIds.compactMap { id in
            registry.first { $0.id == id }
        }.count
    }

    // MARK: - Actions

    /// Toggle the palette visibility, resetting state when opening
    func toggle() {
        if isPresented {
            dismiss()
        } else {
            searchText = ""
            selectedIndex = 0
            isPresented = true
        }
    }

    /// Dismiss the palette
    func dismiss() {
        isPresented = false
        searchText = ""
        selectedIndex = 0
    }

    /// Execute a command, record it as recent, and dismiss
    func execute(_ command: CommandAction) {
        command.action()
        addToRecents(command.id)
        dismiss()
    }

    /// Execute the command at the current selectedIndex
    func executeSelected() {
        let commands = filteredCommands
        guard !commands.isEmpty, selectedIndex >= 0, selectedIndex < commands.count else { return }
        execute(commands[selectedIndex])
    }

    /// Move selection up or down (wraps around)
    func moveSelection(_ direction: Int) {
        let count = filteredCommands.count
        guard count > 0 else { return }
        selectedIndex = (selectedIndex + direction + count) % count
    }

    // MARK: - Registration

    /// Register default commands with navigation and notification closures
    func registerDefaults(
        navigate: @escaping (PageViewModel) -> Void,
        post: @escaping (Notification.Name) -> Void,
        setQuality: @escaping (QualityLevel) -> Void,
        togglePause: @escaping () -> Void,
        toggleAgent: @escaping () -> Void
    ) {
        var commands: [CommandAction] = []

        // Navigation commands
        commands.append(CommandAction(
            id: "nav.dashboard",
            title: "Go to Dashboard",
            subtitle: "System overview and telemetry",
            icon: "house.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.dashboard) }
        ))
        commands.append(CommandAction(
            id: "nav.games",
            title: "Go to Games",
            subtitle: "Game library and optimization",
            icon: "gamecontroller.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.games) }
        ))
        commands.append(CommandAction(
            id: "nav.settings",
            title: "Go to Settings",
            subtitle: "Preferences and profiles",
            icon: "gearshape.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.settings) }
        ))
        commands.append(CommandAction(
            id: "nav.optimize",
            title: "Go to Optimize",
            subtitle: "System optimization controls",
            icon: "bolt.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.optimize) }
        ))
        commands.append(CommandAction(
            id: "nav.aiChat",
            title: "Go to AI Chat",
            subtitle: "Chat with Opta AI assistant",
            icon: "message.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.aiChat) }
        ))
        commands.append(CommandAction(
            id: "nav.processes",
            title: "Go to Processes",
            subtitle: "Running processes and management",
            icon: "cpu",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.processes) }
        ))
        commands.append(CommandAction(
            id: "nav.score",
            title: "Go to Score",
            subtitle: "Score breakdown and history",
            icon: "chart.bar.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.score) }
        ))
        commands.append(CommandAction(
            id: "nav.gamification",
            title: "View Achievements",
            subtitle: "Badges, streaks & challenges",
            icon: "trophy.fill",
            category: .navigation,
            shortcut: nil,
            action: { navigate(.gamification) }
        ))

        // Action commands
        commands.append(CommandAction(
            id: "action.quickOptimize",
            title: "Quick Optimize",
            subtitle: "Run one-click optimization",
            icon: "bolt.circle.fill",
            category: .action,
            shortcut: "Cmd+Shift+P",
            action: { post(.performQuickOptimize) }
        ))
        commands.append(CommandAction(
            id: "action.toggleFPS",
            title: "Toggle FPS Overlay",
            subtitle: "Show/hide frame rate display",
            icon: "speedometer",
            category: .action,
            shortcut: "Cmd+Shift+F",
            action: { post(.toggleFPSOverlay) }
        ))
        commands.append(CommandAction(
            id: "action.pauseRendering",
            title: "Pause Rendering",
            subtitle: "Pause/resume GPU rendering",
            icon: "pause.circle",
            category: .action,
            shortcut: "Cmd+.",
            action: { togglePause() }
        ))
        commands.append(CommandAction(
            id: "action.toggleAgent",
            title: "Toggle Agent Mode",
            subtitle: "Minimize to menu bar agent",
            icon: "eye.slash",
            category: .action,
            shortcut: "Cmd+Shift+H",
            action: { toggleAgent() }
        ))
        commands.append(CommandAction(
            id: "action.checkUpdates",
            title: "Check for Updates",
            subtitle: "Check for app updates",
            icon: "arrow.triangle.2.circlepath",
            category: .action,
            shortcut: "Cmd+U",
            action: { post(.checkForUpdates) }
        ))

        // Quality commands
        let qualityLevels: [(QualityLevel, String, String)] = [
            (.low, "Quality: Low", "Minimum GPU usage"),
            (.medium, "Quality: Medium", "Balanced performance"),
            (.high, "Quality: High", "High fidelity rendering"),
            (.ultra, "Quality: Ultra", "Maximum visual quality"),
            (.adaptive, "Quality: Adaptive", "Auto-adjust to system load")
        ]
        for (level, title, subtitle) in qualityLevels {
            commands.append(CommandAction(
                id: "quality.\(level)",
                title: title,
                subtitle: subtitle,
                icon: "sparkles",
                category: .quality,
                shortcut: nil,
                action: { setQuality(level) }
            ))
        }

        registry = commands
    }

    // MARK: - Fuzzy Match

    /// Check if all characters of query appear in order within text
    private func fuzzyMatch(_ query: String, in text: String) -> Bool {
        let queryLower = query.lowercased()
        let textLower = text.lowercased()

        var queryIndex = queryLower.startIndex
        var textIndex = textLower.startIndex

        while queryIndex < queryLower.endIndex && textIndex < textLower.endIndex {
            if queryLower[queryIndex] == textLower[textIndex] {
                queryIndex = queryLower.index(after: queryIndex)
            }
            textIndex = textLower.index(after: textIndex)
        }

        return queryIndex == queryLower.endIndex
    }

    // MARK: - Recents Persistence

    private func addToRecents(_ id: String) {
        recentCommandIds.removeAll { $0 == id }
        recentCommandIds.insert(id, at: 0)
        if recentCommandIds.count > maxRecents {
            recentCommandIds = Array(recentCommandIds.prefix(maxRecents))
        }
        saveRecents()
    }

    private func saveRecents() {
        UserDefaults.standard.set(recentCommandIds, forKey: recentsKey)
    }

    private func loadRecents() {
        recentCommandIds = UserDefaults.standard.stringArray(forKey: recentsKey) ?? []
    }
}
