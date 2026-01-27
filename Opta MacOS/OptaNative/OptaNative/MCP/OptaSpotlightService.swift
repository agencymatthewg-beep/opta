//
//  OptaSpotlightService.swift
//  OptaNative
//
//  Spotlight integration for Opta optimizations.
//  Allows users to trigger optimizations via Spotlight search.
//
//  Created for Opta Native macOS - MCP Quick Win 1
//

import Foundation
import CoreSpotlight
import CoreServices

// MARK: - Spotlight Optimization Item

struct SpotlightOptimizationItem: Identifiable {
    let id: String
    let title: String
    let description: String
    let category: OptimizationCategory
    let keywords: [String]
    let action: () async throws -> Void
}

// MARK: - Spotlight Service

actor OptaSpotlightService {

    // MARK: - Properties

    private let defaultsOptimizer = DefaultsOptimizerService()
    private let powerService = PowerService()
    private var isIndexed = false

    // MARK: - Indexable Items

    private var spotlightItems: [SpotlightOptimizationItem] {
        [
            // Dock Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.dock",
                title: "Optimize Dock Speed",
                description: "Remove Dock auto-hide delay and speed up animations",
                category: .dock,
                keywords: ["dock", "speed", "fast", "animation", "autohide", "optimize"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyCategory(.dock) }
            ),

            // Finder Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.finder",
                title: "Optimize Finder",
                description: "Show hidden files, extensions, and enable quit menu",
                category: .finder,
                keywords: ["finder", "hidden", "files", "extensions", "optimize"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyCategory(.finder) }
            ),

            // Screenshot Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.screenshots",
                title: "Optimize Screenshots",
                description: "Remove window shadows from screenshots",
                category: .screenshots,
                keywords: ["screenshot", "capture", "shadow", "clean", "optimize"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyCategory(.screenshots) }
            ),

            // Animation Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.animations",
                title: "Reduce Animations",
                description: "Speed up window resizing and reduce motion effects",
                category: .animations,
                keywords: ["animation", "motion", "speed", "fast", "reduce", "optimize"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyCategory(.animations) }
            ),

            // Keyboard Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.keyboard",
                title: "Optimize Keyboard",
                description: "Faster key repeat rate and shorter delay",
                category: .keyboard,
                keywords: ["keyboard", "typing", "repeat", "fast", "optimize"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyCategory(.keyboard) }
            ),

            // All Optimizations
            SpotlightOptimizationItem(
                id: "opta.optimize.all",
                title: "Apply All Optimizations",
                description: "Apply all Opta macOS optimizations for maximum performance",
                category: .dock, // Primary category
                keywords: ["all", "everything", "full", "maximum", "optimize", "performance"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.applyAll() }
            ),

            // Power Profiles
            SpotlightOptimizationItem(
                id: "opta.profile.gaming",
                title: "Gaming Mode",
                description: "Enable gaming power profile for sustained performance",
                category: .animations,
                keywords: ["gaming", "game", "performance", "mode", "profile"],
                action: { [powerService] in await powerService.setProfile(.gaming) }
            ),

            SpotlightOptimizationItem(
                id: "opta.profile.balanced",
                title: "Balanced Mode",
                description: "Switch to balanced power profile",
                category: .animations,
                keywords: ["balanced", "normal", "default", "mode", "profile"],
                action: { [powerService] in await powerService.setProfile(.balanced) }
            ),

            SpotlightOptimizationItem(
                id: "opta.profile.powersaver",
                title: "Power Saver Mode",
                description: "Enable power saving profile for battery life",
                category: .animations,
                keywords: ["power", "saver", "battery", "save", "mode", "profile"],
                action: { [powerService] in await powerService.setProfile(.powerSaver) }
            ),

            // Revert
            SpotlightOptimizationItem(
                id: "opta.revert.all",
                title: "Revert All Optimizations",
                description: "Restore all macOS settings to defaults",
                category: .dock,
                keywords: ["revert", "restore", "default", "undo", "reset"],
                action: { [defaultsOptimizer] in try await defaultsOptimizer.revertAll() }
            )
        ]
    }

    // MARK: - Indexing

    /// Index all Opta optimizations in Spotlight
    func indexOptimizations() async {
        guard !isIndexed else { return }

        var searchableItems: [CSSearchableItem] = []

        for item in spotlightItems {
            let attributeSet = CSSearchableItemAttributeSet(contentType: .item)
            attributeSet.title = item.title
            attributeSet.contentDescription = item.description
            attributeSet.keywords = item.keywords

            // Custom attributes
            attributeSet.creator = "Opta"
            attributeSet.information = "macOS Optimization"

            let searchableItem = CSSearchableItem(
                uniqueIdentifier: item.id,
                domainIdentifier: "com.opta.native.optimizations",
                attributeSet: attributeSet
            )

            // Keep items indefinitely
            searchableItem.expirationDate = .distantFuture

            searchableItems.append(searchableItem)
        }

        do {
            try await CSSearchableIndex.default().indexSearchableItems(searchableItems)
            isIndexed = true
            print("OptaSpotlight: Indexed \(searchableItems.count) optimization items")
        } catch {
            print("OptaSpotlight: Failed to index items: \(error)")
        }
    }

    /// Remove all Opta items from Spotlight index
    func removeFromIndex() async {
        do {
            try await CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: ["com.opta.native.optimizations"])
            isIndexed = false
            print("OptaSpotlight: Removed all items from index")
        } catch {
            print("OptaSpotlight: Failed to remove items: \(error)")
        }
    }

    // MARK: - Handle Selection

    /// Handle when user selects an Opta item from Spotlight
    func handleSpotlightSelection(identifier: String) async -> Bool {
        guard let item = spotlightItems.first(where: { $0.id == identifier }) else {
            print("OptaSpotlight: Unknown item selected: \(identifier)")
            return false
        }

        do {
            try await item.action()
            print("OptaSpotlight: Executed '\(item.title)'")
            return true
        } catch {
            print("OptaSpotlight: Failed to execute '\(item.title)': \(error)")
            return false
        }
    }

    /// Get item by identifier
    func getItem(identifier: String) -> SpotlightOptimizationItem? {
        return spotlightItems.first { $0.id == identifier }
    }
}

// MARK: - App Delegate Extension for Spotlight

extension Notification.Name {
    static let spotlightOptimizationSelected = Notification.Name("OptaSpotlightOptimizationSelected")
}
