//
//  ClawdbotDesktopApp.swift
//  ClawdbotDesktop
//
//  Clawdbot macOS app - Voice-activated coding assistant
//
//  Created by Matthew Byrden
//

import SwiftUI
import ClawdbotKit

@main
struct ClawdbotDesktopApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowResizability(.contentSize)
        .defaultSize(width: 500, height: 700)
    }
}
