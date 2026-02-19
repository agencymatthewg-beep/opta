import UIKit

/// Centralized haptic feedback for Opta design system.
@MainActor
enum OptaHaptics {
    private static let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private static let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private static let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private static let notification = UINotificationFeedbackGenerator()
    private static let selection = UISelectionFeedbackGenerator()

    /// Standard tap — model selection, button presses.
    static func tap() {
        mediumImpact.impactOccurred()
    }

    /// Light tap — subtle interactions like filter chips.
    static func lightTap() {
        lightImpact.impactOccurred()
    }

    /// Heavy tap — important actions like connect/disconnect.
    static func heavyTap() {
        heavyImpact.impactOccurred()
    }

    /// Success — connected, message sent, session loaded.
    static func success() {
        notification.notificationOccurred(.success)
    }

    /// Error — connection failed, API error.
    static func error() {
        notification.notificationOccurred(.error)
    }

    /// Warning — reconnecting, slow response.
    static func warning() {
        notification.notificationOccurred(.warning)
    }

    /// Selection changed — picker, filter toggle.
    static func select() {
        selection.selectionChanged()
    }
}
