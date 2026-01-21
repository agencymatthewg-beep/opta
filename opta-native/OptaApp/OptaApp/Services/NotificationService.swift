//
//  NotificationService.swift
//  OptaApp
//
//  Actor-based notification service for optimization opportunity alerts
//

import UserNotifications
import AppKit

// MARK: - Notification Service

actor NotificationService {

    // MARK: - Singleton

    static let shared = NotificationService()

    // MARK: - State

    private var isAuthorized = false
    private var lastNotificationTimes: [String: Date] = [:]
    private let notificationDebounceInterval: TimeInterval = 300 // 5 minutes

    // MARK: - Authorization

    /// Request notification authorization from the user
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            isAuthorized = try await center.requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            if isAuthorized {
                await setupNotificationCategories()
            }
            return isAuthorized
        } catch {
            print("[NotificationService] Authorization error: \(error)")
            return false
        }
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized
        return isAuthorized
    }

    // MARK: - Optimization Alert Types

    enum OptimizationAlert: String, CaseIterable {
        case highCpuUsage = "high-cpu"
        case highMemoryPressure = "high-memory"
        case gameDetected = "game-detected"
        case thermalThrottling = "thermal"
        case backgroundProcesses = "background"
        case optimizationComplete = "optimization-complete"
        case lowBattery = "low-battery"

        var defaultTitle: String {
            switch self {
            case .highCpuUsage: return "High CPU Usage Detected"
            case .highMemoryPressure: return "High Memory Pressure"
            case .gameDetected: return "Game Detected"
            case .thermalThrottling: return "System Running Hot"
            case .backgroundProcesses: return "Background Processes Active"
            case .optimizationComplete: return "Optimization Complete"
            case .lowBattery: return "Low Battery"
            }
        }

        var categoryIdentifier: String {
            switch self {
            case .gameDetected: return "GAME_OPTIMIZATION"
            case .optimizationComplete: return "OPTIMIZATION_RESULT"
            default: return "OPTIMIZATION"
            }
        }
    }

    // MARK: - Schedule Notifications

    /// Schedule an optimization alert notification
    /// - Parameters:
    ///   - alert: The type of optimization alert
    ///   - title: Custom title (uses default if nil)
    ///   - body: The notification body message
    ///   - actionTitle: Custom action button title
    func scheduleOptimizationAlert(
        _ alert: OptimizationAlert,
        title: String? = nil,
        body: String,
        actionTitle: String = "Optimize Now"
    ) async {
        // Check debounce
        if let lastTime = lastNotificationTimes[alert.rawValue],
           Date().timeIntervalSince(lastTime) < notificationDebounceInterval {
            print("[NotificationService] Debounced notification: \(alert.rawValue)")
            return
        }

        // Check authorization
        guard isAuthorized else {
            let authorized = await requestAuthorization()
            guard authorized else {
                print("[NotificationService] Not authorized to show notifications")
                return
            }
        }

        // Create notification content
        let content = UNMutableNotificationContent()
        content.title = title ?? alert.defaultTitle
        content.body = body
        content.sound = .default
        content.categoryIdentifier = alert.categoryIdentifier

        // Add user info for handling
        content.userInfo = [
            "alertType": alert.rawValue,
            "timestamp": Date().timeIntervalSince1970
        ]

        // Immediate trigger (1 second delay)
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: 1,
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "\(alert.rawValue)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            lastNotificationTimes[alert.rawValue] = Date()
            print("[NotificationService] Scheduled notification: \(alert.rawValue)")
        } catch {
            print("[NotificationService] Failed to schedule notification: \(error)")
        }
    }

    // MARK: - Notification Categories Setup

    func setupNotificationCategories() async {
        // Standard optimization action
        let optimizeAction = UNNotificationAction(
            identifier: "OPTIMIZE_ACTION",
            title: "Optimize",
            options: [.foreground]
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS_ACTION",
            title: "Dismiss",
            options: []
        )

        let viewDetailsAction = UNNotificationAction(
            identifier: "VIEW_DETAILS_ACTION",
            title: "View Details",
            options: [.foreground]
        )

        // Game optimization category
        let applyProfileAction = UNNotificationAction(
            identifier: "APPLY_PROFILE_ACTION",
            title: "Apply Profile",
            options: [.foreground]
        )

        let skipProfileAction = UNNotificationAction(
            identifier: "SKIP_PROFILE_ACTION",
            title: "Skip",
            options: []
        )

        // Create categories
        let optimizationCategory = UNNotificationCategory(
            identifier: "OPTIMIZATION",
            actions: [optimizeAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )

        let gameOptimizationCategory = UNNotificationCategory(
            identifier: "GAME_OPTIMIZATION",
            actions: [applyProfileAction, skipProfileAction],
            intentIdentifiers: [],
            options: []
        )

        let resultCategory = UNNotificationCategory(
            identifier: "OPTIMIZATION_RESULT",
            actions: [viewDetailsAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            optimizationCategory,
            gameOptimizationCategory,
            resultCategory
        ])
    }

    // MARK: - Convenience Methods

    /// Notify about high CPU usage
    func notifyHighCpuUsage(percentage: Int) async {
        await scheduleOptimizationAlert(
            .highCpuUsage,
            body: "CPU at \(percentage)%. Optimize now to free up resources."
        )
    }

    /// Notify about high memory pressure
    func notifyHighMemoryPressure(usedGB: Double, totalGB: Double) async {
        let usedPercentage = Int((usedGB / totalGB) * 100)
        await scheduleOptimizationAlert(
            .highMemoryPressure,
            body: "Memory usage at \(usedPercentage)%. Close unused apps for better performance."
        )
    }

    /// Notify when a game is detected
    func notifyGameDetected(gameName: String) async {
        await scheduleOptimizationAlert(
            .gameDetected,
            title: "Game Detected: \(gameName)",
            body: "Tap to apply optimization profile for best performance.",
            actionTitle: "Apply Profile"
        )
    }

    /// Notify about thermal throttling
    func notifyThermalThrottling(temperature: Int) async {
        await scheduleOptimizationAlert(
            .thermalThrottling,
            body: "System at \(temperature)C. Reduce workload to prevent thermal throttling."
        )
    }

    /// Notify about background processes consuming resources
    func notifyBackgroundProcesses(count: Int, cpuUsage: Int) async {
        await scheduleOptimizationAlert(
            .backgroundProcesses,
            body: "\(count) background processes using \(cpuUsage)% CPU. Tap to review."
        )
    }

    /// Notify when optimization completes
    func notifyOptimizationComplete(
        freedMemoryMB: Int? = nil,
        fpsImprovement: Int? = nil
    ) async {
        var body = "System optimized successfully."

        if let memory = freedMemoryMB, let fps = fpsImprovement {
            body = "Freed \(memory)MB memory. Estimated +\(fps)% FPS improvement."
        } else if let memory = freedMemoryMB {
            body = "Freed \(memory)MB memory."
        } else if let fps = fpsImprovement {
            body = "Estimated +\(fps)% FPS improvement."
        }

        await scheduleOptimizationAlert(
            .optimizationComplete,
            body: body
        )
    }

    // MARK: - Badge Management

    /// Update the app badge count
    func updateBadgeCount(_ count: Int) async {
        guard isAuthorized else { return }

        let center = UNUserNotificationCenter.current()

        // Use badge request with empty content
        if count > 0 {
            let content = UNMutableNotificationContent()
            content.badge = NSNumber(value: count)

            let request = UNNotificationRequest(
                identifier: "badge-update",
                content: content,
                trigger: nil
            )

            try? await center.add(request)
        } else {
            // Clear badge
            await MainActor.run {
                NSApp.dockTile.badgeLabel = nil
            }
        }
    }

    /// Clear all pending notifications
    func clearAllPendingNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    /// Clear all delivered notifications
    func clearAllDeliveredNotifications() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    // MARK: - Debounce Management

    /// Reset debounce timer for a specific alert type
    func resetDebounce(for alert: OptimizationAlert) {
        lastNotificationTimes.removeValue(forKey: alert.rawValue)
    }

    /// Reset all debounce timers
    func resetAllDebounces() {
        lastNotificationTimes.removeAll()
    }
}

// MARK: - Notification Delegate Handler

/// Handles notification responses and actions
class NotificationDelegateHandler: NSObject, UNUserNotificationCenterDelegate {

    static let shared = NotificationDelegateHandler()

    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner and play sound even when app is in foreground
        completionHandler([.banner, .sound])
    }

    // Handle notification response (user tapped or took action)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionIdentifier = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo

        // Extract alert type
        let alertType = userInfo["alertType"] as? String ?? "unknown"

        switch actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            // User tapped the notification
            handleNotificationTap(alertType: alertType)

        case "OPTIMIZE_ACTION":
            // User tapped "Optimize"
            NotificationCenter.default.post(name: .performQuickOptimize, object: nil)
            NotificationCenter.default.post(name: .openMainWindow, object: nil)

        case "APPLY_PROFILE_ACTION":
            // User wants to apply game profile
            NotificationCenter.default.post(
                name: .applyGameProfile,
                object: nil,
                userInfo: userInfo
            )
            NotificationCenter.default.post(name: .openMainWindow, object: nil)

        case "VIEW_DETAILS_ACTION":
            // User wants to view optimization details
            NotificationCenter.default.post(name: .openMainWindow, object: nil)

        case "DISMISS_ACTION", "SKIP_PROFILE_ACTION":
            // User dismissed - no action needed
            break

        default:
            break
        }

        completionHandler()
    }

    private func handleNotificationTap(alertType: String) {
        // Open main window and navigate to relevant section
        NotificationCenter.default.post(name: .openMainWindow, object: nil)

        // Post navigation event based on alert type
        if alertType == NotificationService.OptimizationAlert.gameDetected.rawValue {
            NotificationCenter.default.post(name: .navigateToGames, object: nil)
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let applyGameProfile = Notification.Name("applyGameProfile")
    static let navigateToGames = Notification.Name("navigateToGames")
}
