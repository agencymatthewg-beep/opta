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

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark) // Opta is always dark mode
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
