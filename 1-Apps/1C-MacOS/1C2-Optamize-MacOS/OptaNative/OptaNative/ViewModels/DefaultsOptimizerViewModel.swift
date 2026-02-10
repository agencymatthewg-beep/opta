//
//  DefaultsOptimizerViewModel.swift
//  OptaNative
//
//  ViewModel for the macOS Defaults Optimizer.
//  Manages state for one-click system optimizations.
//
//  Created for Opta Native macOS - Phase 99
//

import SwiftUI

@Observable
final class DefaultsOptimizerViewModel {

    // MARK: - State

    var optimizationsByCategory: [OptimizationCategory: [OptimizationState]] = [:]
    var isLoading = true
    var isApplyingAll = false
    var lastError: String?

    /// Total count of applied optimizations
    var appliedCount: Int {
        optimizationsByCategory.values.flatMap { $0 }.filter { $0.isApplied }.count
    }

    /// Total count of available optimizations
    var totalCount: Int {
        optimizationsByCategory.values.flatMap { $0 }.count
    }

    /// Progress as percentage
    var progressPercentage: Double {
        guard totalCount > 0 else { return 0 }
        return Double(appliedCount) / Double(totalCount) * 100
    }

    // MARK: - Private

    private let service = DefaultsOptimizerService()

    // MARK: - Lifecycle

    init() {
        Task {
            await loadOptimizations()
        }
    }

    // MARK: - Public API

    /// Load/refresh all optimization states
    func loadOptimizations() async {
        await MainActor.run { isLoading = true }

        let grouped = await service.getOptimizationsByCategory()

        await MainActor.run {
            optimizationsByCategory = grouped
            isLoading = false
        }
    }

    /// Toggle a single optimization
    func toggleOptimization(_ optimization: DefaultsOptimization, isApplied: Bool) async {
        do {
            if isApplied {
                try await service.revertOptimization(optimization)
            } else {
                try await service.applyOptimization(optimization)
            }

            // Reload to get fresh state
            await loadOptimizations()
        } catch {
            await MainActor.run {
                lastError = error.localizedDescription
            }
        }
    }

    /// Apply all optimizations in a category
    func applyCategory(_ category: OptimizationCategory) async {
        do {
            try await service.applyCategory(category)
            await loadOptimizations()
        } catch {
            await MainActor.run {
                lastError = error.localizedDescription
            }
        }
    }

    /// Revert all optimizations in a category
    func revertCategory(_ category: OptimizationCategory) async {
        do {
            try await service.revertCategory(category)
            await loadOptimizations()
        } catch {
            await MainActor.run {
                lastError = error.localizedDescription
            }
        }
    }

    /// Apply all optimizations
    func applyAll() async {
        await MainActor.run { isApplyingAll = true }

        do {
            try await service.applyAll()
            await loadOptimizations()
        } catch {
            await MainActor.run {
                lastError = error.localizedDescription
            }
        }

        await MainActor.run { isApplyingAll = false }
    }

    /// Revert all optimizations to defaults
    func revertAll() async {
        await MainActor.run { isApplyingAll = true }

        do {
            try await service.revertAll()
            await loadOptimizations()
        } catch {
            await MainActor.run {
                lastError = error.localizedDescription
            }
        }

        await MainActor.run { isApplyingAll = false }
    }

    /// Check if a category is fully applied
    func isCategoryFullyApplied(_ category: OptimizationCategory) -> Bool {
        guard let states = optimizationsByCategory[category] else { return false }
        return states.allSatisfy { $0.isApplied }
    }

    /// Get count of applied optimizations in category
    func appliedInCategory(_ category: OptimizationCategory) -> Int {
        optimizationsByCategory[category]?.filter { $0.isApplied }.count ?? 0
    }

    /// Get total count in category
    func totalInCategory(_ category: OptimizationCategory) -> Int {
        optimizationsByCategory[category]?.count ?? 0
    }

    /// Clear error message
    func clearError() {
        lastError = nil
    }
}
