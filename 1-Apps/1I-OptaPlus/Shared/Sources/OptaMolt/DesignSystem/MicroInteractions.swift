//
//  MicroInteractions.swift
//  OptaMolt
//
//  Phase 18: Premium micro-interactions — branded loaders, focus glow,
//  emoji bounce, connection pulse, custom sheet springs, scroll glow.
//

import SwiftUI

// MARK: - Opta Branded Loader (Ring with Gap)

/// Custom branded loading spinner — circle with gap, rotating.
/// Replaces ProgressView() throughout the app for consistent branding.
public struct OptaLoader: View {
    let size: CGFloat
    let lineWidth: CGFloat
    let color: Color
    @State private var rotation: Double = 0

    public init(size: CGFloat = 20, lineWidth: CGFloat = 2.5, color: Color = .optaPrimary) {
        self.size = size
        self.lineWidth = lineWidth
        self.color = color
    }

    public var body: some View {
        Circle()
            .trim(from: 0, to: 0.72)
            .stroke(
                AngularGradient(
                    colors: [color.opacity(0), color],
                    center: .center
                ),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
            )
            .frame(width: size, height: size)
            .rotationEffect(.degrees(rotation))
            .onAppear {
                withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
    }
}

// MARK: - Input Focus Glow Modifier

/// Adds a violet border glow and slight lift when the view is focused.
public struct InputFocusGlowModifier: ViewModifier {
    let isFocused: Bool
    let accentColor: Color

    public init(isFocused: Bool, accentColor: Color = .optaPrimary) {
        self.isFocused = isFocused
        self.accentColor = accentColor
    }

    public func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(accentColor.opacity(isFocused ? 0.4 : 0), lineWidth: 1.5)
                    .blur(radius: isFocused ? 2 : 0)
            )
            .shadow(
                color: accentColor.opacity(isFocused ? 0.15 : 0.05),
                radius: isFocused ? 8 : 3,
                y: isFocused ? 2 : 1
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isFocused)
    }
}

// MARK: - Emoji Bounce Modifier

/// On hover, the content does a small bounce (scale 1.0 → 1.08 → 1.0).
public struct EmojiBounceModifier: ViewModifier {
    @State private var bounceScale: CGFloat = 1.0
    @State private var isHovered = false

    public func body(content: Content) -> some View {
        content
            .scaleEffect(bounceScale)
            .onHover { hovering in
                guard hovering, !isHovered else {
                    isHovered = hovering
                    if !hovering {
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                            bounceScale = 1.0
                        }
                    }
                    return
                }
                isHovered = true
                withAnimation(.spring(response: 0.15, dampingFraction: 0.4)) {
                    bounceScale = 1.08
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        bounceScale = 1.0
                    }
                }
            }
    }
}

// MARK: - Connection Dot Pulse

/// A circle that pulses once when `trigger` becomes true.
public struct ConnectionPulseDot: View {
    let color: Color
    let size: CGFloat
    let isConnecting: Bool

    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: CGFloat = 0

    public init(color: Color, size: CGFloat = 6, isConnecting: Bool = false) {
        self.color = color
        self.size = size
        self.isConnecting = isConnecting
    }

    public var body: some View {
        ZStack {
            // Pulse ring
            Circle()
                .stroke(color.opacity(pulseOpacity), lineWidth: 1.5)
                .frame(width: size * pulseScale, height: size * pulseScale)

            // Solid dot
            Circle()
                .fill(color)
                .frame(width: size, height: size)
                .shadow(color: color.opacity(0.6), radius: 4)
        }
        .onChange(of: isConnecting) { _, connecting in
            if connecting {
                // Pulse animation
                pulseScale = 1.0
                pulseOpacity = 0.8
                withAnimation(.easeOut(duration: 0.6)) {
                    pulseScale = 2.5
                    pulseOpacity = 0
                }
            }
        }
    }
}

// MARK: - Custom Sheet Spring

/// Custom presentation spring for sheets — faster and snappier than default.
public extension Animation {
    static let optaSheet: Animation = .spring(response: 0.35, dampingFraction: 0.85)
}

// MARK: - Sheet Scale Modifier

/// Panels scale from 0.95 → 1.0 on appear with custom spring.
public struct SheetScaleModifier: ViewModifier {
    @State private var appeared = false

    public func body(content: Content) -> some View {
        content
            .scaleEffect(appeared ? 1.0 : 0.95)
            .opacity(appeared ? 1.0 : 0)
            .onAppear {
                withAnimation(.optaSheet) {
                    appeared = true
                }
            }
    }
}

// MARK: - Scroll Edge Glow

/// Shows a subtle glow at scroll edges to indicate overscroll.
public struct ScrollEdgeGlow: View {
    let edge: Edge
    let color: Color
    let isVisible: Bool

    public init(edge: Edge, color: Color = .optaPrimary, isVisible: Bool) {
        self.edge = edge
        self.color = color
        self.isVisible = isVisible
    }

    public var body: some View {
        LinearGradient(
            colors: [color.opacity(isVisible ? 0.15 : 0), .clear],
            startPoint: edge == .top ? .top : .bottom,
            endPoint: edge == .top ? .bottom : .top
        )
        .frame(height: 30)
        .allowsHitTesting(false)
        .animation(.easeOut(duration: 0.2), value: isVisible)
    }
}

// MARK: - Message Send Launch Modifier

/// Animates a newly sent message: starts small near input, springs up to position.
public struct MessageSendLaunchModifier: ViewModifier {
    let isNewlySent: Bool
    @State private var launched = false

    public init(isNewlySent: Bool) {
        self.isNewlySent = isNewlySent
    }

    public func body(content: Content) -> some View {
        if isNewlySent && !launched {
            content
                .scaleEffect(launched ? 1.0 : 0.85)
                .offset(y: launched ? 0 : 20)
                .opacity(launched ? 1.0 : 0.6)
                .onAppear {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        launched = true
                    }
                }
        } else {
            content
        }
    }
}

// MARK: - Bot Switch Crossfade

/// Crossfade transition for bot switching — wraps content in an id-keyed transition.
public struct CrossfadeModifier: ViewModifier {
    let id: String

    public func body(content: Content) -> some View {
        content
            .id(id)
            .transition(.opacity.animation(.easeInOut(duration: 0.25)))
    }
}

// MARK: - View Extensions

public extension View {
    /// Adds input focus glow effect.
    func inputFocusGlow(isFocused: Bool, color: Color = .optaPrimary) -> some View {
        modifier(InputFocusGlowModifier(isFocused: isFocused, accentColor: color))
    }

    /// Adds emoji bounce on hover.
    func emojiBounce() -> some View {
        modifier(EmojiBounceModifier())
    }

    /// Adds sheet scale entrance animation.
    func sheetScale() -> some View {
        modifier(SheetScaleModifier())
    }

    /// Adds message send launch animation.
    func sendLaunch(isNewlySent: Bool) -> some View {
        modifier(MessageSendLaunchModifier(isNewlySent: isNewlySent))
    }
}
