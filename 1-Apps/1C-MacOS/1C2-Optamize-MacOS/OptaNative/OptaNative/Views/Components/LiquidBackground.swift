import SwiftUI

/// A dynamic, breathing background that reacts to system energy.
/// Replaces the static radial gradients with animated MeshGradients (macOS 14+)
/// or moving radial gradients for compatibility.
struct LiquidBackground: View {
    @Environment(TelemetryViewModel.self) private var telemetry
    
    // Animation State
    @State private var phase: CGFloat = 0
    @State private var phase2: CGFloat = 0
    
    // Timer
    let timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()
    
    // Derived Energy
    private var energy: Double {
        let cpu = telemetry.cpuUsage / 100.0
        return 0.2 + (cpu * 0.8) // Base 20% + Dynamic
    }
    
    var body: some View {
        ZStack {
            // 1. Deep Void Base
            Color.optaVoid.ignoresSafeArea()
            
            // 2. Breathing Primary Glow (Top Left)
            RadialGradient(
                colors: [
                    Color.optaNeonPurple.opacity(0.1 + 0.1 * energy),
                    .clear
                ],
                center: UnitPoint(x: 0.2 + 0.1 * sin(phase), y: 0.2 + 0.1 * cos(phase)),
                startRadius: 0,
                endRadius: 800 + (200 * energy)
            )
            .ignoresSafeArea()
            .blur(radius: 60)
            
            // 3. Secondary Flow (Bottom Right)
            RadialGradient(
                colors: [
                    Color.optaElectricBlue.opacity(0.05 + 0.1 * energy),
                    .clear
                ],
                center: UnitPoint(x: 0.8 - 0.1 * cos(phase2), y: 0.8 - 0.1 * sin(phase2)),
                startRadius: 0,
                endRadius: 600 + (300 * energy)
            )
            .ignoresSafeArea()
            .blur(radius: 60)
            
            // 4. Accent Pulse (Center - Subtle)
            RadialGradient(
                colors: [
                    Color.optaNeonAmber.opacity(telemetry.isCPUUsageHigh ? 0.1 : 0.0),
                    .clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: 400
            )
            .blendMode(.plusLighter)
        }
        .drawingGroup() // Force Metal rendering for complex gradients
        .onReceive(timer) { _ in
            // Slowly animate phases
            // Speed up slightly with energy
            let speed = 0.01 + (0.02 * energy)
            withAnimation(.linear(duration: 0.1)) {
                phase += speed
                phase2 += speed * 0.7
            }
        }
    }
}
