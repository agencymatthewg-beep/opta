import AppIntents

// MARK: - Opta LM App Shortcuts Provider

struct OptaLMShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // iOS supports at most 10 App Shortcuts per app.
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
            intent: CompleteTaskIntent(),
            phrases: [
                "Complete a task in \(.applicationName)",
                "Mark task done in \(.applicationName)"
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.circle.fill"
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

        AppShortcut(
            intent: DeleteEventIntent(),
            phrases: [
                "Delete an event in \(.applicationName)",
                "Remove event from \(.applicationName)"
            ],
            shortTitle: "Delete Event",
            systemImageName: "calendar.badge.minus"
        )

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
            intent: SmartEventSuggestionsIntent(),
            phrases: [
                "Suggest events in \(.applicationName)",
                "Smart suggestions in \(.applicationName)"
            ],
            shortTitle: "Smart Suggestions",
            systemImageName: "sparkles"
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
