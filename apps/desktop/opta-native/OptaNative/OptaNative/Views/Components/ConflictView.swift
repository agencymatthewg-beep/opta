//
//  ConflictView.swift
//  OptaNative
//
//  View for identifying and resolving software conflicts.
//  Also displays smart suggestions based on user patterns.
//  Created for Opta Native macOS - Plan 97-01 (v12.0)
//

import SwiftUI

struct ConflictView: View {
    /// ViewModel initialized once via State's wrapped value
    @State private var viewModel = ConflictViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: OptaSpacing.xxl) {

                // MARK: - Header
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("System Health")
                            .font(.optaSectionHeader())
                            .foregroundStyle(Color.optaTextPrimary)

                        Text("Monitor conflicts and optimization patterns")
                            .font(.optaSmall)
                            .foregroundStyle(Color.optaTextSecondary)
                    }

                    Spacer()

                    if viewModel.isScanning {
                        ProgressView()
                            .scaleEffect(0.8)
                            .tint(Color.optaNeonPurple)
                    } else {
                        Button(action: { viewModel.refresh() }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.optaNeonPurple)
                        }
                        .buttonStyle(.plain)
                        .padding(8)
                        .background(Color.optaNeonPurple.opacity(0.1))
                        .clipShape(Circle())
                    }
                }
                .padding(.horizontal, OptaSpacing.lg)
                .padding(.top, OptaSpacing.lg)

                // MARK: - Stats Row
                HStack(spacing: OptaSpacing.md) {
                    HealthStatusCard(
                        title: "Conflicts",
                        value: "\(viewModel.conflicts.count)",
                        color: viewModel.conflicts.isEmpty ? Color.optaSuccess : Color.optaWarning,
                        icon: viewModel.conflicts.isEmpty ? "checkmark.shield.fill" : "exclamationmark.triangle.fill"
                    )

                    HealthStatusCard(
                        title: "Patterns",
                        value: "\(viewModel.suggestions.count)",
                        color: Color.optaElectricBlue,
                        icon: "brain.head.profile"
                    )

                    if viewModel.ignoredCount > 0 {
                        HealthStatusCard(
                            title: "Ignored",
                            value: "\(viewModel.ignoredCount)",
                            color: Color.optaTextMuted,
                            icon: "eye.slash"
                        )
                    }
                }
                .padding(.horizontal, OptaSpacing.lg)

                // MARK: - Ignored Reset
                if viewModel.ignoredCount > 0 {
                    HStack {
                        Text("\(viewModel.ignoredCount) conflict(s) hidden")
                            .font(.optaSmall)
                            .foregroundStyle(Color.optaTextMuted)

                        Spacer()

                        Button("Show All") {
                            viewModel.clearIgnoredConflicts()
                        }
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaNeonPurple)
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, OptaSpacing.lg)
                }

                if viewModel.showClearedMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color.optaSuccess)
                        Text("Ignore list cleared")
                            .font(.optaSmall)
                            .foregroundStyle(Color.optaTextSecondary)
                    }
                    .padding(.horizontal, OptaSpacing.lg)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                Divider()
                    .background(Color.optaBorder)
                    .padding(.horizontal, OptaSpacing.lg)

                // MARK: - Conflicts Section
                VStack(alignment: .leading, spacing: OptaSpacing.md) {
                    if !viewModel.conflicts.isEmpty {
                        Text("Detected Conflicts")
                            .font(.optaBodyMedium)
                            .foregroundStyle(Color.optaTextPrimary)
                            .padding(.horizontal, OptaSpacing.lg)

                        ForEach(viewModel.conflicts) { conflict in
                            ConflictRowView(conflict: conflict) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    viewModel.ignoreConflict(id: conflict.id)
                                }
                            }
                        }
                    } else {
                        // Success State
                        HStack(spacing: OptaSpacing.md) {
                            Image(systemName: "checkmark.shield.fill")
                                .font(.title2)
                                .foregroundStyle(Color.optaSuccess)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("No conflicts detected")
                                    .font(.optaBodyMedium)
                                    .foregroundStyle(Color.optaTextPrimary)

                                Text("Your system is optimized for performance")
                                    .font(.optaSmall)
                                    .foregroundStyle(Color.optaTextSecondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(OptaSpacing.lg)
                        .background(Color.optaSuccess.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                                .strokeBorder(Color.optaSuccess.opacity(0.3), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
                        .padding(.horizontal, OptaSpacing.lg)
                    }
                }

                // MARK: - Suggestions Section
                if !viewModel.suggestions.isEmpty {
                    VStack(alignment: .leading, spacing: OptaSpacing.md) {
                        HStack {
                            Text("Optimization Habits")
                                .font(.optaBodyMedium)
                                .foregroundStyle(Color.optaTextPrimary)

                            Spacer()

                            Image(systemName: "sparkles")
                                .font(.caption)
                                .foregroundStyle(Color.optaNeonPurple)
                        }
                        .padding(.horizontal, OptaSpacing.lg)

                        ForEach(viewModel.suggestions) { pattern in
                            PatternRowView(pattern: pattern)
                        }
                    }
                    .padding(.top, OptaSpacing.md)
                }

                Spacer(minLength: OptaSpacing.xxl)
            }
        }
        .frame(minWidth: 400, minHeight: 500)
        .background(Color.optaVoid)
    }
}

// MARK: - Health Status Card

private struct HealthStatusCard: View {
    let title: String
    let value: String
    let color: Color
    let icon: String

    var body: some View {
        HStack(spacing: OptaSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.optaBadge())
                    .foregroundStyle(Color.optaTextMuted)
                    .textCase(.uppercase)
                    .tracking(1)

                Text(value)
                    .font(.optaHero(size: 28))
                    .foregroundStyle(color)
            }

            Spacer()

            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color.opacity(0.8))
        }
        .padding(OptaSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.optaSurface)
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(color.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
    }
}

// MARK: - Conflict Row

private struct ConflictRowView: View {
    let conflict: ConflictInfo
    let onIgnore: () -> Void

    private var severityColor: Color {
        switch conflict.severity {
        case .high: return Color.optaDanger
        case .medium: return Color.optaWarning
        case .low: return Color(hex: 0xFACC15) // Yellow
        }
    }

    private var severityLabel: String {
        switch conflict.severity {
        case .high: return "HIGH"
        case .medium: return "MEDIUM"
        case .low: return "LOW"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: OptaSpacing.md) {
            // Severity Indicator
            VStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3)
                    .foregroundStyle(severityColor)

                Text(severityLabel)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(severityColor)
                    .padding(.top, 2)
            }
            .frame(width: 50)

            // Content
            VStack(alignment: .leading, spacing: 6) {
                Text(conflict.name)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaTextPrimary)

                Text(conflict.description)
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaTextSecondary)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    Image(systemName: "lightbulb.fill")
                        .font(.caption2)
                    Text(conflict.recommendation)
                        .font(.optaSmall)
                }
                .foregroundStyle(severityColor)
                .padding(.top, 4)

                // Detected processes
                if !conflict.detectedProcesses.isEmpty {
                    HStack(spacing: 4) {
                        Text("Processes:")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.optaTextMuted)

                        Text(conflict.detectedProcesses.joined(separator: ", "))
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                    .padding(.top, 2)
                }
            }

            Spacer()

            // Ignore Button
            Button(action: onIgnore) {
                Text("Ignore")
                    .font(.optaBadge())
                    .foregroundStyle(Color.optaTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.optaSurface)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(Color.optaBorder, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(OptaSpacing.lg)
        .background(severityColor.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(severityColor.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
        .padding(.horizontal, OptaSpacing.lg)
    }
}

// MARK: - Pattern Row

private struct PatternRowView: View {
    let pattern: OptimizationPattern

    private var probability: Int {
        Int(pattern.optimizationProbability * 100)
    }

    private var isFavorite: Bool {
        pattern.optimizationProbability > 0.8
    }

    var body: some View {
        HStack(spacing: OptaSpacing.md) {
            // Icon
            Image(systemName: "gamecontroller.fill")
                .font(.title3)
                .foregroundStyle(Color.optaNeonPurple.opacity(0.7))
                .frame(width: 36)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(pattern.context)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaTextPrimary)

                HStack(spacing: 8) {
                    Text("Optimized \(probability)% of launches")
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaTextSecondary)

                    Text("•")
                        .foregroundStyle(Color.optaTextMuted)

                    Text("\(pattern.launchCount) sessions")
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaTextMuted)
                }
            }

            Spacer()

            // Favorite Badge
            if isFavorite {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.caption2)
                    Text("Favorite")
                        .font(.optaBadge())
                }
                .foregroundStyle(Color.optaNeonPurple)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.optaNeonPurple.opacity(0.15))
                .clipShape(Capsule())
            }
        }
        .padding(OptaSpacing.lg)
        .background(Color.optaSurface)
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
        .padding(.horizontal, OptaSpacing.lg)
    }
}

// MARK: - Preview

#Preview {
    ConflictView()
        .frame(width: 500, height: 700)
}
