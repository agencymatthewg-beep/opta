//
//  ScoreDisplay.swift
//  OptaApp
//
//  Opta Score display component with animated ring and grade badge.
//  Features circular progress ring, animated counting, and grade colors.
//

import SwiftUI

// MARK: - ScoreDisplay

/// The Opta Score display component featuring:
/// - Large animated score number with counting
/// - Circular progress ring with gradient
/// - Grade badge with color coding
/// - Pulsing animation when calculating
///
/// # Usage
///
/// ```swift
/// ScoreDisplay(
///     score: coreManager.viewModel.optaScore,
///     grade: coreManager.viewModel.scoreGrade,
///     isCalculating: coreManager.viewModel.scoreCalculating,
///     animation: coreManager.viewModel.scoreAnimation
/// )
/// ```
struct ScoreDisplay: View {

    // MARK: - Properties

    /// Current score (0-100)
    let score: UInt8

    /// Grade string (S, A, B, C, D, F)
    let grade: String

    /// Whether score is being calculated
    let isCalculating: Bool

    /// Animation progress (0.0 - 1.0)
    let animation: Float

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Animated display score
    @State private var displayScore: Int = 0

    /// Whether organic pulse is active (calculating state)
    @State private var isPulsing: Bool = false

    // MARK: - Constants

    private let ringSize: CGFloat = 180
    private let ringStrokeWidth: CGFloat = 12
    private let scoreFont: CGFloat = 48

    // MARK: - Body

    var body: some View {
        VStack(spacing: 16) {
            // Score Ring
            ZStack {
                // Background ring
                Circle()
                    .stroke(
                        Color.white.opacity(0.1),
                        style: StrokeStyle(lineWidth: ringStrokeWidth, lineCap: .round)
                    )

                // Progress ring with gradient
                Circle()
                    .trim(from: 0, to: CGFloat(displayScore) / 100.0)
                    .stroke(
                        scoreGradient,
                        style: StrokeStyle(lineWidth: ringStrokeWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(reduceMotion ? .none : OrganicMotion.organicSpring(for: "score-value", intensity: .medium), value: displayScore)

                // Inner content
                VStack(spacing: 4) {
                    // Score number
                    Text("\(displayScore)")
                        .font(.system(size: scoreFont, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())

                    // Label
                    Text("OPTA SCORE")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.5))
                        .tracking(1.5)
                }
                .organicPulse(id: "optaScore", intensity: .medium)
            }
            .frame(width: ringSize, height: ringSize)
            .shadow(color: colorTemp.tintColor.opacity(colorTemp.glowOpacity * 0.3), radius: 12, x: 0, y: 0)

            // Grade badge
            gradeBadge
        }
        .onChange(of: score) { _, newScore in
            animateScore(to: Int(newScore))
        }
        .onChange(of: isCalculating) { _, calculating in
            handleCalculatingState(calculating)
        }
        .onAppear {
            displayScore = Int(score)
            if isCalculating {
                handleCalculatingState(true)
            }
        }
    }

    // MARK: - Subviews

    /// Grade badge with color coding
    private var gradeBadge: some View {
        Text(grade)
            .font(.system(size: 24, weight: .bold, design: .rounded))
            .foregroundStyle(gradeColor)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(.ultraThinMaterial)
                    .overlay(
                        Capsule()
                            .stroke(gradeColor.opacity(0.3), lineWidth: 1)
                    )
            )
            .shadow(color: gradeColor.opacity(0.3), radius: 8, x: 0, y: 4)
    }

    // MARK: - Computed Properties

    /// Gradient for the score ring (temperature-aware)
    private var scoreGradient: LinearGradient {
        LinearGradient(
            colors: [colorTemp.tintColor, colorTemp.tintColor.opacity(colorTemp.glowOpacity)],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    /// Color for the grade badge based on grade
    private var gradeColor: Color {
        switch grade.uppercased() {
        case "S":
            // Gold gradient effect (use gold color)
            return Color(hex: "FFD700")
        case "A":
            return .green
        case "B":
            return .cyan
        case "C":
            return .yellow
        case "D":
            return .orange
        case "F":
            return .red
        default:
            return .gray
        }
    }

    // MARK: - Animation

    /// Animate score from current to target
    private func animateScore(to target: Int) {
        guard !reduceMotion else {
            displayScore = target
            return
        }

        // Use a timer-based animation for smooth counting
        let startScore = displayScore
        let difference = target - startScore
        let steps = 20
        let stepDuration = 0.02

        guard difference != 0 else { return }

        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(step) * stepDuration) {
                let progress = Float(step) / Float(steps)
                let easedProgress = easeOutCubic(progress)
                displayScore = startScore + Int(Float(difference) * easedProgress)
            }
        }
    }

    /// Handle calculating state changes
    /// Note: Visual pulse now handled by .organicPulse modifier (always-on ambient breathing).
    /// The calculating state is retained for future use (e.g. intensity switching).
    private func handleCalculatingState(_ calculating: Bool) {
        guard !reduceMotion else { return }
        isPulsing = calculating
    }

    /// Ease out cubic timing function
    private func easeOutCubic(_ t: Float) -> Float {
        let p = t - 1
        return p * p * p + 1
    }
}

// MARK: - ScoreRingShape

/// Custom shape for the score ring arc
struct ScoreRingShape: Shape {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        let startAngle = Angle.degrees(-90)
        let endAngle = Angle.degrees(-90 + 360 * progress)

        path.addArc(
            center: center,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            clockwise: false
        )

        return path
    }
}

// MARK: - Compact Score Display

/// A compact version of the score display for use in sidebars or smaller areas
struct CompactScoreDisplay: View {
    let score: UInt8
    let grade: String

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    var body: some View {
        HStack(spacing: 12) {
            // Mini ring
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 4)

                Circle()
                    .trim(from: 0, to: CGFloat(score) / 100.0)
                    .stroke(
                        LinearGradient(
                            colors: [colorTemp.tintColor, colorTemp.tintColor.opacity(colorTemp.glowOpacity)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))

                Text("\(score)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text("Opta Score")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.7))

                Text("Grade: \(grade)")
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
    }
}

// MARK: - Preview

#if DEBUG
struct ScoreDisplay_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 32) {
            ScoreDisplay(
                score: 85,
                grade: "A",
                isCalculating: false,
                animation: 1.0
            )

            HStack(spacing: 16) {
                CompactScoreDisplay(score: 92, grade: "S")
                CompactScoreDisplay(score: 45, grade: "C")
            }
        }
        .padding()
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
