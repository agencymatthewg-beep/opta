import WidgetKit
import SwiftUI

// MARK: - Calendar Widget

struct CalendarWidget: Widget {
    let kind: String = "CalendarWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            CalendarWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Schedule")
        .description("Your upcoming calendar events")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

// MARK: - Calendar Provider

struct CalendarEntry: TimelineEntry {
    let date: Date
    let events: [WidgetEventData]
}

struct CalendarProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(
            date: Date(),
            events: [
                WidgetEventData(summary: "Team Standup", time: "10:00 AM", isAllDay: false),
                WidgetEventData(summary: "Project Review", time: "2:30 PM", isAllDay: false),
                WidgetEventData(summary: "Client Call", time: "4:00 PM", isAllDay: false)
            ]
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
        completion(placeholder(in: context))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
        let entry = placeholder(in: context)
        
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Calendar Widget View

struct CalendarWidgetView: View {
    var entry: CalendarEntry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .systemMedium:
            mediumView
        case .accessoryRectangular:
            rectangularView
        default:
            smallView
        }
    }
    
    // MARK: - Small View
    
    private var smallView: some View {
        ZStack {
            Color.widgetVoid
            
            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(.widgetNeonBlue)
                    Text("SCHEDULE")
                        .font(.caption2.bold())
                        .foregroundColor(.white.opacity(0.6))
                        .tracking(1)
                    Spacer()
                }
                
                if entry.events.isEmpty {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.3))
                        Text("Clear")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    // Next event highlight
                    if let next = entry.events.first {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Next")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.5))
                            
                            Text(next.summary)
                                .font(.subheadline.bold())
                                .foregroundColor(.white)
                                .lineLimit(2)
                            
                            Text(next.time)
                                .font(.caption.bold().monospacedDigit())
                                .foregroundColor(.widgetNeonBlue)
                        }
                    }
                    
                    Spacer()
                    
                    // Count
                    Text("\(entry.events.count) event\(entry.events.count == 1 ? "" : "s") today")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding()
        }
    }
    
    // MARK: - Medium View
    
    private var mediumView: some View {
        ZStack {
            Color.widgetVoid
            
            HStack(spacing: 16) {
                // Next event highlight
                if let next = entry.events.first {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "calendar")
                                .foregroundColor(.widgetNeonBlue)
                            Text("NEXT UP")
                                .font(.caption2.bold())
                                .foregroundColor(.white.opacity(0.6))
                                .tracking(1)
                        }
                        
                        Text(next.summary)
                            .font(.headline)
                            .foregroundColor(.white)
                            .lineLimit(2)
                        
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.caption2)
                            Text(next.time)
                                .font(.caption.bold().monospacedDigit())
                        }
                        .foregroundColor(.widgetNeonBlue)
                        
                        Spacer()
                    }
                    .frame(width: 140)
                }
                
                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 1)
                
                // Event list
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(entry.events.dropFirst().prefix(3), id: \.summary) { event in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.widgetNeonBlue)
                                .frame(width: 6, height: 6)
                            
                            VStack(alignment: .leading, spacing: 1) {
                                Text(event.summary)
                                    .font(.caption)
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                
                                Text(event.time)
                                    .font(.system(size: 9).monospacedDigit())
                                    .foregroundColor(.white.opacity(0.5))
                            }
                            
                            Spacer()
                        }
                    }
                    
                    Spacer()
                }
            }
            .padding()
        }
    }
    
    // MARK: - Rectangular (Lock Screen)
    
    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let next = entry.events.first {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption2)
                    Text(next.time)
                        .font(.caption2.bold())
                }
                
                Text(next.summary)
                    .font(.caption)
                    .lineLimit(1)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                    Text("No events")
                }
                .font(.caption)
            }
        }
    }
}

#Preview(as: .systemMedium) {
    CalendarWidget()
} timeline: {
    CalendarEntry(
        date: Date(),
        events: [
            WidgetEventData(summary: "Team Standup", time: "10:00 AM", isAllDay: false),
            WidgetEventData(summary: "Project Review", time: "2:30 PM", isAllDay: false),
            WidgetEventData(summary: "Client Call", time: "4:00 PM", isAllDay: false)
        ]
    )
}
