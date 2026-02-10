//
//  Opta_ScanApp.swift
//  Opta Scan
//
//  Main application entry point
//  Local-only AI - all processing on device
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

    /// Tracks whether user has been prompted for first-run model download
    @AppStorage("opta.hasCompletedFirstRun") private var hasCompletedFirstRun = false

    /// Controls display of first-run download sheet
    @State private var showFirstRunDownload = false

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            rootView
                .preferredColorScheme(.dark) // Opta is always dark mode
                .task {
                    // Initialize local model on app launch if previously downloaded
                    await Self.initializeLocalModel()
                }
                .onAppear {
                    // Check if model download needed after onboarding
                    checkFirstRunDownload()
                }
                .sheet(isPresented: $showFirstRunDownload, onDismiss: {
                    // Mark as completed even if skipped
                    hasCompletedFirstRun = true
                }) {
                    FirstRunDownloadSheet()
                }
        }
    }

    // MARK: - First-Run Check

    private func checkFirstRunDownload() {
        // Only prompt after onboarding is complete
        guard hasCompletedOnboarding && !hasCompletedFirstRun else { return }

        // Check if any model is already downloaded
        let hasModel = OptaModelConfiguration.all.contains { model in
            ModelDownloadManager.shared.isModelDownloaded(model)
        }

        if !hasModel {
            showFirstRunDownload = true
        } else {
            hasCompletedFirstRun = true
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

    // MARK: - Model Initialization

    /// Check for downloaded model and load if available
    private static func initializeLocalModel() async {
        // Check if model was previously downloaded (stored in UserDefaults for quick access)
        guard let modelId = UserDefaults.standard.string(forKey: "opta.downloadedModelId"),
              let config = OptaModelConfiguration.all.first(where: { $0.id == modelId }) else {
            // No model downloaded yet - user will download in Settings
            return
        }

        do {
            try await LLMServiceManager.shared.loadModel(config)
            print("[Opta] Local model loaded: \(config.displayName)")
        } catch {
            // Model loading failed - user may need to re-download
            print("[Opta] Failed to load model: \(error.localizedDescription)")
        }
    }
}
