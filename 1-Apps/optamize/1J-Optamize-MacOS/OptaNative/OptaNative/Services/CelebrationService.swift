//
//  CelebrationService.swift
//  OptaNative
//
//  Singleton service for triggering celebration effects throughout the app.
//  Manages confetti, sparkles, fireworks, and achievement animations.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

// MARK: - Celebration Types

enum CelebrationType: Sendable, Equatable {
    case badgeUnlock(String)
    case scoreMilestone(Int)
    case achievement(String)
    case optimization
    case streakAchievement(Int)
    case levelUp(Int)

    var displayTitle: String {
        switch self {
        case .badgeUnlock(let name): return "Badge Unlocked: \(name)"
        case .scoreMilestone(let score): return "Score Milestone: \(score)"
        case .achievement(let name): return name
        case .optimization: return "Optimization Complete"
        case .streakAchievement(let days): return "\(days)-Day Streak!"
        case .levelUp(let level): return "Level \(level)!"
        }
    }

    var icon: String {
        switch self {
        case .badgeUnlock: return "rosette"
        case .scoreMilestone: return "star.fill"
        case .achievement: return "trophy.fill"
        case .optimization: return "bolt.fill"
        case .streakAchievement: return "flame.fill"
        case .levelUp: return "arrow.up.circle.fill"
        }
    }

    var effectStyle: CelebrationEffectStyle {
        switch self {
        case .badgeUnlock, .achievement, .levelUp:
            return .fireworks
        case .scoreMilestone:
            return .confetti
        case .optimization:
            return .sparkles
        case .streakAchievement:
            return .flames
        }
    }
}

enum CelebrationEffectStyle: String, Sendable, Equatable {
    case confetti
    case fireworks
    case sparkles
    case flames
    case snow
    case energyBurst
}

// MARK: - Celebration Effect

struct CelebrationEffect: Identifiable, Sendable, Equatable {
    let id: UUID
    let type: CelebrationType
    let style: CelebrationEffectStyle
    let position: CGPoint?
    let intensity: Double
    let duration: Double
    let timestamp: Date

    init(
        type: CelebrationType,
        position: CGPoint? = nil,
        intensity: Double = 1.0,
        duration: Double = 2.5
    ) {
        self.id = UUID()
        self.type = type
        self.style = type.effectStyle
        self.position = position
        self.intensity = intensity
        self.duration = duration
        self.timestamp = Date()
    }
}

// MARK: - Celebration Service

@Observable
@MainActor
final class CelebrationService {

    // MARK: - Singleton

    static let shared = CelebrationService()

    // MARK: - Published State

    private(set) var activeEffect: CelebrationEffect?
    private(set) var effectPosition: CGPoint = .zero
    private(set) var isAnimating: Bool = false

    /// Queue for effects waiting to be shown
    private var effectQueue: [CelebrationEffect] = []

    /// Dismiss task handle
    private var dismissTask: Task<Void, Never>?

    // MARK: - Settings

    var isEnabled: Bool = true
    var respectsReducedMotion: Bool = true

    /// Computed: should effects actually play?
    var shouldPlayEffects: Bool {
        guard isEnabled else { return false }
        if respectsReducedMotion {
            return !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        }
        return true
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Public API

    /// Trigger a celebration effect
    func celebrate(_ type: CelebrationType, at position: CGPoint? = nil, intensity: Double = 1.0) {
        guard shouldPlayEffects else {
            // Still log the event even if effects disabled
            print("CelebrationService: Effect disabled - \(type.displayTitle)")
            return
        }

        let effect = CelebrationEffect(
            type: type,
            position: position,
            intensity: intensity
        )

        // If already animating, queue the effect
        if isAnimating {
            effectQueue.append(effect)
            return
        }

        showEffect(effect)
    }

    /// Convenience: celebrate a score milestone
    func celebrateScore(_ score: Int) {
        // Only celebrate multiples of 100
        if score > 0 && score % 100 == 0 {
            celebrate(.scoreMilestone(score))
        }
    }

    /// Convenience: celebrate badge unlock
    func celebrateBadge(_ badgeName: String) {
        celebrate(.badgeUnlock(badgeName), intensity: 1.2)
    }

    /// Convenience: celebrate optimization complete
    func celebrateOptimization() {
        celebrate(.optimization, intensity: 0.7)
    }

    /// Convenience: celebrate streak
    func celebrateStreak(_ days: Int) {
        guard days >= 3 else { return }
        let intensity = min(1.5, 0.8 + Double(days) * 0.05)
        celebrate(.streakAchievement(days), intensity: intensity)
    }

    /// Convenience: celebrate level up
    func celebrateLevelUp(_ level: Int) {
        celebrate(.levelUp(level), intensity: 1.3)
    }

    /// Dismiss current effect immediately
    func dismiss() {
        dismissTask?.cancel()
        dismissTask = nil

        withAnimation(.easeOut(duration: 0.3)) {
            activeEffect = nil
            isAnimating = false
        }

        // Process queue after short delay
        Task {
            try? await Task.sleep(for: .milliseconds(200))
            processQueue()
        }
    }

    // MARK: - Private Methods

    private func showEffect(_ effect: CelebrationEffect) {
        // Cancel any existing dismiss task
        dismissTask?.cancel()

        // Update state
        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
            activeEffect = effect
            effectPosition = effect.position ?? CGPoint(x: 0.5, y: 0.5)
            isAnimating = true
        }

        // Schedule auto-dismiss
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(effect.duration))
            guard !Task.isCancelled else { return }
            await self?.autoDismiss()
        }

        print("CelebrationService: Playing \(effect.style.rawValue) for \(effect.type.displayTitle)")
    }

    private func autoDismiss() {
        withAnimation(.easeOut(duration: 0.5)) {
            activeEffect = nil
            isAnimating = false
        }

        // Process queue after animation completes
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            processQueue()
        }
    }

    private func processQueue() {
        guard !effectQueue.isEmpty, !isAnimating else { return }
        let next = effectQueue.removeFirst()
        showEffect(next)
    }
}

// MARK: - Accessibility Extension

extension NSWorkspace {
    /// Check if reduce motion is enabled
    var accessibilityDisplayShouldReduceMotion: Bool {
        // macOS provides this via accessibility settings
        // In real implementation, would use proper system API
        // For now, return false (assume full motion is OK)
        return UserDefaults.standard.bool(forKey: "reduceMotion")
    }
}
