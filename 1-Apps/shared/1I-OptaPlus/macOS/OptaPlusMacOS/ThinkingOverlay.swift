//
//  ThinkingOverlay.swift
//  OptaPlusMacOS
//
//  Floating overlay showing the bot's thinking process.
//  Expandable, collapsible, and draggable along left/right edges.
//

import SwiftUI
import OptaMolt

// MARK: - Thinking Event

struct ThinkingEvent: Identifiable, Equatable {
    let id = UUID()
    let timestamp: Date
    let kind: ThinkingKind
    let content: String
    
    enum ThinkingKind: Equatable {
        case started
        case toolCall(name: String)
        case toolResult
        case thinking(text: String)
        case streaming
        case ended
    }
    
    var icon: String {
        switch kind {
        case .started: return "brain"
        case .toolCall: return "wrench.and.screwdriver"
        case .toolResult: return "checkmark.circle"
        case .thinking: return "sparkles"
        case .streaming: return "text.cursor"
        case .ended: return "checkmark"
        }
    }
    
    var color: Color {
        switch kind {
        case .started: return .optaPrimary
        case .toolCall: return .optaAmber
        case .toolResult: return .optaGreen
        case .thinking: return .optaCyan
        case .streaming: return .optaPrimary
        case .ended: return .optaGreen
        }
    }
}

// MARK: - Dock Side

enum OverlayDockSide: String {
    case left, right
}

// MARK: - Thinking Overlay View

struct ThinkingOverlay: View {
    @ObservedObject var viewModel: ChatViewModel
    let events: [ThinkingEvent]
    let isActive: Bool
    
    // Persisted state
    @AppStorage("thinkingOverlay.expanded") private var isExpanded: Bool = true
    @AppStorage("thinkingOverlay.dockSide") private var dockSideRaw: String = "left"
    @AppStorage("thinkingOverlay.verticalOffset") private var savedVerticalOffset: Double = 0
    
    // Drag state
    @State private var dragOffset: CGSize = .zero
    @State private var isDragging: Bool = false
    
    // Animation state
    @State private var breathePhase: CGFloat = 0
    @State private var glowIntensity: CGFloat = 0
    @State private var panelOffset: CGFloat = 30
    @State private var panelOpacity: CGFloat = 0
    
    private var dockSide: OverlayDockSide {
        OverlayDockSide(rawValue: dockSideRaw) ?? .left
    }
    
    private var panelWidth: CGFloat { isExpanded ? 260 : 140 }
    
    var body: some View {
        if isActive || !events.isEmpty {
            GeometryReader { geo in
                panelContent
                    .position(
                        x: resolveX(in: geo),
                        y: resolveY(in: geo)
                    )
                    .gesture(dragGesture(in: geo))
                    .offset(y: panelOffset)
                    .opacity(panelOpacity)
                    .onAppear {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) {
                            panelOffset = 0
                            panelOpacity = 1
                        }
                        withAnimation(.optaPulse) {
                            breathePhase = 1
                        }
                        withAnimation(.optaPulse) {
                            glowIntensity = 1
                        }
                    }
                    .onDisappear {
                        panelOffset = 30
                        panelOpacity = 0
                    }
            }
        }
    }
    
    // MARK: - Position Helpers
    
    private func resolveX(in geo: GeometryProxy) -> CGFloat {
        let halfWidth = panelWidth / 2
        let margin: CGFloat = 16
        let baseX = dockSide == .left
            ? margin + halfWidth
            : geo.size.width - margin - halfWidth
        return baseX + (isDragging ? dragOffset.width : 0)
    }
    
    private func resolveY(in geo: GeometryProxy) -> CGFloat {
        let defaultY = geo.size.height - 80 // Bottom area, above input
        let clamped = clampY(defaultY + savedVerticalOffset, in: geo)
        return clamped + (isDragging ? dragOffset.height : 0)
    }
    
    private func clampY(_ y: CGFloat, in geo: GeometryProxy) -> CGFloat {
        let topMargin: CGFloat = 60
        let bottomMargin: CGFloat = 20
        let halfHeight: CGFloat = isExpanded ? 90 : 20
        return min(max(y, topMargin + halfHeight), geo.size.height - bottomMargin - halfHeight)
    }
    
    // MARK: - Drag Gesture
    
    private func dragGesture(in geo: GeometryProxy) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                isDragging = true
                dragOffset = value.translation
            }
            .onEnded { value in
                isDragging = false
                dragOffset = .zero
                
                // Determine side: snap to whichever side the drag ended closer to
                let currentX = resolveBaseX(in: geo) + value.translation.width
                let midX = geo.size.width / 2
                let newSide: OverlayDockSide = currentX < midX ? .left : .right
                
                // Update vertical offset
                let defaultY = geo.size.height - 80
                let newY = defaultY + savedVerticalOffset + value.translation.height
                let clampedY = clampY(newY, in: geo)
                
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    dockSideRaw = newSide.rawValue
                    savedVerticalOffset = clampedY - defaultY
                }
            }
    }
    
    private func resolveBaseX(in geo: GeometryProxy) -> CGFloat {
        let halfWidth = panelWidth / 2
        let margin: CGFloat = 16
        return dockSide == .left
            ? margin + halfWidth
            : geo.size.width - margin - halfWidth
    }
    
    // MARK: - Panel Content
    
    @ViewBuilder
    private var panelContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header — always visible, tap to expand/collapse
            headerView
                .onTapGesture {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                }
            
            // Expanded content
            if isExpanded && !events.isEmpty {
                // Divider
                LinearGradient(
                    colors: [.clear, Color.optaPrimary.opacity(0.2 * glowIntensity), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(height: 1)
                
                // Event timeline
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(Array(events.suffix(8).enumerated()), id: \.element.id) { index, event in
                            ThinkingEventRow(event: event, isLatest: index == events.suffix(8).count - 1)
                                .transition(.asymmetric(
                                    insertion: .push(from: .bottom).combined(with: .opacity),
                                    removal: .opacity.animation(.optaSnap)
                                ))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: events.count)
                }
                .frame(maxHeight: 140)
            }
        }
        .frame(width: panelWidth)
        .background(panelBackground)
        .overlay(panelBorder)
        .shadow(color: Color.optaPrimary.opacity(isActive ? 0.08 * glowIntensity : 0), radius: 24, y: 6)
        .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
        .scaleEffect(isDragging ? 0.97 : 1.0)
        .animation(.spring(response: 0.2), value: isDragging)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isExpanded)
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: dockSideRaw)
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack(spacing: 8) {
            // Pulsing brain with glow ring
            ZStack {
                Circle()
                    .fill(Color.optaPrimary.opacity(0.15 * glowIntensity))
                    .frame(width: 24, height: 24)
                    .scaleEffect(1 + 0.3 * breathePhase)
                    .blur(radius: 4)
                
                Image(systemName: "brain")
                    .font(.system(size: 12))
                    .foregroundColor(.optaPrimary)
                    .scaleEffect(1 + 0.1 * breathePhase)
            }
            
            Text(isActive ? "Thinking" : "Done")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(isActive ? .optaPrimary : .optaGreen)
            
            if isActive {
                WaveformDots()
            }
            
            Spacer()
            
            // Elapsed time
            if isActive, let first = events.first {
                ElapsedTimer(since: first.timestamp)
            }
            
            // Expand/collapse chevron
            Image(systemName: isExpanded ? "chevron.down" : "chevron.up")
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.optaTextMuted)
                .rotationEffect(.degrees(isExpanded ? 0 : 180))
                .animation(.spring(response: 0.3), value: isExpanded)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    // MARK: - Background & Border
    
    private var panelBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.optaPrimary.opacity(0.03 * glowIntensity))
                .blur(radius: 16)
                .scaleEffect(1.05 + 0.03 * breathePhase)
            
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.optaSurface.opacity(0.85))
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
    
    private var panelBorder: some View {
        RoundedRectangle(cornerRadius: 14)
            .stroke(
                LinearGradient(
                    colors: [
                        Color.optaPrimary.opacity(isActive ? 0.25 * glowIntensity : 0.05),
                        Color.optaBorder.opacity(0.1),
                        Color.optaPrimary.opacity(isActive ? 0.15 * glowIntensity : 0.05)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 1
            )
    }
}

// MARK: - Thinking Event Row

struct ThinkingEventRow: View {
    let event: ThinkingEvent
    let isLatest: Bool
    
    @State private var appeared = false
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: event.icon)
                .font(.system(size: 9))
                .foregroundColor(event.color)
                .frame(width: 14)
                .scaleEffect(appeared ? 1 : 0.5)
                .opacity(appeared ? 1 : 0)
            
            Text(event.content)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(isLatest ? .optaTextPrimary : .optaTextSecondary)
                .lineLimit(1)
                .opacity(appeared ? (isLatest ? 1 : 0.7) : 0)
                .offset(x: appeared ? 0 : 8)
            
            Spacer()
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7).delay(0.05)) {
                appeared = true
            }
        }
    }
}

// MARK: - Waveform Dots

struct WaveformDots: View {
    @State private var phase: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<4, id: \.self) { i in
                let offset: CGFloat = CGFloat(i) * .pi / 2
                let sinVal: CGFloat = sin(phase + offset)
                let yScale: CGFloat = 0.5 + 0.5 * sinVal
                let opacity: Double = 0.4 + 0.6 * Double(sinVal)
                
                Circle()
                    .fill(Color.optaPrimary)
                    .frame(width: 4, height: 4)
                    .scaleEffect(y: yScale, anchor: .center)
                    .opacity(opacity)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 1.2, dampingFraction: 1.0).repeatForever(autoreverses: false)) {
                phase = 2 * .pi
            }
        }
    }
}

// MARK: - Elapsed Timer

struct ElapsedTimer: View {
    let since: Date
    @State private var elapsed: TimeInterval = 0
    
    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()
    
    var body: some View {
        Text(formatElapsed(elapsed))
            .font(.system(size: 9, design: .monospaced))
            .foregroundColor(.optaTextMuted)
            .opacity(0.5)
            .onReceive(timer) { _ in
                elapsed = Date().timeIntervalSince(since)
            }
            .onAppear {
                elapsed = Date().timeIntervalSince(since)
            }
    }
    
    private func formatElapsed(_ t: TimeInterval) -> String {
        if t < 60 { return String(format: "%.1fs", t) }
        return String(format: "%dm %02ds", Int(t) / 60, Int(t) % 60)
    }
}

// MARK: - Preview

#if DEBUG
struct ThinkingOverlay_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()
            
            ThinkingOverlay(
                viewModel: ChatViewModel(botConfig: BotConfig(name: "Test", port: 18793, token: "")),
                events: [
                    ThinkingEvent(timestamp: Date().addingTimeInterval(-3), kind: .started, content: "Processing request"),
                    ThinkingEvent(timestamp: Date().addingTimeInterval(-2), kind: .toolCall(name: "memory_search"), content: "memory_search(\"OptaPlus\")"),
                    ThinkingEvent(timestamp: Date().addingTimeInterval(-1), kind: .streaming, content: "Generating response..."),
                ],
                isActive: true
            )
        }
        .frame(width: 600, height: 500)
    }
}
#endif
