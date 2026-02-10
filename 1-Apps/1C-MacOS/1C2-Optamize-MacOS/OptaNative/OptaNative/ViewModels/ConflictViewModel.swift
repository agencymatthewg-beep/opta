//
//  ConflictViewModel.swift
//  OptaNative
//
//  View model for managing conflict detection and pattern learning insights.
//  Created for Opta Native macOS - Plan 97-01 (v12.0)
//

import SwiftUI

@Observable
@MainActor
class ConflictViewModel {

    // MARK: - Published Properties

    var conflicts: [ConflictInfo] = []
    var suggestions: [OptimizationPattern] = []
    var isScanning: Bool = false
    var showClearedMessage: Bool = false

    // MARK: - Persistence

    private static let ignoredKey = "ignoredConflictIds"

    private var ignoredIds: Set<String> {
        get {
            guard let data = UserDefaults.standard.data(forKey: Self.ignoredKey),
                  let ids = try? JSONDecoder().decode(Set<String>.self, from: data) else {
                return []
            }
            return ids
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: Self.ignoredKey)
            }
        }
    }

    // MARK: - Dependencies

    private let conflictService = ConflictDetectionService()
    private let patternService = PatternLearningService()

    // MARK: - Initialization

    init() {
        refresh()
    }

    // MARK: - Actions

    func refresh() {
        isScanning = true
        showClearedMessage = false

        Task {
            // Fetch conflicts, filtering out ignored ones
            let foundConflicts = await conflictService.detectConflicts()
            self.conflicts = foundConflicts.filter { !ignoredIds.contains($0.id) }

            // Fetch suggestions (top 5 optimized apps)
            let topPatterns = await patternService.getTopOptimizedContexts(limit: 5)
            self.suggestions = topPatterns

            self.isScanning = false
        }
    }

    func ignoreConflict(id: String) {
        var ids = ignoredIds
        ids.insert(id)
        ignoredIds = ids
        conflicts.removeAll { $0.id == id }
    }

    func clearIgnoredConflicts() {
        ignoredIds = []
        showClearedMessage = true
        refresh()
    }

    var ignoredCount: Int {
        ignoredIds.count
    }

    // MARK: - Preview Support

    static var preview: ConflictViewModel {
        let vm = ConflictViewModel()
        vm.conflicts = [
            ConflictInfo(
                id: "preview_1",
                name: "Example Optimizer",
                description: "A competing optimization tool.",
                severity: .medium,
                recommendation: "Consider disabling while using Opta.",
                detectedProcesses: ["ExampleApp"]
            )
        ]
        vm.suggestions = [
            OptimizationPattern(
                context: "Cyberpunk 2077",
                optimizeCount: 8,
                launchCount: 10,
                lastOptimized: Date()
            )
        ]
        return vm
    }
}
