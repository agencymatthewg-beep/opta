//
//  QuickActions.swift
//  OptaApp
//
//  Quick action button bar for common optimization tasks.
//  Features glass button styling with hover/press feedback.
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

            QuickActionButton(
                title: "Scan Games",
                icon: "gamecontroller.fill",
                color: .cyan
            ) {
                coreManager.dispatch(.scanGames)
            }

            QuickActionButton(
                title: "Score",
                icon: "chart.bar.fill",
                color: .green
            ) {
                coreManager.navigate(to: .optimize)
            }
        }
    }
}

// MARK: - QuickActionButton

/// An individual quick action button with glass styling.
struct QuickActionButton: View {

    // MARK: - Properties

    /// Button title
    let title: String

    /// SF Symbol icon name
    let icon: String

    /// Accent color
    let color: Color

    /// Whether the action is in progress
    var isLoading: Bool = false

    /// Action to perform on tap
    let action: () -> Void

    /// Hover state
    @State private var isHovered: Bool = false

    /// Press state
    @State private var isPressed: Bool = false

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
                            .progressViewStyle(CircularProgressViewStyle(tint: color))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(color)
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
                    .stroke(
                        isHovered ? color.opacity(0.3) : Color.white.opacity(0.1),
                        lineWidth: 1
                    )
            )
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .shadow(color: isHovered ? color.opacity(0.2) : .clear, radius: 8, x: 0, y: 4)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        withAnimation(.easeOut(duration: 0.1)) {
                            isPressed = true
                        }
                    }
                }
                .onEnded { _ in
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        isPressed = false
                    }
                }
        )
        .disabled(isLoading)
    }

    // MARK: - Subviews

    private var buttonBackground: some View {
        ZStack {
            // Base dark color
            Color(hex: "09090B")

            // Glass effect
            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(0.5)

            // Hover highlight
            if isHovered {
                Rectangle()
                    .fill(color.opacity(0.05))
            }
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
                    color: .cyan
                ) {}

                QuickActionButton(
                    title: "Score",
                    icon: "chart.bar.fill",
                    color: .green
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
