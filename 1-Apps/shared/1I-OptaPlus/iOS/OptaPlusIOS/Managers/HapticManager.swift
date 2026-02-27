//
//  HapticManager.swift
//  OptaPlusIOS
//
//  Centralised haptic feedback — wraps UIKit feedback generators with
//  pre-prepared instances for snappier response. Automatically respects
//  the system "Haptics Off" setting (UIFeedbackGenerator handles this).
//
//  Usage:
//    HapticManager.shared.impact(.light)      // message sent
//    HapticManager.shared.notification(.success) // bot connected
//    HapticManager.shared.selection()          // toggle, tab switch
//

import UIKit

final class HapticManager {
    static let shared = HapticManager()

    // Pre-prepared generators for lower latency
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let rigidImpact = UIImpactFeedbackGenerator(style: .rigid)
    private let selectionGenerator = UISelectionFeedbackGenerator()
    private let notificationGenerator = UINotificationFeedbackGenerator()

    private init() {
        // Prepare all generators so the first call is responsive
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        rigidImpact.prepare()
        selectionGenerator.prepare()
        notificationGenerator.prepare()
    }

    // MARK: - Impact

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        switch style {
        case .light:
            lightImpact.impactOccurred()
            lightImpact.prepare()
        case .medium:
            mediumImpact.impactOccurred()
            mediumImpact.prepare()
        case .heavy:
            heavyImpact.impactOccurred()
            heavyImpact.prepare()
        case .rigid:
            rigidImpact.impactOccurred()
            rigidImpact.prepare()
        case .soft:
            // Reuse light for soft — no dedicated generator needed
            lightImpact.impactOccurred()
            lightImpact.prepare()
        @unknown default:
            lightImpact.impactOccurred()
            lightImpact.prepare()
        }
    }

    // MARK: - Selection

    func selection() {
        selectionGenerator.selectionChanged()
        selectionGenerator.prepare()
    }

    // MARK: - Notification

    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        notificationGenerator.notificationOccurred(type)
        notificationGenerator.prepare()
    }

    // MARK: - Contextual Patterns (v1.0)

    /// Message sent successfully
    func messageSent() {
        impact(.light)
    }

    /// Bot connected
    func botConnected() {
        notification(.success)
    }

    /// Bot disconnected
    func botDisconnected() {
        notification(.warning)
    }

    /// Error occurred
    func error() {
        notification(.error)
    }

    /// Reaction added to a message
    func reactionAdded() {
        impact(.rigid)
    }

    /// Long-press context menu triggered
    func contextMenu() {
        impact(.medium)
    }

    /// Pull-to-refresh activated
    func pullToRefresh() {
        impact(.light)
    }

    /// Swipe action completed (e.g., swipe to reply)
    func swipeAction() {
        impact(.medium)
    }

    /// Bot started thinking/processing
    func botThinking() {
        impact(.soft)
    }

    /// New message received from bot
    func messageReceived() {
        impact(.light)
    }
}
