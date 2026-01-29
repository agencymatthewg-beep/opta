//
//  ContentView.swift
//  ClawdbotDesktop
//
//  Placeholder UI for Clawdbot macOS app
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

            // Placeholder chat area
            VStack(alignment: .leading, spacing: 12) {
                Text("Chat Interface")
                    .font(.headline)
                    .foregroundColor(.secondary)

                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.secondary.opacity(0.1))
                    .frame(height: 200)
                    .overlay(
                        Text("Messages will appear here")
                            .foregroundColor(.secondary)
                    )

                HStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.1))
                        .frame(height: 40)
                        .overlay(
                            Text("Type a message...")
                                .foregroundColor(.secondary.opacity(0.5))
                        )

                    Button(action: {}) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(.white)
                            .padding(10)
                            .background(Color.blue)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(true)
                }
            }
            .padding()

            // Placeholder status
            Text("Coming Soon")
                .font(.headline)
                .foregroundColor(.secondary)
                .padding(.bottom, 20)
        }
        .frame(minWidth: 400, minHeight: 600)
        .padding()
    }
}

#Preview {
    ContentView()
}
