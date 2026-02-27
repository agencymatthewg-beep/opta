import SwiftUI

// MARK: - Opta Spring Animation

extension Animation {
    static let optaSpring = Animation.spring(response: 0.35, dampingFraction: 0.8)
}

// MARK: - Glass Panel Modifier

struct GlassPanel: ViewModifier {
    var cornerRadius: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(OptaColors.border.opacity(0.5), lineWidth: 0.5)
            )
    }
}

extension View {
    func glassPanel(cornerRadius: CGFloat = 16) -> some View {
        modifier(GlassPanel(cornerRadius: cornerRadius))
    }
}

// MARK: - Connection Status Dot (legacy)

struct ConnectionDot: View {
    let state: ConnectionState

    var body: some View {
        Circle()
            .fill(dotColor)
            .frame(width: 8, height: 8)
    }

    private var dotColor: Color {
        switch state {
        case .connected(.lan): return OptaColors.neonGreen
        case .connected(.wan): return OptaColors.neonAmber
        case .connecting: return OptaColors.neonBlue
        case .disconnected: return OptaColors.textMuted
        case .error: return OptaColors.neonRed
        }
    }
}

// MARK: - Connection Badge (LAN / WAN / Disconnected)

struct ConnectionBadge: View {
    let state: ConnectionState
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(badgeColor)
                .frame(width: 7, height: 7)
                .scaleEffect(pulse ? 1.3 : 1.0)
                .animation(isAnimating ? .easeInOut(duration: 1).repeatForever(autoreverses: true) : .default, value: pulse)

            Text(label)
                .font(.caption2.bold())
                .foregroundStyle(badgeColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(badgeColor.opacity(0.12), in: Capsule())
        .onAppear { pulse = isAnimating }
        .onChange(of: isAnimating) { _, val in pulse = val }
    }

    private var label: String {
        switch state {
        case .connected(.lan): return "LAN"
        case .connected(.wan): return "WAN"
        case .connecting: return "…"
        case .disconnected: return "OFF"
        case .error: return "ERR"
        }
    }

    private var badgeColor: Color {
        switch state {
        case .connected(.lan): return OptaColors.neonGreen
        case .connected(.wan): return OptaColors.neonAmber
        case .connecting: return OptaColors.neonBlue
        case .disconnected: return OptaColors.textMuted
        case .error: return OptaColors.neonRed
        }
    }

    private var isAnimating: Bool {
        if case .connecting = state { return true }
        return false
    }
}
