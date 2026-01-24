//
//  OptaAppApp.swift
//  OptaApp
//
//  Main SwiftUI application entry point
//

import SwiftUI
import Charts

@main
struct OptaAppApp: App {

    // MARK: - State

    /// Shared render coordinator for Metal/wgpu rendering
    @StateObject private var renderCoordinator = RenderCoordinator()

    /// Core manager for Crux state management (created at app level for sharing)
    @State private var coreManager = OptaCoreManager()

    /// Agent mode manager for minimize-to-menu-bar functionality
    @State private var agentModeManager = AgentModeManager.shared

    /// Application delegate for additional setup
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    /// App Storage for menu bar visibility
    @AppStorage("showMenuBarIcon") private var showMenuBarIcon = true

    /// Selected game for detail view (loaded from cache when navigating)
    @State private var selectedGame: Game?

    /// Command palette view model for Cmd+K quick actions
    @State private var commandPalette = CommandPaletteViewModel()

    // MARK: - Body

    var body: some Scene {
        // Main Window
        WindowGroup(id: "main") {
            ZStack {
                mainContentView

                if commandPalette.isPresented {
                    CommandPaletteView(viewModel: commandPalette)
                        .transition(.opacity)
                }

                if GamificationManager.shared.showUnlockOverlay {
                    AchievementUnlockOverlay()
                        .transition(.opacity)
                }
            }
            .withColorTemperature()
            .frame(minWidth: 800, minHeight: 600)
            .preferredColorScheme(.dark)
            .environment(\.optaCoreManager, coreManager)
            .environment(\.agentModeManager, agentModeManager)
            .task {
                commandPalette.registerDefaults(
                    navigate: { page in coreManager.navigate(to: page) },
                    post: { name in NotificationCenter.default.post(name: name, object: nil) },
                    setQuality: { level in renderCoordinator.qualityLevel = level },
                    togglePause: { renderCoordinator.isPaused.toggle() },
                    toggleAgent: { agentModeManager.toggleShowHideWindow() }
                )
                GamificationManager.shared.recordDailyActivity()
            }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 800)
        .commands {
            // Custom Commands
            CommandGroup(after: .appInfo) {
                Button("Toggle FPS Overlay") {
                    NotificationCenter.default.post(
                        name: .toggleFPSOverlay,
                        object: nil
                    )
                }
                .keyboardShortcut("F", modifiers: [.command, .shift])
            }

            CommandGroup(after: .sidebar) {
                Divider()

                Menu("Quality") {
                    Button("Low") {
                        renderCoordinator.qualityLevel = .low
                    }
                    Button("Medium") {
                        renderCoordinator.qualityLevel = .medium
                    }
                    Button("High") {
                        renderCoordinator.qualityLevel = .high
                    }
                    Button("Ultra") {
                        renderCoordinator.qualityLevel = .ultra
                    }
                    Button("Adaptive") {
                        renderCoordinator.qualityLevel = .adaptive
                    }
                }
            }

            CommandGroup(after: .textEditing) {
                Button("Command Palette") {
                    commandPalette.toggle()
                }
                .keyboardShortcut("k", modifiers: [.command])
            }

            // Custom keyboard shortcuts
            CommandGroup(replacing: .newItem) {
                Button("Open Main Window") {
                    NSApp.sendAction(#selector(AppDelegate.openMainWindow), to: nil, from: nil)
                }
                .keyboardShortcut("O", modifiers: [.command, .shift])

                Button("Quick Optimize") {
                    NotificationCenter.default.post(name: .performQuickOptimize, object: nil)
                }
                .keyboardShortcut("P", modifiers: [.command, .shift])

                Divider()

                Button("Pause Rendering") {
                    renderCoordinator.isPaused.toggle()
                }
                .keyboardShortcut(".", modifiers: [.command])

                Button("Check for Updates") {
                    NSApp.sendAction(#selector(AppDelegate.checkForUpdates), to: nil, from: nil)
                }
                .keyboardShortcut("U", modifiers: [.command])

                Divider()

                Button("Toggle Agent Mode") {
                    agentModeManager.toggleShowHideWindow()
                }
                .keyboardShortcut("H", modifiers: [.command, .shift])
            }
        }

        // Settings Window
        WindowGroup(id: "settings") {
            SettingsWindowView()
                .preferredColorScheme(.dark)
        }
        .windowStyle(.automatic)
        .windowResizability(.contentSize)
        .defaultSize(width: 450, height: 500)

        // Menu Bar Extra (macOS 13+)
        MenuBarExtra(isInserted: $showMenuBarIcon) {
            MenuBarPopoverView(
                coordinator: renderCoordinator,
                agentModeManager: agentModeManager
            )
        } label: {
            MenuBarIcon(
                coordinator: renderCoordinator,
                agentModeManager: agentModeManager
            )
        }
        .menuBarExtraStyle(.window)
    }

    // MARK: - Main Content View

    /// Page-based navigation driven by coreManager.viewModel.currentPage
    @ViewBuilder
    private var mainContentView: some View {
        NavigationStack {
            ZStack {
                // Background
                Color(hex: "09090B")
                    .ignoresSafeArea()

                // Page content based on current navigation state
                switch coreManager.viewModel.currentPage {
                case .dashboard:
                    DashboardView(
                        coreManager: coreManager,
                        renderCoordinator: renderCoordinator
                    )

                case .settings:
                    SettingsView()

                case .games:
                    GamesLibraryView()

                case .gameDetail:
                    if let binding = Binding<Game>($selectedGame) {
                        GameDetailView(game: binding)
                    } else {
                        // Loading state while fetching game from cache
                        gameDetailLoadingView
                    }

                case .optimize:
                    OptimizeView(coreManager: coreManager)

                case .processes:
                    ProcessesView(coreManager: coreManager)

                case .chess:
                    placeholderView(
                        title: "Chess",
                        subtitle: "Coming in Phase 75",
                        icon: "crown"
                    )

                case .aiChat:
                    AiChatView()

                case .score:
                    ScoreDetailView(coreManager: coreManager)

                case .gamification:
                    GamificationDashboard(coreManager: coreManager)
                }
            }
            .onChange(of: coreManager.viewModel.selectedGameId) { _, newGameId in
                // Load game from cache when navigating to game detail
                Task {
                    if let gameId = newGameId, let uuid = UUID(uuidString: gameId) {
                        selectedGame = await GameDetectionService.shared.getGame(id: uuid)
                    } else {
                        selectedGame = nil
                    }
                }
            }
            .onChange(of: coreManager.viewModel.currentPage) { _, newPage in
                // Clear selected game when leaving game detail
                if newPage != .gameDetail {
                    selectedGame = nil
                }
            }
        }
    }

    /// Loading view for game detail when fetching from cache
    private var gameDetailLoadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)

            Text("Loading game...")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .task {
            // Load game from cache when showing detail view
            if let gameId = coreManager.viewModel.selectedGameId, let uuid = UUID(uuidString: gameId) {
                selectedGame = await GameDetectionService.shared.getGame(id: uuid)
            }
        }
    }

    /// Placeholder view for pages not yet implemented
    private func placeholderView(title: String, subtitle: String, icon: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.3))

            Text(title)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)

            Text(subtitle)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.5))

            // Back to dashboard button
            Button {
                coreManager.navigate(to: .dashboard)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.left")
                    Text("Back to Dashboard")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.white.opacity(0.1))
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("[OptaApp] Application launched")

        // Configure for high performance
        configureForPerformance()
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("[OptaApp] Application terminating")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Return false to keep running in menu bar when windows are closed
        return false
    }

    private func configureForPerformance() {
        // Request high performance GPU on multi-GPU systems
        if let registrationName = Bundle.main.bundleIdentifier {
            // This hint tells macOS we want the high-performance GPU
            UserDefaults.standard.register(defaults: [
                "NSHighResolutionCapable": true
            ])
        }
    }

    // MARK: - Actions

    @objc func openMainWindow() {
        // Bring main window to front or create if needed
        if let window = NSApp.windows.first(where: { $0.identifier?.rawValue == "main" }) {
            window.makeKeyAndOrderFront(nil)
        } else {
            // Post notification to open window via SwiftUI
            NotificationCenter.default.post(name: .openMainWindow, object: nil)
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func checkForUpdates() {
        print("[OptaApp] Checking for updates...")
        // In a real implementation, this would integrate with Sparkle or similar
        NotificationCenter.default.post(name: .checkForUpdates, object: nil)
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let toggleFPSOverlay = Notification.Name("toggleFPSOverlay")
    static let openMainWindow = Notification.Name("openMainWindow")
    static let checkForUpdates = Notification.Name("checkForUpdates")
}
