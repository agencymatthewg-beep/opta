//
//  DefaultsOptimizerView.swift
//  OptaNative
//
//  One-click macOS optimizations UI.
//  Obsidian glass aesthetic with category-based organization.
//
//  Created for Opta Native macOS - Phase 99
//

import SwiftUI

struct DefaultsOptimizerView: View {
    @State private var viewModel = DefaultsOptimizerViewModel()
    @State private var expandedCategory: OptimizationCategory? = nil
    @State private var showConfirmRevertAll = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header with progress
                headerSection

                // Quick Actions
                quickActionsSection

                // Category Cards
                ForEach(OptimizationCategory.allCases) { category in
                    categoryCard(category)
                }
            }
            .padding(24)
        }
        .background(Color.optaVoid)
        .alert("Revert All Optimizations?", isPresented: $showConfirmRevertAll) {
            Button("Cancel", role: .cancel) { }
            Button("Revert All", role: .destructive) {
                Task { await viewModel.revertAll() }
            }
        } message: {
            Text("This will restore all macOS settings to their defaults.")
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("macOS Optimizer")
                        .font(.optaSectionHeader(size: 28))
                        .foregroundStyle(Color.optaTextPrimary)

                    Text("One-click tweaks for a snappier Mac")
                        .font(.optaSubtitle(size: 14))
                        .foregroundStyle(Color.optaTextMuted)
                }

                Spacer()

                // Progress Ring
                ZStack {
                    Circle()
                        .stroke(Color.optaSurface, lineWidth: 4)
                        .frame(width: 60, height: 60)

                    Circle()
                        .trim(from: 0, to: viewModel.progressPercentage / 100)
                        .stroke(
                            Color.optaNeonPurple,
                            style: StrokeStyle(lineWidth: 4, lineCap: .round)
                        )
                        .frame(width: 60, height: 60)
                        .rotationEffect(.degrees(-90))
                        .animation(.spring(response: 0.5), value: viewModel.progressPercentage)

                    VStack(spacing: 0) {
                        Text("\(viewModel.appliedCount)")
                            .font(.optaMono.weight(.bold))
                            .foregroundStyle(Color.optaTextPrimary)
                        Text("/\(viewModel.totalCount)")
                            .font(.optaSubtitle(size: 10))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaSurface.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(
                                LinearGradient(
                                    colors: [Color.optaNeonPurple.opacity(0.3), Color.clear],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
        }
    }

    // MARK: - Quick Actions Section

    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            // Apply All Button
            Button(action: {
                Task { await viewModel.applyAll() }
            }) {
                HStack(spacing: 8) {
                    if viewModel.isApplyingAll {
                        ProgressView()
                            .scaleEffect(0.8)
                            .tint(Color.optaTextPrimary)
                    } else {
                        Image(systemName: "bolt.fill")
                    }
                    Text("Apply All")
                }
                .font(.opta(size: 14, weight: .semibold))
                .foregroundStyle(Color.optaTextPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.optaNeonPurple.opacity(0.2))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.optaNeonPurple.opacity(0.5), lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isApplyingAll || viewModel.appliedCount == viewModel.totalCount)

            // Revert All Button
            Button(action: {
                showConfirmRevertAll = true
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Revert All")
                }
                .font(.opta(size: 14, weight: .medium))
                .foregroundStyle(Color.optaTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.optaSurface.opacity(0.5))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isApplyingAll || viewModel.appliedCount == 0)
        }
    }

    // MARK: - Category Card

    private func categoryCard(_ category: OptimizationCategory) -> some View {
        VStack(spacing: 0) {
            // Category Header (Always Visible)
            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    if expandedCategory == category {
                        expandedCategory = nil
                    } else {
                        expandedCategory = category
                    }
                }
            }) {
                HStack(spacing: 12) {
                    // Icon
                    Image(systemName: category.icon)
                        .font(.system(size: 18))
                        .foregroundStyle(
                            viewModel.isCategoryFullyApplied(category)
                                ? Color.optaNeonPurple
                                : Color.optaTextSecondary
                        )
                        .frame(width: 32)

                    // Title & Description
                    VStack(alignment: .leading, spacing: 2) {
                        Text(category.rawValue)
                            .font(.opta(size: 16, weight: .semibold))
                            .foregroundStyle(Color.optaTextPrimary)

                        Text(category.description)
                            .font(.optaSubtitle(size: 12))
                            .foregroundStyle(Color.optaTextMuted)
                    }

                    Spacer()

                    // Progress Badge
                    HStack(spacing: 4) {
                        Text("\(viewModel.appliedInCategory(category))/\(viewModel.totalInCategory(category))")
                            .font(.optaMono)
                            .foregroundStyle(Color.optaTextSecondary)

                        Image(systemName: expandedCategory == category ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
                .padding(16)
            }
            .buttonStyle(.plain)

            // Expanded Content
            if expandedCategory == category {
                VStack(spacing: 0) {
                    Divider()
                        .background(Color.optaGlassBorder)

                    // Category Quick Actions
                    HStack(spacing: 12) {
                        Button("Apply All") {
                            Task { await viewModel.applyCategory(category) }
                        }
                        .font(.optaSubtitle(size: 12))
                        .foregroundStyle(Color.optaNeonPurple)

                        Button("Revert All") {
                            Task { await viewModel.revertCategory(category) }
                        }
                        .font(.optaSubtitle(size: 12))
                        .foregroundStyle(Color.optaTextMuted)

                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .buttonStyle(.plain)

                    Divider()
                        .background(Color.optaGlassBorder)

                    // Individual Optimizations
                    if let states = viewModel.optimizationsByCategory[category] {
                        ForEach(states, id: \.optimization.id) { state in
                            optimizationRow(state)

                            if state.optimization.id != states.last?.optimization.id {
                                Divider()
                                    .background(Color.optaGlassBorder.opacity(0.5))
                                    .padding(.leading, 56)
                            }
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaSurface.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(
                            viewModel.isCategoryFullyApplied(category)
                                ? Color.optaNeonPurple.opacity(0.3)
                                : Color.optaGlassBorder,
                            lineWidth: 1
                        )
                )
        )
    }

    // MARK: - Optimization Row

    private func optimizationRow(_ state: OptimizationState) -> some View {
        HStack(spacing: 12) {
            // Status Indicator
            Circle()
                .fill(state.isApplied ? Color.optaNeonPurple : Color.optaSurface)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .strokeBorder(
                            state.isApplied ? Color.optaNeonPurple : Color.optaTextMuted,
                            lineWidth: 1
                        )
                )
                .padding(.leading, 12)

            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(state.optimization.name)
                        .font(.opta(size: 14, weight: .medium))
                        .foregroundStyle(Color.optaTextPrimary)

                    // Impact Badge
                    Text(state.optimization.impactLevel.rawValue)
                        .font(.optaSubtitle(size: 9))
                        .foregroundStyle(impactColor(state.optimization.impactLevel))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(impactColor(state.optimization.impactLevel).opacity(0.15))
                        )

                    // Restart Required
                    if case .killProcess = state.optimization.requiresRestart {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }

                Text(state.optimization.description)
                    .font(.optaSubtitle(size: 11))
                    .foregroundStyle(Color.optaTextMuted)
                    .lineLimit(2)
            }

            Spacer()

            // Toggle
            Toggle("", isOn: Binding(
                get: { state.isApplied },
                set: { _ in
                    Task {
                        await viewModel.toggleOptimization(
                            state.optimization,
                            isApplied: state.isApplied
                        )
                    }
                }
            ))
            .toggleStyle(.switch)
            .tint(Color.optaNeonPurple)
            .scaleEffect(0.8)
        }
        .padding(.vertical, 12)
        .padding(.trailing, 12)
    }

    // MARK: - Helpers

    private func impactColor(_ level: DefaultsOptimization.ImpactLevel) -> Color {
        switch level {
        case .high: return Color.optaNeonPurple
        case .medium: return Color.optaElectricBlue
        case .low: return Color.optaTextMuted
        }
    }
}

// MARK: - Preview

#Preview {
    DefaultsOptimizerView()
        .frame(width: 500, height: 700)
}
