//
//  RadarScanView.swift
//  OptaMolt
//
//  Radar sweep overlay for Bot Map — a 120-degree gradient arc rotates
//  360 degrees over 3 seconds while concentric rings pulse outward.
//  Uses Canvas + TimelineView for smooth, efficient rendering.
//

import SwiftUI

// MARK: - Radar Scan View

/// Radar sweep animation that overlays the Bot Map during network scanning.
///
/// Renders a 120-degree gradient arc from `optaPrimary` to transparent,
/// sweeping continuously at constant angular velocity (3-second period).
/// Three concentric rings pulse at 0.3, 0.6, and 0.9 of the radius.
///
/// Usage:
/// ```swift
/// RadarScanView(isScanning: $scanner.isScanning)
/// ```
public struct RadarScanView: View {
    @Binding public var isScanning: Bool
    @State private var opacity: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Period for one full sweep in seconds.
    private let sweepPeriod: Double = 3.0
    /// Angular width of the gradient arc in radians (120 degrees).
    private let arcWidth: Double = .pi * 2 / 3
    /// Radii of the concentric rings as fractions of the available radius.
    private let ringFractions: [CGFloat] = [0.3, 0.6, 0.9]

    public init(isScanning: Binding<Bool>) {
        self._isScanning = isScanning
    }

    public var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let radius = min(geo.size.width, geo.size.height) * 0.45

            if reduceMotion {
                // Reduced motion: just show static rings while scanning
                staticRadarFallback(center: center, radius: radius)
            } else {
                TimelineView(.animation(minimumInterval: nil, paused: !isScanning)) { timeline in
                    let elapsed = timeline.date.timeIntervalSinceReferenceDate
                    let sweepAngle = (elapsed / sweepPeriod).truncatingRemainder(dividingBy: 1.0) * .pi * 2

                    Canvas { context, size in
                        // Draw concentric pulse rings
                        drawRings(in: &context, center: center, radius: radius, sweepAngle: sweepAngle)

                        // Draw the gradient sweep arc
                        drawSweepArc(in: &context, center: center, radius: radius, sweepAngle: sweepAngle)
                    }
                }
            }
        }
        .opacity(opacity)
        .onChange(of: isScanning) { _, scanning in
            withAnimation(.optaGentle) {
                opacity = scanning ? 1.0 : 0
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: - Canvas Drawing

    /// Draws three concentric rings that brighten as the sweep passes over them.
    private func drawRings(
        in context: inout GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        sweepAngle: Double
    ) {
        for fraction in ringFractions {
            let ringRadius = radius * fraction

            // Base ring (always visible at low opacity)
            let basePath = Path { path in
                path.addEllipse(in: CGRect(
                    x: center.x - ringRadius,
                    y: center.y - ringRadius,
                    width: ringRadius * 2,
                    height: ringRadius * 2
                ))
            }

            context.stroke(
                basePath,
                with: .color(Color.optaPrimary.opacity(0.08)),
                lineWidth: 0.5
            )

            // Pulse: ring brightens briefly as sweep passes the 12 o'clock position
            // Use a sine-based pulse tied to sweep angle for a smooth glow effect
            let pulsePhase = sin(sweepAngle + Double(fraction) * .pi * 2)
            let pulseOpacity = max(0, pulsePhase) * 0.12

            if pulseOpacity > 0.01 {
                context.stroke(
                    basePath,
                    with: .color(Color.optaPrimary.opacity(pulseOpacity)),
                    lineWidth: 1.0
                )
            }
        }
    }

    /// Draws the 120-degree gradient sweep arc using segmented fill.
    private func drawSweepArc(
        in context: inout GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        sweepAngle: Double
    ) {
        // Draw the arc as a series of thin wedge segments for a smooth gradient.
        // The leading edge (sweepAngle) is fully opaque, fading to transparent
        // over the 120-degree trailing tail.
        let segmentCount = 40
        let segmentArc = arcWidth / Double(segmentCount)

        for i in 0..<segmentCount {
            // Fraction from leading edge (1.0) to trailing edge (0.0)
            let fraction = 1.0 - Double(i) / Double(segmentCount)
            let segmentOpacity = fraction * fraction * 0.25 // quadratic falloff for natural look

            guard segmentOpacity > 0.005 else { continue }

            let startAngle = sweepAngle - Double(i) * segmentArc
            let endAngle = startAngle - segmentArc

            var wedge = Path()
            wedge.move(to: center)
            wedge.addArc(
                center: center,
                radius: radius,
                startAngle: .radians(startAngle),
                endAngle: .radians(endAngle),
                clockwise: true
            )
            wedge.closeSubpath()

            context.fill(
                wedge,
                with: .color(Color.optaPrimary.opacity(segmentOpacity))
            )
        }

        // Leading edge highlight — a bright thin line at the sweep front
        let angle = CGFloat(sweepAngle)
        let leadStart = CGPoint(
            x: center.x + radius * 0.1 * cos(angle),
            y: center.y + radius * 0.1 * sin(angle)
        )
        let leadEnd = CGPoint(
            x: center.x + radius * cos(angle),
            y: center.y + radius * sin(angle)
        )

        var leadLine = Path()
        leadLine.move(to: leadStart)
        leadLine.addLine(to: leadEnd)

        context.stroke(
            leadLine,
            with: .color(Color.optaPrimaryGlow.opacity(0.4)),
            style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
        )
    }

    // MARK: - Reduced Motion Fallback

    /// Static rings shown when reduce motion is enabled.
    private func staticRadarFallback(center: CGPoint, radius: CGFloat) -> some View {
        Canvas { context, _ in
            for fraction in ringFractions {
                let ringRadius = radius * fraction
                let path = Path { p in
                    p.addEllipse(in: CGRect(
                        x: center.x - ringRadius,
                        y: center.y - ringRadius,
                        width: ringRadius * 2,
                        height: ringRadius * 2
                    ))
                }
                context.stroke(
                    path,
                    with: .color(Color.optaPrimary.opacity(0.15)),
                    lineWidth: 0.5
                )
            }
        }
    }
}
