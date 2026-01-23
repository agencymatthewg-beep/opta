//
//  GameCardView.swift
//  OptaApp
//
//  Game card component for the games library grid.
//  Shows game icon, name, platform badge, last played, and quick optimize button.
//

import SwiftUI

// MARK: - GameCardView

/// A card component displaying a game in the library grid.
///
/// Features:
/// - 48x48 app icon
/// - Game name with platform badge
/// - Last played relative time
/// - Quick optimize button (bolt icon)
/// - Optimized state indicator (checkmark badge)
/// - Glass card styling with hover effect
struct GameCardView: View {

    // MARK: - Properties

    /// The game to display
    let game: Game

    /// Action when card is tapped (navigates to detail)
    var onSelect: () -> Void

    /// Action when quick optimize is tapped
    var onOptimize: () -> Void

    /// Hover state for visual feedback
    @State private var isHovering = false

    /// Accessibility: reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Body

    var body: some View {
        Button {
            onSelect()
        } label: {
            HStack(spacing: 12) {
                // Game icon
                gameIcon

                // Game info
                VStack(alignment: .leading, spacing: 4) {
                    // Name with optimized badge
                    HStack(spacing: 6) {
                        Text(game.name)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white)
                            .lineLimit(1)

                        if game.isOptimized {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color(hex: "22C55E"))
                        }
                    }

                    // Platform and last played
                    HStack(spacing: 8) {
                        platformBadge

                        Text(game.lastPlayedRelative)
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }

                Spacer()

                // Quick optimize button
                quickOptimizeButton
            }
            .padding(12)
            .background(cardBackground)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
        }
        .organicHover(isHovered: isHovering, id: "card-\(game.id.uuidString)")
    }

    // MARK: - Components

    /// Game icon (48x48)
    @ViewBuilder
    private var gameIcon: some View {
        Group {
            if let iconData = game.iconData,
               let nsImage = NSImage(data: iconData) {
                Image(nsImage: nsImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } else {
                // Fallback icon
                Image(systemName: "gamecontroller.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.white.opacity(0.3))
                    .frame(width: 48, height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.white.opacity(0.05))
                    )
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    /// Platform badge
    private var platformBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: game.platform.iconName)
                .font(.system(size: 8))

            Text(game.platform.displayName)
                .font(.system(size: 9, weight: .medium))
        }
        .foregroundStyle(.white.opacity(0.7))
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            Capsule()
                .fill(Color(hex: game.platform.badgeColor).opacity(0.6))
        )
    }

    /// Quick optimize button
    private var quickOptimizeButton: some View {
        Button {
            onOptimize()
        } label: {
            Image(systemName: "bolt.fill")
                .font(.system(size: 12))
                .foregroundStyle(Color(hex: "8B5CF6"))
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(Color(hex: "8B5CF6").opacity(0.15))
                )
        }
        .buttonStyle(.plain)
        .help("Quick Optimize")
    }

    /// Obsidian card background with branch-energy hover glow
    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color(hex: "0A0A0F"))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.05))
            )
            .overlay(
                // Branch-energy hover: radial violet glow
                Group {
                    if reduceMotion {
                        // Reduce-motion fallback: solid violet border on hover
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isHovering
                                    ? Color(hex: "8B5CF6").opacity(0.3)
                                    : Color(hex: "8B5CF6").opacity(0.1),
                                lineWidth: isHovering ? 2 : 1
                            )
                    } else {
                        // Branch-energy radial gradient
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color(hex: "8B5CF6").opacity(isHovering ? 0.15 : 0),
                                        .clear
                                    ],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: 120
                                )
                            )
                    }
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        Color(hex: "8B5CF6").opacity(isHovering ? 0.3 : 0.1),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: isHovering ? Color(hex: "8B5CF6").opacity(0.1) : .clear,
                radius: 8,
                x: 0,
                y: 4
            )
    }
}

// MARK: - Compact Game Card

/// A more compact game card for smaller grids or lists.
struct CompactGameCardView: View {

    let game: Game
    var onSelect: () -> Void

    @State private var isHovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button {
            onSelect()
        } label: {
            VStack(spacing: 8) {
                // Game icon
                Group {
                    if let iconData = game.iconData,
                       let nsImage = NSImage(data: iconData) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    } else {
                        Image(systemName: "gamecontroller.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(.white.opacity(0.3))
                            .frame(width: 64, height: 64)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.white.opacity(0.05))
                            )
                    }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    // Optimized badge
                    Group {
                        if game.isOptimized {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(Color(hex: "22C55E"))
                                .background(
                                    Circle()
                                        .fill(Color(hex: "0A0A0F"))
                                        .padding(-2)
                                )
                        }
                    }
                    .offset(x: 24, y: -24),
                    alignment: .topTrailing
                )

                // Name
                Text(game.name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(hex: "0A0A0F"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.05))
                    )
                    .overlay(
                        Group {
                            if reduceMotion {
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        isHovering
                                            ? Color(hex: "8B5CF6").opacity(0.3)
                                            : Color(hex: "8B5CF6").opacity(0.1),
                                        lineWidth: isHovering ? 2 : 1
                                    )
                            } else {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(
                                        RadialGradient(
                                            colors: [
                                                Color(hex: "8B5CF6").opacity(isHovering ? 0.15 : 0),
                                                .clear
                                            ],
                                            center: .center,
                                            startRadius: 0,
                                            endRadius: 120
                                        )
                                    )
                            }
                        }
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                Color(hex: "8B5CF6").opacity(isHovering ? 0.3 : 0.1),
                                lineWidth: 1
                            )
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
        }
        .organicHover(isHovered: isHovering, id: "compact-\(game.id.uuidString)")
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color(hex: "0A0A0F")
            .ignoresSafeArea()

        VStack(spacing: 16) {
            GameCardView(
                game: Game(
                    name: "Cyberpunk 2077",
                    executablePath: "/Applications/Cyberpunk2077.app",
                    platform: .steam,
                    lastPlayed: Date().addingTimeInterval(-86400 * 2),
                    totalPlaytime: 3600 * 45
                ),
                onSelect: {},
                onOptimize: {}
            )
            .frame(maxWidth: 320)

            HStack(spacing: 12) {
                CompactGameCardView(
                    game: Game(
                        name: "Minecraft",
                        executablePath: "/Applications/Minecraft.app",
                        platform: .native,
                        lastPlayed: Date().addingTimeInterval(-86400)
                    ),
                    onSelect: {}
                )
                .frame(width: 100)

                CompactGameCardView(
                    game: Game(
                        name: "Fortnite",
                        executablePath: "/Applications/Fortnite.app",
                        platform: .epic
                    ),
                    onSelect: {}
                )
                .frame(width: 100)
            }
        }
        .padding()
    }
}
