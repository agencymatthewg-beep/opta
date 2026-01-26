//
//  RadialMenuLayout.swift
//  OptaNative
//
//  Immersive home screen layout arranged in a circular orbit.
//  Replaces the sidebar navigation with a centralized interaction model.
//  Created for Opta Native macOS - Plan 103-01 (v12.0)
//

import SwiftUI

struct RadialMenuLayout: View {
    @Binding var selectedItem: NavigationItem?

    // Environment - Real-time system metrics
    @Environment(TelemetryViewModel.self) private var telemetry

    // State
    @State private var hoveredItem: NavigationItem?

    // Config
    private let radius: CGFloat = 250 // Increased radius to minimize overlap

    // MARK: - Ring Energy Calculation

    /// Calculates ring energy (0-1) from system metrics.
    /// Combines CPU usage and memory pressure into a unified energy level.
    private var ringEnergy: Double {
        // Weighted average: 60% CPU, 40% memory (CPU is more dynamic)
        let cpuContribution = (telemetry.cpuUsage / 100.0) * 0.6
        let memContribution = (telemetry.memoryPercent / 100.0) * 0.4

        // Base energy of 0.3 ensures ring is never completely dormant
        let baseEnergy = 0.3
        let dynamicEnergy = cpuContribution + memContribution

        // Clamp to 0.3 - 1.0 range
        return min(1.0, baseEnergy + dynamicEnergy * 0.7)
    }

    /// Dynamic status text based on system state
    private var systemStatusText: String {
        if telemetry.isCPUHot {
            return "Running Hot"
        } else if telemetry.isCPUUsageHigh {
            return "High Load"
        } else if telemetry.isMemoryHigh {
            return "Memory Pressure"
        } else if telemetry.cpuUsage > 50 {
            return "Working"
        } else if telemetry.cpuUsage > 20 {
            return "Active"
        } else {
            return "System Idle"
        }
    }

    /// Status glow color based on system health
    private var statusGlowColor: Color {
        if telemetry.isCPUHot {
            return .red.opacity(0.6)
        } else if telemetry.isCPUUsageHigh || telemetry.isMemoryHigh {
            return .optaNeonAmber.opacity(0.5)
        } else if telemetry.cpuUsage > 50 {
            return .optaElectricBlue.opacity(0.4)
        } else {
            return .optaNeonPurple.opacity(0.3)
        }
    }
    
    // Navigation Items
    private let items: [NavigationItem] = [
        .gameSession,   // 0 deg (Right)
        .chess,         // 60 deg
        .optimization,  // 120 deg
        .conflicts,     // 180 deg
        .gamification,  // 240 deg
        .dashboard      // 300 deg
    ]
    
    var body: some View {
        ZStack {
            // Background Atmosphere managed by RootView
            
            // Central Nucleus
            ZStack {
                OptaRingView(energy: ringEnergy)
                    .frame(width: 320, height: 320)
                    .opacity(0.9)
                    .offset(y: 10)
                
                VStack(spacing: 8) {
                    // Official Opta Hero Typography
                    // Font: Sora Bold, Tracking: 0.12em, Gradient: Moonlight (dynamic)
                    Text(hoveredItem?.rawValue ?? "OPTA")
                        .font(.optaHero(size: OptaTypography.heroSize))
                        .tracking(OptaTypography.heroTracking)
                        .foregroundStyle(
                            // Moonlight gradient - tinted based on hover state
                            hoveredItem != nil
                                ? LinearGradient.optaMoonlightTinted(with: itemColor(for: hoveredItem!))
                                : LinearGradient.optaMoonlight
                        )
                        // Primary atmospheric glow (changes with hover)
                        .shadow(
                            color: hoveredItem != nil
                                ? itemColor(for: hoveredItem!).opacity(0.8)
                                : Color.optaNeonPurple.opacity(0.5),
                            radius: 40, x: 0, y: 0
                        )
                        // Secondary tight glow
                        .shadow(
                            color: hoveredItem != nil
                                ? itemColor(for: hoveredItem!)
                                : Color.optaDeepPurple.opacity(0.3),
                            radius: 10, x: 0, y: 0
                        )
                        // Drop shadow for depth
                        .shadow(color: .black.opacity(0.8), radius: 2, x: 0, y: 2)
                        // CRITICAL: Prevent text clipping during animations
                        .fixedSize(horizontal: true, vertical: false)
                        .contentTransition(.numericText())

                    if hoveredItem == nil {
                        // Official Opta Subtitle Typography
                        // Font: Sora Light, Tracking: 0.25em, Uppercase
                        Text(systemStatusText)
                            .font(.optaSubtitle(size: OptaTypography.subtitleSize))
                            .tracking(OptaTypography.subtitleTracking)
                            .textCase(.uppercase)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color.optaTextMuted, Color.optaTextMuted.opacity(0.5)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            // Dynamic glow based on system health
                            .shadow(color: statusGlowColor, radius: 8)
                            .shadow(color: statusGlowColor.opacity(0.5), radius: 15)
                            .fixedSize(horizontal: true, vertical: false)
                            .contentTransition(.interpolate)
                            .animation(.easeInOut(duration: 0.5), value: systemStatusText)
                    }
                }
                // Padding to accommodate shadow/glow effects (prevents clipping)
                .padding(.horizontal, 60)
                .animation(.bouncy, value: hoveredItem)
            }

            // Satellites
            ForEach(Array(items.enumerated()), id: \.element) { index, item in
                let angle = Double(index) * (360.0 / Double(items.count))
                
                SatelliteButton(
                    item: item,
                    action: { selectedItem = item },
                    isHovered: hoveredItem == item
                )
                .offset(
                    x: radius * cos(angle * .pi / 180),
                    y: radius * sin(angle * .pi / 180)
                )
                .onHover { isHovering in
                    if isHovering {
                        withAnimation(.spring(response: 0.3)) {
                            hoveredItem = item
                        }
                    } else if hoveredItem == item {
                        withAnimation(.spring(response: 0.3)) {
                            hoveredItem = nil
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // Helper to extract color from Satellite logic
    private func itemColor(for item: NavigationItem) -> Color {
        switch item {
        case .dashboard: return .optaNeonPurple
        case .gameSession: return .optaElectricBlue
        case .gamification: return .indigo
        case .optimization: return .optaNeonAmber
        case .macTweaks: return .cyan
        case .conflicts: return .red
        case .chess: return .white
        }
    }
}

#Preview {
    RadialMenuLayout(selectedItem: .constant(nil))
        .environment(TelemetryViewModel.preview)
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
}
