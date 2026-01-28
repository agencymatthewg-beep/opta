import Foundation

// MARK: - Settings Manager

@Observable
final class NotificationSettingsManager {

    // MARK: - Singleton

    static let shared = NotificationSettingsManager()

    // MARK: - State

    private(set) var settings: NotificationSettings

    // MARK: - Constants

    private let settingsKey = "opta.notificationSettings"

    // MARK: - Initialization

    private init() {
        // Load from UserDefaults or create new
        if let data = UserDefaults.standard.data(forKey: settingsKey),
           let decoded = try? JSONDecoder().decode(NotificationSettings.self, from: data) {
            self.settings = decoded
        } else {
            self.settings = NotificationSettings()
            save() // Persist defaults
        }
    }

    // MARK: - Persistence

    func save() {
        guard let encoded = try? JSONEncoder().encode(settings) else {
            print("[NotificationSettingsManager] Failed to encode settings")
            return
        }

        UserDefaults.standard.set(encoded, forKey: settingsKey)
        print("[NotificationSettingsManager] Settings saved")
    }

    // MARK: - Convenience Methods

    func updateTypeSettings(for type: OptaNotificationType, _ newSettings: NotificationTypeSettings) {
        settings.updateSettings(for: type, newSettings)
        save()
    }

    func toggleType(_ type: OptaNotificationType) {
        var current = settings.settings(for: type)
        current.isEnabled.toggle()
        updateTypeSettings(for: type, current)
    }

    func toggleSound(for type: OptaNotificationType) {
        var current = settings.settings(for: type)
        current.soundEnabled.toggle()
        updateTypeSettings(for: type, current)
    }

    func updateDebounce(for type: OptaNotificationType, interval: TimeInterval) {
        var current = settings.settings(for: type)
        current.debounceInterval = interval
        updateTypeSettings(for: type, current)
    }

    func updateDeliveryStyle(for type: OptaNotificationType, style: NotificationTypeSettings.DeliveryStyle) {
        var current = settings.settings(for: type)
        current.deliveryStyle = style
        updateTypeSettings(for: type, current)
    }

    func updateQuietHours(_ config: QuietHoursConfig) {
        settings.quietHours = config
        save()
    }

    func toggleMasterSwitch() {
        settings.masterEnabled.toggle()
        save()
    }

    func toggleBadge() {
        settings.badgeEnabled.toggle()
        save()
    }

    func toggleForegroundNotifications() {
        settings.foregroundNotifications.toggle()
        save()
    }

    func resetToDefaults() {
        settings = NotificationSettings()
        save()
    }
}
