//
//  QuickActionWidget.swift
//  OptaPlusIOS
//
//  Home screen widget with tappable preset message buttons.
//  Opens OptaPlus and sends the message to the selected bot.
//

import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct QuickActionEntry: TimelineEntry {
    let date: Date
    let actions: [WidgetQuickAction]
    let isPlaceholder: Bool
    
    init(date: Date = Date(), actions: [WidgetQuickAction] = [], isPlaceholder: Bool = false) {
        self.date = date
        self.actions = actions
        self.isPlaceholder = isPlaceholder
    }
}

// MARK: - Timeline Provider

struct QuickActionProvider: TimelineProvider {
    private let dataManager = WidgetDataManager.shared
    
    func placeholder(in context: Context) -> QuickActionEntry {
        QuickActionEntry(
            actions: [
                WidgetQuickAction(id: "1", label: "Status", emoji: "📊", botId: "", message: "status"),
                WidgetQuickAction(id: "2", label: "Hello", emoji: "👋", botId: "", message: "Hello!"),
                WidgetQuickAction(id: "3", label: "Tasks", emoji: "📋", botId: "", message: "What tasks are running?"),
                WidgetQuickAction(id: "4", label: "Summary", emoji: "📝", botId: "", message: "Give me a summary"),
            ],
            isPlaceholder: true
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (QuickActionEntry) -> Void) {
        let actions = dataManager.loadQuickActions()
        completion(QuickActionEntry(actions: actions))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionEntry>) -> Void) {
        let actions = dataManager.loadQuickActions()
        let entry = QuickActionEntry(actions: actions)
        // Quick actions rarely change — refresh every 30 min
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let action: WidgetQuickAction
    
    var body: some View {
        Link(destination: URL(string: "optaplus://send?message=\(action.message.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&bot=\(action.botId)")!) {
            VStack(spacing: 4) {
                Text(action.emoji)
                    .font(.system(size: 20))
                Text(action.label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.white.opacity(0.06))
            )
        }
    }
}

// MARK: - Small Widget View

struct QuickActionSmallView: View {
    let entry: QuickActionEntry
    
    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                ForEach(entry.actions.prefix(2)) { action in
                    QuickActionButton(action: action)
                }
            }
            HStack(spacing: 6) {
                ForEach(entry.actions.dropFirst(2).prefix(2)) { action in
                    QuickActionButton(action: action)
                }
            }
        }
        .padding(8)
        .containerBackground(for: .widget) {
            Color(hex: "#0A0A0A")
        }
    }
}

// MARK: - Medium Widget View

struct QuickActionMediumView: View {
    let entry: QuickActionEntry
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(entry.actions.prefix(4)) { action in
                QuickActionButton(action: action)
            }
        }
        .padding(10)
        .containerBackground(for: .widget) {
            Color(hex: "#0A0A0A")
        }
    }
}

// MARK: - Widget Definition

struct QuickActionWidget: Widget {
    let kind = "com.optamolt.widget.quick-actions"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickActionProvider()) { entry in
            QuickActionSmallView(entry: entry)
        }
        .configurationDisplayName("Quick Actions")
        .description("Send preset messages to your bots with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
