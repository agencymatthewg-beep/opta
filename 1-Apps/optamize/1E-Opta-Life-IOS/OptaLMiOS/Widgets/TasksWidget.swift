import WidgetKit
import SwiftUI

// MARK: - Tasks Widget

struct TasksWidget: Widget {
    let kind: String = "TasksWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksProvider()) { entry in
            TasksWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Tasks")
        .description("View your Todoist tasks at a glance")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Tasks Provider

struct TasksEntry: TimelineEntry {
    let date: Date
    let tasks: [WidgetTaskData]
    let stats: (today: Int, overdue: Int, total: Int)
}

struct TasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(
            date: Date(),
            tasks: [
                WidgetTaskData(content: "Review project proposal", priority: 4, dueString: "Today"),
                WidgetTaskData(content: "Team standup", priority: 3, dueString: "10:00 AM"),
                WidgetTaskData(content: "Send weekly report", priority: 2, dueString: "Tomorrow")
            ],
            stats: (today: 5, overdue: 2, total: 12)
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        let entry = placeholder(in: context)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        // In production, fetch from API
        // For now, use placeholder data
        let entry = placeholder(in: context)
        
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Tasks Widget View

struct TasksWidgetView: View {
    var entry: TasksEntry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .systemMedium:
            mediumView
        case .systemLarge:
            largeView
        case .accessoryCircular:
            circularView
        case .accessoryRectangular:
            rectangularView
        default:
            smallView
        }
    }
    
    // MARK: - Small Widget
    
    private var smallView: some View {
        ZStack {
            Color.widgetVoid
            
            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack {
                    Image(systemName: "checklist")
                        .foregroundColor(.widgetPrimary)
                    Text("TASKS")
                        .font(.caption2.bold())
                        .foregroundColor(.white.opacity(0.6))
                        .tracking(1)
                    Spacer()
                }
                
                // Count
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(entry.stats.today)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundColor(.widgetNeonGreen)
                    
                    Text("today")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
                
                Spacer()
                
                // First task preview
                if let firstTask = entry.tasks.first {
                    HStack(spacing: 6) {
                        Circle()
                            .stroke(priorityColor(firstTask.priority), lineWidth: 2)
                            .frame(width: 12, height: 12)
                        
                        Text(firstTask.content)
                            .font(.caption)
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }
                
                // Overdue indicator
                if entry.stats.overdue > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2)
                        Text("\(entry.stats.overdue) overdue")
                            .font(.caption2)
                    }
                    .foregroundColor(.red.opacity(0.8))
                }
            }
            .padding()
        }
    }
    
    // MARK: - Medium Widget
    
    private var mediumView: some View {
        ZStack {
            Color.widgetVoid
            
            HStack(spacing: 16) {
                // Stats column
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "checklist")
                            .foregroundColor(.widgetPrimary)
                        Text("TASKS")
                            .font(.caption2.bold())
                            .foregroundColor(.white.opacity(0.6))
                            .tracking(1)
                    }
                    
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(entry.stats.today)")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundColor(.widgetNeonGreen)
                        Text("/ \(entry.stats.total)")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    
                    if entry.stats.overdue > 0 {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 6, height: 6)
                            Text("\(entry.stats.overdue) overdue")
                                .font(.caption2)
                                .foregroundColor(.red.opacity(0.8))
                        }
                    }
                    
                    Spacer()
                }
                .frame(width: 100)
                
                // Tasks list
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(entry.tasks.prefix(4), id: \.content) { task in
                        HStack(spacing: 8) {
                            Circle()
                                .stroke(priorityColor(task.priority), lineWidth: 2)
                                .frame(width: 14, height: 14)
                            
                            VStack(alignment: .leading, spacing: 1) {
                                Text(task.content)
                                    .font(.caption)
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                
                                if let due = task.dueString {
                                    Text(due)
                                        .font(.system(size: 9))
                                        .foregroundColor(.white.opacity(0.5))
                                }
                            }
                        }
                    }
                    Spacer()
                }
            }
            .padding()
        }
    }
    
    // MARK: - Large Widget
    
    private var largeView: some View {
        ZStack {
            Color.widgetVoid
            
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack {
                    Image(systemName: "checklist")
                        .foregroundColor(.widgetPrimary)
                    Text("TASKS")
                        .font(.caption.bold())
                        .foregroundColor(.white.opacity(0.6))
                        .tracking(2)
                    
                    Spacer()
                    
                    HStack(spacing: 4) {
                        Text("\(entry.stats.today)")
                            .font(.title3.bold())
                            .foregroundColor(.widgetNeonGreen)
                        Text("today")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                
                Divider().background(Color.white.opacity(0.1))
                
                // Full task list
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(entry.tasks.prefix(8), id: \.content) { task in
                        HStack(spacing: 12) {
                            Circle()
                                .stroke(priorityColor(task.priority), lineWidth: 2)
                                .frame(width: 18, height: 18)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.content)
                                    .font(.subheadline)
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                
                                if let due = task.dueString {
                                    Text(due)
                                        .font(.caption2)
                                        .foregroundColor(.white.opacity(0.5))
                                }
                            }
                            
                            Spacer()
                            
                            if task.priority >= 3 {
                                Image(systemName: "flag.fill")
                                    .font(.caption2)
                                    .foregroundColor(priorityColor(task.priority))
                            }
                        }
                    }
                }
                
                Spacer()
                
                // Footer
                if entry.stats.overdue > 0 {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                        Text("\(entry.stats.overdue) overdue tasks")
                            .font(.caption)
                    }
                    .foregroundColor(.red.opacity(0.8))
                }
            }
            .padding()
        }
    }
    
    // MARK: - Lock Screen Widgets
    
    private var circularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            
            VStack(spacing: 2) {
                Text("\(entry.stats.today)")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                
                Text("tasks")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private var rectangularView: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: "checklist")
                        .font(.caption2)
                    Text("\(entry.stats.today) tasks today")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                if let firstTask = entry.tasks.first {
                    Text(firstTask.content)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
        }
    }
    
    // MARK: - Helpers
    
    private func priorityColor(_ priority: Int) -> Color {
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .blue
        default: return .white.opacity(0.4)
        }
    }
}

#Preview(as: .systemMedium) {
    TasksWidget()
} timeline: {
    TasksEntry(
        date: Date(),
        tasks: [
            WidgetTaskData(content: "Review project proposal", priority: 4, dueString: "Today"),
            WidgetTaskData(content: "Team standup", priority: 3, dueString: "10:00 AM"),
            WidgetTaskData(content: "Send weekly report", priority: 2, dueString: "Tomorrow"),
            WidgetTaskData(content: "Update documentation", priority: 1, dueString: nil)
        ],
        stats: (today: 5, overdue: 2, total: 12)
    )
}
