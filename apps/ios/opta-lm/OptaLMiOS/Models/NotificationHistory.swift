import Foundation

// MARK: - Notification History Models

struct NotificationHistoryItem: Identifiable, Codable {
    let id: String
    let type: OptaNotificationType
    let title: String
    let body: String
    let timestamp: Date
    let wasRead: Bool

    var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: timestamp, relativeTo: Date())
    }

    var dateString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
}

// MARK: - Notification History Manager

@Observable
final class NotificationHistoryManager {
    static let shared = NotificationHistoryManager()

    private(set) var history: [NotificationHistoryItem] = []
    private let historyKey = "opta.notificationHistory"
    private let maxHistoryDays = 7
    private let maxHistoryItems = 100

    private init() {
        loadHistory()
        clearOldHistory()
    }

    // MARK: - Add to History

    func logNotification(id: String, type: OptaNotificationType, title: String, body: String) {
        let item = NotificationHistoryItem(
            id: id,
            type: type,
            title: title,
            body: body,
            timestamp: Date(),
            wasRead: false
        )

        history.insert(item, at: 0) // Most recent first

        // Limit history size
        if history.count > maxHistoryItems {
            history = Array(history.prefix(maxHistoryItems))
        }

        saveHistory()
    }

    // MARK: - Mark as Read

    func markAsRead(id: String) {
        if let index = history.firstIndex(where: { $0.id == id }) {
            var item = history[index]
            let updatedItem = NotificationHistoryItem(
                id: item.id,
                type: item.type,
                title: item.title,
                body: item.body,
                timestamp: item.timestamp,
                wasRead: true
            )
            history[index] = updatedItem
            saveHistory()
        }
    }

    // MARK: - Clear History

    func clearHistory() {
        history.removeAll()
        saveHistory()
    }

    func clearOldHistory() {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -maxHistoryDays, to: Date()) ?? Date()
        history.removeAll { $0.timestamp < cutoffDate }
        saveHistory()
    }

    // MARK: - Persistence

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: historyKey),
              let decoded = try? JSONDecoder().decode([NotificationHistoryItem].self, from: data) else {
            return
        }
        history = decoded
    }

    private func saveHistory() {
        guard let encoded = try? JSONEncoder().encode(history) else { return }
        UserDefaults.standard.set(encoded, forKey: historyKey)
    }

    // MARK: - Stats

    var totalNotifications: Int {
        history.count
    }

    var todayNotifications: Int {
        let calendar = Calendar.current
        return history.filter { calendar.isDateInToday($0.timestamp) }.count
    }

    var unreadCount: Int {
        history.filter { !$0.wasRead }.count
    }

    func notificationsGroupedByDate() -> [(Date, [NotificationHistoryItem])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: history) { item in
            calendar.startOfDay(for: item.timestamp)
        }

        return grouped.sorted { $0.key > $1.key }
            .map { ($0.key, $0.value.sorted { $0.timestamp > $1.timestamp }) }
    }
}
