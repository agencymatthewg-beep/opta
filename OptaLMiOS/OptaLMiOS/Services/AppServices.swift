import Foundation
import Network
import Combine
import UserNotifications

// MARK: - Network Monitor

@MainActor
class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()
    
    @Published var isConnected = true
    @Published var connectionType: ConnectionType = .unknown
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    enum ConnectionType {
        case wifi
        case cellular
        case wired
        case unknown
    }
    
    private init() {
        startMonitoring()
    }
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isConnected = path.status == .satisfied
                self?.connectionType = self?.getConnectionType(path) ?? .unknown
            }
        }
        monitor.start(queue: queue)
    }
    
    func stopMonitoring() {
        monitor.cancel()
    }
    
    private func getConnectionType(_ path: NWPath) -> ConnectionType {
        if path.usesInterfaceType(.wifi) {
            return .wifi
        } else if path.usesInterfaceType(.cellular) {
            return .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            return .wired
        }
        return .unknown
    }
}

// MARK: - Cache Manager

class CacheManager {
    static let shared = CacheManager()
    
    private let defaults = UserDefaults.standard
    private let cachePrefix = "opta_cache_"
    
    private init() {}
    
    func cache<T: Encodable>(_ data: T, forKey key: String, expirationMinutes: Int = 15) {
        let fullKey = cachePrefix + key
        
        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: fullKey)
            defaults.set(Date().addingTimeInterval(TimeInterval(expirationMinutes * 60)), forKey: fullKey + "_expiry")
        }
    }
    
    func retrieve<T: Decodable>(forKey key: String, as type: T.Type) -> T? {
        let fullKey = cachePrefix + key
        
        // Check expiration
        if let expiry = defaults.object(forKey: fullKey + "_expiry") as? Date {
            if Date() > expiry {
                // Cache expired
                clearCache(forKey: key)
                return nil
            }
        }
        
        guard let data = defaults.data(forKey: fullKey) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    
    func clearCache(forKey key: String) {
        let fullKey = cachePrefix + key
        defaults.removeObject(forKey: fullKey)
        defaults.removeObject(forKey: fullKey + "_expiry")
    }
    
    func clearAllCache() {
        let keys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(cachePrefix) }
        keys.forEach { defaults.removeObject(forKey: $0) }
    }
}

// MARK: - Notification Manager

@MainActor
class NotificationManager: ObservableObject {
    static let shared = NotificationManager()

    @Published var pendingNotifications: [OptaNotification] = []

    private var lastNotificationTimes: [String: Date] = [:]
    private let settingsManager = NotificationSettingsManager.shared
    private var isAuthorized = false

    private init() {
        setupNotificationCategories()
    }

    // MARK: - Authorization

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, error in
            Task { @MainActor in
                self?.isAuthorized = granted
                if let error = error {
                    print("Notification permission error: \(error)")
                }
            }
        }
    }

    func checkAuthorizationStatus() async -> Bool {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized
        return isAuthorized
    }

    // MARK: - Core Scheduling

    func scheduleNotification(
        _ type: OptaNotificationType,
        title: String,
        body: String,
        trigger: UNNotificationTrigger? = nil,
        userInfo: [AnyHashable: Any] = [:]
    ) {
        // Check if notification should be shown
        guard settingsManager.settings.shouldShowNotification(for: type) else {
            print("[NotificationManager] Notification suppressed by settings: \(type.rawValue)")
            return
        }

        let typeSettings = settingsManager.settings.settings(for: type)

        // Check debounce
        if typeSettings.debounceInterval > 0 {
            if let lastTime = lastNotificationTimes[type.rawValue],
               Date().timeIntervalSince(lastTime) < typeSettings.debounceInterval {
                print("[NotificationManager] Debounced notification: \(type.rawValue)")
                return
            }
        }

        // Check authorization
        guard isAuthorized else {
            print("[NotificationManager] Not authorized")
            return
        }

        // Create notification content
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body

        // Sound based on settings
        if typeSettings.soundEnabled {
            content.sound = .default
        }

        // Badge if enabled
        if settingsManager.settings.badgeEnabled {
            content.badge = 1
        }

        content.categoryIdentifier = type.defaultCategory

        // User info
        var finalUserInfo = userInfo
        finalUserInfo["notificationType"] = type.rawValue
        finalUserInfo["timestamp"] = Date().timeIntervalSince1970
        content.userInfo = finalUserInfo

        // Use provided trigger or immediate trigger
        let finalTrigger = trigger ?? UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)

        let request = UNNotificationRequest(
            identifier: "\(type.rawValue)-\(UUID().uuidString)",
            content: content,
            trigger: finalTrigger
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[NotificationManager] Failed to schedule: \(error)")
            } else {
                self.lastNotificationTimes[type.rawValue] = Date()
                print("[NotificationManager] Scheduled: \(type.rawValue)")
            }
        }
    }

    // MARK: - Task Reminders

    func scheduleTaskReminder(for task: OptaTask, minutesBefore: Int = 30) {
        guard let dueDate = task.due?.displayDate else { return }

        let triggerDate = dueDate.addingTimeInterval(TimeInterval(-minutesBefore * 60))
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        scheduleNotification(
            .taskReminder,
            title: "Task Reminder",
            body: task.content,
            trigger: trigger,
            userInfo: ["taskId": task.id]
        )
    }

    // MARK: - Event Reminders

    func scheduleEventReminder(for event: CalendarEvent, minutesBefore: Int = 15) {
        guard let startDate = event.startDate else { return }

        let triggerDate = startDate.addingTimeInterval(TimeInterval(-minutesBefore * 60))
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        scheduleNotification(
            .eventReminder,
            title: "Upcoming: \(event.summary)",
            body: "Starting in \(minutesBefore) minutes",
            trigger: trigger,
            userInfo: ["eventId": event.id]
        )
    }

    // MARK: - New Notification Types

    func scheduleDailyBriefing(at time: Date = Date()) {
        let components = Calendar.current.dateComponents([.hour, .minute], from: time)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

        scheduleNotification(
            .dailyBriefing,
            title: "Good Morning",
            body: "Your daily briefing is ready",
            trigger: trigger
        )
    }

    func notifyAIInsight(message: String) {
        scheduleNotification(
            .aiInsight,
            title: "AI Insight",
            body: message
        )
    }

    func notifyGoalMilestone(goal: String, progress: Int) {
        scheduleNotification(
            .goalMilestone,
            title: "Goal Progress",
            body: "\(goal) is \(progress)% complete"
        )
    }

    func notifyHabitStreak(habit: String, days: Int) {
        scheduleNotification(
            .habitStreak,
            title: "Streak Achievement",
            body: "\(days) days of \(habit)! 🔥"
        )
    }

    func scheduleFocusReminder(message: String, at date: Date) {
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        scheduleNotification(
            .focusSession,
            title: "Focus Time",
            body: message,
            trigger: trigger
        )
    }

    func notifyLowPriority(message: String) {
        scheduleNotification(
            .lowPriority,
            title: "Update",
            body: message
        )
    }

    // MARK: - Badge Management

    func updateBadgeCount(_ count: Int) {
        guard settingsManager.settings.badgeEnabled else { return }
        UNUserNotificationCenter.current().setBadgeCount(count)
    }

    func clearBadge() {
        UNUserNotificationCenter.current().setBadgeCount(0)
    }

    // MARK: - Clear Notifications

    func clearAllPendingNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    func clearAllDeliveredNotifications() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    // MARK: - Debounce Management

    func resetDebounce(for type: OptaNotificationType) {
        lastNotificationTimes.removeValue(forKey: type.rawValue)
    }

    func resetAllDebounces() {
        lastNotificationTimes.removeAll()
    }

    // MARK: - Categories Setup

    private func setupNotificationCategories() {
        let completeAction = UNNotificationAction(
            identifier: "COMPLETE_ACTION",
            title: "Complete",
            options: []
        )

        let snoozeAction = UNNotificationAction(
            identifier: "SNOOZE_ACTION",
            title: "Snooze",
            options: []
        )

        let viewAction = UNNotificationAction(
            identifier: "VIEW_ACTION",
            title: "View",
            options: [.foreground]
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS_ACTION",
            title: "Dismiss",
            options: []
        )

        let categories = [
            UNNotificationCategory(
                identifier: "TASK",
                actions: [completeAction, snoozeAction, dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "EVENT",
                actions: [viewAction, dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "BRIEFING",
                actions: [viewAction, dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "AI_INSIGHT",
                actions: [viewAction, dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "ACHIEVEMENT",
                actions: [viewAction, dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "FOCUS",
                actions: [dismissAction],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: "UPDATE",
                actions: [dismissAction],
                intentIdentifiers: [],
                options: []
            )
        ]

        UNUserNotificationCenter.current().setNotificationCategories(Set(categories))
    }
}

// MARK: - Notification Delegate Handler

class NotificationDelegateHandler: NSObject, UNUserNotificationCenterDelegate {

    static let shared = NotificationDelegateHandler()

    private let settingsManager = NotificationSettingsManager.shared

    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Check if foreground notifications are enabled
        if settingsManager.settings.foregroundNotifications {
            completionHandler([.banner, .sound, .badge])
        } else {
            completionHandler([])
        }
    }

    // Handle notification response
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionIdentifier = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo

        switch actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            // User tapped the notification
            NotificationCenter.default.post(name: .openOptaApp, object: nil, userInfo: userInfo)

        case "COMPLETE_ACTION":
            // Handle task completion
            if let taskId = userInfo["taskId"] as? String {
                NotificationCenter.default.post(name: .completeTask, object: nil, userInfo: ["taskId": taskId])
            }

        case "SNOOZE_ACTION":
            // Handle snooze (reschedule for 10 minutes later)
            if let taskId = userInfo["taskId"] as? String {
                NotificationCenter.default.post(name: .snoozeTask, object: nil, userInfo: ["taskId": taskId])
            }

        case "VIEW_ACTION":
            NotificationCenter.default.post(name: .openOptaApp, object: nil, userInfo: userInfo)

        case "DISMISS_ACTION":
            break

        default:
            break
        }

        completionHandler()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let openOptaApp = Notification.Name("openOptaApp")
    static let completeTask = Notification.Name("completeTask")
    static let snoozeTask = Notification.Name("snoozeTask")
}

struct OptaNotification: Identifiable {
    let id: String
    let title: String
    let body: String
    let type: NotificationType
    let scheduledDate: Date
    
    enum NotificationType {
        case task, event, briefing, reminder
    }
}

// MARK: - User Preferences

@MainActor
class UserPreferences: ObservableObject {
    static let shared = UserPreferences()
    
    @Published var hapticFeedbackEnabled: Bool {
        didSet { UserDefaults.standard.set(hapticFeedbackEnabled, forKey: "hapticFeedback") }
    }
    
    @Published var notificationsEnabled: Bool {
        didSet { UserDefaults.standard.set(notificationsEnabled, forKey: "notifications") }
    }
    
    @Published var briefingTime: Date {
        didSet { UserDefaults.standard.set(briefingTime.timeIntervalSince1970, forKey: "briefingTime") }
    }
    
    @Published var theme: AppTheme {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: "theme") }
    }
    
    @Published var defaultTaskPriority: TaskPriority {
        didSet { UserDefaults.standard.set(defaultTaskPriority.rawValue, forKey: "defaultPriority") }
    }
    
    private init() {
        let defaults = UserDefaults.standard
        self.hapticFeedbackEnabled = defaults.bool(forKey: "hapticFeedback")
        self.notificationsEnabled = defaults.bool(forKey: "notifications")
        
        if let timeInterval = defaults.object(forKey: "briefingTime") as? TimeInterval {
            self.briefingTime = Date(timeIntervalSince1970: timeInterval)
        } else {
            // Default to 8 AM
            var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
            components.hour = 8
            components.minute = 0
            self.briefingTime = Calendar.current.date(from: components) ?? Date()
        }
        
        if let themeRaw = defaults.string(forKey: "theme"), let theme = AppTheme(rawValue: themeRaw) {
            self.theme = theme
        } else {
            self.theme = .dark
        }
        
        if let priorityRaw = defaults.object(forKey: "defaultPriority") as? Int, let priority = TaskPriority(rawValue: priorityRaw) {
            self.defaultTaskPriority = priority
        } else {
            self.defaultTaskPriority = .normal
        }
    }
}

enum AppTheme: String, CaseIterable {
    case dark = "dark"
    case oled = "oled"
    case midnight = "midnight"
    
    var displayName: String {
        switch self {
        case .dark: return "Dark"
        case .oled: return "OLED Black"
        case .midnight: return "Midnight"
        }
    }
}
