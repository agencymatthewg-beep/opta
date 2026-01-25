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
        
        Task {
            // Fetch conflicts
            let foundConflicts = await conflictService.detectConflicts()
            self.conflicts = foundConflicts
            
            // Fetch suggestions (top 3 optimized apps)
            let topPatterns = await patternService.getTopOptimizedContexts(limit: 3)
            self.suggestions = topPatterns
            
            self.isScanning = false
        }
    }
    
    func ignoreConflict(id: String) {
        // In a real app, persist this ignore preference
        conflicts.removeAll { $0.id == id }
    }
}
