//
//  ContentView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .dashboard
    @AppStorage("optaplus.onboardingDone") private var onboardingDone = false

    enum Tab: String {
        case dashboard, history, chat, automations, debug
    }

    var body: some View {
        if !onboardingDone && appState.bots.isEmpty {
            OnboardingView()
                .environmentObject(appState)
        } else {
            TabView(selection: $selectedTab) {
                DashboardView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Dashboard", systemImage: selectedTab == .dashboard ? "square.grid.2x2.fill" : "square.grid.2x2")
                    }
                    .tag(Tab.dashboard)

                ChatHistoryView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("History", systemImage: selectedTab == .history ? "clock.arrow.circlepath" : "clock.arrow.circlepath")
                    }
                    .tag(Tab.history)

                ChatTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Chat", systemImage: selectedTab == .chat ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                    }
                    .tag(Tab.chat)

                AutomationsView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Automations", systemImage: selectedTab == .automations ? "bolt.circle.fill" : "bolt.circle")
                    }
                    .tag(Tab.automations)

                DebugView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Debug", systemImage: selectedTab == .debug ? "ant.fill" : "ant")
                    }
                    .tag(Tab.debug)
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
