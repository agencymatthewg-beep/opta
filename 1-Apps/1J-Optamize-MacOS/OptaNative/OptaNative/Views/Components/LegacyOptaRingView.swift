//
//  LegacyOptaRingView.swift
//  OptaNative
//
//  Preserved v2.1 algorithm for fallback when assets are missing.
//

import SwiftUI

struct LegacyOptaRingView: View {
    // MARK: - Configuration

    /// Energy level (0.0 = dormant, 0.5 = active, 1.0 = exploding)
    var energy: Double = 0.5

    // MARK: - Animation States

    // Primary plasma rotation layers (different speeds for organic feel)
    @State private var plasmaRotation1: Double = 0
    @State private var plasmaRotation2: Double = 0
    @State private var plasmaRotation3: Double = 0

    // Hot spot animations (random intensity flares)
    @State private var hotSpot1Opacity: Double = 0.3
    @State private var hotSpot2Opacity: Double = 0.5
    @State private var hotSpot3Opacity: Double = 0.2

    // Pulse animations (breathing effect)
    @State private var plasmaPulse: Double = 1.0
    @State private var rimPulse: Double = 1.0

    @State private var isAnimating = false

    // MARK: - Spec Constants

    private let ringStrokeWidth: CGFloat = 48
    private let plasmaStrokeWidth: CGFloat = 24  // Plasma is centered in the tube
    private let plasmaPadding: CGFloat = 12      // Centers plasma within tube wall

    // Colors from spec (using DesignSystem colors)
    private let obsidianDark = Color.optaSurface         // Titanium/Glass base
    private let obsidianMid = Color.optaMuted            // Mid-tone with violet undertones
    private let electricViolet = Color.optaNeonPurple    // Primary plasma color
    private let deepPurple = Color.optaDeepPurple        // Ambient/cool zones
    private let hotWhite = Color.white                    // Hot spots
    private let rimGlow = Color.optaPrimary              // Rim lighting

    var body: some View {
        ZStack {
            // ═══════════════════════════════════════════════════════════════
            // LAYER 0: Ambient Glow (Deep Purple Backlight)
            // Creates atmospheric halo BEHIND the ring
            // ═══════════════════════════════════════════════════════════════
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            deepPurple.opacity(0.7 * energy),
                            deepPurple.opacity(0.3 * energy),
                            .clear
                        ],
                        center: .center,
                        startRadius: 100,
                        endRadius: 200
                    )
                )
                .blur(radius: 50)
                .scaleEffect(1.2)

            // ═══════════════════════════════════════════════════════════════
            // LAYER 1: Dark Metallic Glassmorphism Body (Main Ring)
            // Titanium/Glass hybrid - NOT transparent, premium volcanic glass
            // ═══════════════════════════════════════════════════════════════
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            obsidianMid,      // Light catch (top-left)
                            obsidianDark,     // Deep titanium
                            Color.optaVoid,   // Near-black shadow
                            obsidianDark.opacity(0.8)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: ringStrokeWidth
                )
                .shadow(color: .black.opacity(0.8), radius: 20, x: 0, y: 15)

            // ═══════════════════════════════════════════════════════════════
            // LAYER 2: ENERGY EQUATOR (3D Plasma Core)
            //
            // The plasma exists in the CENTER of the torus tube cavity,
            // equidistant from inner and outer walls. This creates the
            // illusion of energy trapped within a glass vessel.
            //
            // Multiple overlapping layers create the abstract, variable,
            // alive-feeling plasma that is NOT predictable.
            // ═══════════════════════════════════════════════════════════════

            // --- Plasma Base Layer (slow churning) ---
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: plasmaGradientStops(
                            baseOpacity: 0.15 * energy,
                            hotSpotOpacity: hotSpot1Opacity * energy
                        ),
                        center: .center
                    ),
                    lineWidth: plasmaStrokeWidth
                )
                .padding(plasmaPadding)
                .rotationEffect(.degrees(plasmaRotation1))
                .blur(radius: 6) // Deeper in the tube = more blur
                .blendMode(.screen)

            // --- Plasma Mid Layer (faster, offset rotation) ---
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: plasmaGradientStops(
                            baseOpacity: 0.25 * energy,
                            hotSpotOpacity: hotSpot2Opacity * energy
                        ),
                        center: .center
                    ),
                    lineWidth: plasmaStrokeWidth - 4
                )
                .padding(plasmaPadding + 2)
                .rotationEffect(.degrees(plasmaRotation2))
                .blur(radius: 4)
                .blendMode(.screen)
                .scaleEffect(plasmaPulse)

            // --- Plasma Core Layer (brightest, centered) ---
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: plasmaGradientStops(
                            baseOpacity: 0.4 * energy,
                            hotSpotOpacity: hotSpot3Opacity * energy,
                            includeWhiteHot: true
                        ),
                        center: .center
                    ),
                    lineWidth: plasmaStrokeWidth - 8
                )
                .padding(plasmaPadding + 4)
                .rotationEffect(.degrees(plasmaRotation3))
                .blur(radius: 2)
                .blendMode(.plusLighter)

            // --- Hot Spot Flares (random intensity bursts) ---
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .strokeBorder(
                        AngularGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: hotWhite.opacity(hotSpotOpacity(for: index) * energy), location: hotSpotLocation(for: index)),
                                .init(color: electricViolet.opacity(0.5 * energy), location: hotSpotLocation(for: index) + 0.05),
                                .init(color: .clear, location: hotSpotLocation(for: index) + 0.1)
                            ],
                            center: .center
                        ),
                        lineWidth: 8
                    )
                    .padding(plasmaPadding + CGFloat(index * 2))
                    .rotationEffect(.degrees(Double(index * 120) + plasmaRotation2))
                    .blur(radius: 3)
                    .blendMode(.plusLighter)
            }

            // ═══════════════════════════════════════════════════════════════
            // LAYER 3: Glass Shell (Top Reflection)
            // Simulates overhead light reflecting on frosted glass surface
            // ═══════════════════════════════════════════════════════════════
            Circle()
                .strokeBorder(
                    LinearGradient(
                        stops: [
                            .init(color: .white.opacity(0.25), location: 0.0),
                            .init(color: .white.opacity(0.08), location: 0.3),
                            .init(color: .white.opacity(0.02), location: 0.5),
                            .init(color: .clear, location: 0.6)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: ringStrokeWidth
                )

            // ═══════════════════════════════════════════════════════════════
            // LAYER 4: Rim Light (HD Edge Definition)
            // Creates the signature "HD" look with sharp edge glow
            // Fresnel effect - brighter at glancing angles
            // ═══════════════════════════════════════════════════════════════
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: [
                            .init(color: rimGlow.opacity(0.9 * rimPulse * energy), location: 0.0),
                            .init(color: .white.opacity(0.7 * rimPulse * energy), location: 0.1),
                            .init(color: .clear, location: 0.25),
                            .init(color: .clear, location: 0.75),
                            .init(color: .white.opacity(0.5 * rimPulse * energy), location: 0.9),
                            .init(color: rimGlow.opacity(0.8 * rimPulse * energy), location: 1.0)
                        ],
                        center: .center
                    ),
                    lineWidth: 2
                )
                .padding(-1)

            // Inner rim for depth
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: [
                            .init(color: electricViolet.opacity(0.4 * energy), location: 0.05),
                            .init(color: .clear, location: 0.2),
                            .init(color: .clear, location: 0.8),
                            .init(color: electricViolet.opacity(0.3 * energy), location: 0.95)
                        ],
                        center: .center
                    ),
                    lineWidth: 1
                )
                .padding(ringStrokeWidth - 1)

            // ═══════════════════════════════════════════════════════════════
            // LAYER 5: Specular Highlight (Wet/Sharp)
            // Creates the polished glass "wet" look
            // ═══════════════════════════════════════════════════════════════
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .white.opacity(0.9), location: 0.12),
                            .init(color: .white, location: 0.14),
                            .init(color: .white.opacity(0.7), location: 0.16),
                            .init(color: .clear, location: 0.20)
                        ],
                        center: .center
                    ),
                    lineWidth: 4
                )
                .padding(3)
                .rotationEffect(.degrees(-45))
                .blur(radius: 0.5)
                .blendMode(.overlay)
        }
        .frame(width: 320, height: 320)
        .rotation3DEffect(
            .degrees(25), // 3D Hero Display tilt per spec
            axis: (x: 1.0, y: 0.0, z: 0.0)
        )
        .onAppear {
            startAnimations()
        }
    }

    // MARK: - Plasma Gradient Generation

    /// Creates abstract, variable plasma gradient stops
    /// Different hot spots and opacity levels create the "alive" feeling
    private func plasmaGradientStops(
        baseOpacity: Double,
        hotSpotOpacity: Double,
        includeWhiteHot: Bool = false
    ) -> [Gradient.Stop] {
        var stops: [Gradient.Stop] = []

        // Create irregular, organic distribution of plasma intensity
        let segments = 12
        for i in 0..<segments {
            let location = Double(i) / Double(segments)

            // Vary intensity based on pseudo-random pattern
            let intensity = sin(location * .pi * 4) * 0.3 + 0.7
            let opacity = baseOpacity * intensity

            if i % 4 == 0 {
                // Hot spot locations
                stops.append(.init(color: .clear, location: max(0, location - 0.02)))
                if includeWhiteHot {
                    stops.append(.init(color: hotWhite.opacity(hotSpotOpacity), location: location))
                } else {
                    stops.append(.init(color: electricViolet.opacity(hotSpotOpacity), location: location))
                }
                stops.append(.init(color: electricViolet.opacity(opacity), location: location + 0.03))
            } else if i % 4 == 2 {
                // Cool zones
                stops.append(.init(color: deepPurple.opacity(opacity * 0.3), location: location))
            } else {
                // Mid intensity
                stops.append(.init(color: electricViolet.opacity(opacity * 0.6), location: location))
            }
        }

        // Close the loop
        stops.append(.init(color: stops.first?.color ?? .clear, location: 1.0))

        return stops.sorted { $0.location < $1.location }
    }

    private func hotSpotOpacity(for index: Int) -> Double {
        switch index {
        case 0: return hotSpot1Opacity
        case 1: return hotSpot2Opacity
        case 2: return hotSpot3Opacity
        default: return 0.3
        }
    }

    private func hotSpotLocation(for index: Int) -> Double {
        // Distribute hot spots around the ring
        [0.15, 0.45, 0.75][index]
    }

    // MARK: - Animation System

    private func startAnimations() {
        guard !isAnimating else { return }
        isAnimating = true

        // === PRIMARY PLASMA ROTATIONS ===
        // Different speeds create organic, non-mechanical movement

        // Layer 1: Slow, base churning (8s per spec)
        withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
            plasmaRotation1 = 360
        }

        // Layer 2: Counter-rotation, faster (creates turbulence)
        withAnimation(.linear(duration: 6).repeatForever(autoreverses: false)) {
            plasmaRotation2 = -360
        }

        // Layer 3: Fastest, core energy
        withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
            plasmaRotation3 = 360
        }

        // === HOT SPOT INTENSITY FLARES ===
        // Random-feeling intensity changes (2-4s intervals per spec)

        withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
            hotSpot1Opacity = 0.9
        }

        withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true).delay(0.7)) {
            hotSpot2Opacity = 0.85
        }

        withAnimation(.easeInOut(duration: 2.8).repeatForever(autoreverses: true).delay(1.4)) {
            hotSpot3Opacity = 0.95
        }

        // === BREATHING PULSE ===
        // Subtle scale breathing for life

        withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
            plasmaPulse = 1.03
        }

        withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true).delay(0.5)) {
            rimPulse = 1.15
        }
    }
}
