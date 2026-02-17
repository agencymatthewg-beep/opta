//
//  ContentView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .map
    @AppStorage("optaplus.onboardingDone") private var onboardingDone = false

    enum Tab: String {
        case map, chat, automations, settings
    }

    var body: some View {
        if !onboardingDone && appState.bots.isEmpty {
            OnboardingView()
                .environmentObject(appState)
        } else {
            TabView(selection: $selectedTab) {
                BotMapView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Map", systemImage: selectedTab == .map ? "circle.hexagongrid.fill" : "circle.hexagongrid")
                    }
                    .tag(Tab.map)
                    .accessibilityLabel("Bot Map")
                    .accessibilityHint("View paired bots in constellation layout")

                ChatPagerTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Chat", systemImage: selectedTab == .chat ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                    }
                    .tag(Tab.chat)
                    .accessibilityLabel("Chat")
                    .accessibilityHint("Chat with your bots")

                AutomationsPagerTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Automations", systemImage: selectedTab == .automations ? "bolt.circle.fill" : "bolt.circle")
                    }
                    .tag(Tab.automations)
                    .accessibilityLabel("Automations")
                    .accessibilityHint("Manage cron jobs and scheduled tasks")

                SettingsView(isModal: false)
                    .environmentObject(appState)
                    .tabItem {
                        Label("Settings", systemImage: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                    }
                    .tag(Tab.settings)
                    .accessibilityLabel("Settings")
                    .accessibilityHint("Configure bots, appearance, and preferences")
            }
            .tint(.optaPrimary)
            .onChange(of: selectedTab) { _, _ in
                HapticManager.shared.selection()
            }
        }
    }
}

// MARK: - Chat Pager Tab (Swipeable per-bot pages)

struct ChatPagerTab: View {
    @EnvironmentObject var appState: AppState
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
                        .accessibilityHint("View past chat sessions")
                        Button {
                            showBotConfig = true
                        } label: {
                            Image(systemName: "slider.horizontal.3")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Bot configuration")
                        .accessibilityHint("Manage model, thinking level, and gateway settings")
                    }
                }
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
                    .accessibilityHint("Opens a form to create a new cron job")
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
