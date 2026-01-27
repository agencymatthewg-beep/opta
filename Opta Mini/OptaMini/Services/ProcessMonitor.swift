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

/// Monitors running applications and launchd services, tracks Opta ecosystem status
@MainActor
final class ProcessMonitor: ObservableObject {
    /// Current status of each Opta component (id -> isRunning)
    @Published private(set) var appStatus: [String: Bool] = [:]

    private var cancellables = Set<AnyCancellable>()
    private var serviceCheckTimer: Timer?

    init() {
        // Initialize status for all Opta apps/services
        for app in OptaApp.allApps {
            appStatus[app.id] = false
        }

        // Check initial state
        refreshStatus()

        // Subscribe to workspace notifications (for regular apps)
        subscribeToNotifications()
        
        // Set up periodic check for launchd services
        startServiceMonitoring()
    }
    
    deinit {
        serviceCheckTimer?.invalidate()
    }

    /// Refresh status by checking currently running apps and services
    func refreshStatus() {
        // Check regular apps via NSWorkspace
        let runningApps = NSWorkspace.shared.runningApplications
        let runningBundleIds = Set(runningApps.compactMap { $0.bundleIdentifier })

        for app in OptaApp.regularApps {
            appStatus[app.id] = runningBundleIds.contains(app.bundleIdentifier)
        }
        
        // Check launchd services via process list
        checkServiceStatus()
    }
    
    /// Check status of launchd services
    private func checkServiceStatus() {
        for service in OptaApp.services {
            appStatus[service.id] = isServiceRunning(service)
        }
    }
    
    /// Check if a launchd service is running by looking for its process
    private func isServiceRunning(_ service: OptaApp) -> Bool {
        guard let processName = service.processName else { return false }
        
        let task = Process()
        task.launchPath = "/usr/bin/pgrep"
        task.arguments = ["-f", processName]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice
        
        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus == 0
        } catch {
            return false
        }
    }
    
    /// Start periodic monitoring of launchd services
    private func startServiceMonitoring() {
        // Check every 5 seconds
        serviceCheckTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkServiceStatus()
            }
        }
    }

    /// Check if a specific app/service is running
    func isRunning(_ app: OptaApp) -> Bool {
        appStatus[app.id] ?? false
    }

    /// Count of running Opta components
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

    /// Launch an Opta app or service
    func launch(_ app: OptaApp) {
        switch app.type {
        case .app:
            launchApp(app)
        case .launchdService:
            startService(app)
        }
    }

    /// Stop a running Opta app or service
    func stop(_ app: OptaApp) {
        switch app.type {
        case .app:
            stopApp(app)
        case .launchdService:
            stopService(app)
        }
    }
    
    // MARK: - Regular App Controls
    
    private func launchApp(_ app: OptaApp) {
        guard let url = app.appURL else { return }
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
    }
    
    private func stopApp(_ app: OptaApp) {
        guard let runningApp = NSWorkspace.shared.runningApplications.first(where: {
            $0.bundleIdentifier == app.bundleIdentifier
        }) else { return }
        runningApp.terminate()
    }
    
    // MARK: - Launchd Service Controls
    
    private func startService(_ service: OptaApp) {
        guard let plistPath = service.launchdPlistPath else { return }
        
        let uid = getuid()
        let task = Process()
        task.launchPath = "/bin/launchctl"
        task.arguments = ["bootstrap", "gui/\(uid)", plistPath]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        
        do {
            try task.run()
            task.waitUntilExit()
            
            // Refresh status after a short delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.checkServiceStatus()
            }
        } catch {
            print("Failed to start service \(service.name): \(error)")
        }
    }
    
    private func stopService(_ service: OptaApp) {
        guard let label = service.launchdLabel else { return }
        
        let uid = getuid()
        let task = Process()
        task.launchPath = "/bin/launchctl"
        task.arguments = ["bootout", "gui/\(uid)/\(label)"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        
        do {
            try task.run()
            task.waitUntilExit()
            
            // Refresh status after a short delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.checkServiceStatus()
            }
        } catch {
            print("Failed to stop service \(service.name): \(error)")
        }
    }

    /// Restart an Opta app/service (stop then launch)
    func restart(_ app: OptaApp) {
        stop(app)
        // Delay launch slightly to allow clean termination
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.launch(app)
        }
    }

    /// Stop all running Opta apps/services
    func stopAll() {
        for app in OptaApp.allApps where isRunning(app) {
            stop(app)
        }
    }

    /// Launch all stopped Opta apps/services
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
              let optaApp = OptaApp.regularApps.first(where: { $0.bundleIdentifier == bundleId }) else {
            return
        }
        appStatus[optaApp.id] = true
    }

    private func handleAppTermination(_ app: NSRunningApplication) {
        guard let bundleId = app.bundleIdentifier,
              let optaApp = OptaApp.regularApps.first(where: { $0.bundleIdentifier == bundleId }) else {
            return
        }
        appStatus[optaApp.id] = false
    }
}
