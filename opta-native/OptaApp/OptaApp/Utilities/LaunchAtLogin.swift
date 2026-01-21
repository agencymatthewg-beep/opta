//
//  LaunchAtLogin.swift
//  OptaApp
//
//  Utility for managing launch at login using SMAppService (macOS 13+)
//

import Foundation
import ServiceManagement

// MARK: - Launch At Login Manager

/// Manages the app's launch at login status using SMAppService
enum LaunchAtLogin {

    // MARK: - Properties

    /// Whether the app is currently set to launch at login
    static var isEnabled: Bool {
        get {
            if #available(macOS 13.0, *) {
                return SMAppService.mainApp.status == .enabled
            } else {
                // Fallback for older macOS versions
                return legacyIsEnabled
            }
        }
        set {
            if #available(macOS 13.0, *) {
                setEnabled(newValue)
            } else {
                legacySetEnabled(newValue)
            }
        }
    }

    /// Current status as a descriptive string
    static var statusDescription: String {
        if #available(macOS 13.0, *) {
            switch SMAppService.mainApp.status {
            case .enabled:
                return "Enabled"
            case .notRegistered:
                return "Not Registered"
            case .notFound:
                return "Not Found"
            case .requiresApproval:
                return "Requires Approval"
            @unknown default:
                return "Unknown"
            }
        } else {
            return legacyIsEnabled ? "Enabled (Legacy)" : "Disabled (Legacy)"
        }
    }

    // MARK: - macOS 13+ Implementation

    @available(macOS 13.0, *)
    private static func setEnabled(_ enabled: Bool) {
        do {
            if enabled {
                // Register the app to launch at login
                if SMAppService.mainApp.status == .enabled {
                    print("[LaunchAtLogin] Already enabled")
                    return
                }

                try SMAppService.mainApp.register()
                print("[LaunchAtLogin] Successfully registered for launch at login")

            } else {
                // Unregister the app from launching at login
                if SMAppService.mainApp.status != .enabled {
                    print("[LaunchAtLogin] Already disabled")
                    return
                }

                try SMAppService.mainApp.unregister()
                print("[LaunchAtLogin] Successfully unregistered from launch at login")
            }
        } catch {
            print("[LaunchAtLogin] Error: \(error.localizedDescription)")
            handleError(error)
        }
    }

    @available(macOS 13.0, *)
    private static func handleError(_ error: Error) {
        let nsError = error as NSError

        switch nsError.code {
        case kSMErrorAlreadyRegistered:
            print("[LaunchAtLogin] App is already registered")
        case kSMErrorLaunchDeniedByUser:
            print("[LaunchAtLogin] Launch was denied by user - check System Settings > Login Items")
        case kSMErrorInternalFailure:
            print("[LaunchAtLogin] Internal failure - try restarting the app")
        default:
            print("[LaunchAtLogin] Unknown error code: \(nsError.code)")
        }

        // Post notification for UI to handle
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .launchAtLoginError,
                object: nil,
                userInfo: ["error": error]
            )
        }
    }

    // MARK: - Legacy Implementation (macOS 12 and earlier)

    private static var legacyIsEnabled: Bool {
        // Check if app is in login items using deprecated API
        // This is a simplified check - in production you'd use LSSharedFileList
        return UserDefaults.standard.bool(forKey: "legacyLaunchAtLogin")
    }

    private static func legacySetEnabled(_ enabled: Bool) {
        // Store preference locally
        UserDefaults.standard.set(enabled, forKey: "legacyLaunchAtLogin")

        // Note: For full legacy support, you would need to use LSSharedFileList
        // which is deprecated but still works on older macOS versions
        print("[LaunchAtLogin] Legacy mode - stored preference locally")

        if enabled {
            addToLoginItemsLegacy()
        } else {
            removeFromLoginItemsLegacy()
        }
    }

    private static func addToLoginItemsLegacy() {
        // This would use LSSharedFileList in a full implementation
        // For now, we just log the intent
        print("[LaunchAtLogin] Legacy: Would add to login items")
    }

    private static func removeFromLoginItemsLegacy() {
        // This would use LSSharedFileList in a full implementation
        print("[LaunchAtLogin] Legacy: Would remove from login items")
    }

    // MARK: - Utility Methods

    /// Opens System Settings to the Login Items pane
    static func openLoginItemsSettings() {
        if #available(macOS 13.0, *) {
            // Open new System Settings
            if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
                NSWorkspace.shared.open(url)
            }
        } else {
            // Open old System Preferences
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.general") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    /// Checks if user needs to grant permission in System Settings
    @available(macOS 13.0, *)
    static var requiresApproval: Bool {
        return SMAppService.mainApp.status == .requiresApproval
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let launchAtLoginError = Notification.Name("launchAtLoginError")
    static let launchAtLoginStatusChanged = Notification.Name("launchAtLoginStatusChanged")
}

// MARK: - SMAppService Status Extension

@available(macOS 13.0, *)
extension SMAppService.Status: CustomStringConvertible {
    public var description: String {
        switch self {
        case .enabled:
            return "Enabled"
        case .notRegistered:
            return "Not Registered"
        case .notFound:
            return "Not Found"
        case .requiresApproval:
            return "Requires Approval"
        @unknown default:
            return "Unknown"
        }
    }
}
