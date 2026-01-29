//
//  ContentView.swift
//  ClawdbotMobile
//
//  Placeholder UI for Clawdbot iOS app
//
//  Created by Matthew Byrden
//

import SwiftUI
import ClawdbotKit

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            // App icon placeholder
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 80))
                .foregroundStyle(.linearGradient(
                    colors: [.blue, .purple],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))

            // App title
            Text("Clawdbot")
                .font(.largeTitle)
                .fontWeight(.bold)

            // Version info from ClawdbotKit
            Text("v\(ClawdbotKit.version)")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text(ClawdbotKit.platforms)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()

            // Placeholder status
            Text("Coming Soon")
                .font(.headline)
                .foregroundColor(.secondary)
                .padding(.bottom, 40)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
