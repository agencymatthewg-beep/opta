//
//  MenuBarCircularMenuButton.swift
//  OptaApp
//
//  Quick access button for activating the circular menu from the menu bar.
//

import SwiftUI

// MARK: - Menu Bar Circular Menu Button

/// A button in the menu bar popover that opens the circular menu
struct MenuBarCircularMenuButton: View {

    // MARK: - Properties

    /// Whether the circular menu is being shown
    @Binding var isCircularMenuPresented: Bool

    /// Callback to close the menu bar popover
    var onActivate: (() -> Void)?

    /// Hover state
    @State private var isHovered: Bool = false

    // MARK: - Body

    var body: some View {
        Button {
            activateCircularMenu()
        } label: {
            HStack(spacing: 10) {
                // Circular menu icon
                ZStack {
                    Circle()
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    Color(hex: "8B5CF6"),
                                    Color(hex: "3B82F6")
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                        .frame(width: 24, height: 24)

                    // Sector indicators
                    ForEach(0..<4, id: \.self) { index in
                        Circle()
                            .fill(sectorColor(index))
                            .frame(width: 4, height: 4)
                            .offset(sectorOffset(index))
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Quick Navigate")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white)

                    Text("Cmd+Opt+N")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                }

                Spacer()

                Image(systemName: "arrow.up.right.circle")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.4))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isHovered ? Color.white.opacity(0.1) : Color.white.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(
                        isHovered
                            ? LinearGradient(
                                colors: [Color(hex: "8B5CF6").opacity(0.5), Color(hex: "3B82F6").opacity(0.5)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            : LinearGradient(
                                colors: [Color.white.opacity(0.1), Color.white.opacity(0.05)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }

    // MARK: - Helpers

    private func sectorColor(_ index: Int) -> Color {
        switch index {
        case 0: return Color(hex: "3B82F6")  // Blue - Dashboard
        case 1: return Color(hex: "10B981")  // Green - Games
        case 2: return Color(hex: "F59E0B")  // Amber - Profiles
        case 3: return Color(hex: "8B5CF6")  // Purple - Settings
        default: return .white.opacity(0.5)
        }
    }

    private func sectorOffset(_ index: Int) -> CGSize {
        let radius: CGFloat = 7
        let angle = Double(index) * (Double.pi / 2) - (Double.pi / 4)
        return CGSize(
            width: radius * cos(angle),
            height: radius * sin(angle)
        )
    }

    private func activateCircularMenu() {
        // Play haptic
        SensoryManager.shared.playHaptic(.generic)

        // Notify to close menu bar popover
        onActivate?()

        // Small delay to let popover close
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            // Activate circular menu
            isCircularMenuPresented = true

            // Also post notification for global handling
            NotificationCenter.default.post(name: .toggleCircularMenu, object: nil)
        }
    }
}

// MARK: - Menu Bar Quick Navigate Row

/// Row-style button for quick navigation menu
struct MenuBarQuickNavigateRow: View {

    /// Callback to trigger circular menu
    let onTrigger: () -> Void

    @State private var isHovered: Bool = false

    var body: some View {
        Button(action: onTrigger) {
            HStack(spacing: 12) {
                Image(systemName: "circle.grid.2x2.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(hex: "8B5CF6"), Color(hex: "3B82F6")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text("Quick Navigate")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)

                    Text("Open circular menu")
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.6))
                }

                Spacer()

                // Keyboard shortcut hint
                HStack(spacing: 2) {
                    Image(systemName: "command")
                        .font(.system(size: 9))
                    Image(systemName: "option")
                        .font(.system(size: 9))
                    Text("N")
                        .font(.system(size: 9, weight: .medium))
                }
                .foregroundColor(.white.opacity(0.4))
                .padding(.horizontal, 6)
                .padding(.vertical: 3)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.1))
                )
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isHovered ? Color(hex: "8B5CF6").opacity(0.15) : Color.white.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(
                        isHovered ? Color(hex: "8B5CF6").opacity(0.3) : Color.white.opacity(0.1),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Compact Menu Bar Trigger

/// Compact circular menu trigger for tight spaces
struct CompactCircularMenuTrigger: View {

    /// Action to trigger menu
    let action: () -> Void

    @State private var isHovered: Bool = false
    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: action) {
            ZStack {
                // Background ring
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(hex: "8B5CF6").opacity(isHovered ? 0.3 : 0.1),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 16
                        )
                    )
                    .frame(width: 32, height: 32)

                // Ring outline
                Circle()
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color(hex: "8B5CF6"),
                                Color(hex: "3B82F6")
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: isHovered ? 2 : 1.5
                    )
                    .frame(width: 24, height: 24)

                // Center dot
                Circle()
                    .fill(Color(hex: "8B5CF6"))
                    .frame(width: 4, height: 4)
            }
            .scaleEffect(isPressed ? 0.9 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
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
        .accessibilityLabel("Quick Navigate")
        .accessibilityHint("Open circular navigation menu")
    }
}

// MARK: - Menu Bar Integration Helper

/// Helper to integrate circular menu with menu bar
struct MenuBarCircularMenuIntegration {

    /// Trigger the circular menu from menu bar
    static func triggerFromMenuBar() {
        // Post notification
        NotificationCenter.default.post(name: .toggleCircularMenu, object: nil)

        // Also trigger via gesture recognizer
        DispatchQueue.main.async {
            let mouseLocation = NSEvent.mouseLocation
            CircularMenuGestureRecognizer.shared.triggerMenu(
                trigger: .keyboardShortcut,
                at: mouseLocation
            )
        }
    }

    /// Register global keyboard shortcut
    static func registerGlobalShortcut() {
        // The global shortcut is registered via NSEvent monitor in CircularMenuGestureRecognizer
        // This method ensures the recognizer is set up
        _ = CircularMenuGestureRecognizer.shared
    }
}

// MARK: - Preview

#if DEBUG
struct MenuBarCircularMenuButton_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            // Full button
            MenuBarCircularMenuButton(
                isCircularMenuPresented: .constant(false)
            )

            // Quick navigate row
            MenuBarQuickNavigateRow {
                print("Triggered")
            }

            // Compact trigger
            HStack {
                Text("Compact:")
                    .foregroundStyle(.white.opacity(0.6))
                CompactCircularMenuTrigger {
                    print("Compact triggered")
                }
            }
        }
        .padding()
        .frame(width: 280)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
