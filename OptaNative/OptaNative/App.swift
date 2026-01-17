//
//  App.swift
//  OptaNative
//
//  Main application entry point with menu bar integration.
//  Manages TelemetryViewModel as environment object for both
//  the main window and menu bar popover.
//  Created for Opta Native macOS - Plan 19-06
//

import SwiftUI

@main
struct OptaNativeApp: App {
    /// Shared telemetry view model for the entire app
    @State private var telemetry = TelemetryViewModel()

    var body: some Scene {
        // Main Window
        WindowGroup {
            MainWindowView()
                .environment(telemetry)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 700, height: 800)

        // Menu Bar Extra with dynamic icon
        MenuBarExtra {
            MenuBarView()
                .environment(telemetry)
        } label: {
            Image(systemName: menuBarIcon)
        }
        .menuBarExtraStyle(.window)
    }

    /// Dynamic menu bar icon based on CPU temperature.
    /// Shows flame when CPU is hot (> 80°C), otherwise shows bolt.
    private var menuBarIcon: String {
        if telemetry.isCPUHot {
            return "flame.fill"
        } else {
            return "bolt.fill"
        }
    }
}
