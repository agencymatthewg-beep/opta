//
//  App.swift
//  OptaNative
//
//  Main application entry point.
//  Manages TelemetryViewModel as environment object for the main window.
//  Menu bar functionality moved to OptaMini.
//  Created for Opta Native macOS
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
    }

    /// Opens the about information
    private func openAbout() {
        NSApp.activate(ignoringOtherApps: true)
        // Could open an about window or navigate to about page
    }
}

