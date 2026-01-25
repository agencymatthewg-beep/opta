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
    
    // State
    @State private var hoveredItem: NavigationItem?
    
    // Config
    private let radius: CGFloat = 180
    
    // Navigation Items mapped to approximate angles (in degrees)
    // 0 is Right (3 o'clock), moving clockwise.
    // Adjusted to match reference image clock positions.
    private let items: [(NavigationItem, Double)] = [
        (.dashboard, 315),   // Top-Right (2 o'clock) -> -45 deg
        (.gameSession, 0),   // Right (3 o'clock) -> 0 deg
        (.chess, 45),        // Bottom-Right (5 o'clock) -> 45 deg
        (.optimization, 90), // Bottom (6 o'clock) -> 90 deg
        (.conflicts, 135),   // Bottom-Left (7 o'clock) -> 135 deg
        (.gamification, 180) // Left (9 o'clock) -> 180 deg
        // Settings would be at 225 (-135), added later if needed
    ]
    
    var body: some View {
        ZStack {
            // Background Atmosphere managed by RootView
            
            // Central Nucleus
            ZStack {
                OptaRingView()
                    .frame(width: 320, height: 320) // explicit sizing
                    .opacity(0.9)
                    .offset(y: 10) // Visual centering adjustment for tilt
                
                VStack(spacing: 8) {
                    // Premium 3D Text
                    Text(hoveredItem?.rawValue ?? "OPTA")
                        .font(.opta(size: 46, weight: .heavy)) // Thicker font for 3D effect
                        .tracking(1) // Modern spacing
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    .white,
                                    .white.opacity(0.8)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        // Layer 1: Colored Glow (Atmosphere)
                        .shadow(
                            color: hoveredItem != nil ? Color(itemColor(for: hoveredItem!)).opacity(0.8) : Color(hex: 0x581C87).opacity(0.5),
                            radius: 20, x: 0, y: 0
                        )
                        // Layer 2: Core Bloom (Intense)
                        .shadow(
                            color: hoveredItem != nil ? Color(itemColor(for: hoveredItem!)) : Color(hex: 0x581C87).opacity(0.3),
                            radius: 5, x: 0, y: 0
                        )
                        // Layer 3: Drop Shadow (Depth)
                        .shadow(color: .black.opacity(0.8), radius: 2, x: 0, y: 2)
                        .contentTransition(.numericText())
                    
                    if hoveredItem == nil {
                        Text("System Active")
                            .font(.opta(size: 13, weight: .medium))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color.optaTextMuted, Color.optaTextMuted.opacity(0.5)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .tracking(4)
                            .shadow(color: Color.optaNeonPurple.opacity(0.3), radius: 5)
                    }
                }
            .animation(.bouncy, value: hoveredItem)
            }

            // Satellites
            ForEach(items, id: \.0) { item, angle in
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
        case .conflicts: return .red
        case .chess: return .white
        }
    }
}

#Preview {
    RadialMenuLayout(selectedItem: .constant(nil))
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
}
