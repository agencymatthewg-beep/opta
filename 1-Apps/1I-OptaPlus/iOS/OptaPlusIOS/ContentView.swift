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

    enum Tab {
        case chat, settings
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ChatTab()
                .environmentObject(appState)
                .tabItem {
                    Label("Chat", systemImage: "bubble.left.and.bubble.right.fill")
                }
                .tag(Tab.chat)

            SettingsView()
                .environmentObject(appState)
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(Tab.settings)
        }
        .tint(.optaPrimary)
    }
}

// MARK: - Chat Tab (Split on iPad, Stack on iPhone)

struct ChatTab: View {
    @EnvironmentObject var appState: AppState
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

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
