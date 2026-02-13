//
//  NotificationManager.swift
//  OptaPlusMacOS
//
//  macOS notification support with actionable categories.
//

import Foundation
import UserNotifications
import AppKit

@MainActor
final class NotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    
    @Published var unreadCount: Int = 0
    
    // Category identifiers
    static let messageCategoryId = "OPTAPLUS_MESSAGE"
    
    // Action identifiers
    static let replyActionId = "REPLY_ACTION"
    static let markReadActionId = "MARK_READ_ACTION"
    static let muteActionId = "MUTE_1H_ACTION"
    
    // Track muted bots (botId -> unmute time)
    private var mutedBots: [String: Date] = [:]
    
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
    
    /// Register notification categories with actions.
    func registerCategories() {
        let replyAction = UNTextInputNotificationAction(
            identifier: Self.replyActionId,
            title: "Reply",
            options: [],
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Type a reply…"
        )
        
        let markReadAction = UNNotificationAction(
            identifier: Self.markReadActionId,
            title: "Mark Read",
            options: []
        )
        
        let muteAction = UNNotificationAction(
            identifier: Self.muteActionId,
            title: "Mute 1h",
            options: []
        )
        
        let messageCategory = UNNotificationCategory(
            identifier: Self.messageCategoryId,
            actions: [replyAction, markReadAction, muteAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([messageCategory])
    }
    
    /// Post a notification for an incoming bot message when app is not focused.
    func notifyIfNeeded(botName: String, botId: String? = nil, message: String) {
        guard !NSApp.isActive else { return }
        
        // Check if bot is muted
        if let id = botId, let muteUntil = mutedBots[id], Date() < muteUntil {
            return
        }
        
        unreadCount += 1
        NSApp.dockTile.badgeLabel = "\(unreadCount)"
        
        let content = UNMutableNotificationContent()
        content.title = botName
        content.body = String(message.prefix(200))
        content.sound = .default
        content.categoryIdentifier = Self.messageCategoryId
        
        // Store bot ID in userInfo for action handling
        if let botId = botId {
            content.userInfo = ["botId": botId]
        }
        
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
    
    /// Mute a bot for 1 hour.
    func muteBot(_ botId: String) {
        mutedBots[botId] = Date().addingTimeInterval(3600)
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
    
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let botId = userInfo["botId"] as? String
        
        Task { @MainActor in
            switch response.actionIdentifier {
            case Self.replyActionId:
                if let textResponse = response as? UNTextInputNotificationResponse,
                   let botId = botId {
                    // Send the reply text to the bot
                    NotificationCenter.default.post(
                        name: .optaPlusNotificationReply,
                        object: nil,
                        userInfo: ["botId": botId, "text": textResponse.userText]
                    )
                }
                
            case Self.markReadActionId:
                clearBadge()
                
            case Self.muteActionId:
                if let botId = botId {
                    muteBot(botId)
                }
                
            case UNNotificationDefaultActionIdentifier:
                // Clicked the notification — open the bot's chat
                NSApp.activate(ignoringOtherApps: true)
                if let botId = botId {
                    NotificationCenter.default.post(
                        name: .optaPlusOpenBot,
                        object: nil,
                        userInfo: ["botId": botId]
                    )
                }
                
            default:
                break
            }
        }
        
        completionHandler()
    }
}

extension Notification.Name {
    static let optaPlusNotificationReply = Notification.Name("optaPlusNotificationReply")
    static let optaPlusOpenBot = Notification.Name("optaPlusOpenBot")
}
