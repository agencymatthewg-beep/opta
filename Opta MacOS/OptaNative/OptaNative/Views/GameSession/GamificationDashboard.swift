//
//  GamificationDashboard.swift
//  OptaNative
//
//  Placeholder for the Gamification Dashboard.
//

import SwiftUI

struct GamificationDashboard: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.optaNeonPurple)

            Text("Achievements")
                .font(.opta(size: 24, weight: .bold))
                .foregroundStyle(Color.optaTextPrimary)

            Text("Coming Soon")
                .font(.opta(size: 15))
                .foregroundStyle(Color.optaTextMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
