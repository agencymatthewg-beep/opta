//
//  SatelliteButton.swift
//  OptaNative
//
//  Circular glass button for the Radial Menu layout.
//  Emits a glow and scales up on hover.
//  Created for Opta Native macOS - Plan 103-01 (v12.0)
//

import SwiftUI

struct SatelliteButton: View {
    let item: NavigationItem
    let action: () -> Void
    var isHovered: Bool
    
    // Aesthetic Config
    private let size: CGFloat = 80
    
    // Item Metadata
    private var itemColor: Color {
        switch item {
        case .dashboard: return .optaNeonPurple // Grid/Dash
        case .gameSession: return .optaElectricBlue // Controller
        case .gamification: return .indigo // Trophy
        case .optimization: return .optaNeonAmber // Lightning
        case .conflicts: return .red // Target/Health
        case .chess: return .white // Crown
        }
    }
    
    var body: some View {
        Button(action: action) {
            ZStack {
                // Glow (only when hovered)
                if isHovered {
                    Circle()
                        .fill(itemColor.opacity(0.4))
                        .blur(radius: 20)
                        .scaleEffect(1.2)
                }
                
                // Glass Surface with Obsidian Rim
                Circle()
                    .fill(.ultraThinMaterial)
                    .overlay(
                        Circle()
                            .strokeBorder(
                                LinearGradient(
                                    colors: [
                                        Color(hex: 0x2a2a30), // Light catch
                                        Color(hex: 0x050507), // Shadow
                                        Color.white.opacity(0.1)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 3 // Thicker rim
                            )
                    )
                    .shadow(color: .black.opacity(0.5), radius: 5, x: 0, y: 5)
                
                // Icon
                Image(systemName: item.icon)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(isHovered ? .white : Color.optaTextSecondary)
                    .shadow(color: isHovered ? itemColor : .clear, radius: 10)
            }
            .frame(width: size, height: size)
            .scaleEffect(isHovered ? 1.1 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
        }
        .buttonStyle(.plain)
    }
}
