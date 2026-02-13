//
//  ContentView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .chat
    @AppStorage("optaplus.onboardingDone") private var onboardingDone = false

    enum Tab {
        case chat, settings
    }

    var body: some View {
        if !onboardingDone && appState.bots.isEmpty {
            OnboardingView()
                .environmentObject(appState)
        } else {
            TabView(selection: $selectedTab) {
                ChatTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Chat", systemImage: selectedTab == .chat ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                    }
                    .tag(Tab.chat)

                SettingsView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Settings", systemImage: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                    }
                    .tag(Tab.settings)
            }
            .tint(.optaPrimary)
        }
    }
}

// MARK: - Chat Tab (Split on iPad, Stack on iPhone)

struct ChatTab: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic
    @State private var showSettings = false

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            BotListView()
                .environmentObject(appState)
        } detail: {
            if let bot = appState.selectedBot {
                let vm = appState.viewModel(for: bot)
                ChatView(viewModel: vm, botConfig: bot)
            } else {
                emptyState
            }
        }
        .navigationSplitViewStyle(.balanced)
        .onAppear {
            if sizeClass == .regular {
                columnVisibility = .all
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)
            Text("Select a bot to start chatting")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.optaVoid)
    }
}
