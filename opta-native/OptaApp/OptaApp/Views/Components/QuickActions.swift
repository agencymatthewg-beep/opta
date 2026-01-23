//
//  QuickActions.swift
//  OptaApp
//
//  Quick action button bar for common optimization tasks.
//  Features obsidian button styling with branch-energy violet hover/press feedback.
//

import SwiftUI

// MARK: - QuickActions

/// A horizontal bar of quick action buttons for common tasks.
///
/// Actions:
/// - Optimize Now: Triggers stealth mode
/// - Scan Games: Initiates game detection
/// - View Score: Navigates to score detail
///
/// # Usage
///
/// ```swift
/// QuickActions(coreManager: coreManager)
/// ```
struct QuickActions: View {

    // MARK: - Properties

    /// Core manager for dispatching events
    let coreManager: OptaCoreManager

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            QuickActionButton(
                title: "Optimize",
                icon: "bolt.fill",
                color: Color(hex: "8B5CF6"),
                isLoading: coreManager.viewModel.stealthModeActive
            ) {
                coreManager.executeStealthMode()
            }
            .organicAppear(index: 0, total: 3)

            QuickActionButton(
                title: "Scan Games",
                icon: "gamecontroller.fill",
                color: Color(hex: "7C3AED")
            ) {
                coreManager.dispatch(.scanGames)
            }
            .organicAppear(index: 1, total: 3)

            QuickActionButton(
                title: "Score",
                icon: "chart.bar.fill",
                color: Color(hex: "A855F7")
            ) {
                coreManager.navigate(to: .optimize)
            }
            .organicAppear(index: 2, total: 3)
        }
    }
}

// MARK: - QuickActionButton

/// An individual quick action button with obsidian styling and branch-energy hover effects.
struct QuickActionButton: View {

    // MARK: - Properties

    /// Button title
    let title: String

    /// SF Symbol icon name
    let icon: String

    /// Accent color (violet family)
    let color: Color

    /// Whether the action is in progress
    var isLoading: Bool = false

    /// Action to perform on tap
    let action: () -> Void

    /// Hover state
    @State private var isHovered: Bool = false

    /// Press state
    @State private var isPressed: Bool = false

    /// Loading pulse animation state
    @State private var loadingPulse: Bool = false

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Constants

    /// Branch energy violet color
    private let branchViolet = Color(hex: "8B5CF6")

    /// Deep obsidian base
    private let obsidianBase = Color(hex: "0A0A0F")

    // MARK: - Body

    var body: some View {
        Button(action: {
            guard !isLoading else { return }
            action()
        }) {
            VStack(spacing: 8) {
                // Icon
                ZStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: branchViolet))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(iconColor)
                    }
                }
                .frame(height: 24)

                // Title
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.9))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
            .background(buttonBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .shadow(
                color: isHovered && !reduceMotion ? branchViolet.opacity(0.15) : .clear,
                radius: 12,
                x: 0,
                y: 4
            )
        }
        .buttonStyle(PlainButtonStyle())
        .organicHover(isHovered: isHovered, id: "quickAction-\(title)")
        .onHover { hovering in
            guard !reduceMotion else {
                isHovered = hovering
                return
            }
            withAnimation(OrganicMotion.organicSpring(for: "quickAction-\(title)", intensity: .medium)) {
                isHovered = hovering
            }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        if reduceMotion {
                            isPressed = true
                        } else {
                            withAnimation(OrganicMotion.organicSpring(for: "quickAction-\(title)-press", intensity: .energetic)) {
                                isPressed = true
                            }
                        }
                    }
                }
                .onEnded { _ in
                    if reduceMotion {
                        isPressed = false
                    } else {
                        withAnimation(OrganicMotion.organicSpring(for: "quickAction-\(title)-press", intensity: .energetic)) {
                            isPressed = false
                        }
                    }
                }
        )
        .disabled(isLoading)
        .onChange(of: isLoading) { _, newValue in
            if newValue && !reduceMotion {
                startLoadingPulse()
            } else {
                loadingPulse = false
            }
        }
    }

    // MARK: - Subviews

    /// Obsidian button background with subtle inner shadow
    private var buttonBackground: some View {
        ZStack {
            // Deep obsidian base
            obsidianBase

            // Subtle hover glow (center radial approximation)
            if isHovered && !reduceMotion {
                RadialGradient(
                    colors: [
                        branchViolet.opacity(0.08),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 80
                )
            }
        }
        // Inner shadow for depth perception
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.black.opacity(0.4), lineWidth: 1)
                .blur(radius: 1)
                .offset(y: 1)
                .mask(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.black)
                )
        )
    }

    // MARK: - Computed Properties

    /// Icon color with violet blend on hover
    private var iconColor: Color {
        if isHovered && !reduceMotion {
            // Blend toward violet on hover
            return color.opacity(0.7)
        }
        return color
    }

    /// Border color based on state
    private var borderColor: Color {
        if isLoading && !reduceMotion {
            // Pulsing violet border during loading
            return branchViolet.opacity(loadingPulse ? 0.5 : 0.2)
        }
        if isPressed {
            return branchViolet.opacity(0.6)
        }
        if isHovered && !reduceMotion {
            return branchViolet.opacity(0.4)
        }
        return Color.white.opacity(0.1)
    }

    // MARK: - Methods

    /// Start the loading pulse animation with organic timing
    private func startLoadingPulse() {
        let duration = OrganicMotion.ambientDuration(for: "quickAction-\(title)-loading")
        withAnimation(
            .easeInOut(duration: min(duration, 2.0))
            .repeatForever(autoreverses: true)
        ) {
            loadingPulse = true
        }
    }
}

// MARK: - Preview

#if DEBUG
struct QuickActions_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 24) {
            // Preview buttons individually since we can't create real OptaCoreManager
            HStack(spacing: 12) {
                QuickActionButton(
                    title: "Optimize",
                    icon: "bolt.fill",
                    color: Color(hex: "8B5CF6")
                ) {}

                QuickActionButton(
                    title: "Scan Games",
                    icon: "gamecontroller.fill",
                    color: Color(hex: "7C3AED")
                ) {}

                QuickActionButton(
                    title: "Score",
                    icon: "chart.bar.fill",
                    color: Color(hex: "A855F7")
                ) {}
            }

            // Loading state
            HStack(spacing: 12) {
                QuickActionButton(
                    title: "Optimizing...",
                    icon: "bolt.fill",
                    color: Color(hex: "8B5CF6"),
                    isLoading: true
                ) {}
            }
        }
        .padding()
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
