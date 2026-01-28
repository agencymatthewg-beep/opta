//
//  SemanticRouter.swift
//  OptaApp
//
//  Semantic router that decides whether to route queries to the local (MLX)
//  or cloud (Claude) LLM based on query complexity, privacy requirements,
//  network availability, and system state.
//

import Foundation

// MARK: - Router Context

/// Context provided to the router for making routing decisions.
///
/// Captures system state, network conditions, and user preferences
/// to inform the local vs. cloud decision.
struct RouterContext {
    /// Whether network connectivity is available
    var networkAvailable: Bool

    /// Whether the local model is loaded and ready
    var localModelLoaded: Bool

    /// Current thermal state of the system
    var thermalState: ThermalStateViewModel

    /// Current battery level (nil on desktop Mac)
    var batteryLevel: Float?

    /// User's preferred model selection
    var userPreference: LLMModel

    /// Default context for desktop Mac with network
    static var `default`: RouterContext {
        RouterContext(
            networkAvailable: true,
            localModelLoaded: false,
            thermalState: .nominal,
            batteryLevel: nil,
            userPreference: .auto
        )
    }
}

// MARK: - SemanticRouter

/// Routes queries to local or cloud LLM based on heuristic analysis.
///
/// Routing logic:
/// - Network unavailable -> forced local
/// - Local model not loaded -> forced cloud
/// - Short, simple queries -> local preferred
/// - Complex analysis/optimization queries -> cloud preferred
/// - High thermal state -> cloud preferred (avoid local compute)
/// - User override -> respects explicit selection
///
/// Usage:
/// ```swift
/// let route = SemanticRouter.shared.route(
///     query: "What's my CPU usage?",
///     context: routerContext
/// )
/// // route == .local (simple status query)
/// ```
final class SemanticRouter {

    // MARK: - Singleton

    static let shared = SemanticRouter()

    // MARK: - Configuration

    /// Maximum word count for a "simple" query
    private let simpleQueryMaxWords = 20

    /// Keywords that indicate need for local processing
    private let localPatterns: Set<String> = [
        "what is", "how much", "status", "current",
        "show me", "check", "tell me", "quick",
        "temperature", "how hot", "fan speed"
    ]

    /// Keywords that indicate need for cloud processing
    private let cloudPatterns: Set<String> = [
        "optimize", "analyze", "why is", "recommend",
        "compare", "help me", "explain", "suggest",
        "improve", "fix", "troubleshoot", "best",
        "configure", "set up", "plan", "strategy"
    ]

    // MARK: - Routing

    /// Route a query to the appropriate LLM model.
    ///
    /// - Parameters:
    ///   - query: The user's input text
    ///   - context: Current system and preference context
    /// - Returns: The LLMModel to use for this query
    func route(query: String, context: RouterContext) -> LLMModel {
        // Respect explicit user preference
        switch context.userPreference {
        case .local:
            return .local
        case .cloud:
            return .cloud
        case .auto:
            return autoRoute(query: query, context: context)
        }
    }

    /// Perform automatic routing based on query analysis and context.
    ///
    /// Priority order:
    /// 1. Network availability (no network -> local forced)
    /// 2. Local model availability (not loaded -> cloud forced)
    /// 3. Thermal state (critical -> cloud to avoid compute)
    /// 4. Query complexity analysis
    private func autoRoute(query: String, context: RouterContext) -> LLMModel {
        // Network unavailable -> must use local
        if !context.networkAvailable {
            print("[SemanticRouter] Route: local (no network)")
            return .local
        }

        // Local model not loaded -> must use cloud
        if !context.localModelLoaded {
            print("[SemanticRouter] Route: cloud (local model not loaded)")
            return .cloud
        }

        // High thermal state -> prefer cloud to avoid local compute
        if context.thermalState == .serious || context.thermalState == .critical {
            print("[SemanticRouter] Route: cloud (thermal state: \(context.thermalState.rawValue))")
            return .cloud
        }

        // Query complexity analysis
        let complexity = analyzeComplexity(query: query)

        if complexity == .simple {
            print("[SemanticRouter] Route: local (simple query)")
            return .local
        } else {
            print("[SemanticRouter] Route: cloud (complex query)")
            return .cloud
        }
    }

    // MARK: - Query Analysis

    /// Query complexity classification
    private enum QueryComplexity {
        case simple
        case complex
    }

    /// Analyze query complexity using keyword heuristics.
    ///
    /// Simple queries: short, status-checking, factual
    /// Complex queries: analysis, multi-step reasoning, optimization advice
    private func analyzeComplexity(query: String) -> QueryComplexity {
        let lowered = query.lowercased()
        let wordCount = query.split(separator: " ").count

        // Short queries with local patterns -> simple
        if wordCount <= simpleQueryMaxWords {
            for pattern in localPatterns {
                if lowered.contains(pattern) {
                    return .simple
                }
            }
        }

        // Check for cloud patterns
        for pattern in cloudPatterns {
            if lowered.contains(pattern) {
                return .complex
            }
        }

        // Default: cloud for auto mode (until local model quality proven)
        return .complex
    }

    // MARK: - Initialization

    private init() {
        print("[SemanticRouter] Initialized (\(localPatterns.count) local patterns, \(cloudPatterns.count) cloud patterns)")
    }
}
