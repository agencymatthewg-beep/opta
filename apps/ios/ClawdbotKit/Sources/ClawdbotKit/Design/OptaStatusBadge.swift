//
//  OptaStatusBadge.swift
//  ClawdbotKit
//
//  Status indicator badge matching Opta Life Manager style.
//  Displays "OPTA INTELLIGENCE - ACTIVE" or custom text with pulsing glow.
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Status Badge

/// Status indicator badge matching Opta Life Manager style
/// Displays "OPTA INTELLIGENCE - ACTIVE" or custom text
public struct OptaStatusBadge: View {
    public enum Status {
        case active
        case inactive
        case connecting
    }

    let status: Status
    let label: String?

    @State private var glowPulse = false

    public init(status: Status, label: String? = nil) {
        self.status = status
        self.label = label
    }

    public var body: some View {
        HStack(spacing: 8) {
            // Status indicator dot
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
                .shadow(color: statusColor.opacity(glowPulse ? 0.8 : 0.4), radius: glowPulse ? 8 : 4)

            // Label text
            Text(displayText)
                .font(.system(size: 12, weight: .regular, design: .rounded))
                .tracking(12 * 0.15)  // 0.15em tracking
                .textCase(.uppercase)
                .foregroundColor(statusTextColor)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(statusBackground)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(statusBorderColor, lineWidth: 1)
        )
        .onAppear {
            if status == .active {
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                    glowPulse = true
                }
            }
        }
    }

    private var displayText: String {
        if let label = label {
            return label
        }
        switch status {
        case .active: return "OPTA INTELLIGENCE - ACTIVE"
        case .inactive: return "OPTA INTELLIGENCE - OFFLINE"
        case .connecting: return "OPTA INTELLIGENCE - CONNECTING"
        }
    }

    private var statusColor: Color {
        switch status {
        case .active: return .clawdbotGreen
        case .inactive: return .clawdbotTextMuted
        case .connecting: return .clawdbotAmber
        }
    }

    private var statusTextColor: Color {
        switch status {
        case .active: return .clawdbotPurple
        case .inactive: return .clawdbotTextMuted
        case .connecting: return .clawdbotAmber
        }
    }

    @ViewBuilder
    private var statusBackground: some View {
        switch status {
        case .active:
            LinearGradient(
                colors: [
                    Color.clawdbotPurple.opacity(0.2),
                    Color.clawdbotBlue.opacity(0.1)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        case .inactive, .connecting:
            Color.clawdbotSurface.opacity(0.4)
        }
    }

    private var statusBorderColor: Color {
        switch status {
        case .active: return .clawdbotPurple.opacity(0.4)
        case .inactive: return .clawdbotBorder.opacity(0.3)
        case .connecting: return .clawdbotAmber.opacity(0.4)
        }
    }
}

// MARK: - Compact Badge Variant

public extension OptaStatusBadge {
    /// Compact version with just the dot indicator
    struct Compact: View {
        let status: OptaStatusBadge.Status

        @State private var glowPulse = false

        public init(status: OptaStatusBadge.Status) {
            self.status = status
        }

        public var body: some View {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
                .shadow(color: statusColor.opacity(glowPulse ? 0.8 : 0.4), radius: glowPulse ? 8 : 4)
                .onAppear {
                    if status == .active {
                        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                            glowPulse = true
                        }
                    }
                }
        }

        private var statusColor: Color {
            switch status {
            case .active: return .clawdbotGreen
            case .inactive: return .clawdbotTextMuted
            case .connecting: return .clawdbotAmber
            }
        }
    }
}

#if DEBUG
struct OptaStatusBadge_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            OptaStatusBadge(status: .active)
            OptaStatusBadge(status: .inactive)
            OptaStatusBadge(status: .connecting)

            Divider()

            HStack(spacing: 12) {
                OptaStatusBadge.Compact(status: .active)
                OptaStatusBadge.Compact(status: .inactive)
                OptaStatusBadge.Compact(status: .connecting)
            }

            Divider()

            // Custom label example
            OptaStatusBadge(status: .active, label: "CLAWDBOT - READY")
        }
        .padding()
        .background(Color.clawdbotBackground)
        .previewLayout(.sizeThatFits)
    }
}
#endif
