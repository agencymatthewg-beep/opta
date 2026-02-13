//
//  EnhancedTypingIndicator.swift
//  OptaMolt
//
//  Animated 3-dot typing indicator with bot name and auto-hide.
//

import SwiftUI

// MARK: - Enhanced Typing Indicator

public struct EnhancedTypingIndicator: View {
    let botName: String
    let isActive: Bool

    @State private var phase = 0
    @State private var isVisible = false
    @State private var autoHideTask: Task<Void, Never>?

    private let timer = Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()

    public init(botName: String, isActive: Bool) {
        self.botName = botName
        self.isActive = isActive
    }

    public var body: some View {
        Group {
            if isVisible {
                HStack(spacing: 8) {
                    // Animated dots
                    HStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .fill(Color.optaPrimary.opacity(phase == i ? 1.0 : 0.3))
                                .frame(width: 6, height: 6)
                                .offset(y: phase == i ? -4 : 0)
                                .animation(.spring(response: 0.3, dampingFraction: 0.5), value: phase)
                        }
                    }

                    Text("\(botName) is typing…")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(Color.optaSurface.opacity(0.6))
                        .overlay(Capsule().stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5))
                )
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.8).combined(with: .opacity),
                    removal: .opacity
                ))
            }
        }
        .onReceive(timer) { _ in
            if isVisible {
                phase = (phase + 1) % 4
            }
        }
        .onChange(of: isActive) { _, active in
            if active {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    isVisible = true
                }
                // Auto-hide after 30s
                autoHideTask?.cancel()
                autoHideTask = Task {
                    try? await Task.sleep(nanoseconds: 30_000_000_000)
                    if !Task.isCancelled {
                        await MainActor.run {
                            withAnimation(.easeOut(duration: 0.3)) {
                                isVisible = false
                            }
                        }
                    }
                }
            } else {
                autoHideTask?.cancel()
                withAnimation(.easeOut(duration: 0.3)) {
                    isVisible = false
                }
            }
        }
        .onAppear {
            if isActive {
                isVisible = true
                autoHideTask = Task {
                    try? await Task.sleep(nanoseconds: 30_000_000_000)
                    if !Task.isCancelled {
                        await MainActor.run {
                            withAnimation(.easeOut(duration: 0.3)) { isVisible = false }
                        }
                    }
                }
            }
        }
    }
}
