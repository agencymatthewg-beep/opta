//
//  MemoryAlertService.swift
//  OptaNative
//
//  Configurable memory pressure thresholds that trigger auto-purge or notifications.
//  Prevents memory-related slowdowns before they impact user experience.
//
//  Created for Opta Native macOS - Quick Win 5
//

import Foundation
import UserNotifications

// MARK: - Memory Alert Configuration

struct MemoryAlertConfiguration: Sendable {
    /// Whether memory alerts are enabled
    var isEnabled: Bool = true

    /// Warning threshold (percentage)
    var warningThreshold: Double = 75.0

    /// Critical threshold (percentage)
    var criticalThreshold: Double = 90.0

    /// Whether to auto-purge on critical
    var autoPurgeOnCritical: Bool = false

    /// Cooldown between alerts (seconds)
    var cooldownSeconds: TimeInterval = 300  // 5 minutes

    /// Whether to send system notifications
    var sendNotifications: Bool = true

    /// Whether to broadcast via MCP WebSocket
    var broadcastViaMCP: Bool = true
}

// MARK: - Memory Alert Level

enum MemoryAlertLevel: String, Sendable {
    case normal = "Normal"
    case warning = "Warning"
    case critical = "Critical"

    var severity: Int {
        switch self {
        case .normal: return 0
        case .warning: return 1
        case .critical: return 2
        }
    }
}

// MARK: - Memory Alert Service

actor MemoryAlertService {

    // MARK: - Properties

    private var configuration = MemoryAlertConfiguration()
    private var lastAlertTime: Date?
    private var lastAlertLevel: MemoryAlertLevel = .normal
    private var isAuthorized = false
    private weak var webSocketServer: MCPWebSocketServer?
    private let memoryService = MemoryService()

    // MARK: - Monitoring

    private var monitoringTask: Task<Void, Never>?
    private var isMonitoring = false

    // MARK: - Initialization

    init(webSocketServer: MCPWebSocketServer? = nil) {
        self.webSocketServer = webSocketServer
    }

    // MARK: - Configuration

    func setConfiguration(_ config: MemoryAlertConfiguration) {
        self.configuration = config
    }

    func getConfiguration() -> MemoryAlertConfiguration {
        return configuration
    }

    func setWebSocketServer(_ server: MCPWebSocketServer) {
        self.webSocketServer = server
    }

    // MARK: - Monitoring Control

    /// Start memory monitoring
    func startMonitoring(intervalSeconds: TimeInterval = 10) async {
        guard !isMonitoring else { return }

        // Request notification permission if needed
        if configuration.sendNotifications {
            await requestAuthorization()
        }

        isMonitoring = true

        monitoringTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.checkMemoryPressure()
                try? await Task.sleep(nanoseconds: UInt64(intervalSeconds * 1_000_000_000))
            }
        }

        print("MemoryAlert: Started monitoring (interval: \(intervalSeconds)s)")
    }

    /// Stop memory monitoring
    func stopMonitoring() {
        monitoringTask?.cancel()
        monitoringTask = nil
        isMonitoring = false
        print("MemoryAlert: Stopped monitoring")
    }

    /// Check if monitoring is active
    func isCurrentlyMonitoring() -> Bool {
        return isMonitoring
    }

    // MARK: - Authorization

    private func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            isAuthorized = granted

            if granted {
                await registerCategories()
            }
        } catch {
            print("MemoryAlert: Failed to request authorization: \(error)")
        }
    }

    private func registerCategories() async {
        let center = UNUserNotificationCenter.current()

        let purgeAction = UNNotificationAction(
            identifier: "PURGE_MEMORY",
            title: "Purge Memory",
            options: []
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS",
            title: "Dismiss",
            options: []
        )

        let memoryCategory = UNNotificationCategory(
            identifier: "MEMORY_PRESSURE",
            actions: [purgeAction, dismissAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )

        center.setNotificationCategories([memoryCategory])
    }

    // MARK: - Pressure Check

    private func checkMemoryPressure() async {
        guard configuration.isEnabled else { return }

        let stats = await memoryService.getMemoryStats()
        let level = determineAlertLevel(usagePercent: stats.usagePercent)

        // Only alert if level changed or is worse than last
        guard level.severity > lastAlertLevel.severity ||
              (level != .normal && shouldAlert(newLevel: level)) else {
            // Update level even if not alerting
            if level.severity < lastAlertLevel.severity {
                lastAlertLevel = level
            }
            return
        }

        // Handle based on level
        switch level {
        case .critical:
            await handleCriticalMemory(stats: stats)
        case .warning:
            await handleWarningMemory(stats: stats)
        case .normal:
            break
        }

        lastAlertLevel = level
        lastAlertTime = Date()
    }

    private func determineAlertLevel(usagePercent: Double) -> MemoryAlertLevel {
        if usagePercent >= configuration.criticalThreshold {
            return .critical
        } else if usagePercent >= configuration.warningThreshold {
            return .warning
        } else {
            return .normal
        }
    }

    private func shouldAlert(newLevel: MemoryAlertLevel) -> Bool {
        guard let lastTime = lastAlertTime else { return true }
        return Date().timeIntervalSince(lastTime) >= configuration.cooldownSeconds
    }

    // MARK: - Alert Handlers

    private func handleCriticalMemory(stats: MemoryStats) async {
        let usedGB = String(format: "%.1f", stats.usedGB)
        let totalGB = String(format: "%.1f", stats.totalGB)
        let percent = String(format: "%.0f", stats.usagePercent)

        // Auto-purge if enabled
        if configuration.autoPurgeOnCritical {
            let result = await memoryService.purgeMemory(aggressive: true)
            print("MemoryAlert: Auto-purge completed - freed \(result.freedMB) MB")
        }

        // Send notification
        if configuration.sendNotifications {
            await sendNotification(
                title: "Critical Memory Pressure",
                body: "Using \(usedGB) of \(totalGB) GB (\(percent)%). Close apps or purge memory.",
                level: .critical
            )
        }

        // Broadcast via MCP
        if configuration.broadcastViaMCP {
            await broadcastMemoryAlert(
                level: .critical,
                usagePercent: stats.usagePercent,
                recommendation: "Close unused applications or enable auto-purge"
            )
        }
    }

    private func handleWarningMemory(stats: MemoryStats) async {
        let usedGB = String(format: "%.1f", stats.usedGB)
        let totalGB = String(format: "%.1f", stats.totalGB)
        let percent = String(format: "%.0f", stats.usagePercent)

        // Send notification
        if configuration.sendNotifications {
            await sendNotification(
                title: "High Memory Usage",
                body: "Using \(usedGB) of \(totalGB) GB (\(percent)%). Consider closing unused apps.",
                level: .warning
            )
        }

        // Broadcast via MCP
        if configuration.broadcastViaMCP {
            await broadcastMemoryAlert(
                level: .warning,
                usagePercent: stats.usagePercent,
                recommendation: "Consider closing unused applications"
            )
        }
    }

    // MARK: - Notifications

    private func sendNotification(title: String, body: String, level: MemoryAlertLevel) async {
        guard isAuthorized else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.categoryIdentifier = "MEMORY_PRESSURE"
        content.sound = level == .critical ? .default : nil

        content.userInfo = [
            "level": level.rawValue
        ]

        let request = UNNotificationRequest(
            identifier: "memory-\(level.rawValue)",
            content: content,
            trigger: nil
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            print("MemoryAlert: Sent \(level.rawValue) notification")
        } catch {
            print("MemoryAlert: Failed to send notification: \(error)")
        }
    }

    // MARK: - MCP Broadcast

    private func broadcastMemoryAlert(level: MemoryAlertLevel, usagePercent: Double, recommendation: String) async {
        guard let server = webSocketServer else { return }

        let notification = MCPNotification.memoryPressure(
            level: level.rawValue,
            usagePercent: usagePercent,
            recommendation: recommendation
        )

        await server.broadcast(notification)
    }

    // MARK: - Manual Actions

    /// Manually trigger memory purge
    func purgeMemory(aggressive: Bool = false) async -> MemoryPurgeResult {
        return await memoryService.purgeMemory(aggressive: aggressive)
    }

    /// Get current memory stats
    func getMemoryStats() async -> MemoryStats {
        return await memoryService.getMemoryStats()
    }

    /// Get current alert level
    func getCurrentAlertLevel() async -> MemoryAlertLevel {
        let stats = await memoryService.getMemoryStats()
        return determineAlertLevel(usagePercent: stats.usagePercent)
    }
}
