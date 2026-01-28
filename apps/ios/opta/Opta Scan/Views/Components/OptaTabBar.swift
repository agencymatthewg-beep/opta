//
//  OptaTabBar.swift
//  Opta Scan
//
//  Custom tab bar with glass styling following IOS_AESTHETIC_GUIDE.md
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Tab Enum

/// Available tabs in the main navigation
enum OptaTab: String, CaseIterable {
    case capture = "camera.fill"
    case history = "clock"
    case settings = "gearshape"

    /// Human-readable title for the tab
    var title: String {
        switch self {
        case .capture: return "Capture"
        case .history: return "History"
        case .settings: return "Settings"
        }
    }

    /// SF Symbol name for the tab icon
    var iconName: String { rawValue }
}

// MARK: - OptaTabBar

/// Custom glass-styled tab bar for main navigation
struct OptaTabBar: View {

    // MARK: - Properties

    @Binding var selectedTab: OptaTab

    // MARK: - Body

    var body: some View {
        HStack(spacing: 0) {
            ForEach(OptaTab.allCases, id: \.self) { tab in
                TabBarButton(
                    tab: tab,
                    isSelected: selectedTab == tab,
                    action: { selectTab(tab) }
                )
            }
        }
        .padding(.horizontal, OptaDesign.Spacing.lg)
        .padding(.top, OptaDesign.Spacing.sm)
        .padding(.bottom, OptaDesign.Spacing.xs)
        .glassSubtle()
        .padding(.horizontal, OptaDesign.Spacing.md)
        .padding(.bottom, OptaDesign.Spacing.xs)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tab bar")
    }

    // MARK: - Private Methods

    private func selectTab(_ tab: OptaTab) {
        guard selectedTab != tab else { return }
        withAnimation(.optaSpring) {
            OptaHaptics.shared.selectionChanged()
            selectedTab = tab
        }
    }
}

// MARK: - Tab Bar Button

/// Individual button in the tab bar with selection indicator
private struct TabBarButton: View {

    // MARK: - Properties

    let tab: OptaTab
    let isSelected: Bool
    let action: () -> Void

    // MARK: - Constants

    private enum Layout {
        static let iconSize: CGFloat = 22
        static let indicatorSize: CGFloat = 4
        static let spacing: CGFloat = 4
        static let inactiveIndicatorScale: CGFloat = 0.5
    }

    // MARK: - Body

    var body: some View {
        Button(action: action) {
            VStack(spacing: Layout.spacing) {
                // Tab Icon
                Image(systemName: tab.iconName)
                    .font(.system(size: Layout.iconSize, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextMuted)
                    .symbolEffect(.bounce, value: isSelected)

                // Active Indicator Dot
                Circle()
                    .fill(Color.optaPurple)
                    .frame(width: Layout.indicatorSize, height: Layout.indicatorSize)
                    .opacity(isSelected ? 1 : 0)
                    .scaleEffect(isSelected ? 1 : Layout.inactiveIndicatorScale)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityHint(isSelected ? "Currently selected" : "Double tap to switch to \(tab.title)")
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()

        VStack {
            Spacer()
            OptaTabBar(selectedTab: .constant(.capture))
        }
    }
}
