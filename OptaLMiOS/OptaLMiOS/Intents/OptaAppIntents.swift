import AppIntents

// MARK: - Opta LM App Shortcuts Provider

struct OptaLMShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
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
    }
}
