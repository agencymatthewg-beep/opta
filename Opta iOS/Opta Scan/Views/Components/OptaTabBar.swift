//
//  OptaTabBar.swift
//  Opta Scan
//
//  Custom tab bar with glass styling following IOS_AESTHETIC_GUIDE.md
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Tab Enum

enum OptaTab: String, CaseIterable {
    case capture = "camera.fill"
    case history = "clock"
    case settings = "gearshape"

    var title: String {
        switch self {
        case .capture: return "Capture"
        case .history: return "History"
        case .settings: return "Settings"
        }
    }
}

// MARK: - OptaTabBar

struct OptaTabBar: View {
    @Binding var selectedTab: OptaTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(OptaTab.allCases, id: \.self) { tab in
                TabBarButton(
                    tab: tab,
                    isSelected: selectedTab == tab
                ) {
                    withAnimation(.optaSpring) {
                        if selectedTab != tab {
                            OptaHaptics.shared.selectionChanged()
                            selectedTab = tab
                        }
                    }
                }
            }
        }
        .padding(.horizontal, OptaDesign.Spacing.lg)
        .padding(.top, OptaDesign.Spacing.sm)
        .padding(.bottom, OptaDesign.Spacing.xs)
        .glassSubtle()
        .padding(.horizontal, OptaDesign.Spacing.md)
        .padding(.bottom, OptaDesign.Spacing.xs)
    }
}

// MARK: - Tab Bar Button

private struct TabBarButton: View {
    let tab: OptaTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: tab.rawValue)
                    .font(.system(size: 22, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextMuted)
                    .symbolEffect(.bounce, value: isSelected)

                // Active indicator dot
                Circle()
                    .fill(Color.optaPurple)
                    .frame(width: 4, height: 4)
                    .opacity(isSelected ? 1 : 0)
                    .scaleEffect(isSelected ? 1 : 0.5)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
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
