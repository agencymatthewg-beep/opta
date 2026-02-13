//
//  RiveLogoView.swift
//  OptaMenuBar
//
//  SwiftUI view for Rive-animated Opta logo in the menu bar.
//  Animation speed and glow respond to system momentum state.
//  Created for Opta - Plan 20-08
//

import SwiftUI
import RiveRuntime

// MARK: - Rive Logo View

/// SwiftUI view wrapping the Rive animation for the Opta logo.
/// Responds to momentum state for dynamic visual feedback.
struct RiveLogoView: View {
    /// Current momentum state controlling animation
    let momentum: MomentumState

    /// Size of the logo in points
    var size: CGFloat = 22

    /// Rive view model for controlling animation
    @State private var riveViewModel: RiveViewModel?

    /// Whether the animation has loaded successfully
    @State private var isLoaded = false

    /// Fallback glow animation state
    @State private var glowOpacity: Double = 0.5

    var body: some View {
        ZStack {
            // Glow background
            glowBackground

            // Rive animation (with fallback)
            if isLoaded, let viewModel = riveViewModel {
                RiveViewRepresentable(viewModel: viewModel)
                    .frame(width: size, height: size)
            } else {
                // Fallback: SF Symbol with animated glow
                fallbackIcon
            }
        }
        .frame(width: size, height: size)
        .onChange(of: momentum.rotationSpeed) { _, newSpeed in
            updateAnimationSpeed(newSpeed)
        }
        .onChange(of: momentum.color) { _, newColor in
            updateGlowState(newColor)
        }
        .onAppear {
            loadAnimation()
            startGlowAnimation()
        }
    }

    // MARK: - Subviews

    /// Animated glow background
    private var glowBackground: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: momentum.color.gradientColors.map { $0.opacity(glowOpacity * Double(momentum.intensity)) },
                    center: .center,
                    startRadius: 0,
                    endRadius: size / 2
                )
            )
            .blur(radius: 4)
    }

    /// Fallback icon when Rive animation is unavailable
    private var fallbackIcon: some View {
        Image(systemName: "bolt.fill")
            .font(.system(size: size * 0.7, weight: .semibold))
            .foregroundStyle(
                LinearGradient(
                    colors: momentum.color.gradientColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .rotationEffect(.degrees(rotationAngle))
    }

    /// Rotation angle based on momentum
    private var rotationAngle: Double {
        // Subtle rotation for visual interest
        return Double(momentum.rotationSpeed) * 15
    }

    // MARK: - Animation Control

    /// Load the Rive animation from bundle resources
    private func loadAnimation() {
        // Try to load from bundle
        guard let url = Bundle.module.url(forResource: "opta-logo", withExtension: "riv") else {
            print("[RiveLogoView] Rive file not found, using fallback icon")
            return
        }

        do {
            riveViewModel = try RiveViewModel(
                fileName: "opta-logo",
                stateMachineName: "State Machine 1",
                fit: .contain
            )
            isLoaded = true
            print("[RiveLogoView] Rive animation loaded successfully")
        } catch {
            print("[RiveLogoView] Failed to load Rive animation: \(error)")
        }
    }

    /// Update Rive animation speed based on momentum
    private func updateAnimationSpeed(_ speed: Float) {
        guard let viewModel = riveViewModel else { return }

        // Set state machine input for rotation speed
        do {
            try viewModel.setInput("speed", value: Double(speed))
        } catch {
            // Input may not exist in all animation variants
            print("[RiveLogoView] Could not set speed input: \(error)")
        }
    }

    /// Update Rive glow state based on momentum color
    private func updateGlowState(_ color: MomentumColor) {
        guard let viewModel = riveViewModel else { return }

        let stateIndex: Double = switch color {
        case .idle: 0
        case .active: 1
        case .critical: 2
        }

        do {
            try viewModel.setInput("glowState", value: stateIndex)
        } catch {
            print("[RiveLogoView] Could not set glowState input: \(error)")
        }
    }

    /// Start the fallback glow animation
    private func startGlowAnimation() {
        withAnimation(
            .easeInOut(duration: 1.0 / Double(momentum.pulseFrequency))
            .repeatForever(autoreverses: true)
        ) {
            glowOpacity = 0.8
        }
    }
}

// MARK: - Rive View Representable

/// NSViewRepresentable wrapper for RiveView in macOS
struct RiveViewRepresentable: NSViewRepresentable {
    let viewModel: RiveViewModel?

    func makeNSView(context: Context) -> RiveView {
        let view = RiveView()
        view.wantsLayer = true

        if let vm = viewModel {
            // Configure view with viewModel
            view.fit = .contain
        }

        return view
    }

    func updateNSView(_ nsView: RiveView, context: Context) {
        // Update as needed when state changes
    }
}

// MARK: - RiveViewModel Extension

extension RiveViewModel {
    /// Convenience initializer for loading from bundle
    convenience init(fileName: String, stateMachineName: String, fit: RiveFit) throws {
        try self.init(fileName: fileName, stateMachineName: stateMachineName)
    }
}

// MARK: - Preview

#Preview("RiveLogoView - Idle") {
    HStack(spacing: 20) {
        RiveLogoView(
            momentum: MomentumState(intensity: 0.3, color: .idle, rotationSpeed: 0.5, pulseFrequency: 0.5)
        )

        RiveLogoView(
            momentum: MomentumState(intensity: 0.7, color: .active, rotationSpeed: 1.5, pulseFrequency: 1.0)
        )

        RiveLogoView(
            momentum: MomentumState(intensity: 1.0, color: .critical, rotationSpeed: 3.0, pulseFrequency: 2.0)
        )
    }
    .padding()
    .background(Color.black)
}
