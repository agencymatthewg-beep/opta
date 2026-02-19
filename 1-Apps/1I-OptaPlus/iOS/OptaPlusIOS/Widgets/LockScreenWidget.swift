//
//  LockScreenWidget.swift
//  OptaPlusIOS
//
//  Lock screen widgets — AccessoryCircular showing bot count/status dots.
//  iOS 17+, WidgetKit.
//

import WidgetKit
import SwiftUI

// MARK: - Lock Screen Circular View

struct LockScreenCircularView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        ZStack {
            // Background ring showing ratio of connected bots
            if entry.totalCount > 0 {
                let ratio = Double(entry.connectedCount) / Double(entry.totalCount)
                Circle()
                    .trim(from: 0, to: ratio)
                    .stroke(
                        Color(hex: "#8B5CF6"),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                
                Circle()
                    .trim(from: ratio, to: 1.0)
                    .stroke(
                        Color.white.opacity(0.15),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
            }
            
            // Center content
            VStack(spacing: 1) {
                Text("\(entry.connectedCount)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("bots")
                    .font(.system(size: 8, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .widgetLabel {
            Text("OptaPlus")
        }
    }
}

// MARK: - Lock Screen Rectangular View

struct LockScreenRectangularView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        HStack(spacing: 8) {
            // Status dots
            VStack(spacing: 3) {
                ForEach(entry.bots.prefix(3)) { bot in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(bot.isConnected ? Color.green : Color.red)
                            .frame(width: 6, height: 6)
                        Text(bot.name)
                            .font(.system(size: 11, weight: .medium))
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
        }
    }
}

// MARK: - Lock Screen Inline View

struct LockScreenInlineView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "circle.hexagongrid")
            Text("\(entry.connectedCount)/\(entry.totalCount) bots online")
        }
    }
}

// MARK: - Widget Definition

struct LockScreenBotWidget: Widget {
    let kind = "com.optamolt.widget.lockscreen-bots"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BotStatusProvider()) { entry in
            switch WidgetFamily.accessoryCircular {
            default:
                LockScreenCircularView(entry: entry)
            }
        }
        .configurationDisplayName("Bot Status")
        .description("See bot connection status at a glance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
