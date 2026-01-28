import Foundation

// MARK: - Local AI Service

/// On-device AI service that provides intelligent responses without requiring a backend
@MainActor
class LocalAIService {
    static let shared = LocalAIService()

    private init() {}

    // MARK: - Process Command

    func processCommand(_ command: String, state: [String: Any] = [:]) async -> AICommandResponse {
        let lowercased = command.lowercased()

        // Calendar/Schedule queries
        if containsAny(lowercased, ["schedule", "calendar", "today", "tomorrow", "meeting", "event", "what's on"]) {
            return handleCalendarQuery(command, lowercased: lowercased)
        }

        // Task queries
        if containsAny(lowercased, ["task", "todo", "to-do", "add a task", "create task", "remind"]) {
            return handleTaskQuery(command, lowercased: lowercased)
        }

        // Email queries
        if containsAny(lowercased, ["email", "inbox", "mail", "unread", "messages"]) {
            return handleEmailQuery(command, lowercased: lowercased)
        }

        // Summary/briefing
        if containsAny(lowercased, ["summary", "briefing", "overview", "status", "how am i doing"]) {
            return handleSummaryQuery()
        }

        // Focus/productivity
        if containsAny(lowercased, ["focus", "productivity", "concentrate", "what should i"]) {
            return handleFocusQuery()
        }

        // Greetings
        if containsAny(lowercased, ["hello", "hi ", "hey", "good morning", "good afternoon", "good evening"]) {
            return handleGreeting()
        }

        // Help
        if containsAny(lowercased, ["help", "what can you do", "capabilities"]) {
            return handleHelp()
        }

        // Default intelligent response
        return handleGeneral(command)
    }

    // MARK: - Query Handlers

    private func handleCalendarQuery(_ command: String, lowercased: String) -> AICommandResponse {
        let hour = Calendar.current.component(.hour, from: Date())
        let timeContext = hour < 12 ? "this morning" : (hour < 17 ? "this afternoon" : "this evening")

        if lowercased.contains("tomorrow") {
            return AICommandResponse(
                success: true,
                message: "I'll help you check tomorrow's schedule. To see your full calendar, tap the Schedule tab below. You can also say 'Schedule a meeting tomorrow at 3pm' to add events.",
                actionType: "CALENDAR",
                payload: nil,
                newState: nil
            )
        }

        if lowercased.contains("schedule") && (lowercased.contains("meeting") || lowercased.contains("event")) {
            // Extract time if mentioned
            let timePattern = #"(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)"#
            if let _ = lowercased.range(of: timePattern, options: .regularExpression) {
                return AICommandResponse(
                    success: true,
                    message: "I'd love to help schedule that! To create events, head to the Schedule tab and tap the + button. You can set the title, time, and any other details there.",
                    actionType: "CALENDAR",
                    payload: nil,
                    newState: nil
                )
            }
        }

        return AICommandResponse(
            success: true,
            message: "Here's what I can tell you about your schedule \(timeContext):\n\nTo view your full calendar and upcoming events, tap the **Schedule** tab at the bottom. From there you can:\n\n• View today's events\n• Browse upcoming days\n• Add new events\n• Set reminders\n\nWould you like me to help you add something to your calendar?",
            actionType: "CALENDAR",
            payload: nil,
            newState: nil
        )
    }

    private func handleTaskQuery(_ command: String, lowercased: String) -> AICommandResponse {
        // Check if they're trying to add a task
        if lowercased.contains("add") || lowercased.contains("create") || lowercased.contains("new") {
            // Try to extract the task content
            let patterns = [
                "add a task:? ?(.+)",
                "add task:? ?(.+)",
                "create a task:? ?(.+)",
                "create task:? ?(.+)",
                "remind me to (.+)",
                "add (.+) to my tasks",
                "task:? ?(.+)"
            ]

            for pattern in patterns {
                if let range = lowercased.range(of: pattern, options: .regularExpression) {
                    let taskContent = String(command[range]).replacingOccurrences(of: "add a task:", with: "")
                        .replacingOccurrences(of: "add task:", with: "")
                        .replacingOccurrences(of: "create a task:", with: "")
                        .replacingOccurrences(of: "create task:", with: "")
                        .replacingOccurrences(of: "remind me to", with: "")
                        .trimmingCharacters(in: .whitespaces)

                    if !taskContent.isEmpty {
                        return AICommandResponse(
                            success: true,
                            message: "Got it! To add '\(taskContent)' as a task:\n\n1. Tap the **Tasks** tab below\n2. Tap the + button\n3. Enter your task details\n\nYou can also set due dates and priorities there!",
                            actionType: "TASK",
                            payload: ["suggestedTask": AnyCodable(taskContent)],
                            newState: nil
                        )
                    }
                }
            }

            return AICommandResponse(
                success: true,
                message: "I can help you create a task! Just tell me what you need to do.\n\nFor example:\n• \"Add a task: Buy groceries\"\n• \"Remind me to call mom\"\n• \"Create task: Finish report by Friday\"",
                actionType: "TASK",
                payload: nil,
                newState: nil
            )
        }

        return AICommandResponse(
            success: true,
            message: "Your tasks are ready to view in the **Tasks** tab!\n\nHere's what you can do:\n• View all your tasks\n• Mark tasks complete\n• Add new tasks\n• Set priorities and due dates\n\nWant me to help you add a new task?",
            actionType: "TASK",
            payload: nil,
            newState: nil
        )
    }

    private func handleEmailQuery(_ command: String, lowercased: String) -> AICommandResponse {
        return AICommandResponse(
            success: true,
            message: "Email integration helps you stay on top of your inbox!\n\nTo check your emails:\n• Your unread count appears on the Dashboard\n• Important emails are highlighted\n\n*Note: Email features require connecting your email account in Settings.*\n\nWould you like help with anything else?",
            actionType: "EMAIL",
            payload: nil,
            newState: nil
        )
    }

    private func handleSummaryQuery() -> AICommandResponse {
        let hour = Calendar.current.component(.hour, from: Date())
        let dayOfWeek = Calendar.current.component(.weekday, from: Date())
        let isWeekend = dayOfWeek == 1 || dayOfWeek == 7

        var greeting: String
        if hour < 12 {
            greeting = "Good morning!"
        } else if hour < 17 {
            greeting = "Good afternoon!"
        } else {
            greeting = "Good evening!"
        }

        let dayContext = isWeekend ? "Enjoy your weekend!" : "Let's make today productive."

        return AICommandResponse(
            success: true,
            message: "\(greeting) \(dayContext)\n\n**Your Opta Overview:**\n\n📋 **Tasks** - Check your task list in the Tasks tab\n📅 **Schedule** - View events in the Schedule tab\n📊 **Dashboard** - See your daily summary\n\nI'm here to help you stay organized. What would you like to focus on?",
            actionType: nil,
            payload: nil,
            newState: nil
        )
    }

    private func handleFocusQuery() -> AICommandResponse {
        let hour = Calendar.current.component(.hour, from: Date())

        var suggestion: String
        if hour < 10 {
            suggestion = "Morning is great for deep work. Consider tackling your most challenging task first while your energy is high."
        } else if hour < 12 {
            suggestion = "Late morning is perfect for meetings and collaboration. Save creative tasks for after lunch."
        } else if hour < 14 {
            suggestion = "Post-lunch can be slower. Try light tasks or a quick walk to refresh."
        } else if hour < 17 {
            suggestion = "Afternoon is good for follow-ups, emails, and wrapping up tasks."
        } else {
            suggestion = "Evening is a good time to plan tomorrow and wind down. Review what you accomplished today!"
        }

        return AICommandResponse(
            success: true,
            message: "**Focus Recommendation:**\n\n\(suggestion)\n\n**Productivity Tips:**\n• Break large tasks into smaller steps\n• Use the 2-minute rule: if it takes less than 2 minutes, do it now\n• Take short breaks every 25-50 minutes\n\nCheck your Tasks tab to see what needs attention!",
            actionType: nil,
            payload: nil,
            newState: nil
        )
    }

    private func handleGreeting() -> AICommandResponse {
        let hour = Calendar.current.component(.hour, from: Date())
        let greeting = hour < 12 ? "Good morning" : (hour < 17 ? "Good afternoon" : "Good evening")

        return AICommandResponse(
            success: true,
            message: "\(greeting)! I'm Opta, your personal assistant.\n\nI can help you with:\n• 📅 Checking your schedule\n• ✅ Managing tasks\n• 📊 Getting productivity insights\n• 🎯 Focusing on what matters\n\nWhat would you like to do?",
            actionType: nil,
            payload: nil,
            newState: nil
        )
    }

    private func handleHelp() -> AICommandResponse {
        return AICommandResponse(
            success: true,
            message: "**Here's what I can help with:**\n\n📅 **Calendar**\n\"What's on my schedule today?\"\n\"Schedule a meeting tomorrow\"\n\n✅ **Tasks**\n\"Add a task: Buy groceries\"\n\"What tasks do I have?\"\n\n📊 **Insights**\n\"Give me my summary\"\n\"What should I focus on?\"\n\n💡 **Tips**\n• Use natural language - I understand context\n• Tap the quick actions below for common commands\n• Check the Dashboard for an overview\n\nHow can I help you today?",
            actionType: nil,
            payload: nil,
            newState: nil
        )
    }

    private func handleGeneral(_ command: String) -> AICommandResponse {
        return AICommandResponse(
            success: true,
            message: "I understand you're asking about: \"\(command)\"\n\nI can help you with:\n• **Schedule** - \"What's on my calendar?\"\n• **Tasks** - \"Add a task\" or \"Show my tasks\"\n• **Focus** - \"What should I work on?\"\n• **Summary** - \"Give me my daily briefing\"\n\nTry rephrasing your request, or tap one of the quick actions below!",
            actionType: nil,
            payload: nil,
            newState: nil
        )
    }

    // MARK: - Helpers

    private func containsAny(_ text: String, _ keywords: [String]) -> Bool {
        for keyword in keywords {
            if text.contains(keyword) {
                return true
            }
        }
        return false
    }
}
