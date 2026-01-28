//
//  AchievementUnlockOverlay.swift
//  OptaApp
//
//  Celebratory overlay animation displayed when a badge is unlocked.
//  Full-screen backdrop with centered card, scale animation, and
//  radial particle-like effects.
//

import SwiftUI

// MARK: - Achievement Unlock Overlay

struct AchievementUnlockOverlay: View {

    private var manager: GamificationManager { GamificationManager.shared }

    @State private var showCard: Bool = false
    @State private var particleScale: CGFloat = 0.3
    @State private var particleOpacity: Double = 1.0
    @State private var iconRotation: Double = -15
    @State private var xpCountUp: Int = 0
    @State private var dismissTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            if let badge = manager.recentUnlock {
                // Particle burst
                particleBurst(for: badge)

                // Main card
                unlockCard(badge)
                    .scaleEffect(showCard ? 1.0 : 0.5)
                    .opacity(showCard ? 1.0 : 0.0)
                    .rotationEffect(.degrees(showCard ? 0 : -5))
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                showCard = true
            }
            withAnimation(.easeOut(duration: 1.2)) {
                particleScale = 2.5
            }
            withAnimation(.easeOut(duration: 1.5)) {
                particleOpacity = 0.0
            }
            withAnimation(.spring(response: 0.6, dampingFraction: 0.5).delay(0.2)) {
                iconRotation = 0
            }

            // Count up XP
            if let badge = manager.recentUnlock {
                animateXPCount(target: badge.tier.xpReward)
            }

            // Auto-dismiss after 4 seconds
            dismissTask = Task {
                try? await Task.sleep(for: .seconds(4))
                if !Task.isCancelled {
                    await MainActor.run {
                        dismiss()
                    }
                }
            }
        }
        .onDisappear {
            dismissTask?.cancel()
        }
    }

    // MARK: - Unlock Card

    private func unlockCard(_ badge: Badge) -> some View {
        VStack(spacing: 20) {
            // Title
            Text("Badge Unlocked!")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: "FFD700"))
                .textCase(.uppercase)
                .tracking(2)

            // Badge icon
            ZStack {
                Circle()
                    .stroke(Color(hex: badge.tier.color), lineWidth: 3)
                    .frame(width: 80, height: 80)
                    .shadow(color: Color(hex: badge.tier.color).opacity(0.5), radius: 12)

                Circle()
                    .fill(Color(hex: badge.tier.color).opacity(0.1))
                    .frame(width: 80, height: 80)

                Image(systemName: badge.icon)
                    .font(.system(size: 36))
                    .foregroundStyle(Color(hex: badge.tier.color))
                    .rotationEffect(.degrees(iconRotation))
            }

            // Badge name
            Text(badge.name)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)

            // Description
            Text(badge.description)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)

            // XP Reward
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .foregroundStyle(Color(hex: "8B5CF6"))
                Text("+\(xpCountUp) XP")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color(hex: "8B5CF6"))
            }

            // Tier pill
            Text(badge.tier.rawValue)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color(hex: badge.tier.color))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(Color(hex: badge.tier.color).opacity(0.15))
                        .overlay(
                            Capsule()
                                .stroke(Color(hex: badge.tier.color).opacity(0.4), lineWidth: 1)
                        )
                )

            // Dismiss button
            Button {
                dismiss()
            } label: {
                Text("Awesome!")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(hex: "8B5CF6"))
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(32)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(hex: "0A0A0F"))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color(hex: "8B5CF6").opacity(0.4), lineWidth: 1.5)
                )
                .shadow(color: Color(hex: "8B5CF6").opacity(0.2), radius: 20)
        )
        .frame(maxWidth: 320)
    }

    // MARK: - Particle Burst

    private func particleBurst(for badge: Badge) -> some View {
        ZStack {
            ForEach(0..<8, id: \.self) { index in
                let angle = Double(index) * (360.0 / 8.0)
                Circle()
                    .fill(Color(hex: badge.tier.color))
                    .frame(width: 8, height: 8)
                    .offset(
                        x: cos(angle * .pi / 180) * 60 * particleScale,
                        y: sin(angle * .pi / 180) * 60 * particleScale
                    )
                    .opacity(particleOpacity)
            }
        }
    }

    // MARK: - Helpers

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.25)) {
            showCard = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            manager.showUnlockOverlay = false
            manager.recentUnlock = nil
        }
    }

    private func animateXPCount(target: Int) {
        let steps = 20
        let interval = 0.05
        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(step) * interval) {
                xpCountUp = (target * step) / steps
            }
        }
    }
}
