import Foundation
import AppKit
import Combine

/// Status of an individual app/service
enum AppStatus: Equatable {
    case stopped
    case launching
    case running
}

/// Overall ecosystem health status
enum EcosystemStatus {
    case allRunning    // All apps running
    case someRunning   // Some apps running
    case someLaunching // Some apps launching
    case noneRunning   // No apps running

    var iconName: String {
        switch self {
        case .allRunning, .someRunning:
            return "circle.grid.2x2.fill"
        case .someLaunching:
            return "circle.grid.2x2.fill"
        case .noneRunning:
            return "circle.grid.2x2"
        }
    }
}

/// Monitors running applications and launchd services, tracks Opta ecosystem status
@MainActor
final class ProcessMonitor: ObservableObject {
    /// Current status of each Opta component (id -> AppStatus)
    @Published private(set) var appStatus: [String: AppStatus] = [:]

    /// Track when each app started running (for uptime display)
    private(set) var appStartTimes: [String: Date] = [:]

    private var cancellables = Set<AnyCancellable>()
    private var serviceCheckTimer: Timer?
    private let notificationService = NotificationService.shared

    init() {
        // Initialize status for all Opta apps/services
        for app in OptaApp.allApps {
            appStatus[app.id] = .stopped
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
            let isRunning = runningBundleIds.contains(app.bundleIdentifier)
            let wasRunning = appStatus[app.id] == .running

            // Only update if not currently launching, or if now running
            if appStatus[app.id] != .launching || isRunning {
                appStatus[app.id] = isRunning ? .running : .stopped

                // Track start time if newly running
                if isRunning && !wasRunning {
                    appStartTimes[app.id] = Date()
                } else if !isRunning && wasRunning {
                    appStartTimes.removeValue(forKey: app.id)
                }
            }
        }

        // Check launchd services via process list
        checkServiceStatus()
    }

    /// Check status of launchd services
    private func checkServiceStatus() {
        for service in OptaApp.services {
            let isRunning = isServiceRunning(service)
            let wasRunning = appStatus[service.id] == .running
            let wasLaunching = appStatus[service.id] == .launching

            // Only update if not currently launching, or if now running
            if appStatus[service.id] != .launching || isRunning {
                appStatus[service.id] = isRunning ? .running : .stopped

                // Track start time and send notifications
                if isRunning && !wasRunning {
                    appStartTimes[service.id] = Date()
                    if wasLaunching {
                        notificationService.notifyAppStarted(service.name)
                    }
                } else if !isRunning && wasRunning {
                    appStartTimes.removeValue(forKey: service.id)
                    notificationService.notifyAppStopped(service.name)
                }
            }
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

    /// Get status of a specific app/service
    func status(_ app: OptaApp) -> AppStatus {
        appStatus[app.id] ?? .stopped
    }

    /// Check if a specific app/service is running
    func isRunning(_ app: OptaApp) -> Bool {
        appStatus[app.id] == .running
    }

    /// Check if a specific app/service is launching
    func isLaunching(_ app: OptaApp) -> Bool {
        appStatus[app.id] == .launching
    }

    /// Count of running Opta components
    var runningCount: Int {
        appStatus.values.filter { $0 == .running }.count
    }

    /// Count of launching Opta components
    var launchingCount: Int {
        appStatus.values.filter { $0 == .launching }.count
    }

    /// Overall ecosystem status for menu bar icon
    var ecosystemStatus: EcosystemStatus {
        let running = runningCount
        let launching = launchingCount
        let total = OptaApp.allApps.count
        if running == total { return .allRunning }
        if launching > 0 { return .someLaunching }
        if running > 0 { return .someRunning }
        return .noneRunning
    }

    // MARK: - App Controls

    /// Launch an Opta app or service
    func launch(_ app: OptaApp) {
        // Set to launching state
        appStatus[app.id] = .launching

        switch app.type {
        case .app:
            launchApp(app)
        case .launchdService:
            startService(app)
        }

        // Timeout: if still launching after 10 seconds, check actual status
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if self?.appStatus[app.id] == .launching {
                self?.refreshStatus()
            }
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
        appStatus[optaApp.id] = .running
        appStartTimes[optaApp.id] = Date()
        notificationService.notifyAppStarted(optaApp.name)
    }

    private func handleAppTermination(_ app: NSRunningApplication) {
        guard let bundleId = app.bundleIdentifier,
              let optaApp = OptaApp.regularApps.first(where: { $0.bundleIdentifier == bundleId }) else {
            return
        }
        appStatus[optaApp.id] = .stopped
        appStartTimes.removeValue(forKey: optaApp.id)
        notificationService.notifyAppStopped(optaApp.name)
    }

    /// Get uptime for an app (returns nil if not running)
    func uptime(for app: OptaApp) -> TimeInterval? {
        guard let startTime = appStartTimes[app.id] else { return nil }
        return Date().timeIntervalSince(startTime)
    }

    /// Format uptime as human-readable string
    func formattedUptime(for app: OptaApp) -> String? {
        guard let uptime = uptime(for: app) else { return nil }

        let hours = Int(uptime) / 3600
        let minutes = (Int(uptime) % 3600) / 60
        let seconds = Int(uptime) % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }
}
