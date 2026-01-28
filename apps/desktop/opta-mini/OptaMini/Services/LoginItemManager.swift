import Foundation
import ServiceManagement

/// Manages the app's login item status using SMAppService (macOS 13+)
@MainActor
final class LoginItemManager: ObservableObject {
    @Published private(set) var isEnabled: Bool = false

    init() {
        refreshStatus()
    }

    /// Check current login item status
    func refreshStatus() {
        isEnabled = SMAppService.mainApp.status == .enabled
    }

    /// Enable or disable launch at login
    func setEnabled(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            refreshStatus()
        } catch {
            print("Login item error: \(error)")
        }
    }
}
