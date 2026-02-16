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
        case dashboard, web, chat, automations, debug
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

                BotWebView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Web", systemImage: selectedTab == .web ? "globe.americas.fill" : "globe.americas")
                    }
                    .tag(Tab.web)

                ChatPagerTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Chat", systemImage: selectedTab == .chat ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                    }
                    .tag(Tab.chat)

                AutomationsPagerTab()
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

// MARK: - Chat Pager Tab (Swipeable per-bot pages)

struct ChatPagerTab: View {
    @EnvironmentObject var appState: AppState
    @State private var showSettings = false
    @State private var showBotConfig = false
    @State private var showHistory = false

    var body: some View {
        NavigationStack {
            BotPagerView { bot in
                let vm = appState.viewModel(for: bot)
                VStack(spacing: 0) {
                    BotPageHeader(bot: bot, viewModel: vm)
                    ChatView(viewModel: vm, botConfig: bot)
                }
            }
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        Button {
                            showHistory = true
                        } label: {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Chat history")
                        Button {
                            showBotConfig = true
                        } label: {
                            Image(systemName: "slider.horizontal.3")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Bot configuration")
                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Settings")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
            .sheet(isPresented: $showBotConfig) {
                if let bot = appState.selectedBot {
                    BotManagementSheet(viewModel: appState.viewModel(for: bot))
                }
            }
            .sheet(isPresented: $showHistory) {
                ChatHistoryView()
                    .environmentObject(appState)
            }
        }
    }
}

// MARK: - Automations Pager Tab (Swipeable per-bot pages)

struct AutomationsPagerTab: View {
    @EnvironmentObject var appState: AppState
    @State private var showCreateSheet = false

    var body: some View {
        NavigationStack {
            BotPagerView { bot in
                let vm = appState.viewModel(for: bot)
                VStack(spacing: 0) {
                    BotPageHeader(bot: bot, viewModel: vm, compact: true)
                    BotAutomationsPage(bot: bot, viewModel: vm)
                }
            }
            .navigationTitle("Automations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.optaPrimary)
                    }
                    .accessibilityLabel("Create automation")
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                if let bot = appState.selectedBot {
                    let vm = appState.viewModel(for: bot)
                    CreateJobSheet(
                        viewModel: vm,
                        botConfig: bot,
                        existingJob: nil,
                        onSaved: {}
                    )
                }
            }
        }
    }
}
