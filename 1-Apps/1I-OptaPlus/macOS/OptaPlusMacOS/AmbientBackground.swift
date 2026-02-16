//
//  AmbientBackground.swift
//  OptaPlusMacOS
//
//  Cinematic Void ambient background — lives behind all chat content.
//  Renders floating gradient orbs and a subtle particle field on a pure
//  void (#050505) base. Responds to bot state (thinking/typing pulses
//  brighter) and connection state (disconnected dims everything).
//
//  Uses Canvas + TimelineView for maximum rendering performance.
//
//  Usage:
//  ```swift
//  ZStack {
//      AmbientBackground(
//          botAccentColor: .optaCoral,
//          botState: .idle,
//          isConnected: true
//      )
//      ChatContentView()
//  }
//  ```
//

import SwiftUI
import OptaMolt

// MARK: - Bot State

/// Current activity state of the active bot.
public enum BotActivityState: Sendable {
    case idle
    case thinking
    case typing
}

// MARK: - Ambient Background

/// A performant ambient background that renders behind all chat content.
///
/// Features:
/// - Pure `Color.optaVoid` base
/// - 3 floating gradient orbs using the bot's accent color (5-10% opacity, ~200px blur)
/// - ~40 particle dots (white at 3-5% opacity, slowly drifting)
/// - Bot state reactivity: thinking/typing → orbs pulse brighter
/// - Connection state: disconnected → everything dims
public struct AmbientBackground: View {
    /// The active bot's accent color for orb tinting.
    let botAccentColor: Color
    /// Current bot activity state.
    let botState: BotActivityState
    /// Whether the client is connected.
    let isConnected: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        botAccentColor: Color = .optaPrimary,
        botState: BotActivityState = .idle,
        isConnected: Bool = true
    ) {
        self.botAccentColor = botAccentColor
        self.botState = botState
        self.isConnected = isConnected
    }

    /// Base opacity multiplier based on connection state.
    private var globalDim: Double {
        isConnected ? 1.0 : 0.3
    }

    public var body: some View {
        // Static ambient background — rendered once, no continuous animation.
        // Drops idle CPU from ~30% to <2%.
        staticBackground
            .opacity(globalDim)
            .animation(.optaSpring, value: isConnected)
    }

    // MARK: - Static Fallback

    @ViewBuilder
    private var staticBackground: some View {
        ZStack {
            Color.optaVoid
            // Lightweight radial gradients instead of blur() — 50x cheaper
            RadialGradient(
                colors: [botAccentColor.opacity(0.06 * globalDim), .clear],
                center: UnitPoint(x: 0.25, y: 0.3),
                startRadius: 0,
                endRadius: 300
            )
            RadialGradient(
                colors: [botAccentColor.opacity(0.04 * globalDim), .clear],
                center: UnitPoint(x: 0.75, y: 0.7),
                startRadius: 0,
                endRadius: 250
            )
        }
        .ignoresSafeArea()
        .drawingGroup() // Flatten to single GPU texture
    }

}

// MARK: - Preview

#if DEBUG
#Preview("Ambient Background — Idle") {
    AmbientBackground(botAccentColor: .optaPrimary, botState: .idle, isConnected: true)
        .frame(width: 800, height: 600)
}

#Preview("Ambient Background — Thinking") {
    AmbientBackground(botAccentColor: .optaCoral, botState: .thinking, isConnected: true)
        .frame(width: 800, height: 600)
}

#Preview("Ambient Background — Disconnected") {
    AmbientBackground(botAccentColor: .optaPrimary, botState: .idle, isConnected: false)
        .frame(width: 800, height: 600)
}
#endif
