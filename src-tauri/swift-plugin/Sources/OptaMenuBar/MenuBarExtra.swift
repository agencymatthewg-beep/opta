//
//  MenuBarExtra.swift
//  OptaMenuBar
//
//  MenuBarExtra implementation for macOS 13+ menu bar integration.
//  Provides real-time system monitoring with animated Rive logo.
//  Created for Opta - Plan 20-08
//

import SwiftUI

// MARK: - Metrics Store

/// Observable store for system metrics received from Rust backend.
/// Bridges IPC data to SwiftUI views.
@MainActor
@Observable
final class MetricsStore {

    // MARK: - Published Properties

    /// Current system metrics snapshot
    var currentMetrics: SystemMetrics?

    /// Current momentum state for animation
    var momentum: MomentumState = MomentumState(
        intensity: 0.3,
        color: .idle,
        rotationSpeed: 0.5,
        pulseFrequency: 0.5
    )

    /// Whether IPC is connected
    var isConnected: Bool = false

    /// Last update timestamp
    var lastUpdate: Date?

    /// Error message if any
    var errorMessage: String?

    // MARK: - Private Properties

    private let bridge = FlatBuffersBridge()
    private var ipcHandler: IPCHandler?

    // MARK: - Initialization

    init() {
        setupIPC()
    }

    // MARK: - IPC Setup

    /// Setup IPC handler to receive metrics from Rust backend
    private func setupIPC() {
        ipcHandler = IPCHandler { [weak self] data in
            guard let self = self else { return }

            if let metrics = self.bridge.parseMetrics(data: data) {
                Task { @MainActor in
                    self.currentMetrics = metrics
                    self.momentum = self.bridge.getMomentumState(from: metrics)
                    self.lastUpdate = Date()
                    self.isConnected = true
                    self.errorMessage = nil
                }
            }
        }

        // Set connection status callback
        ipcHandler?.onConnectionChange = { [weak self] connected in
            Task { @MainActor in
                self?.isConnected = connected
                if !connected {
                    self?.errorMessage = "Waiting for Opta backend..."
                }
            }
        }
    }

    // MARK: - Mock Data (for development)

    /// Generate mock metrics for testing when IPC is unavailable
    func generateMockMetrics() {
        let mockMetrics = SystemMetrics(
            cpuUsage: Float.random(in: 10...80),
            memoryUsage: Float.random(in: 40...75),
            memoryTotal: 32 * 1024 * 1024 * 1024, // 32 GB
            memoryUsed: UInt64.random(in: 12...24) * 1024 * 1024 * 1024,
            diskUsage: Float.random(in: 30...70),
            cpuTemperature: Float.random(in: 40...65),
            gpuTemperature: Float.random(in: 35...55),
            timestamp: UInt64(Date().timeIntervalSince1970 * 1000)
        )

        currentMetrics = mockMetrics
        momentum = bridge.getMomentumState(from: mockMetrics)
        lastUpdate = Date()
    }
}

// MARK: - Menu Bar Content View

/// Root content view for the MenuBarExtra
struct MenuBarContentView: View {
    @State private var store = MetricsStore()

    var body: some View {
        PopoverView(metrics: store.currentMetrics, momentum: store.momentum)
            .frame(width: 300, height: 400)
            .onAppear {
                // If no metrics received, show mock data for development
                if store.currentMetrics == nil {
                    Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
                        if store.currentMetrics == nil || !store.isConnected {
                            Task { @MainActor in
                                store.generateMockMetrics()
                            }
                        }
                    }
                }
            }
    }
}

// MARK: - Menu Bar Label View

/// Label view for the MenuBarExtra showing animated logo
struct MenuBarLabelView: View {
    let momentum: MomentumState

    var body: some View {
        // Menu bar requires specific size constraints
        RiveLogoView(momentum: momentum, size: 18)
            .help("Opta - System Monitor")
    }
}

// MARK: - App Entry Point (Standalone)

/// Standalone app entry point for development/testing.
/// In production, this is launched as a helper by the Tauri app.
struct OptaMenuBarApp: App {
    @State private var store = MetricsStore()

    var body: some Scene {
        // Menu Bar Extra
        MenuBarExtra {
            MenuBarContentView()
        } label: {
            MenuBarLabelView(momentum: store.momentum)
        }
        .menuBarExtraStyle(.window) // Allows larger popover

        // Optional: Settings window for standalone operation
        #if DEBUG
        Settings {
            SettingsView()
        }
        #endif
    }
}

// MARK: - Settings View (Debug)

#if DEBUG
struct SettingsView: View {
    var body: some View {
        Form {
            Section("IPC Configuration") {
                Text("Socket Path: /tmp/opta-metrics.sock")
                    .font(.system(.body, design: .monospaced))
            }

            Section("About") {
                Text("Opta Menu Bar Plugin")
                    .font(.headline)
                Text("Version 1.0.0")
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(width: 350, height: 200)
    }
}
#endif

// MARK: - Preview

#Preview("MenuBarContentView") {
    MenuBarContentView()
        .frame(width: 300, height: 400)
}
