//
//  NotificationManager.swift
//  OptaPlusMacOS
//
//  Basic macOS notification support for incoming messages.
//

import Foundation
import UserNotifications
import AppKit

@MainActor
final class NotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    
    @Published var unreadCount: Int = 0
    
    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }
    
    /// Request notification permission on first launch.
    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                NSLog("[Notify] Permission error: \(error)")
            }
            NSLog("[Notify] Permission granted: \(granted)")
        }
    }
    
    /// Post a notification for an incoming bot message when app is not focused.
    func notifyIfNeeded(botName: String, message: String) {
        guard !NSApp.isActive else { return }
        
        unreadCount += 1
        NSApp.dockTile.badgeLabel = "\(unreadCount)"
        
        let content = UNMutableNotificationContent()
        content.title = botName
        content.body = String(message.prefix(200))
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    /// Clear badge when app becomes active.
    func clearBadge() {
        unreadCount = 0
        NSApp.dockTile.badgeLabel = nil
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Don't show notification if app is active
        completionHandler([])
    }
}
