//
//  App.swift
//  OptaNative
//
//  Main application entry point with menu bar integration.
//  Manages TelemetryViewModel as environment object for both
//  the main window and menu bar popover.
//  Enhanced with pin/transient behavior and momentum-based icon.
//  Created for Opta Native macOS - Plans 19-06, 20-09
//

import SwiftUI

@main
struct OptaNativeApp: App {
    /// Shared telemetry view model for the entire app
    @State private var telemetry = TelemetryViewModel()

    /// Pin state for popover behavior (persisted in UserDefaults)
    @AppStorage("popoverPinned") private var isPinned: Bool = false

    var body: some Scene {
        // Main Window
        WindowGroup {
            RootView()
                .environment(telemetry)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 700, height: 800)

        // Menu Bar Extra with dynamic momentum-based icon
        MenuBarExtra {
            // Use enhanced PopoverView with holographic visualization
            PopoverView()
                .environment(telemetry)
        } label: {
            // Dynamic icon reflecting system state
            MenuBarIconView(
                cpuUsage: telemetry.cpuUsage,
                cpuTemperature: telemetry.cpuTemperature,
                isHot: telemetry.isCPUHot
            )
        }
        .menuBarExtraStyle(.window)
        .commands {
            // Custom command group for About
            CommandGroup(replacing: .appInfo) {
                Button("About Opta") {
                    openAbout()
                }
            }
        }
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
