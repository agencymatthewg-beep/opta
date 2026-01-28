import Foundation
import UserNotifications

/// Handles system notifications for Opta Mini
final class NotificationService: NSObject {
    static let shared = NotificationService()

    private override init() {
        super.init()
        requestAuthorization()
    }

    /// Request notification permissions
    private func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in
            if let error = error {
                print("[NotificationService] Authorization error: \(error)")
            }
        }
    }

    /// Notify when an app starts
    func notifyAppStarted(_ appName: String) {
        guard UserDefaults.standard.bool(forKey: "notificationsEnabled") else { return }

        let content = UNMutableNotificationContent()
        content.title = "Opta Ecosystem"
        content.body = "\(appName) is now running"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Notify when an app stops
    func notifyAppStopped(_ appName: String) {
        guard UserDefaults.standard.bool(forKey: "notificationsEnabled") else { return }

        let content = UNMutableNotificationContent()
        content.title = "Opta Ecosystem"
        content.body = "\(appName) has stopped"
        content.sound = nil

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Notify when an app fails to start
    func notifyAppError(_ appName: String, error: String) {
        let content = UNMutableNotificationContent()
        content.title = "Opta Ecosystem"
        content.body = "\(appName) error: \(error)"
        content.sound = .defaultCritical

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }
}
