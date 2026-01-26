import Foundation
import AppKit
import Combine

/// Overall ecosystem health status
enum EcosystemStatus {
    case allRunning    // All apps running
    case someRunning   // Some apps running
    case noneRunning   // No apps running

    var iconName: String {
        switch self {
        case .allRunning, .someRunning:
            return "circle.grid.2x2.fill"
        case .noneRunning:
            return "circle.grid.2x2"
        }
    }
}

/// Monitors running applications and tracks Opta ecosystem app status
@MainActor
final class ProcessMonitor: ObservableObject {
    /// Current status of each Opta app (bundleId -> isRunning)
    @Published private(set) var appStatus: [String: Bool] = [:]

    private var cancellables = Set<AnyCancellable>()

    init() {
        // Initialize status for all Opta apps
        for app in OptaApp.allApps {
            appStatus[app.bundleIdentifier] = false
        }

        // Check initial state
        refreshStatus()

        // Subscribe to workspace notifications
        subscribeToNotifications()
    }

    /// Refresh status by checking currently running apps
    func refreshStatus() {
        let runningApps = NSWorkspace.shared.runningApplications
        let runningBundleIds = Set(runningApps.compactMap { $0.bundleIdentifier })

        for app in OptaApp.allApps {
            appStatus[app.bundleIdentifier] = runningBundleIds.contains(app.bundleIdentifier)
        }
    }

    /// Check if a specific app is running
    func isRunning(_ app: OptaApp) -> Bool {
        appStatus[app.bundleIdentifier] ?? false
    }

    /// Count of running Opta apps
    var runningCount: Int {
        appStatus.values.filter { $0 }.count
    }

    /// Overall ecosystem status for menu bar icon
    var ecosystemStatus: EcosystemStatus {
        let running = runningCount
        let total = OptaApp.allApps.count
        if running == total { return .allRunning }
        if running > 0 { return .someRunning }
        return .noneRunning
    }

    // MARK: - App Controls

    /// Launch an Opta app
    func launch(_ app: OptaApp) {
        guard let url = app.appURL else { return }
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
    }

    /// Stop a running Opta app
    func stop(_ app: OptaApp) {
        guard let runningApp = NSWorkspace.shared.runningApplications.first(where: {
            $0.bundleIdentifier == app.bundleIdentifier
        }) else { return }
        runningApp.terminate()
    }

    /// Restart an Opta app (stop then launch)
    func restart(_ app: OptaApp) {
        stop(app)
        // Delay launch slightly to allow clean termination
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.launch(app)
        }
    }

    /// Stop all running Opta apps
    func stopAll() {
        for app in OptaApp.allApps where isRunning(app) {
            stop(app)
        }
    }

    /// Launch all stopped Opta apps
    func launchAll() {
        for app in OptaApp.allApps where !isRunning(app) {
            launch(app)
        }
    }

    private func subscribeToNotifications() {
        let workspace = NSWorkspace.shared
        let nc = workspace.notificationCenter

        // App launched
        nc.publisher(for: NSWorkspace.didLaunchApplicationNotification)
            .compactMap { $0.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] app in
                self?.handleAppLaunch(app)
            }
            .store(in: &cancellables)

        // App terminated
        nc.publisher(for: NSWorkspace.didTerminateApplicationNotification)
            .compactMap { $0.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] app in
                self?.handleAppTermination(app)
            }
            .store(in: &cancellables)
    }

    private func handleAppLaunch(_ app: NSRunningApplication) {
        guard let bundleId = app.bundleIdentifier,
              OptaApp.allApps.contains(where: { $0.bundleIdentifier == bundleId }) else {
            return
        }
        appStatus[bundleId] = true
    }

    private func handleAppTermination(_ app: NSRunningApplication) {
        guard let bundleId = app.bundleIdentifier,
              OptaApp.allApps.contains(where: { $0.bundleIdentifier == bundleId }) else {
            return
        }
        appStatus[bundleId] = false
    }
}
