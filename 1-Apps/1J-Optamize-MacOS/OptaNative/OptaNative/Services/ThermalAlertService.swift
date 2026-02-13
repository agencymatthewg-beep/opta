//
//  ThermalAlertService.swift
//  OptaNative
//
//  Push system notifications when thermal state changes to critical or throttling.
//  Integrates with NotificationCenter for non-intrusive alerts with actionable suggestions.
//
//  Created for Opta Native macOS - Quick Win 2
//

import Foundation
import UserNotifications

// MARK: - Thermal Alert Configuration

struct ThermalAlertConfiguration: Sendable {
    /// Whether thermal alerts are enabled
    var isEnabled: Bool = true

    /// Minimum severity to trigger notifications (0 = cool, 4 = throttling)
    var minimumSeverity: Int = 2  // Hot and above

    /// Cooldown between notifications (seconds)
    var cooldownSeconds: TimeInterval = 300  // 5 minutes

    /// Whether to show throttle prediction warnings
    var showThrottlePredictions: Bool = true

    /// Seconds threshold for imminent throttle warning
    var imminentThrottleSeconds: TimeInterval = 60
}

// MARK: - Thermal Alert Service

actor ThermalAlertService {

    // MARK: - Properties

    private var configuration = ThermalAlertConfiguration()
    private var lastAlertTime: Date?
    private var lastAlertedState: ThermalState?
    private var isAuthorized = false
    private weak var webSocketServer: MCPWebSocketServer?

    // MARK: - Initialization

    init(webSocketServer: MCPWebSocketServer? = nil) {
        self.webSocketServer = webSocketServer
    }

    // MARK: - Authorization

    /// Request notification permissions
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted

            if granted {
                await registerNotificationCategories()
                print("ThermalAlert: Notification permission granted")
            } else {
                print("ThermalAlert: Notification permission denied")
            }

            return granted
        } catch {
            print("ThermalAlert: Failed to request authorization: \(error)")
            return false
        }
    }

    /// Register notification categories with actions
    private func registerNotificationCategories() async {
        let center = UNUserNotificationCenter.current()

        // Throttling alert category
        let reduceLoadAction = UNNotificationAction(
            identifier: "REDUCE_LOAD",
            title: "Reduce Load",
            options: []
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS",
            title: "Dismiss",
            options: []
        )

        let throttleCategory = UNNotificationCategory(
            identifier: "THERMAL_THROTTLE",
            actions: [reduceLoadAction, dismissAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )

        // Critical alert category
        let openOptaAction = UNNotificationAction(
            identifier: "OPEN_OPTA",
            title: "Open Opta",
            options: [.foreground]
        )

        let criticalCategory = UNNotificationCategory(
            identifier: "THERMAL_CRITICAL",
            actions: [openOptaAction, dismissAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )

        // Warning category
        let warningCategory = UNNotificationCategory(
            identifier: "THERMAL_WARNING",
            actions: [dismissAction],
            intentIdentifiers: [],
            options: []
        )

        center.setNotificationCategories([throttleCategory, criticalCategory, warningCategory])
    }

    // MARK: - Configuration

    func setConfiguration(_ config: ThermalAlertConfiguration) {
        self.configuration = config
    }

    func getConfiguration() -> ThermalAlertConfiguration {
        return configuration
    }

    func setWebSocketServer(_ server: MCPWebSocketServer) {
        self.webSocketServer = server
    }

    // MARK: - Alert Processing

    /// Process a thermal prediction and send alerts if needed
    func processThermalPrediction(_ prediction: ThermalPrediction) async {
        guard configuration.isEnabled else { return }

        let state = prediction.state
        let previousState = lastAlertedState

        // Check if state warrants an alert
        guard state.severity >= configuration.minimumSeverity else {
            // State improved, clear last alerted state
            if let prev = previousState, state.severity < prev.severity {
                lastAlertedState = nil
            }
            return
        }

        // Check cooldown
        if let lastTime = lastAlertTime,
           Date().timeIntervalSince(lastTime) < configuration.cooldownSeconds {
            // Still in cooldown, but check for escalation
            if let prev = previousState, state.severity > prev.severity {
                // State got worse, allow alert
            } else {
                return
            }
        }

        // Check throttle prediction
        if configuration.showThrottlePredictions,
           let secondsToThrottle = prediction.secondsToThrottle,
           secondsToThrottle < configuration.imminentThrottleSeconds,
           secondsToThrottle > 0 {
            await sendThrottlePredictionAlert(seconds: Int(secondsToThrottle), prediction: prediction)
            return
        }

        // Send state change alert
        await sendThermalStateAlert(state: state, prediction: prediction, previousState: previousState)
    }

    // MARK: - Send Alerts

    private func sendThermalStateAlert(
        state: ThermalState,
        prediction: ThermalPrediction,
        previousState: ThermalState?
    ) async {
        let content = UNMutableNotificationContent()

        switch state {
        case .throttling:
            content.title = "CPU Throttling Active"
            content.body = "Temperature: \(Int(prediction.currentTemperature))°C. Close intensive apps to reduce heat."
            content.categoryIdentifier = "THERMAL_THROTTLE"
            content.sound = .default

        case .critical:
            content.title = "Critical Temperature"
            content.body = "CPU at \(Int(prediction.currentTemperature))°C. \(prediction.recommendation ?? "Take action to prevent throttling.")"
            content.categoryIdentifier = "THERMAL_CRITICAL"
            content.sound = .default

        case .hot:
            content.title = "High Temperature Warning"
            content.body = "CPU at \(Int(prediction.currentTemperature))°C. \(prediction.recommendation ?? "Monitor workload.")"
            content.categoryIdentifier = "THERMAL_WARNING"
            content.sound = nil

        default:
            return
        }

        // Add thermal data to userInfo
        content.userInfo = [
            "temperature": prediction.currentTemperature,
            "state": state.rawValue,
            "formFactor": prediction.formFactor.rawValue
        ]

        await deliverNotification(content: content, identifier: "thermal-state-\(state.rawValue)")

        // Update tracking
        lastAlertTime = Date()
        lastAlertedState = state

        // Broadcast via WebSocket
        await broadcastThermalChange(
            previousState: previousState?.rawValue ?? "unknown",
            currentState: state.rawValue,
            temperature: prediction.currentTemperature,
            recommendation: prediction.recommendation
        )
    }

    private func sendThrottlePredictionAlert(seconds: Int, prediction: ThermalPrediction) async {
        let content = UNMutableNotificationContent()

        if seconds < 30 {
            content.title = "Throttling Imminent"
            content.body = "CPU may throttle in seconds at current temperature trend."
        } else {
            let timeStr = seconds < 60 ? "\(seconds) seconds" : "~\(seconds / 60) minute\(seconds >= 120 ? "s" : "")"
            content.title = "Throttle Warning"
            content.body = "At current rate, CPU may throttle in \(timeStr)."
        }

        content.categoryIdentifier = "THERMAL_WARNING"
        content.userInfo = [
            "temperature": prediction.currentTemperature,
            "secondsToThrottle": seconds
        ]

        await deliverNotification(content: content, identifier: "thermal-prediction")

        lastAlertTime = Date()
    }

    private func deliverNotification(content: UNMutableNotificationContent, identifier: String) async {
        guard isAuthorized else {
            // Try to authorize
            let granted = await requestAuthorization()
            guard granted else { return }
        }

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil  // Deliver immediately
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            print("ThermalAlert: Delivered notification '\(identifier)'")
        } catch {
            print("ThermalAlert: Failed to deliver notification: \(error)")
        }
    }

    // MARK: - WebSocket Broadcast

    private func broadcastThermalChange(
        previousState: String,
        currentState: String,
        temperature: Double,
        recommendation: String?
    ) async {
        guard let server = webSocketServer else { return }

        let notification = MCPNotification.thermalStateChange(
            previousState: previousState,
            currentState: currentState,
            temperature: temperature,
            recommendation: recommendation
        )

        await server.broadcast(notification)
    }

    // MARK: - Clear Alerts

    /// Clear all pending thermal notifications
    func clearPendingAlerts() async {
        let center = UNUserNotificationCenter.current()
        center.removeDeliveredNotifications(withIdentifiers: [
            "thermal-state-Throttling",
            "thermal-state-Critical",
            "thermal-state-Hot",
            "thermal-prediction"
        ])
        center.removePendingNotificationRequests(withIdentifiers: [
            "thermal-state-Throttling",
            "thermal-state-Critical",
            "thermal-state-Hot",
            "thermal-prediction"
        ])
    }
}
