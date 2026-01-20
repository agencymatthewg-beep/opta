//
//  Opta_ScanApp.swift
//  Opta Scan
//
//  Main application entry point
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - App Entry Point

/// Main application entry point for Opta Scan
@main
struct Opta_ScanApp: App {

    // MARK: - Properties

    /// Shared persistence controller for Core Data
    private let persistenceController = PersistenceController.shared

    /// Tracks whether user has completed first-time onboarding
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            rootView
                .preferredColorScheme(.dark) // Opta is always dark mode
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var rootView: some View {
        if hasCompletedOnboarding {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        } else {
            OnboardingView(hasCompletedOnboarding: $hasCompletedOnboarding)
        }
    }
}
