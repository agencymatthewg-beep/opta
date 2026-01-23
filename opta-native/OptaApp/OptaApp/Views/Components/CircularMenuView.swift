//
//  CircularMenuView.swift
//  OptaApp
//
//  Pure SwiftUI circular navigation menu.
//  Provides gesture handling, animation, and sector selection.
//
//  Obsidian aesthetic with temperature-driven violet accents.
//

import SwiftUI
import Foundation

// MARK: - Sector Model

/// Represents a sector in the circular menu
struct CircularMenuSector: Identifiable, Equatable {
    let id: Int
    let icon: String
    let label: String
    let color: Color

    /// Default sectors for Opta navigation — accessibility-safe system purple
    static let defaultSectors: [CircularMenuSector] = [
        CircularMenuSector(id: 0, icon: "house.fill", label: "Dashboard", color: .purple),
        CircularMenuSector(id: 1, icon: "gamecontroller.fill", label: "Games", color: .purple),
        CircularMenuSector(id: 2, icon: "chart.bar.fill", label: "Profiles", color: .purple),
        CircularMenuSector(id: 3, icon: "gearshape.fill", label: "Settings", color: .purple)
    ]
}

// MARK: - CircularMenuView

/// SwiftUI circular navigation menu with obsidian aesthetic.
///
/// Features:
/// - Animated sector reveal with spring physics
/// - Mouse hover for sector highlighting
/// - Keyboard navigation (arrow keys, Return, Escape)
/// - Haptic and audio feedback integration
/// - Temperature-driven violet accents
///
/// # Usage
///
/// ```swift
/// CircularMenuView(
///     isPresented: $showMenu,
///     sectors: CircularMenuSector.defaultSectors,
///     onSelect: { sector in
///         navigate(to: sector)
///     }
/// )
/// ```
struct CircularMenuView: View {

    // MARK: - Properties

    /// Binding to control menu visibility
    @Binding var isPresented: Bool

    /// Sectors to display in the menu
    let sectors: [CircularMenuSector]

    /// Callback when a sector is selected
    var onSelect: ((CircularMenuSector) -> Void)?

    /// Callback when menu is dismissed without selection
    var onDismiss: (() -> Void)?

    /// Optional center position (defaults to view center)
    var centerPosition: CGPoint?

    /// Outer radius of the menu
    var radius: CGFloat = 150

    /// Inner radius of the menu
    var innerRadius: CGFloat = 50

    // MARK: - State

    /// Currently highlighted sector index
    @State private var highlightedSector: Int = -1

    /// Open progress for animation (0.0 - 1.0)
    @State private var openProgress: CGFloat = 0

    /// Keyboard navigation index
    @State private var keyboardIndex: Int = 0

    // MARK: - Environment

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorTemperature) private var colorTemp

    // MARK: - Constants

    private let obsidianBase = Color(hex: "0A0A0F")

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background dimming
                if isPresented {
                    Color.black
                        .opacity(0.4 * openProgress)
                        .ignoresSafeArea()
                        .onTapGesture {
                            dismiss()
                        }
                }

                // Menu content
                if openProgress > 0.01 {
                    circularMenuContent(in: geometry)
                        .position(menuCenter(in: geometry))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .focusable(isPresented)
        .onKeyPress(.escape) {
            guard isPresented else { return .ignored }
            dismiss()
            return .handled
        }
        .onKeyPress(.leftArrow) {
            guard isPresented else { return .ignored }
            navigateKeyboard(direction: -1)
            return .handled
        }
        .onKeyPress(.rightArrow) {
            guard isPresented else { return .ignored }
            navigateKeyboard(direction: 1)
            return .handled
        }
        .onKeyPress(.return) {
            guard isPresented else { return .ignored }
            selectCurrentSector()
            return .handled
        }
        .onChange(of: isPresented) { _, newValue in
            if newValue {
                openMenu()
            } else {
                closeMenu()
            }
        }
    }

    // MARK: - Menu Content

    private func circularMenuContent(in geometry: GeometryProxy) -> some View {
        ZStack {
            // Render sectors
            ForEach(sectors) { sector in
                sectorView(sector)
            }

            // Center indicator
            centerIndicator
        }
        .frame(width: radius * 2, height: radius * 2)
        .scaleEffect(openProgress)
        .opacity(openProgress)
    }

    // MARK: - Sector View

    private func sectorView(_ sector: CircularMenuSector) -> some View {
        let angle = sectorAngle(for: sector.id)
        let isHighlighted = highlightedSector == sector.id
        let sectorCenter = sectorCenterPosition(for: sector.id)

        return VStack(spacing: 6) {
            // Icon
            Image(systemName: sector.icon)
                .font(.system(size: isHighlighted ? 22 : 18, weight: .medium))
                .foregroundStyle(isHighlighted ? colorTemp.violetColor : .white.opacity(0.8))
                .shadow(
                    color: isHighlighted ? colorTemp.violetColor.opacity(0.5) : .clear,
                    radius: isHighlighted ? 8 : 0
                )

            // Label
            Text(sector.label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(isHighlighted ? .white : .white.opacity(0.6))
        }
        .padding(12)
        .background(
            Circle()
                .fill(isHighlighted ? obsidianBase.opacity(0.9) : obsidianBase.opacity(0.7))
        )
        .overlay(
            Circle()
                .stroke(
                    isHighlighted ? colorTemp.violetColor.opacity(0.6) : Color.white.opacity(0.1),
                    lineWidth: isHighlighted ? 1.5 : 0.5
                )
        )
        .scaleEffect(isHighlighted ? 1.1 : 1.0)
        .offset(x: sectorCenter.x, y: sectorCenter.y)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                highlightedSector = hovering ? sector.id : -1
            }
        }
        .onTapGesture {
            selectSector(sector)
        }
        .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isHighlighted)
    }

    // MARK: - Center Indicator

    private var centerIndicator: some View {
        Circle()
            .fill(obsidianBase)
            .frame(width: innerRadius * 1.2, height: innerRadius * 1.2)
            .overlay(
                Circle()
                    .stroke(colorTemp.violetColor.opacity(0.3), lineWidth: 1)
            )
            .overlay(
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            )
            .onTapGesture {
                dismiss()
            }
    }

    // MARK: - Geometry

    private func menuCenter(in geometry: GeometryProxy) -> CGPoint {
        centerPosition ?? CGPoint(
            x: geometry.size.width / 2,
            y: geometry.size.height / 2
        )
    }

    private func sectorAngle(for index: Int) -> Double {
        let sectorSize = (2 * .pi) / Double(sectors.count)
        return sectorSize * Double(index) - .pi / 2 // Start from top
    }

    private func sectorCenterPosition(for index: Int) -> CGPoint {
        let angle: Double = sectorAngle(for: index)
        let distance: CGFloat = (radius + innerRadius) / 2
        let x: CGFloat = CGFloat(Darwin.cos(angle)) * distance
        let y: CGFloat = CGFloat(Darwin.sin(angle)) * distance
        return CGPoint(x: x, y: y)
    }

    // MARK: - Navigation

    private func navigateKeyboard(direction: Int) {
        keyboardIndex = (keyboardIndex + direction + sectors.count) % sectors.count
        withAnimation(.easeOut(duration: 0.15)) {
            highlightedSector = keyboardIndex
        }
        SensoryManager.shared.playInteraction(.navigation)
    }

    private func selectCurrentSector() {
        if highlightedSector >= 0 && highlightedSector < sectors.count {
            selectSector(sectors[highlightedSector])
        }
    }

    // MARK: - Selection

    private func selectSector(_ sector: CircularMenuSector) {
        SensoryManager.shared.playInteraction(.sectorSelect)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: 0.2)) {
                isPresented = false
            }
            onSelect?(sector)
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.2)) {
            isPresented = false
        }
        onDismiss?()
    }

    // MARK: - Menu State

    private func openMenu() {
        keyboardIndex = 0
        highlightedSector = -1

        let animation: Animation = reduceMotion
            ? .easeOut(duration: 0.15)
            : .spring(response: 0.35, dampingFraction: 0.7)

        withAnimation(animation) {
            openProgress = 1.0
        }

        if !reduceMotion {
            SensoryManager.shared.playInteraction(.menuOpen)
        }
    }

    private func closeMenu() {
        highlightedSector = -1

        let animation: Animation = reduceMotion
            ? .easeOut(duration: 0.1)
            : .easeOut(duration: 0.2)

        withAnimation(animation) {
            openProgress = 0
        }

        if !reduceMotion {
            SensoryManager.shared.playInteraction(.menuClose)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CircularMenuView_Previews: PreviewProvider {
    static var previews: some View {
        CircularMenuPreviewWrapper()
            .frame(width: 500, height: 500)
            .preferredColorScheme(.dark)
    }
}

struct CircularMenuPreviewWrapper: View {
    @State private var isPresented = true

    var body: some View {
        ZStack {
            Color(hex: "09090B").ignoresSafeArea()

            CircularMenuView(
                isPresented: $isPresented,
                sectors: CircularMenuSector.defaultSectors,
                onSelect: { sector in
                    print("Selected: \(sector.label)")
                }
            )
        }
    }
}
#endif
