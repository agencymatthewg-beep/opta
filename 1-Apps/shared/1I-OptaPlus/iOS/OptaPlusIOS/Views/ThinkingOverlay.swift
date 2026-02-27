//
//  ThinkingOverlay.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct ThinkingOverlay: View {
    let botState: BotState
    let events: [AgentStreamEvent]
    @Binding var isExpanded: Bool

    @State private var elapsed: TimeInterval = 0
    @State private var dotPhase: Int = 0

    private let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            compactPill
                .onTapGesture {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                }

            if isExpanded && !events.isEmpty {
                expandedTimeline
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .onReceive(timer) { _ in
            elapsed += 0.5
            dotPhase = (dotPhase + 1) % 4
        }
        .onAppear { elapsed = 0 }
    }

    private var compactPill: some View {
        HStack(spacing: 8) {
            // Waveform dots
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color.optaPrimary)
                        .frame(width: 5, height: 5)
                        .scaleEffect(dotPhase == i || dotPhase == 3 ? 1.3 : 0.7)
                        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: dotPhase)
                }
            }

            Text(botState == .thinking ? "Thinking" : "Typing")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.optaTextSecondary)

            Text(formatElapsed(elapsed))
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
                .monospacedDigit()

            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay(
                    Capsule()
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        )
    }

    private var expandedTimeline: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(events.suffix(10)) { event in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(eventColor(event))
                            .frame(width: 6, height: 6)

                        Text(eventLabel(event))
                            .font(.caption)
                            .foregroundColor(.optaTextSecondary)
                            .lineLimit(1)
                    }
                }
            }
            .padding(12)
        }
        .frame(maxHeight: 200)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        )
        .padding(.top, 4)
    }

    private func eventColor(_ event: AgentStreamEvent) -> Color {
        switch event.stream {
        case "tool_call", "tool": return .optaAmber
        case "assistant": return .optaPrimary
        case "lifecycle": return .optaCyan
        default: return .optaTextMuted
        }
    }

    private func eventLabel(_ event: AgentStreamEvent) -> String {
        if let tool = event.toolName { return "🔧 \(tool)" }
        if let phase = event.phase { return phase.capitalized }
        if let text = event.text { return String(text.prefix(60)) }
        return event.stream
    }

    private func formatElapsed(_ t: TimeInterval) -> String {
        let s = Int(t)
        if s < 60 { return "\(s)s" }
        return "\(s / 60)m \(s % 60)s"
    }
}
