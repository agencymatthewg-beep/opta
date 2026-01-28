//
//  VisualEffectsOverlay.swift
//  OptaNative
//
//  Global overlay for displaying particle effects and celebrations.
//  Listens to 'TriggerCelebration' notifications.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

struct VisualEffectsOverlay: View {
    @State private var activeEffect: ParticleEffect?
    @State private var burstKey = 0 // Key to force-refresh views on burst
    
    var body: some View {
        ZStack {
            if let effect = activeEffect {
                ParticleEffectView(effect: effect, isActive: true)
                    .transition(.opacity)
            }
        }
        .allowsHitTesting(false) // Let clicks pass through
        .onReceive(NotificationCenter.default.publisher(for: .triggerCelebration)) { notification in
            handleTrigger(notification)
        }
    }
    
    private func handleTrigger(_ notification: Notification) {
        guard let type = notification.userInfo?["type"] as? String else { return }
        
        switch type {
        case "achievement":
            triggerEffect(.confetti, duration: 3.0)
        case "optimization_complete":
            triggerEffect(.energyField(center: CGPoint(x: 300, y: 300)), duration: 2.0)
        case "game_session_end":
            triggerEffect(.fireworks, duration: 3.0)
        default: break
        }
    }
    
    private func triggerEffect(_ effect: ParticleEffect, duration: TimeInterval) {
        withAnimation {
            self.activeEffect = effect
            self.burstKey += 1
        }
        
        // Auto dismiss
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            withAnimation {
                self.activeEffect = nil
            }
        }
    }
}

extension Notification.Name {
    static let triggerCelebration = Notification.Name("TriggerCelebration")
}

// Helper to trigger easily
struct Effects {
    static func celebrate(type: String) {
        NotificationCenter.default.post(name: .triggerCelebration, object: nil, userInfo: ["type": type])
    }
}
