//
//  OptaMenuBarApp.swift
//  OptaMenuBar
//
//  Standalone app entry point for the MenuBar plugin.
//  Used for development and as the executable target.
//  Created for Opta - Plan 20-08
//

import SwiftUI

@main
struct OptaMenuBarAppMain: App {
    @State private var store = MetricsStore()

    var body: some Scene {
        // Menu Bar Extra with animated logo
        MenuBarExtra {
            MenuBarContentView()
        } label: {
            MenuBarLabelView(momentum: store.momentum)
        }
        .menuBarExtraStyle(.window)

        // Debug settings window
        #if DEBUG
        Settings {
            DebugSettingsView(store: store)
        }
        #endif
    }
}

// MARK: - Debug Settings

#if DEBUG
struct DebugSettingsView: View {
    let store: MetricsStore

    var body: some View {
        Form {
            Section("Connection Status") {
                LabeledContent("IPC Connected", value: store.isConnected ? "Yes" : "No")
                LabeledContent("Socket Path", value: "/tmp/opta-metrics.sock")

                if let lastUpdate = store.lastUpdate {
                    LabeledContent("Last Update", value: lastUpdate.formatted())
                }

                if let error = store.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }

            Section("Current Metrics") {
                if let metrics = store.currentMetrics {
                    LabeledContent("CPU Usage", value: String(format: "%.1f%%", metrics.cpuUsage))
                    LabeledContent("Memory Usage", value: String(format: "%.1f%%", metrics.memoryUsage))
                    LabeledContent("CPU Temp", value: String(format: "%.1f°C", metrics.cpuTemperature))
                } else {
                    Text("No metrics available")
                        .foregroundStyle(.secondary)
                }
            }

            Section("Momentum State") {
                LabeledContent("Intensity", value: String(format: "%.2f", store.momentum.intensity))
                LabeledContent("Color", value: momentumColorName)
                LabeledContent("Rotation Speed", value: String(format: "%.1f", store.momentum.rotationSpeed))
            }

            Section("Actions") {
                Button("Generate Mock Data") {
                    Task { @MainActor in
                        store.generateMockMetrics()
                    }
                }
            }
        }
        .padding()
        .frame(width: 400, height: 350)
    }

    private var momentumColorName: String {
        switch store.momentum.color {
        case .idle: return "Idle (Purple)"
        case .active: return "Active (Cyan)"
        case .critical: return "Critical (Red)"
        }
    }
}
#endif
