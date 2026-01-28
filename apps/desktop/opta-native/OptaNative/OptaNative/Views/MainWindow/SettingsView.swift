//
//  SettingsView.swift
//  OptaNative
//
//  Placeholder settings view for future configuration options.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// Placeholder settings view.
/// Will be expanded in future phases to include:
/// - Monitoring intervals
/// - Startup preferences
/// - Theme customization
/// - Notification settings
/// - Helper tool management
struct SettingsView: View {

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: OptaSpacing.xxl) {
                // Header
                VStack(spacing: OptaSpacing.md) {
                    Image(systemName: "gearshape.2")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(Color.optaMutedForeground)

                    Text("Settings")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    Text("Coming soon")
                        .font(.optaBody)
                        .foregroundStyle(Color.optaMutedForeground)
                }
                .padding(.top, 60)

                // Preview of upcoming features
                upcomingFeatures
            }
            .frame(maxWidth: .infinity)
            .padding(OptaSpacing.xl)
        }
        .background(Color.optaBackground)
    }

    // MARK: - Upcoming Features

    @ViewBuilder
    private var upcomingFeatures: some View {
        VStack(alignment: .leading, spacing: OptaSpacing.lg) {
            Text("Planned Features")
                .font(.optaH3)
                .foregroundStyle(Color.optaForeground)

            GlassCard(cornerRadius: OptaSpacing.radiusLarge) {
                VStack(alignment: .leading, spacing: OptaSpacing.md) {
                    featureRow(
                        icon: "clock.arrow.circlepath",
                        title: "Monitoring Interval",
                        description: "Adjust how often telemetry is collected"
                    )

                    Divider()
                        .background(Color.optaBorder.opacity(0.5))

                    featureRow(
                        icon: "power",
                        title: "Launch at Login",
                        description: "Start Opta automatically when you log in"
                    )

                    Divider()
                        .background(Color.optaBorder.opacity(0.5))

                    featureRow(
                        icon: "bell.badge",
                        title: "Notifications",
                        description: "Get alerts for high resource usage"
                    )

                    Divider()
                        .background(Color.optaBorder.opacity(0.5))

                    featureRow(
                        icon: "shield.checkered",
                        title: "Helper Tool",
                        description: "Manage privileged helper installation"
                    )

                    Divider()
                        .background(Color.optaBorder.opacity(0.5))

                    featureRow(
                        icon: "paintbrush",
                        title: "Appearance",
                        description: "Customize accent colors and themes"
                    )
                }
                .padding(OptaSpacing.lg)
            }
        }
        .frame(maxWidth: 400)
    }

    @ViewBuilder
    private func featureRow(icon: String, title: String, description: String) -> some View {
        HStack(spacing: OptaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.optaPrimary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaForeground)

                Text(description)
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview("Settings View") {
    SettingsView()
        .frame(width: 600, height: 700)
}
