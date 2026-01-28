import SwiftUI
import AppKit

// MARK: - Base Glass Background

/// NSViewRepresentable wrapper for NSVisualEffectView providing stronger vibrancy
/// than SwiftUI's built-in materials. Uses .hudWindow material for the strongest
/// glass effect matching Opta's aesthetic.
struct GlassBackground: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .hudWindow
    var blendingMode: NSVisualEffectView.BlendingMode = .behindWindow
    var cornerRadius: CGFloat = 12
    var isActive: Bool = true

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = isActive ? .active : .inactive
        view.wantsLayer = true
        view.layer?.cornerRadius = cornerRadius
        view.layer?.masksToBounds = true
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
        nsView.state = isActive ? .active : .inactive
        nsView.layer?.cornerRadius = cornerRadius
    }
}

// MARK: - Glass Card

/// A card-style glass container with rounded corners and subtle shadow.
/// Ideal for content cards and panels.
struct GlassCard<Content: View>: View {
    let cornerRadius: CGFloat
    let content: () -> Content

    init(
        cornerRadius: CGFloat = 16,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.content = content
    }

    var body: some View {
        ZStack {
            GlassBackground(
                material: .hudWindow,
                blendingMode: .behindWindow,
                cornerRadius: cornerRadius
            )

            content()
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.3), radius: 10, x: 0, y: 4)
    }
}

// MARK: - Glass Panel

/// A full-width glass panel without rounding.
/// Ideal for headers, footers, and navigation areas.
struct GlassPanel<Content: View>: View {
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        ZStack {
            GlassBackground(
                material: .hudWindow,
                blendingMode: .behindWindow,
                cornerRadius: 0
            )

            content()
        }
        .overlay(
            Rectangle()
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

// MARK: - Glass Button

/// An interactive glass-styled button with hover and press states.
/// Animates from dormant (0%) to active (50%) glow on interaction.
struct GlassButton: View {
    let title: String
    let icon: String?
    let action: () -> Void

    @State private var isHovered = false
    @State private var isPressed = false

    init(
        title: String,
        icon: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                }
                Text(title)
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(isHovered ? Color.optaPrimary : Color.optaForeground)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background {
                ZStack {
                    GlassBackground(
                        material: isPressed ? .popover : .hudWindow,
                        blendingMode: .behindWindow,
                        cornerRadius: 10
                    )

                    // Inner glow on hover
                    if isHovered {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.optaPrimary.opacity(0.1))
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        isHovered ? Color.optaPrimary.opacity(0.4) : Color.white.opacity(0.08),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: isHovered ? Color.optaPrimary.opacity(0.3) : Color.clear,
                radius: isHovered ? 15 : 0
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.15), value: isHovered)
            .animation(.easeOut(duration: 0.1), value: isPressed)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Glass Primary Button

/// A primary action button with the characteristic Opta glow effect.
/// Use for main CTAs and important actions.
struct GlassPrimaryButton: View {
    let title: String
    let icon: String?
    let action: () -> Void

    @State private var isHovered = false
    @State private var isPressed = false

    init(
        title: String,
        icon: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                }
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background {
                LinearGradient(
                    colors: [Color.optaPrimary, Color.optaAccent],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .shadow(
                color: Color.optaPrimary.opacity(isHovered ? 0.6 : 0.4),
                radius: isHovered ? 25 : 15,
                x: 0,
                y: isHovered ? 8 : 4
            )
            .scaleEffect(isPressed ? 0.98 : (isHovered ? 1.02 : 1.0))
            .animation(.easeOut(duration: 0.2), value: isHovered)
            .animation(.easeOut(duration: 0.1), value: isPressed)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Preview Provider

#Preview("Glass Components") {
    ZStack {
        // Dark background to showcase glass effects
        Color.optaBackground
            .ignoresSafeArea()

        VStack(spacing: 24) {
            // Glass Card Example
            GlassCard {
                VStack(spacing: 12) {
                    Text("Glass Card")
                        .font(.headline)
                        .foregroundStyle(Color.optaForeground)
                    Text("With native macOS vibrancy")
                        .font(.subheadline)
                        .foregroundStyle(Color.optaMutedForeground)
                }
                .padding(20)
            }
            .frame(width: 280)

            // Glass Panel Example
            GlassPanel {
                HStack {
                    Text("Glass Panel")
                        .font(.headline)
                        .foregroundStyle(Color.optaForeground)
                    Spacer()
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(Color.optaPrimary)
                }
                .padding(16)
            }
            .frame(width: 280)

            // Button Examples
            HStack(spacing: 16) {
                GlassButton(title: "Secondary", icon: "gear") {
                    print("Secondary tapped")
                }

                GlassPrimaryButton(title: "Primary", icon: "bolt.fill") {
                    print("Primary tapped")
                }
            }
        }
        .padding(40)
    }
    .frame(width: 400, height: 500)
}
