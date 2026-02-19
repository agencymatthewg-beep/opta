//
//  PushNotificationManager.swift
//  OptaPlusIOS
//
//  Manages iOS push notification permission, token delivery, and notification handling.
//  Coordinates with OptaMolt's PushTokenManager for gateway registration.
//
//  v1.0
//

import UIKit
import UserNotifications
import OptaMolt

// MARK: - Push Notification Manager

@MainActor
final class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {

    static let shared = PushNotificationManager()

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Permission

    static func requestPermission() async {
        let center = UNUserNotificationCenter.current()
        center.delegate = shared

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        } catch {
            print("Push notification permission error: \(error)")
        }

        // Register notification categories (for action buttons)
        registerCategories()
    }

    // MARK: - Categories

    private static func registerCategories() {
        let replyAction = UNTextInputNotificationAction(
            identifier: "REPLY_ACTION",
            title: "Reply",
            options: [],
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Type a reply..."
        )

        let category = UNNotificationCategory(
            identifier: "BOT_MESSAGE",
            actions: [replyAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    // MARK: - Foreground Notification Display

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner even when app is in foreground
        completionHandler([.banner, .sound])
    }

    // MARK: - Notification Tap Handler

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        Task { @MainActor in
            if let botId = userInfo["botId"] as? String {
                // Navigate to the bot's chat
                if let bot = AppState.shared?.bots.first(where: { $0.id == botId }) {
                    AppState.shared?.selectBot(bot)
                }
            }

            // Handle reply action
            if response.actionIdentifier == "REPLY_ACTION",
               let textResponse = response as? UNTextInputNotificationResponse {
                let replyText = textResponse.userText
                if let vm = AppState.shared?.selectedViewModel {
                    await vm.send(replyText)
                }
            }
        }

        completionHandler()
    }

    // MARK: - Local Notification

    /// Post a local notification for a bot message (used when app is backgrounded with active WS).
    static func notifyBotMessage(botName: String, botEmoji: String, content: String, botId: String) {
        let notifContent = UNMutableNotificationContent()
        notifContent.title = "\(botEmoji) \(botName)"
        notifContent.body = String(content.prefix(200))
        notifContent.sound = .default
        notifContent.categoryIdentifier = "BOT_MESSAGE"
        notifContent.userInfo = ["botId": botId]

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: notifContent,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }
}
