import AppIntents

// MARK: - Opta LM App Shortcuts Provider

struct OptaLMShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // MARK: Core Intents (Original)

        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task to \(.applicationName)",
                "Create a task in \(.applicationName)"
            ],
            shortTitle: "Add Task",
            systemImageName: "checklist"
        )

        AppShortcut(
            intent: GetBriefingIntent(),
            phrases: [
                "What's on my \(.applicationName) schedule?",
                "Give me my \(.applicationName) briefing",
                "\(.applicationName) status",
                "What's my day look like in \(.applicationName)?"
            ],
            shortTitle: "Daily Briefing",
            systemImageName: "sparkles"
        )

        AppShortcut(
            intent: AskOptaIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Hey \(.applicationName)"
            ],
            shortTitle: "Ask Opta LM",
            systemImageName: "bubble.left.and.bubble.right"
        )

        AppShortcut(
            intent: CreateEventIntent(),
            phrases: [
                "Add event to \(.applicationName)",
                "Create meeting in \(.applicationName)"
            ],
            shortTitle: "Create Event",
            systemImageName: "calendar.badge.plus"
        )

        AppShortcut(
            intent: GetQuickStatusIntent(),
            phrases: [
                "\(.applicationName) quick status",
                "What's next in \(.applicationName)?",
                "\(.applicationName) summary"
            ],
            shortTitle: "Quick Status",
            systemImageName: "info.circle"
        )

        // MARK: Calendar Intents (Phase 4)

        AppShortcut(
            intent: ViewUnifiedCalendarIntent(),
            phrases: [
                "Show all my calendars in \(.applicationName)",
                "Unified calendar in \(.applicationName)"
            ],
            shortTitle: "Unified Calendar",
            systemImageName: "calendar"
        )

        AppShortcut(
            intent: AddToAppleCalendarIntent(),
            phrases: [
                "Add to Apple Calendar via \(.applicationName)",
                "Create Apple Calendar event in \(.applicationName)"
            ],
            shortTitle: "Add to Apple Calendar",
            systemImageName: "calendar.badge.plus"
        )

        AppShortcut(
            intent: CreateInBothCalendarsIntent(),
            phrases: [
                "Create event in both calendars in \(.applicationName)",
                "Add to all calendars in \(.applicationName)"
            ],
            shortTitle: "Both Calendars",
            systemImageName: "calendar.badge.checkmark"
        )

        AppShortcut(
            intent: SyncCalendarsIntent(),
            phrases: [
                "Sync my calendars in \(.applicationName)",
                "Calendar sync in \(.applicationName)"
            ],
            shortTitle: "Sync Calendars",
            systemImageName: "arrow.triangle.2.circlepath"
        )

        // MARK: Reminders Intents (Phase 4)

        AppShortcut(
            intent: ViewRemindersIntent(),
            phrases: [
                "Show my reminders in \(.applicationName)",
                "View reminders in \(.applicationName)"
            ],
            shortTitle: "View Reminders",
            systemImageName: "checklist.checked"
        )

        AppShortcut(
            intent: AddToRemindersIntent(),
            phrases: [
                "Add reminder via \(.applicationName)",
                "Create reminder in \(.applicationName)"
            ],
            shortTitle: "Add Reminder",
            systemImageName: "plus.circle"
        )

        AppShortcut(
            intent: CompleteReminderIntent(),
            phrases: [
                "Complete reminder in \(.applicationName)",
                "Mark reminder done in \(.applicationName)"
            ],
            shortTitle: "Complete Reminder",
            systemImageName: "checkmark.circle.fill"
        )

        AppShortcut(
            intent: ImportRemindersToOptaIntent(),
            phrases: [
                "Import reminders to \(.applicationName)",
                "Sync reminders to \(.applicationName)"
            ],
            shortTitle: "Import Reminders",
            systemImageName: "square.and.arrow.down"
        )

        // MARK: Health Intents (Phase 4)

        AppShortcut(
            intent: GetSleepInsightIntent(),
            phrases: [
                "How did I sleep in \(.applicationName)?",
                "Sleep insight in \(.applicationName)"
            ],
            shortTitle: "Sleep Insight",
            systemImageName: "bed.double.fill"
        )

        AppShortcut(
            intent: GetActivityInsightIntent(),
            phrases: [
                "How active was I in \(.applicationName)?",
                "Activity insight in \(.applicationName)"
            ],
            shortTitle: "Activity Insight",
            systemImageName: "figure.walk"
        )

        AppShortcut(
            intent: GetProductivityCorrelationIntent(),
            phrases: [
                "Productivity correlation in \(.applicationName)",
                "Sleep vs productivity in \(.applicationName)"
            ],
            shortTitle: "Productivity Analysis",
            systemImageName: "chart.line.uptrend.xyaxis"
        )

        AppShortcut(
            intent: LogWorkoutIntent(),
            phrases: [
                "Log workout in \(.applicationName)",
                "Record exercise in \(.applicationName)"
            ],
            shortTitle: "Log Workout",
            systemImageName: "figure.run"
        )

        // MARK: Tasks Intents (Phase 4)

        AppShortcut(
            intent: GetUnifiedTodoListIntent(),
            phrases: [
                "Show all my tasks in \(.applicationName)",
                "Unified todo list in \(.applicationName)"
            ],
            shortTitle: "All Tasks",
            systemImageName: "list.bullet"
        )

        AppShortcut(
            intent: AddToTodoistIntent(),
            phrases: [
                "Add to Todoist via \(.applicationName)",
                "Create Todoist task in \(.applicationName)"
            ],
            shortTitle: "Add to Todoist",
            systemImageName: "plus.square"
        )

        AppShortcut(
            intent: SyncTodoistIntent(),
            phrases: [
                "Sync Todoist in \(.applicationName)",
                "Todoist sync in \(.applicationName)"
            ],
            shortTitle: "Sync Todoist",
            systemImageName: "arrow.triangle.2.circlepath"
        )

        // MARK: Smart Intents (Phase 4)

        AppShortcut(
            intent: SmartEventSuggestionsIntent(),
            phrases: [
                "Suggest events in \(.applicationName)",
                "Smart suggestions in \(.applicationName)"
            ],
            shortTitle: "Smart Suggestions",
            systemImageName: "sparkles"
        )

        AppShortcut(
            intent: SmartTimeBlockingIntent(),
            phrases: [
                "Block time for tasks in \(.applicationName)",
                "Time blocking in \(.applicationName)"
            ],
            shortTitle: "Time Blocking",
            systemImageName: "rectangle.split.3x3"
        )

        AppShortcut(
            intent: OptimizeDayIntent(),
            phrases: [
                "Optimize my day in \(.applicationName)",
                "Day optimization in \(.applicationName)"
            ],
            shortTitle: "Optimize Day",
            systemImageName: "wand.and.stars"
        )
    }
}
