//
//  PatternLearningService.swift
//  OptaNative
//
//  Service for learning user habits and optimization patterns.
//  Tracks events (game launch, optimization toggle) to provide smart suggestions.
//  Created for Opta Native macOS - Plan 97-01 (v12.0)
//

import Foundation

// MARK: - Models

struct UserEvent: Codable, Identifiable, Sendable {
    let id: UUID
    let type: EventType
    let timestamp: Date
    let context: String? // e.g. Game Name
    
    enum EventType: String, Codable {
        case gameLaunch
        case optimizeOn
        case optimizeOff
        case appLaunch
    }
}

struct OptimizationPattern: Codable, Identifiable, Sendable {
    var id: String { context }
    let context: String // e.g. "Cyberpunk 2077"
    var optimizeCount: Int
    var launchCount: Int
    var lastOptimized: Date?
    
    var optimizationProbability: Double {
        guard launchCount > 0 else { return 0 }
        return Double(optimizeCount) / Double(launchCount)
    }
}

// MARK: - Service

actor PatternLearningService {
    
    // MARK: - Properties
    
    private var events: [UserEvent] = []
    private var patterns: [String: OptimizationPattern] = [:] // Context -> Pattern
    private let fileManager = FileManager.default
    
    // MARK: - Initialization
    
    init() {
        Task {
            await loadData()
        }
    }
    
    // MARK: - Event Tracking
    
    func trackEvent(_ type: UserEvent.EventType, context: String? = nil) {
        let event = UserEvent(id: UUID(), type: type, timestamp: Date(), context: context)
        events.append(event)
        
        // Update patterns
        if let context = context {
            var pattern = patterns[context] ?? OptimizationPattern(context: context, optimizeCount: 0, launchCount: 0, lastOptimized: nil)
            
            switch type {
            case .gameLaunch:
                pattern.launchCount += 1
            case .optimizeOn:
                pattern.optimizeCount += 1
                pattern.lastOptimized = Date()
            default:
                break
            }
            
            patterns[context] = pattern
        }
        
        // Persist periodically or on change (simplified here)
        Task {
            await saveData()
        }
    }
    
    // MARK: - Analysis
    
    /// Suggests whether to optimize based on past behavior for this context.
    func shouldSuggestOptimization(for context: String) -> Bool {
        guard let pattern = patterns[context] else { return false }
        
        // If user optimizes > 50% of the time, suggest it
        return pattern.optimizationProbability > 0.5
    }
    
    /// Returns the most frequently optimized games/apps
    func getTopOptimizedContexts(limit: Int = 3) -> [OptimizationPattern] {
        return patterns.values
            .filter { $0.optimizeCount > 0 }
            .sorted { $0.optimizeCount > $1.optimizeCount }
            .prefix(limit)
            .map { $0 }
    }
    
    // MARK: - Persistence
    
    private var persistenceURL: URL? {
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let appDir = appSupport.appendingPathComponent("OptaApp")
        return appDir.appendingPathComponent("patterns.json")
    }
    
    private func saveData() async {
        guard let url = persistenceURL else { return }
        do {
            let data = try JSONEncoder().encode(patterns)
            try data.write(to: url, options: .atomic)
        } catch {
            print("Failed to save patterns: \(error)")
        }
    }
    
    private func loadData() async {
        guard let url = persistenceURL,
              let data = try? Data(contentsOf: url) else {
            return
        }
        do {
            self.patterns = try JSONDecoder().decode([String: OptimizationPattern].self, from: data)
        } catch {
            print("Failed to load patterns: \(error)")
        }
    }
}
