import SwiftUI

struct NotificationTestSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                List {
                    Section {
                        ForEach(OptaNotificationType.allCases) { type in
                            Button {
                                testNotification(type)
                            } label: {
                                HStack(spacing: 16) {
                                    Image(systemName: type.iconName)
                                        .font(.system(size: 20))
                                        .foregroundStyle(Color.optaPrimary)
                                        .frame(width: 28)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(type.displayName)
                                            .font(.system(size: 16, weight: .medium))
                                            .foregroundStyle(Color.optaTextPrimary)

                                        Text("Tap to test")
                                            .font(.system(size: 13))
                                            .foregroundStyle(Color.optaTextSecondary)
                                    }

                                    Spacer()

                                    Image(systemName: "paperplane.fill")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.optaTextMuted)
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowBackground(Color.optaGlassBackground)
                        }
                    } header: {
                        Text("Send Test Notifications")
                            .foregroundStyle(Color.optaTextSecondary)
                    } footer: {
                        Text("Test each notification type to see how it appears")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Test Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Color.optaPrimary)
                }
            }
            .toolbarBackground(Color.optaVoid, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func testNotification(_ type: OptaNotificationType) {
        HapticManager.shared.impact(.light)

        let manager = NotificationManager.shared

        switch type {
        case .taskReminder:
            manager.scheduleNotification(
                .taskReminder,
                title: "Task Reminder",
                body: "Complete your weekly review"
            )

        case .eventReminder:
            manager.scheduleNotification(
                .eventReminder,
                title: "Upcoming Event",
                body: "Team meeting in 15 minutes"
            )

        case .dailyBriefing:
            manager.scheduleDailyBriefing()

        case .aiInsight:
            manager.notifyAIInsight(message: "You're most productive between 9 AM - 11 AM")

        case .goalMilestone:
            manager.notifyGoalMilestone(goal: "Fitness Goal", progress: 75)

        case .habitStreak:
            manager.notifyHabitStreak(habit: "Morning Exercise", days: 7)

        case .focusSession:
            manager.scheduleFocusReminder(message: "Time for a break", at: Date().addingTimeInterval(5))

        case .lowPriority:
            manager.notifyLowPriority(message: "Background sync completed")
        }
    }
}
