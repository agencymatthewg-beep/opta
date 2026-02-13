//
//  BotProfileSheet.swift
//  OptaPlusMacOS
//
//  Bot profile detail sheet — glass card with animated glow,
//  connection info, session stats, and accent color tinting.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Bot Profile Sheet

struct BotProfileSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) var dismiss

    private var bot: BotConfig { viewModel.botConfig }

    private var accentColor: Color {
        botAccentColor(for: bot)
    }

    private var connectionLabel: String {
        switch viewModel.connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Disconnected"
        }
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaRed
        }
    }

    private var sessionUptime: String {
        guard viewModel.connectionState == .connected else { return "—" }
        // Approximate from first message in current session
        guard let first = viewModel.messages.first else { return "Just started" }
        let interval = Date().timeIntervalSince(first.timestamp)
        if interval < 60 { return "\(Int(interval))s" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        return "\(Int(interval / 3600))h \(Int((interval.truncatingRemainder(dividingBy: 3600)) / 60))m"
    }

    private var messagesSent: Int {
        viewModel.messages.filter { if case .user = $0.sender { return true }; return false }.count
    }

    private var messagesReceived: Int {
        viewModel.messages.filter { if case .bot = $0.sender { return true }; return false }.count
    }

    private var lastMessageTime: String {
        guard let last = viewModel.messages.last else { return "—" }
        return last.timestamp.formatted(date: .omitted, time: .shortened)
    }

    @State private var emojiGlow: CGFloat = 0
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with large emoji
            VStack(spacing: 16) {
                ZStack {
                    // Animated glow ring
                    Circle()
                        .fill(accentColor.opacity(0.15 + 0.1 * emojiGlow))
                        .frame(width: 100, height: 100)
                        .blur(radius: 20)

                    Circle()
                        .fill(accentColor.opacity(0.08))
                        .frame(width: 80, height: 80)

                    Text(bot.emoji)
                        .font(.system(size: 44))
                }
                .shadow(color: accentColor.opacity(0.4), radius: 20 + 10 * emojiGlow)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                        emojiGlow = 1
                    }
                }

                Text(bot.name)
                    .font(.sora(22, weight: .bold))
                    .foregroundColor(.optaTextPrimary)

                Text("\(bot.host):\(bot.port)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.top, 28)
            .padding(.bottom, 20)

            // Connection status pill
            HStack(spacing: 6) {
                Circle()
                    .fill(connectionColor)
                    .frame(width: 8, height: 8)
                    .shadow(color: connectionColor.opacity(0.6), radius: 4)

                Text(connectionLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(connectionColor)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(connectionColor.opacity(0.1))
            )
            .overlay(
                Capsule()
                    .stroke(connectionColor.opacity(0.2), lineWidth: 0.5)
            )
            .padding(.bottom, 20)

            // Active session info
            if let session = viewModel.activeSession {
                HStack(spacing: 8) {
                    Image(systemName: session.mode.icon)
                        .font(.system(size: 11))
                        .foregroundColor(sessionModeColor(session.mode))
                    Text(session.name)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                    Text("·")
                        .foregroundColor(.optaTextMuted)
                    Text(session.mode.label)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }
                .padding(.bottom, 16)
            }

            // Stats section — glass card
            VStack(spacing: 12) {
                Text("SESSION STATS")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Gradient divider
                LinearGradient(
                    colors: [.clear, accentColor.opacity(0.2), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(height: 1)

                HStack(spacing: 0) {
                    StatCell(label: "Sent", value: "\(messagesSent)", color: .optaPrimary)
                    Spacer()
                    StatCell(label: "Received", value: "\(messagesReceived)", color: accentColor)
                    Spacer()
                    StatCell(label: "Uptime", value: sessionUptime, color: .optaGreen)
                }

                HStack {
                    Text("Last message")
                        .font(.system(size: 10))
                        .foregroundColor(.optaTextMuted)
                    Spacer()
                    Text(lastMessageTime)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextSecondary)
                }
                .padding(.top, 4)

                // Persistent stats
                let stats = viewModel.stats
                if stats.totalSent > 0 || stats.totalReceived > 0 {
                    LinearGradient(
                        colors: [.clear, accentColor.opacity(0.15), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                    .padding(.top, 4)

                    Text("ALL TIME")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)

                    HStack(spacing: 0) {
                        StatCell(label: "Total Sent", value: "\(stats.totalSent)", color: .optaPrimary)
                        Spacer()
                        StatCell(label: "Total Recv", value: "\(stats.totalReceived)", color: accentColor)
                        Spacer()
                        StatCell(label: "Avg Response", value: stats.formattedAvgResponseTime, color: .optaGreen)
                    }

                    HStack(spacing: 0) {
                        StatCell(label: "Streak", value: "\(stats.longestStreak)d", color: .optaAmber)
                        Spacer()
                        StatCell(label: "Peak Hour", value: stats.formattedMostActiveTime, color: .optaBlue)
                        Spacer()
                        StatCell(label: "", value: "", color: .clear)
                    }
                }
            }
            .padding(16)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.optaSurface.opacity(0.5))
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Accent tint
                    RoundedRectangle(cornerRadius: 16)
                        .fill(accentColor.opacity(0.03))
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [accentColor.opacity(0.15), Color.optaBorder.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.5
                    )
            )
            .padding(.horizontal, 24)

            Spacer()

            // Close button
            Button("Done") { dismiss() }
                .keyboardShortcut(.cancelAction)
                .padding(.bottom, 20)
        }
        .frame(width: 340, height: 440)
        .background(
            ZStack {
                Color.optaVoid

                // Accent gradient at top
                VStack {
                    RadialGradient(
                        colors: [accentColor.opacity(0.06), .clear],
                        center: .top,
                        startRadius: 0,
                        endRadius: 200
                    )
                    .frame(height: 200)
                    Spacer()
                }
            }
        )
        .preferredColorScheme(.dark)
        .opacity(appeared ? 1 : 0)
        .scaleEffect(appeared ? 1 : 0.95)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                appeared = true
            }
        }
    }
}

// MARK: - Stat Cell

private struct StatCell: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.optaTextMuted)
        }
        .frame(minWidth: 60)
    }
}
