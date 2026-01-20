//
//  SettingsView.swift
//  Opta Scan
//
//  Settings screen - will be populated with options later
//  Created by Matthew Byrden
//

import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                List {
                    // Placeholder settings sections
                    Section {
                        SettingsRow(
                            icon: "wand.and.stars",
                            title: "Optimization Depth",
                            subtitle: "How thorough to analyze"
                        )

                        SettingsRow(
                            icon: "icloud",
                            title: "Sync",
                            subtitle: "iCloud backup"
                        )
                    } header: {
                        Text("Preferences")
                    }

                    Section {
                        SettingsRow(
                            icon: "questionmark.circle",
                            title: "Help & Support",
                            subtitle: nil
                        )

                        SettingsRow(
                            icon: "info.circle",
                            title: "About",
                            subtitle: nil
                        )
                    } header: {
                        Text("Support")
                    }

                    // Version footer
                    Section {
                        HStack {
                            Spacer()
                            VStack(spacing: OptaDesign.Spacing.xxs) {
                                Text("Opta Scan")
                                    .optaCaptionStyle()
                                Text("Version 1.0.0")
                                    .optaLabelStyle()
                            }
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .scrollContentBackground(.hidden)
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.optaBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

// MARK: - Settings Row Component

private struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Color.optaPurple)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .optaBodyStyle()
                    .foregroundStyle(Color.optaTextPrimary)

                if let subtitle = subtitle {
                    Text(subtitle)
                        .optaLabelStyle()
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.optaTextMuted)
        }
        .padding(.vertical, OptaDesign.Spacing.xxs)
        .listRowBackground(Color.optaSurface)
    }
}

#Preview {
    SettingsView()
}
