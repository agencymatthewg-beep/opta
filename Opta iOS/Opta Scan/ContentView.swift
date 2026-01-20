//
//  ContentView.swift
//  Opta Scan
//
//  Main container with custom tab navigation
//  Created by Matthew Byrden
//

import SwiftUI

struct ContentView: View {
    @State private var selectedTab: OptaTab = .capture

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background
            Color.optaBackground
                .ignoresSafeArea()

            // Tab content
            Group {
                switch selectedTab {
                case .capture:
                    CaptureView()
                case .history:
                    HistoryView()
                case .settings:
                    SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Add bottom padding to avoid tab bar overlap
            .padding(.bottom, 80)

            // Custom tab bar
            OptaTabBar(selectedTab: $selectedTab)
        }
    }
}

#Preview {
    ContentView()
}
