//
//  App.swift
//  OptaNative
//
//  Main application entry point with menu bar integration.
//  Manages TelemetryViewModel as environment object for both
//  the main window and menu bar popover.
//  Enhanced with pin/transient behavior, momentum-based icon,
//  and global celebration overlay.
//  Created for Opta Native macOS - Plans 19-06, 20-09, 99-01
//

import SwiftUI

@main
struct OptaNativeApp: App {
    /// Shared telemetry view model for the entire app
    @State private var telemetry = TelemetryViewModel()

    init() {
        NSLog("[OptaNativeApp] App initialized - build with logging v2")
    }

    /// Keyboard shortcut manager
    private let shortcuts = KeyboardShortcutManager.shared

    /// Pin state for popover behavior (persisted in UserDefaults)
    @AppStorage("popoverPinned") private var isPinned: Bool = false

    var body: some Scene {
        // Main Window
        WindowGroup {
            RootView()
                .environment(telemetry)
                .celebrationOverlay()
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 700, height: 800)
        .commands {
            // MARK: - App Commands
            CommandGroup(replacing: .appInfo) {
                Button("About Opta") {
                    openAbout()
                }
            }

            // MARK: - File Commands
            CommandGroup(replacing: .newItem) {
                Button("New Game") {
                    shortcuts.trigger(.newGame)
                }
                .keyboardShortcut("n", modifiers: .command)
            }

            // MARK: - Edit Commands
            CommandGroup(after: .undoRedo) {
                Button("Undo Move") {
                    shortcuts.trigger(.undo)
                }
                .keyboardShortcut("z", modifiers: .command)
            }

            // MARK: - View Commands
            CommandGroup(replacing: .toolbar) {
                Button("Refresh") {
                    shortcuts.trigger(.refresh)
                }
                .keyboardShortcut("r", modifiers: .command)

                Button("Hard Reset") {
                    shortcuts.trigger(.hardReset)
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])

                Divider()

                Button("Go Home") {
                    shortcuts.trigger(.goHome)
                }
                .keyboardShortcut("0", modifiers: .command)

                Button("Go Back") {
                    shortcuts.trigger(.goBack)
                }
                .keyboardShortcut("[", modifiers: .command)
            }

            // MARK: - Navigation Commands
            CommandMenu("Navigate") {
                Button("Dashboard") {
                    shortcuts.trigger(.navDashboard)
                }
                .keyboardShortcut("1", modifiers: .command)

                Button("Game Booster") {
                    shortcuts.trigger(.navGameBooster)
                }
                .keyboardShortcut("2", modifiers: .command)

                Button("Achievements") {
                    shortcuts.trigger(.navAchievements)
                }
                .keyboardShortcut("3", modifiers: .command)

                Button("Optimization") {
                    shortcuts.trigger(.navOptimization)
                }
                .keyboardShortcut("4", modifiers: .command)

                Button("Health") {
                    shortcuts.trigger(.navHealth)
                }
                .keyboardShortcut("5", modifiers: .command)

                Button("Chess") {
                    shortcuts.trigger(.navChess)
                }
                .keyboardShortcut("6", modifiers: .command)

                Divider()

                Button("Toggle Sidebar") {
                    shortcuts.trigger(.toggleSidebar)
                }
                .keyboardShortcut("s", modifiers: [.command, .option])
            }
        }

        // Menu Bar Extra with dynamic momentum-based icon
        // This appears on the RIGHT side of the menu bar (with WiFi, battery, etc.)
        MenuBarExtra {
            // Use enhanced PopoverView with holographic visualization
            PopoverView()
                .environment(telemetry)
        } label: {
            // Visible label with icon and text
            HStack(spacing: 3) {
                Image(systemName: "bolt.circle.fill")
                Text("Opta")
                    .font(.system(size: 12, weight: .medium))
            }
        }
        .menuBarExtraStyle(.window)
    }

    /// Opens the about information
    private func openAbout() {
        NSApp.activate(ignoringOtherApps: true)
        // Could open an about window or navigate to about page
    }
}

// MARK: - Menu Bar Icon View

/// Dynamic menu bar icon that reflects system momentum state
struct MenuBarIconView: View {
    let cpuUsage: Double
    let cpuTemperature: Double
    let isHot: Bool

    var body: some View {
        HStack(spacing: 4) {
            // Status icon
            Image(systemName: statusIcon)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(iconColor)

            // Optional: Show brief CPU indicator when high
            if cpuUsage > 75 {
                Text("\(Int(cpuUsage))")
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// Dynamic icon based on system state
    private var statusIcon: String {
        if isHot {
            return "flame.fill"
        } else if cpuUsage > 85 {
            return "bolt.trianglebadge.exclamationmark.fill"
        } else if cpuUsage > 60 {
            return "bolt.fill"
        } else {
            return "bolt"
        }
    }

    /// Icon color based on state
    private var iconColor: Color {
        if isHot || cpuUsage > 85 {
            return .red
        } else if cpuUsage > 60 {
            return .orange
        } else {
            return .primary
        }
    }
}
