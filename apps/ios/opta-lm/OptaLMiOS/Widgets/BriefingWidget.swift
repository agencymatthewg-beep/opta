import WidgetKit
import SwiftUI

// MARK: - Briefing Widget

struct BriefingWidget: Widget {
    let kind: String = "BriefingWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BriefingProvider()) { entry in
            BriefingWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Opta Briefing")
        .description("Your daily intelligence summary")
        .supportedFamilies([.systemMedium, .accessoryInline])
    }
}

// MARK: - Briefing Provider

struct BriefingEntry: TimelineEntry {
    let date: Date
    let briefing: WidgetBriefingData
}

struct BriefingProvider: TimelineProvider {
    func placeholder(in context: Context) -> BriefingEntry {
        BriefingEntry(
            date: Date(),
            briefing: WidgetBriefingData(
                greeting: "morning",
                tasksToday: 5,
                eventsCount: 3,
                unreadEmails: 2,
                summary: "All systems nominal. You're in control."
            )
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (BriefingEntry) -> Void) {
        completion(placeholder(in: context))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<BriefingEntry>) -> Void) {
        let entry = placeholder(in: context)
        
        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Briefing Widget View

struct BriefingWidgetView: View {
    var entry: BriefingEntry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemMedium:
            mediumView
        case .accessoryInline:
            inlineView
        default:
            mediumView
        }
    }
    
    // MARK: - Medium View
    
    private var mediumView: some View {
        ZStack {
            Color.widgetVoid
            
            HStack(spacing: 20) {
                // Opta Ring
                ZStack {
                    Circle()
                        .fill(Color.widgetPrimary.opacity(0.1))
                        .frame(width: 70, height: 70)
                    
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [.widgetPrimary, Color(hex: "06B6D4")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3
                        )
                        .frame(width: 60, height: 60)
                    
                    Image(systemName: "sparkles")
                        .font(.title3)
                        .foregroundColor(.widgetPrimary)
                }
                
                // Content
                VStack(alignment: .leading, spacing: 8) {
                    Text("Good \(entry.briefing.greeting)")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(entry.briefing.summary)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(2)
                    
                    // Stats row
                    HStack(spacing: 16) {
                        StatPill(
                            icon: "checkmark.circle",
                            value: entry.briefing.tasksToday,
                            color: .widgetNeonGreen
                        )
                        
                        StatPill(
                            icon: "calendar",
                            value: entry.briefing.eventsCount,
                            color: .widgetNeonBlue
                        )
                        
                        StatPill(
                            icon: "envelope",
                            value: entry.briefing.unreadEmails,
                            color: .widgetNeonAmber
                        )
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
    
    // MARK: - Inline View (Lock Screen)
    
    private var inlineView: some View {
        HStack(spacing: 4) {
            Image(systemName: "sparkles")
            Text("\(entry.briefing.tasksToday) tasks • \(entry.briefing.eventsCount) events")
        }
    }
}

struct StatPill: View {
    let icon: String
    let value: Int
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9))
            
            Text("\(value)")
                .font(.caption2.bold().monospacedDigit())
        }
        .foregroundColor(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15))
        .cornerRadius(8)
    }
}

#Preview(as: .systemMedium) {
    BriefingWidget()
} timeline: {
    BriefingEntry(
        date: Date(),
        briefing: WidgetBriefingData(
            greeting: "morning",
            tasksToday: 5,
            eventsCount: 3,
            unreadEmails: 2,
            summary: "All systems nominal. You're in control."
        )
    )
}
