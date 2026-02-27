import SwiftUI

struct VRAMGaugeView: View {
    let used: Double
    let total: Double

    @State private var animatedPercentage: Double = 0
    @State private var appeared = false

    private var percentage: Double {
        guard total > 0 else { return 0 }
        return min(used / total, 1.0)
    }

    private var gaugeColor: Color {
        switch percentage {
        case 0..<0.6: return OptaColors.neonGreen
        case 0.6..<0.85: return OptaColors.neonAmber
        default: return OptaColors.neonRed
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                // Background track
                Circle()
                    .stroke(OptaColors.border.opacity(0.3), lineWidth: 12)

                // Glow layer
                Circle()
                    .trim(from: 0, to: animatedPercentage)
                    .stroke(gaugeColor.opacity(0.3), style: StrokeStyle(lineWidth: 20, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .blur(radius: 6)

                // Main arc
                Circle()
                    .trim(from: 0, to: animatedPercentage)
                    .stroke(gaugeColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))

                VStack(spacing: 2) {
                    Text(String(format: "%.1f", used))
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(OptaColors.textPrimary)
                        .contentTransition(.numericText())
                    Text("/ \(String(format: "%.0f", total)) GB")
                        .font(.caption)
                        .foregroundStyle(OptaColors.textSecondary)
                }
            }
            .frame(width: 140, height: 140)

            Text("VRAM Usage")
                .font(.caption)
                .foregroundStyle(OptaColors.textMuted)
                .textCase(.uppercase)
                .tracking(1)
        }
        .padding()
        .glassPanel()
        .onAppear {
            withAnimation(.optaSpring) {
                animatedPercentage = percentage
            }
        }
        .onChange(of: percentage) { _, newValue in
            withAnimation(.optaSpring) {
                animatedPercentage = newValue
            }
        }
    }
}
