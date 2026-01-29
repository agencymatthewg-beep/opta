//
//  ThinkingIndicator.swift
//  ClawdbotKit
//
//  Animated indicator shown when bot is thinking or using tools.
//  Displays three bouncing dots with optional detail text.
//

import SwiftUI

/// Animated thinking indicator for bot processing states
///
/// Shows three animated dots with optional detail text to indicate:
/// - `.thinking` state: Bot is processing the request
/// - `.toolUse` state: Bot is using an external tool (shows detail)
///
/// Layout matches bot message styling (left-aligned with surface background).
public struct ThinkingIndicator: View {
    /// Optional detail text (e.g., "Searching web...")
    public let detail: String?

    /// Animation phase for staggered dot animation
    @State private var animationPhase: Int = 0

    /// Initialize with optional detail text
    /// - Parameter detail: Tool use detail message (nil for basic thinking)
    public init(detail: String? = nil) {
        self.detail = detail
    }

    // MARK: - Body

    public var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                // Animated dots with obsidian active styling and glow pulse
                dotsView
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .obsidianActive()
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .glowPulsePurple(isActive: true)

                // Detail text (e.g., "Searching web...")
                if let detail = detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundColor(.clawdbotTextSecondary)
                        .padding(.leading, 4)
                }
            }

            Spacer(minLength: 60)
        }
        .ignition()  // Wake-from-darkness entrance
        .onAppear {
            startAnimation()
        }
    }

    // MARK: - Animated Dots

    /// Three dots with staggered bounce animation
    private var dotsView: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(Color.clawdbotTextSecondary)
                    .frame(width: 8, height: 8)
                    .offset(y: dotOffset(for: index))
            }
        }
    }

    /// Calculate vertical offset for each dot based on animation phase
    private func dotOffset(for index: Int) -> CGFloat {
        // Stagger the animation so dots bounce in sequence
        let effectivePhase = (animationPhase + index) % 3
        return effectivePhase == 0 ? -4 : 0
    }

    /// Start the continuous bounce animation
    private func startAnimation() {
        // Skip animation if Reduce Motion is enabled
        guard !ClawdbotMotion.isReduceMotionEnabled else { return }

        // Use timer-based animation for smooth staggered effect
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.2)) {
                animationPhase = (animationPhase + 1) % 3
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ThinkingIndicator_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            // Basic thinking indicator
            ThinkingIndicator()

            // With tool detail
            ThinkingIndicator(detail: "Searching the web...")

            // In context (simulating chat)
            VStack(alignment: .leading, spacing: 8) {
                // User message (simulated)
                HStack {
                    Spacer(minLength: 60)
                    Text("What's the weather like?")
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.clawdbotPurple)
                        )
                        .foregroundColor(.white)
                }

                // Thinking indicator
                ThinkingIndicator(detail: "Checking weather API...")
            }
            .padding()
        }
        .padding()
        .background(Color.clawdbotBackground)
        .preferredColorScheme(.dark)
    }
}
#endif
