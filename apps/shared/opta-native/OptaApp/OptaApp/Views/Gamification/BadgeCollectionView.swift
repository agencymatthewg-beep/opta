//
//  BadgeCollectionView.swift
//  OptaApp
//
//  Grid view of all badges with filter tabs, tier-colored rings,
//  locked/unlocked states, and detail popovers.
//

import SwiftUI

// MARK: - Badge Filter

enum BadgeFilter: String, CaseIterable {
    case all = "All"
    case unlocked = "Unlocked"
    case optimization = "Optimization"
    case streak = "Streak"
    case score = "Score"
    case exploration = "Exploration"
}

// MARK: - Badge Collection View

struct BadgeCollectionView: View {

    @State private var selectedFilter: BadgeFilter = .all
    @State private var selectedBadge: Badge?

    private var manager: GamificationManager { GamificationManager.shared }

    private var filteredBadges: [Badge] {
        switch selectedFilter {
        case .all:
            return manager.badges
        case .unlocked:
            return manager.badges.filter { $0.isUnlocked }
        case .optimization:
            return manager.badges.filter { $0.category == .optimization }
        case .streak:
            return manager.badges.filter { $0.category == .streak }
        case .score:
            return manager.badges.filter { $0.category == .score }
        case .exploration:
            return manager.badges.filter { $0.category == .exploration }
        }
    }

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Filter tabs
            filterTabsView

            // Badge grid
            if filteredBadges.isEmpty {
                emptyStateView
            } else {
                badgeGridView
            }
        }
    }

    // MARK: - Filter Tabs

    private var filterTabsView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(BadgeFilter.allCases, id: \.self) { filter in
                    filterTab(filter)
                }
            }
        }
    }

    private func filterTab(_ filter: BadgeFilter) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedFilter = filter
            }
        } label: {
            Text(filter.rawValue)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(selectedFilter == filter ? .white : .white.opacity(0.5))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(selectedFilter == filter ? Color(hex: "8B5CF6").opacity(0.3) : Color.white.opacity(0.06))
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Badge Grid

    private var badgeGridView: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            ForEach(filteredBadges) { badge in
                badgeCell(badge)
            }
        }
    }

    private func badgeCell(_ badge: Badge) -> some View {
        Button {
            if badge.isUnlocked {
                selectedBadge = badge
            }
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    // Tier-colored ring
                    Circle()
                        .stroke(
                            Color(hex: badge.tier.color).opacity(badge.isUnlocked ? 1.0 : 0.2),
                            lineWidth: 2.5
                        )
                        .frame(width: 52, height: 52)

                    // Glow for unlocked
                    if badge.isUnlocked {
                        Circle()
                            .fill(Color(hex: badge.tier.color).opacity(0.08))
                            .frame(width: 52, height: 52)
                    }

                    // Icon or lock
                    if badge.isUnlocked {
                        Image(systemName: badge.icon)
                            .font(.system(size: 20))
                            .foregroundStyle(Color(hex: badge.tier.color))
                    } else {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.white.opacity(0.3))
                    }
                }

                Text(badge.name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(badge.isUnlocked ? .white : .white.opacity(0.4))
                    .lineLimit(1)

                Text(badge.tier.rawValue)
                    .font(.system(size: 10))
                    .foregroundStyle(Color(hex: badge.tier.color).opacity(badge.isUnlocked ? 0.8 : 0.3))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .opacity(badge.isUnlocked ? 1.0 : 0.5)
        }
        .buttonStyle(.plain)
        .popover(isPresented: Binding(
            get: { selectedBadge?.id == badge.id },
            set: { if !$0 { selectedBadge = nil } }
        )) {
            badgeDetailPopover(badge)
        }
    }

    // MARK: - Badge Detail Popover

    private func badgeDetailPopover(_ badge: Badge) -> some View {
        VStack(spacing: 12) {
            Image(systemName: badge.icon)
                .font(.system(size: 32))
                .foregroundStyle(Color(hex: badge.tier.color))

            Text(badge.name)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            Text(badge.description)
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)

            Divider()
                .overlay(Color.white.opacity(0.1))

            HStack(spacing: 16) {
                Label(badge.tier.rawValue, systemImage: "shield.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: badge.tier.color))

                Label("+\(badge.tier.xpReward) XP", systemImage: "sparkles")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "8B5CF6"))
            }

            if let date = badge.unlockedDate {
                Text("Unlocked \(date.formatted(.dateTime.month().day().year()))")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(20)
        .frame(width: 220)
        .background(Color(hex: "0A0A0F"))
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 8) {
            Image(systemName: "trophy")
                .font(.system(size: 24))
                .foregroundStyle(.white.opacity(0.3))

            Text("No badges in this category yet")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}
