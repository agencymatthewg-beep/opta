//
//  KeyboardShortcutManager.swift
//  OptaNative
//
//  Manages app-wide keyboard shortcuts and broadcasts actions to views.
//  Created for Opta Native macOS
//

import SwiftUI
import Combine

// MARK: - Keyboard Actions

enum KeyboardAction: String {
    case refresh            // Cmd + R
    case hardReset          // Cmd + Shift + R
    case goHome             // Cmd + 0 or Esc
    case goBack             // Cmd + [ or Cmd + Left
    case newGame            // Cmd + N
    case undo               // Cmd + Z
    case openSettings       // Cmd + ,
    case toggleSidebar      // Cmd + Option + S

    // Navigation shortcuts
    case navDashboard       // Cmd + 1
    case navGameBooster     // Cmd + 2
    case navAchievements    // Cmd + 3
    case navOptimization    // Cmd + 4
    case navHealth          // Cmd + 5
    case navChess           // Cmd + 6
}

// MARK: - Keyboard Shortcut Manager

@Observable
final class KeyboardShortcutManager {
    static let shared = KeyboardShortcutManager()

    /// Current action (set when shortcut is triggered, cleared after handling)
    var currentAction: KeyboardAction?

    /// Trigger an action
    func trigger(_ action: KeyboardAction) {
        currentAction = action

        // Post notification for views that need it
        NotificationCenter.default.post(
            name: .keyboardShortcutTriggered,
            object: action
        )

        // Clear after a short delay to allow views to respond
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.currentAction = nil
        }
    }
}

// MARK: - Notification Extension

extension Notification.Name {
    static let keyboardShortcutTriggered = Notification.Name("keyboardShortcutTriggered")
}

// MARK: - View Modifier for Keyboard Shortcuts

struct KeyboardShortcutResponder: ViewModifier {
    let action: KeyboardAction
    let handler: () -> Void

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: .keyboardShortcutTriggered)) { notification in
                if let triggeredAction = notification.object as? KeyboardAction,
                   triggeredAction == action {
                    handler()
                }
            }
    }
}

extension View {
    /// Respond to a keyboard shortcut action
    func onKeyboardShortcut(_ action: KeyboardAction, perform handler: @escaping () -> Void) -> some View {
        modifier(KeyboardShortcutResponder(action: action, handler: handler))
    }
}
