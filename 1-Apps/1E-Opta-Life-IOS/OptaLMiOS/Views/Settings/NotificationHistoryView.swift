import SwiftUI

struct NotificationHistoryView: View {
    @State private var historyManager = NotificationHistoryManager.shared

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Stats Header
                if !historyManager.history.isEmpty {
                    statsHeader
                        .padding()
                }

                // History List
                if historyManager.history.isEmpty {
                    emptyState
                } else {
                    historyList
                }
            }
        }
        .navigationTitle("Notification History")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        historyManager.clearHistory()
                        HapticManager.shared.impact(.medium)
                    } label: {
                        Label("Clear All", systemImage: "trash")
                    }

                    Button {
                        historyManager.clearOldHistory()
                        HapticManager.shared.impact(.light)
                    } label: {
                        Label("Clear Old (7+ days)", systemImage: "clock.arrow.circlepath")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundColor(.optaPrimary)
                }
            }
        }
    }

    // MARK: - Stats Header

    private var statsHeader: some View {
        HStack(spacing: 20) {
            StatBadge(
                icon: "bell.badge",
                value: "\(historyManager.totalNotifications)",
                label: "Total",
                color: .optaPrimary
            )

            StatBadge(
                icon: "sun.max",
                value: "\(historyManager.todayNotifications)",
                label: "Today",
                color: .optaNeonBlue
            )

            StatBadge(
                icon: "envelope.badge",
                value: "\(historyManager.unreadCount)",
                label: "Unread",
                color: .optaNeonCyan
            )
        }
        .padding()
        .background(Color.optaGlassBackground)
        .glassPanel(cornerRadius: 12)
    }

    // MARK: - History List

    private var historyList: some View {
        ScrollView {
            LazyVStack(spacing: 16, pinnedViews: .sectionHeaders) {
                ForEach(historyManager.notificationsGroupedByDate(), id: \.0) { date, items in
                    Section {
                        ForEach(items) { item in
                            NotificationHistoryRow(item: item) {
                                historyManager.markAsRead(id: item.id)
                            }
                        }
                    } header: {
                        Text(dateHeaderText(for: date))
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.optaTextMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                            .padding(.vertical, 8)
                            .background(Color.optaVoid.opacity(0.95))
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "bell.slash")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)

            Text("No Notifications Yet")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)

            Text("Your notification history will appear here")
                .font(.caption)
                .foregroundColor(.optaTextMuted)

            Spacer()
        }
    }

    // MARK: - Helpers

    private func dateHeaderText(for date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE, MMM d"
            return formatter.string(from: date)
        }
    }
}

// MARK: - Notification History Row

struct NotificationHistoryRow: View {
    let item: NotificationHistoryItem
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
            HapticManager.shared.impact(.light)
        } label: {
            HStack(spacing: 12) {
                // Type Icon
                Image(systemName: item.type.icon)
                    .font(.title3)
                    .foregroundColor(item.type.color)
                    .frame(width: 32, height: 32)
                    .background(item.type.color.opacity(0.2))
                    .cornerRadius(8)

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.optaTextPrimary)
                        .lineLimit(1)

                    Text(item.body)
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(2)

                    Text(item.timeAgo)
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()

                // Unread indicator
                if !item.wasRead {
                    Circle()
                        .fill(Color.optaNeonBlue)
                        .frame(width: 8, height: 8)
                }
            }
            .padding()
            .background(
                item.wasRead
                    ? Color.optaGlassBackground
                    : Color.optaGlassBackground.opacity(1.5)
            )
            .glassPanel(cornerRadius: 12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        NotificationHistoryView()
    }
}
