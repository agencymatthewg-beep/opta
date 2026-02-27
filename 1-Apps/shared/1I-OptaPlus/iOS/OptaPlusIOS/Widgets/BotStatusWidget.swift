//
//  BotStatusWidget.swift
//  OptaPlusIOS
//
//  Home screen widget showing connected bots + last message.
//  WidgetKit, iOS 17+, Cinematic Void design.
//

import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct BotStatusEntry: TimelineEntry {
    let date: Date
    let bots: [WidgetBotInfo]
    let isPlaceholder: Bool
    
    init(date: Date = Date(), bots: [WidgetBotInfo] = [], isPlaceholder: Bool = false) {
        self.date = date
        self.bots = bots
        self.isPlaceholder = isPlaceholder
    }
    
    var connectedCount: Int { bots.filter(\.isConnected).count }
    var totalCount: Int { bots.count }
}

// MARK: - Timeline Provider

struct BotStatusProvider: TimelineProvider {
    private let dataManager = WidgetDataManager.shared
    
    func placeholder(in context: Context) -> BotStatusEntry {
        BotStatusEntry(
            bots: [
                WidgetBotInfo(id: "1", name: "Opta Max", emoji: "🥷🏿", isConnected: true, lastMessage: "Task complete.", lastMessageDate: Date(), accentColorHex: "#8B5CF6"),
                WidgetBotInfo(id: "2", name: "Mono", emoji: "🟢", isConnected: true, lastMessage: nil, lastMessageDate: nil, accentColorHex: "#22C55E"),
                WidgetBotInfo(id: "3", name: "Opta512", emoji: "🟣", isConnected: false, lastMessage: nil, lastMessageDate: nil, accentColorHex: "#A855F7"),
            ],
            isPlaceholder: true
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (BotStatusEntry) -> Void) {
        let bots = dataManager.loadBots()
        completion(BotStatusEntry(bots: bots))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<BotStatusEntry>) -> Void) {
        let bots = dataManager.loadBots()
        let entry = BotStatusEntry(bots: bots)
        // Refresh every 5 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Small Widget View

struct BotStatusSmallView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack {
                Text("OptaPlus")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(entry.connectedCount)/\(entry.totalCount)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color(hex: "#A78BFA"))
            }
            
            // Bot list
            VStack(alignment: .leading, spacing: 4) {
                ForEach(entry.bots.prefix(4)) { bot in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(bot.isConnected ? Color(hex: "#22C55E") : Color(hex: "#EF4444"))
                            .frame(width: 6, height: 6)
                        Text(bot.emoji)
                            .font(.system(size: 11))
                        Text(bot.name)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                        Spacer()
                    }
                }
            }
            
            Spacer(minLength: 0)
            
            // Last message preview
            if let firstBot = entry.bots.first(where: { $0.lastMessage != nil }),
               let msg = firstBot.lastMessage {
                Text(msg)
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1)
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            Color(hex: "#0A0A0A")
        }
    }
}

// MARK: - Medium Widget View

struct BotStatusMediumView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        HStack(spacing: 12) {
            // Left: Bot grid
            VStack(alignment: .leading, spacing: 6) {
                Text("OptaPlus")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                
                ForEach(entry.bots.prefix(5)) { bot in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(bot.isConnected ? Color(hex: "#22C55E") : Color(hex: "#EF4444"))
                            .frame(width: 7, height: 7)
                        Text(bot.emoji)
                            .font(.system(size: 12))
                        Text(bot.name)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Right: Last messages
            VStack(alignment: .trailing, spacing: 8) {
                Text("\(entry.connectedCount) online")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: "#A78BFA"))
                
                Spacer(minLength: 0)
                
                ForEach(entry.bots.filter({ $0.lastMessage != nil }).prefix(3)) { bot in
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(bot.name)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.6))
                        Text(bot.lastMessage ?? "")
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.4))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(14)
        .containerBackground(for: .widget) {
            Color(hex: "#0A0A0A")
        }
    }
}

// MARK: - Widget Definition

struct BotStatusWidget: Widget {
    let kind = "com.optamolt.widget.bot-status"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BotStatusProvider()) { entry in
            switch entry.bots.isEmpty && !entry.isPlaceholder {
            case true:
                Text("Open OptaPlus to set up bots")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                    .containerBackground(for: .widget) { Color(hex: "#0A0A0A") }
            case false:
                // WidgetKit picks the right view based on family
                BotStatusSmallView(entry: entry)
            }
        }
        .configurationDisplayName("Bot Status")
        .description("Monitor your connected bots and recent messages.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
