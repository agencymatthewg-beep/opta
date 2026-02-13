//
//  ThinkingOverlay.swift
//  OptaPlusMacOS
//
//  Floating background overlay showing the bot's thinking process.
//  Dynamic glass panel with ambient breathing, event cascade, and
//  subtle particle-like glow effects.
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

// MARK: - Thinking Overlay View

struct ThinkingOverlay: View {
    @ObservedObject var viewModel: ChatViewModel
    let events: [ThinkingEvent]
    let isActive: Bool
    
    @State private var breathePhase: CGFloat = 0
    @State private var glowIntensity: CGFloat = 0
    @State private var panelOffset: CGFloat = 40
    @State private var panelOpacity: CGFloat = 0
    
    var body: some View {
        if isActive || !events.isEmpty {
            VStack {
                Spacer()
                
                VStack(alignment: .leading, spacing: 0) {
                    // Header with ambient breathing
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
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    
                    if !events.isEmpty {
                        // Gradient divider
                        LinearGradient(
                            colors: [.clear, Color.optaPrimary.opacity(0.2 * glowIntensity), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(height: 1)
                        
                        // Event timeline with cascading entrance
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(alignment: .leading, spacing: 3) {
                                ForEach(Array(events.suffix(6).enumerated()), id: \.element.id) { index, event in
                                    ThinkingEventRow(event: event, isLatest: index == events.suffix(6).count - 1)
                                        .transition(.asymmetric(
                                            insertion: .push(from: .bottom).combined(with: .opacity),
                                            removal: .opacity.animation(.easeOut(duration: 0.15))
                                        ))
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: events.count)
                        }
                        .frame(maxHeight: 110)
                    }
                }
                .frame(width: 260)
                .background(
                    ZStack {
                        // Ambient glow behind panel
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.optaPrimary.opacity(0.03 * glowIntensity))
                            .blur(radius: 20)
                            .scaleEffect(1.1 + 0.05 * breathePhase)
                        
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.optaSurface.opacity(0.7))
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
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
                )
                .shadow(color: Color.optaPrimary.opacity(isActive ? 0.08 * glowIntensity : 0), radius: 24, y: 6)
                .offset(y: panelOffset)
                .opacity(panelOpacity)
                .padding(.leading, 16)
                .padding(.bottom, 80)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .allowsHitTesting(false)
            .onAppear {
                // Entrance animation
                withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) {
                    panelOffset = 0
                    panelOpacity = 1
                }
                // Start breathing
                withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                    breathePhase = 1
                }
                withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                    glowIntensity = 1
                }
            }
            .onDisappear {
                panelOffset = 40
                panelOpacity = 0
            }
        }
    }
}

// MARK: - Thinking Event Row

struct ThinkingEventRow: View {
    let event: ThinkingEvent
    let isLatest: Bool
    
    @State private var appeared = false
    
    var body: some View {
        HStack(spacing: 6) {
            // Animated icon
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

// MARK: - Waveform Dots (organic thinking indicator)

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
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
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
        .frame(width: 400, height: 500)
    }
}
#endif
