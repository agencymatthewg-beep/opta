//
//  GamificationDashboard.swift
//  OptaApp
//
//  Main gamification page with XP progress, streaks, daily challenges,
//  badge collection summary, and achievement progress list.
//

import SwiftUI

// MARK: - Gamification Dashboard

struct GamificationDashboard: View {

    @Bindable var coreManager: OptaCoreManager
    @Environment(\.colorTemperature) private var colorTemp

    private var manager: GamificationManager { GamificationManager.shared }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 24) {
                // Header
                headerSection

                // XP & Level
                xpSection

                // Streak
                streakSection

                // Daily Challenges
                challengesSection

                // Badge Summary
                badgeSummarySection

                // Achievement Progress
                achievementSection
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .onAppear {
            manager.recordDailyActivity()
            manager.recordPageVisit(.gamification)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Button {
                coreManager.navigate(to: .dashboard)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .medium))
                    Text("Back")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)

            Spacer()

            Text("Achievements")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(.white)

            Spacer()

            // Placeholder for symmetry
            Color.clear.frame(width: 60, height: 1)
        }
    }

    // MARK: - XP Section

    private var xpSection: some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                // Level badge
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "8B5CF6"), Color(hex: "7C3AED")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 56, height: 56)

                    Text("\(manager.xp.level)")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Level \(manager.xp.level)")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)

                    // XP Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.white.opacity(0.1))

                            RoundedRectangle(cornerRadius: 4)
                                .fill(
                                    LinearGradient(
                                        colors: [Color(hex: "8B5CF6"), Color(hex: "A855F7")],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geo.size.width * manager.xp.levelProgress)
                        }
                    }
                    .frame(height: 8)

                    Text("\(manager.xp.currentLevelXP) / 100 XP")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.5))
                }
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: "0A0A0F"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(hex: "8B5CF6").opacity(0.2), lineWidth: 1)
                    )
            )

            // Total XP
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(Color(hex: "8B5CF6"))
                Text("Total XP: \(manager.xp.totalXP)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
    }

    // MARK: - Streak Section

    private var streakSection: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Color(hex: "F59E0B"))
                    .font(.system(size: 20))

                Text("\(manager.streak.currentStreak) Day Streak")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)

                Spacer()

                if manager.streak.isActiveToday {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color(hex: "22C55E"))
                            .font(.system(size: 14))
                        Text("Active Today")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: "22C55E"))
                    }
                }
            }

            // Streak dots (last 7 days)
            HStack(spacing: 8) {
                ForEach(0..<7, id: \.self) { day in
                    let isActive = day < manager.streak.currentStreak
                    Circle()
                        .fill(isActive ? Color(hex: "F59E0B") : Color.white.opacity(0.15))
                        .frame(width: 12, height: 12)
                }

                Spacer()

                Text("Best: \(manager.streak.longestStreak) days")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(hex: "0A0A0F"))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    // MARK: - Challenges Section

    private var challengesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's Challenges")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            ForEach(manager.dailyChallenges) { challenge in
                challengeCard(challenge)
            }
        }
    }

    private func challengeCard(_ challenge: DailyChallenge) -> some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(challenge.isComplete ? Color(hex: "22C55E").opacity(0.2) : Color(hex: "8B5CF6").opacity(0.15))
                    .frame(width: 36, height: 36)

                Image(systemName: challenge.isComplete ? "checkmark" : challenge.icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(challenge.isComplete ? Color(hex: "22C55E") : Color(hex: "8B5CF6"))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(challenge.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(challenge.isComplete ? .white.opacity(0.5) : .white)
                    .strikethrough(challenge.isComplete)

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.1))

                        RoundedRectangle(cornerRadius: 3)
                            .fill(challenge.isComplete ? Color(hex: "22C55E") : Color(hex: "8B5CF6"))
                            .frame(width: geo.size.width * challenge.progressFraction)
                    }
                }
                .frame(height: 6)
            }

            Spacer()

            // XP Reward
            Text("+\(challenge.xpReward) XP")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(challenge.isComplete ? Color(hex: "22C55E") : Color(hex: "8B5CF6"))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(challenge.isComplete ? Color(hex: "22C55E").opacity(0.1) : Color(hex: "8B5CF6").opacity(0.1))
                )
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "0A0A0F"))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    // MARK: - Badge Summary

    private var badgeSummarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("\(manager.unlockedBadgeCount)/\(manager.totalBadgeCount) Badges Unlocked")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)

                Spacer()
            }

            // Recent badges row
            if !manager.recentBadges.isEmpty {
                HStack(spacing: 12) {
                    ForEach(manager.recentBadges) { badge in
                        badgeMiniView(badge)
                    }
                    Spacer()
                }
            } else {
                Text("Complete challenges to unlock badges!")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.5))
            }

            // Full badge collection
            BadgeCollectionView()
                .padding(.top, 8)
        }
    }

    private func badgeMiniView(_ badge: Badge) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(Color(hex: badge.tier.color), lineWidth: 2)
                    .frame(width: 44, height: 44)

                Image(systemName: badge.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(Color(hex: badge.tier.color))
            }

            Text(badge.name)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
        .frame(width: 64)
    }

    // MARK: - Achievement Progress

    private var achievementSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Next Achievements")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            if manager.nextAchievements.isEmpty {
                Text("All achievements unlocked!")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.5))
            } else {
                ForEach(manager.nextAchievements) { achievement in
                    achievementRow(achievement)
                }
            }
        }
    }

    private func achievementRow(_ achievement: Achievement) -> some View {
        HStack(spacing: 12) {
            Image(systemName: achievement.icon)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "8B5CF6"))
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(achievement.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)

                Text(achievement.description)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.1))

                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: "8B5CF6"))
                            .frame(width: geo.size.width * achievement.progressFraction)
                    }
                }
                .frame(height: 6)
            }

            Spacer()

            Text("\(achievement.progress)/\(achievement.target)")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "0A0A0F"))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }
}
