//
//  OptaRingView.swift
//  OptaApp
//
//  SwiftUI wrapper for the wgpu OptaRing 3D rendering component.
//  Integrates MetalRenderView with ring-specific state control.
//

import SwiftUI

// MARK: - OptaRingView

/// SwiftUI wrapper for the wgpu OptaRing 3D component.
///
/// This view integrates the Metal/wgpu render infrastructure with ring-specific
/// state management. The ring serves as the visual centerpiece of the dashboard,
/// displaying the current optimization state through animated phases.
///
/// # Ring States
///
/// - **sleeping**: Ring is dormant, minimal animation
/// - **waking**: Wake-up animation with expanding energy
/// - **active**: Normal operational state
/// - **exploding**: Celebration/explosion effect after optimization
///
/// # Usage
///
/// ```swift
/// OptaRingView(
///     coordinator: renderCoordinator,
///     phase: coreManager.viewModel.ring.phase,
///     intensity: coreManager.viewModel.ring.energy,
///     explodeProgress: coreManager.viewModel.ring.progress
/// )
/// .frame(width: 300, height: 300)
/// .onTapGesture {
///     coreManager.dispatch(.toggleRingExpanded)
/// }
/// ```
struct OptaRingView: View {

    // MARK: - Properties

    /// The render coordinator managing the Metal/wgpu rendering
    @ObservedObject var coordinator: RenderCoordinator

    /// Current ring animation phase
    let phase: RingPhaseViewModel

    /// Ring intensity/energy level (0.0 - 1.0)
    let intensity: Float

    /// Explosion animation progress (0.0 - 1.0)
    let explodeProgress: Float

    /// Optional tap action
    var onTap: (() -> Void)? = nil

    // MARK: - State

    /// Whether the ring is currently hovered
    @State private var isHovered: Bool = false

    /// Accessibility reduced motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Constants

    /// Default ring size
    static let defaultSize: CGFloat = 300

    // MARK: - Body

    var body: some View {
        ZStack {
            // Metal render view with wgpu ring
            MetalRenderView(coordinator: coordinator)
                .clipShape(Circle())

            // Glow effect overlay (rendered in SwiftUI for glass compositing)
            if intensity > 0 && !reduceMotion {
                ringGlowOverlay
            }

            // Phase indicator (debug/development)
            #if DEBUG
            phaseIndicator
            #endif
        }
        .frame(width: Self.defaultSize, height: Self.defaultSize)
        .contentShape(Circle())
        .onTapGesture {
            onTap?()
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .onAppear {
            configureRingState()
        }
        .onChange(of: phase) { _, newPhase in
            coordinator.setRingPhase(newPhase)
        }
        .onChange(of: intensity) { _, newIntensity in
            coordinator.setRingIntensity(newIntensity)
        }
        .onChange(of: explodeProgress) { _, newProgress in
            coordinator.setRingExplodeProgress(newProgress)
        }
    }

    // MARK: - Subviews

    /// Glow effect that radiates from the ring
    private var ringGlowOverlay: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        phaseColor.opacity(Double(intensity) * 0.3),
                        phaseColor.opacity(Double(intensity) * 0.1),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: Self.defaultSize * 0.3,
                    endRadius: Self.defaultSize * 0.6
                )
            )
            .scaleEffect(1.0 + CGFloat(explodeProgress) * 0.3)
            .blur(radius: 20 + CGFloat(intensity) * 10)
            .allowsHitTesting(false)
    }

    #if DEBUG
    /// Debug phase indicator
    private var phaseIndicator: some View {
        VStack {
            Spacer()
            Text(phase.rawValue)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.5))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.5))
                .clipShape(Capsule())
        }
        .padding(.bottom, 8)
    }
    #endif

    // MARK: - Computed Properties

    /// Color based on current ring phase
    private var phaseColor: Color {
        switch phase {
        case .idle, .sleeping:
            return Color(hex: "6366F1")  // Indigo - dormant
        case .wakingUp:
            return Color(hex: "8B5CF6")  // Purple - waking
        case .active:
            return Color(hex: "3B82F6")  // Blue - active
        case .optimizing:
            return Color(hex: "10B981")  // Emerald - optimizing
        case .celebrating:
            return Color(hex: "F59E0B")  // Amber - celebration
        }
    }

    // MARK: - Private Methods

    /// Configure initial ring state in the coordinator
    private func configureRingState() {
        coordinator.setRingPhase(phase)
        coordinator.setRingIntensity(intensity)
        coordinator.setRingExplodeProgress(explodeProgress)
    }
}

// MARK: - RenderCoordinator Ring Extensions

extension RenderCoordinator {

    /// Set the current ring animation phase
    /// - Parameter phase: The ring phase to set
    func setRingPhase(_ phase: RingPhaseViewModel) {
        // Convert to internal ring phase for the Rust bridge
        let phaseValue = ringPhaseToValue(phase)

        #if DEBUG
        print("[RenderCoordinator] Setting ring phase: \(phase.rawValue) (value: \(phaseValue))")
        #endif

        // TODO: Bridge to Rust render when ring component is fully integrated
        // renderBridge?.setRingPhase(phaseValue)
    }

    /// Set the ring intensity/energy level
    /// - Parameter intensity: Intensity value (0.0 - 1.0)
    func setRingIntensity(_ intensity: Float) {
        let clampedIntensity = max(0, min(1, intensity))

        #if DEBUG
        print("[RenderCoordinator] Setting ring intensity: \(clampedIntensity)")
        #endif

        // TODO: Bridge to Rust render when ring component is fully integrated
        // renderBridge?.setRingIntensity(clampedIntensity)
    }

    /// Set the ring explosion animation progress
    /// - Parameter progress: Progress value (0.0 - 1.0)
    func setRingExplodeProgress(_ progress: Float) {
        let clampedProgress = max(0, min(1, progress))

        #if DEBUG
        print("[RenderCoordinator] Setting ring explode progress: \(clampedProgress)")
        #endif

        // TODO: Bridge to Rust render when ring component is fully integrated
        // renderBridge?.setRingExplodeProgress(clampedProgress)
    }

    /// Convert RingPhaseViewModel to internal integer value
    private func ringPhaseToValue(_ phase: RingPhaseViewModel) -> UInt8 {
        switch phase {
        case .idle: return 0
        case .wakingUp: return 1
        case .active: return 2
        case .optimizing: return 3
        case .celebrating: return 4
        case .sleeping: return 5
        }
    }
}

// MARK: - Compact OptaRingView

/// Compact version of OptaRingView for menu bar and sidebars
struct CompactOptaRingView: View {

    /// The render coordinator
    @ObservedObject var coordinator: RenderCoordinator

    /// Ring phase
    let phase: RingPhaseViewModel

    /// Ring intensity
    let intensity: Float

    /// Size for compact display
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            // Simplified ring indicator (no full Metal render for compact)
            Circle()
                .strokeBorder(
                    AngularGradient(
                        colors: [phaseColor.opacity(0.5), phaseColor, phaseColor.opacity(0.5)],
                        center: .center
                    ),
                    lineWidth: 3
                )

            // Energy core
            Circle()
                .fill(
                    RadialGradient(
                        colors: [phaseColor.opacity(0.4), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: size / 2 - 4
                    )
                )
                .scaleEffect(0.6 + CGFloat(intensity) * 0.4)
        }
        .frame(width: size, height: size)
    }

    private var phaseColor: Color {
        switch phase {
        case .idle, .sleeping:
            return Color(hex: "6366F1")
        case .wakingUp:
            return Color(hex: "8B5CF6")
        case .active:
            return Color(hex: "3B82F6")
        case .optimizing:
            return Color(hex: "10B981")
        case .celebrating:
            return Color(hex: "F59E0B")
        }
    }
}

// MARK: - Preview

#if DEBUG
struct OptaRingView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 32) {
            // Full size ring
            OptaRingView(
                coordinator: RenderCoordinator(),
                phase: .active,
                intensity: 0.7,
                explodeProgress: 0
            )

            // Compact ring variants
            HStack(spacing: 16) {
                CompactOptaRingView(
                    coordinator: RenderCoordinator(),
                    phase: .idle,
                    intensity: 0.3
                )

                CompactOptaRingView(
                    coordinator: RenderCoordinator(),
                    phase: .active,
                    intensity: 0.8
                )

                CompactOptaRingView(
                    coordinator: RenderCoordinator(),
                    phase: .optimizing,
                    intensity: 1.0
                )
            }
        }
        .padding(32)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
