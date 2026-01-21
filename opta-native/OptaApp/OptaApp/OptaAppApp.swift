//
//  OptaAppApp.swift
//  OptaApp
//
//  Main SwiftUI application entry point
//

import SwiftUI

@main
struct OptaAppApp: App {

    // MARK: - State

    /// Shared render coordinator
    @StateObject private var renderCoordinator = RenderCoordinator()

    /// Application delegate for additional setup
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    /// App Storage for menu bar visibility
    @AppStorage("showMenuBarIcon") private var showMenuBarIcon = true

    // MARK: - Body

    var body: some Scene {
        // Main Window
        WindowGroup(id: "main") {
            ContentView(coordinator: renderCoordinator)
                .frame(minWidth: 800, minHeight: 600)
                .preferredColorScheme(.dark)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 800)
        .commands {
            // Custom Commands
            CommandGroup(after: .appInfo) {
                Button("Toggle FPS Overlay") {
                    NotificationCenter.default.post(
                        name: .toggleFPSOverlay,
                        object: nil
                    )
                }
                .keyboardShortcut("F", modifiers: [.command, .shift])
            }

            CommandGroup(after: .sidebar) {
                Divider()

                Menu("Quality") {
                    Button("Low") {
                        renderCoordinator.qualityLevel = .low
                    }
                    Button("Medium") {
                        renderCoordinator.qualityLevel = .medium
                    }
                    Button("High") {
                        renderCoordinator.qualityLevel = .high
                    }
                    Button("Ultra") {
                        renderCoordinator.qualityLevel = .ultra
                    }
                    Button("Adaptive") {
                        renderCoordinator.qualityLevel = .adaptive
                    }
                }
            }

            // Custom keyboard shortcuts
            CommandGroup(replacing: .newItem) {
                Button("Open Main Window") {
                    NSApp.sendAction(#selector(AppDelegate.openMainWindow), to: nil, from: nil)
                }
                .keyboardShortcut("O", modifiers: [.command, .shift])

                Button("Quick Optimize") {
                    NotificationCenter.default.post(name: .performQuickOptimize, object: nil)
                }
                .keyboardShortcut("P", modifiers: [.command, .shift])

                Divider()

                Button("Pause Rendering") {
                    renderCoordinator.isPaused.toggle()
                }
                .keyboardShortcut(".", modifiers: [.command])

                Button("Check for Updates") {
                    NSApp.sendAction(#selector(AppDelegate.checkForUpdates), to: nil, from: nil)
                }
                .keyboardShortcut("U", modifiers: [.command])
            }
        }

        // Settings Window
        WindowGroup(id: "settings") {
            SettingsWindowView()
                .preferredColorScheme(.dark)
        }
        .windowStyle(.automatic)
        .windowResizability(.contentSize)
        .defaultSize(width: 450, height: 500)

        // Menu Bar Extra (macOS 13+)
        MenuBarExtra("Opta", systemImage: "waveform.circle.fill", isInserted: $showMenuBarIcon) {
            MenuBarPopoverView(coordinator: renderCoordinator)
        }
        .menuBarExtraStyle(.window)
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("[OptaApp] Application launched")

        // Configure for high performance
        configureForPerformance()
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("[OptaApp] Application terminating")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Return false to keep running in menu bar when windows are closed
        return false
    }

    private func configureForPerformance() {
        // Request high performance GPU on multi-GPU systems
        if let registrationName = Bundle.main.bundleIdentifier {
            // This hint tells macOS we want the high-performance GPU
            UserDefaults.standard.register(defaults: [
                "NSHighResolutionCapable": true
            ])
        }
    }

    // MARK: - Actions

    @objc func openMainWindow() {
        // Bring main window to front or create if needed
        if let window = NSApp.windows.first(where: { $0.identifier?.rawValue == "main" }) {
            window.makeKeyAndOrderFront(nil)
        } else {
            // Post notification to open window via SwiftUI
            NotificationCenter.default.post(name: .openMainWindow, object: nil)
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func checkForUpdates() {
        print("[OptaApp] Checking for updates...")
        // In a real implementation, this would integrate with Sparkle or similar
        NotificationCenter.default.post(name: .checkForUpdates, object: nil)
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let toggleFPSOverlay = Notification.Name("toggleFPSOverlay")
    static let openMainWindow = Notification.Name("openMainWindow")
    static let checkForUpdates = Notification.Name("checkForUpdates")
}
