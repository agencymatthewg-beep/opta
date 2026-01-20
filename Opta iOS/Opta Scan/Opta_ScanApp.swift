//
//  Opta_ScanApp.swift
//  Opta Scan
//
//  Created by Matthew Byrden
//

import SwiftUI

@main
struct Opta_ScanApp: App {

    let persistenceController = PersistenceController.shared
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                ContentView()
                    .preferredColorScheme(.dark) // Opta is always dark mode
                    .environment(\.managedObjectContext, persistenceController.container.viewContext)
            } else {
                OnboardingView(hasCompletedOnboarding: $hasCompletedOnboarding)
                    .preferredColorScheme(.dark)
            }
        }
    }
}
