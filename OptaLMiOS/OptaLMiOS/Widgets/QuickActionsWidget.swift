import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Quick Actions Widget

struct QuickActionsWidget: Widget {
    let kind: String = "QuickActionsWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickActionsProvider()) { entry in
            QuickActionsWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Quick Actions")
        .description("Quickly add tasks, events, or ask Opta")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Quick Actions Provider

struct QuickActionsEntry: TimelineEntry {
    let date: Date
}

struct QuickActionsProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickActionsEntry {
        QuickActionsEntry(date: Date())
    }
    
    func getSnapshot(in context: Context, completion: @escaping (QuickActionsEntry) -> Void) {
        completion(QuickActionsEntry(date: Date()))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionsEntry>) -> Void) {
        let entry = QuickActionsEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

// MARK: - Quick Actions Widget View

struct QuickActionsWidgetView: View {
    var entry: QuickActionsEntry
    
    var body: some View {
        ZStack {
            Color.widgetVoid
            
            VStack(spacing: 12) {
                // Header
                HStack {
                    Image(systemName: "sparkles")
                        .foregroundColor(.widgetPrimary)
                    Text("QUICK ACTIONS")
                        .font(.caption2.bold())
                        .foregroundColor(.white.opacity(0.6))
                        .tracking(1)
                    Spacer()
                }
                
                // Action buttons
                HStack(spacing: 12) {
                    WidgetActionButton(
                        icon: "plus.circle.fill",
                        label: "Add Task",
                        color: .widgetNeonGreen,
                        intent: AddTaskWidgetIntent()
                    )
                    
                    WidgetActionButton(
                        icon: "calendar.badge.plus",
                        label: "Add Event",
                        color: .widgetNeonBlue,
                        intent: CreateEventWidgetIntent()
                    )
                    
                    WidgetActionButton(
                        icon: "sparkles",
                        label: "Ask Opta",
                        color: .widgetPrimary,
                        intent: AskOptaWidgetIntent()
                    )
                    
                    WidgetActionButton(
                        icon: "info.circle.fill",
                        label: "Briefing",
                        color: Color(hex: "06B6D4"),
                        intent: GetBriefingWidgetIntent()
                    )
                }
            }
            .padding()
        }
    }
}

struct WidgetActionButton<I: AppIntent>: View {
    let icon: String
    let label: String
    let color: Color
    let intent: I
    
    var body: some View {
        Button(intent: intent) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(color.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(color.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Widget Intents

struct AddTaskWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task"
    static var openAppWhenRun: Bool = true
    
    func perform() async throws -> some IntentResult {
        // Opens the app to add task screen
        return .result()
    }
}

struct CreateEventWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Event"
    static var openAppWhenRun: Bool = true
    
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct AskOptaWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Opta"
    static var openAppWhenRun: Bool = true
    
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct GetBriefingWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Briefing"
    static var openAppWhenRun: Bool = false
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        do {
            let briefing = try await api.fetchBriefing()
            
            var response = "Good \(briefing.greeting). "
            response += "\(briefing.stats.tasksToday) tasks today. "
            response += "\(briefing.stats.upcomingEvents) events upcoming."
            
            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            return .result(dialog: "Unable to fetch briefing.")
        }
    }
}

#Preview(as: .systemMedium) {
    QuickActionsWidget()
} timeline: {
    QuickActionsEntry(date: Date())
}
