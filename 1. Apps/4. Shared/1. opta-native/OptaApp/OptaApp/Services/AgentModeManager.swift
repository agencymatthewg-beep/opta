//
//  AgentModeManager.swift
//  OptaApp
//
//  Manages agent mode for minimize-to-menu-bar background monitoring
//

import SwiftUI
import AppKit

// MARK: - Agent Mode Manager

@Observable
final class AgentModeManager {

    // MARK: - Singleton

    static let shared = AgentModeManager()

    // MARK: - State

    /// Whether agent mode is currently active
    var isAgentMode: Bool = false {
        didSet {
            if oldValue != isAgentMode {
                handleAgentModeChange()
                storedAgentMode = isAgentMode
            }
        }
    }

    /// Whether to show system notifications
    var showNotifications: Bool = true {
        didSet {
            storedNotifications = showNotifications
        }
    }

    /// Auto-minimize when a game launches
    var autoMinimizeOnGameLaunch: Bool = true {
        didSet {
            storedAutoMinimize = autoMinimizeOnGameLaunch
        }
    }

    /// Background monitoring interval in seconds
    var monitoringInterval: TimeInterval = 5.0

    /// Number of pending optimization opportunities
    var pendingOptimizationCount: Int = 0

    /// Current system status for icon display
    var systemStatus: SystemStatus = .normal

    // MARK: - System Status

    enum SystemStatus: String, CaseIterable {
        case normal     // System healthy
        case warning    // Optimization recommended
        case critical   // Action needed
        case agent      // Agent mode active (purple)
        case paused     // Rendering/monitoring paused

        var color: Color {
            switch self {
            case .normal: return .green
            case .warning: return .orange
            case .critical: return .red
            case .agent: return Color(hex: "8B5CF6") ?? .purple
            case .paused: return .gray
            }
        }

        var icon: String {
            switch self {
            case .normal: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .critical: return "exclamationmark.octagon.fill"
            case .agent: return "eye.slash.fill"
            case .paused: return "pause.circle.fill"
            }
        }
    }

    // MARK: - Persistence

    @ObservationIgnored @AppStorage("agentModeEnabled") private var storedAgentMode = false
    @ObservationIgnored @AppStorage("agentModeNotifications") private var storedNotifications = true
    @ObservationIgnored @AppStorage("agentModeAutoMinimize") private var storedAutoMinimize = true

    // MARK: - Private State

    private var monitoringTask: Task<Void, Never>?
    private var gameObserverToken: NSObjectProtocol?

    // MARK: - Initialization

    private init() {
        // Restore state from storage
        isAgentMode = storedAgentMode
        showNotifications = storedNotifications
        autoMinimizeOnGameLaunch = storedAutoMinimize

        // Update system status based on agent mode
        if isAgentMode {
            systemStatus = .agent
        }

        // Setup game detection observer
        setupGameDetectionObserver()

        // Setup notification delegate
        _ = NotificationDelegateHandler.shared
    }

    // MARK: - Agent Mode Control

    /// Enter agent mode - minimizes to menu bar and continues monitoring
    func enterAgentMode() {
        isAgentMode = true
        systemStatus = .agent

        // Hide all windows
        DispatchQueue.main.async {
            for window in NSApp.windows {
                if window.level != .statusBar {
                    window.orderOut(nil)
                }
            }
        }

        // Post notification for UI updates
        NotificationCenter.default.post(
            name: .agentModeDidChange,
            object: nil,
            userInfo: ["isAgentMode": true]
        )

        print("[AgentModeManager] Entered agent mode")
    }

    /// Exit agent mode - restores main window and full UI
    func exitAgentMode() {
        isAgentMode = false
        systemStatus = .normal

        // Open main window
        NotificationCenter.default.post(name: .openMainWindow, object: nil)

        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
        }

        NotificationCenter.default.post(
            name: .agentModeDidChange,
            object: nil,
            userInfo: ["isAgentMode": false]
        )

        print("[AgentModeManager] Exited agent mode")
    }

    /// Toggle agent mode on/off
    func toggleAgentMode() {
        if isAgentMode {
            exitAgentMode()
        } else {
            enterAgentMode()
        }
    }

    /// Toggle show/hide main window while in agent mode
    func toggleShowHideWindow() {
        if isAgentMode {
            exitAgentMode()
        } else if NSApp.windows.contains(where: { $0.isVisible && $0.level != .statusBar }) {
            enterAgentMode()
        } else {
            NotificationCenter.default.post(name: .openMainWindow, object: nil)
        }
    }

    // MARK: - Agent Mode State Change

    private func handleAgentModeChange() {
        if isAgentMode {
            startBackgroundMonitoring()
        } else {
            stopBackgroundMonitoring()
        }
    }

    // MARK: - Background Monitoring

    private func startBackgroundMonitoring() {
        stopBackgroundMonitoring() // Cancel any existing task

        monitoringTask = Task { @MainActor in
            print("[AgentModeManager] Started background monitoring")

            while !Task.isCancelled && isAgentMode {
                await checkSystemStatus()
                try? await Task.sleep(for: .seconds(monitoringInterval))
            }

            print("[AgentModeManager] Stopped background monitoring")
        }
    }

    private func stopBackgroundMonitoring() {
        monitoringTask?.cancel()
        monitoringTask = nil
    }

    // MARK: - System Status Checking

    @MainActor
    private func checkSystemStatus() async {
        // Placeholder for actual system monitoring
        // In a full implementation, this would check:
        // - CPU usage via telemetry
        // - Memory pressure
        // - Thermal state
        // - Running games

        // Example threshold checks (would be replaced with real data)
        let simulatedCpuUsage = Int.random(in: 20...90)
        let simulatedMemoryPressure = Int.random(in: 30...85)
        let simulatedTemperature = Int.random(in: 40...95)

        // Update status based on thresholds
        var newStatus: SystemStatus = .agent

        if simulatedTemperature > 85 {
            newStatus = .critical
            if showNotifications {
                await NotificationService.shared.notifyThermalThrottling(temperature: simulatedTemperature)
            }
        } else if simulatedCpuUsage > 85 {
            newStatus = .warning
            if showNotifications {
                await NotificationService.shared.notifyHighCpuUsage(percentage: simulatedCpuUsage)
            }
        } else if simulatedMemoryPressure > 80 {
            newStatus = .warning
        }

        // Only update if agent mode is still active
        if isAgentMode {
            systemStatus = newStatus
        }
    }

    // MARK: - Game Detection Observer

    private func setupGameDetectionObserver() {
        // Observe game launches for auto-minimize
        gameObserverToken = NotificationCenter.default.addObserver(
            forName: .gameDidLaunch,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self = self else { return }

            if self.autoMinimizeOnGameLaunch && !self.isAgentMode {
                self.enterAgentMode()

                // Notify about game detection
                if self.showNotifications,
                   let gameName = notification.userInfo?["gameName"] as? String {
                    Task {
                        await NotificationService.shared.notifyGameDetected(gameName: gameName)
                    }
                }
            }
        }
    }

    // MARK: - Pending Optimizations

    /// Increment pending optimization count
    func addPendingOptimization() {
        pendingOptimizationCount += 1
        Task {
            await NotificationService.shared.updateBadgeCount(pendingOptimizationCount)
        }
    }

    /// Clear pending optimizations
    func clearPendingOptimizations() {
        pendingOptimizationCount = 0
        Task {
            await NotificationService.shared.updateBadgeCount(0)
        }
    }

    // MARK: - Cleanup

    deinit {
        stopBackgroundMonitoring()
        if let token = gameObserverToken {
            NotificationCenter.default.removeObserver(token)
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let agentModeDidChange = Notification.Name("agentModeDidChange")
    static let gameDidLaunch = Notification.Name("gameDidLaunch")
}

// MARK: - Environment Key

private struct AgentModeManagerKey: EnvironmentKey {
    static let defaultValue = AgentModeManager.shared
}

extension EnvironmentValues {
    var agentModeManager: AgentModeManager {
        get { self[AgentModeManagerKey.self] }
        set { self[AgentModeManagerKey.self] = newValue }
    }
}

