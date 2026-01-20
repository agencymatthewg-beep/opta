//
//  HistoryView.swift
//  Opta Scan
//
//  History screen showing past scans - will be populated in Phase 6
//  Created by Matthew Byrden
//

import SwiftUI

struct HistoryView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                // Empty state
                VStack(spacing: OptaDesign.Spacing.lg) {
                    Image(systemName: "clock")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(Color.optaTextMuted)

                    VStack(spacing: OptaDesign.Spacing.xs) {
                        Text("No scans yet")
                            .optaHeadlineStyle()

                        Text("Your optimization history will appear here")
                            .optaCaptionStyle()
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, OptaDesign.Spacing.xl)
            }
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.optaBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

#Preview {
    HistoryView()
}
