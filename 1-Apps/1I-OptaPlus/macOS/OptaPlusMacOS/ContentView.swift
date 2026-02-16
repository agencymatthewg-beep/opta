//
//  ContentView.swift
//  OptaPlusMacOS
//
//  Main content view: navigation sidebar (bot list) + chat area + session drawer.
//  Cinematic Void design — deep black, glass surfaces, electric violet accents.
//

import SwiftUI
import UniformTypeIdentifiers
import OptaPlus
import OptaMolt

// MARK: - Drop Type

enum DropType {
    case file, text, url

    var icon: String {
        switch self {
        case .file: return "arrow.down.doc"
        case .text: return "text.bubble"
        case .url: return "link"
        }
    }

    var label: String {
        switch self {
        case .file: return "Drop files to attach"
        case .text: return "Drop text as message"
        case .url: return "Drop URL to send"
        }
    }
}

// MARK: - Detail Mode

enum DetailMode: Equatable {
    case chat, dashboard, automations, botWeb, debug
}

// MARK: - Content View

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @EnvironmentObject var animPrefs: AnimationPreferences

    @State private var showCommandPalette = false
    @State private var showKeyboardShortcuts = false
    @State private var showMessageSearch = false
    @State private var botSwitchOverlay: String? = nil
    @State private var detailMode: DetailMode = .chat
    
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Custom drag handle for hidden title bar
                WindowDragHandle()
                
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    switch detailMode {
                    case .dashboard:
                        DashboardView()
                            .environmentObject(appState)
                            .environmentObject(windowState)
                    case .automations:
                        if let bot = windowState.selectedBot(in: appState) {
                            AutomationsView(bot: bot, viewModel: appState.viewModel(for: bot))
                                .environmentObject(appState)
                        } else {
                            AutomationsView(bot: nil, viewModel: nil)
                                .environmentObject(appState)
                        }
                    case .botWeb:
                        BotWebView()
                            .environmentObject(appState)
                            .environmentObject(windowState)
                    case .debug:
                        if let bot = windowState.selectedBot(in: appState) {
                            DebugView(bot: bot, viewModel: appState.viewModel(for: bot))
                                .environmentObject(appState)
                        } else {
                            DebugView(bot: nil, viewModel: nil)
                                .environmentObject(appState)
                        }
                    case .chat:
                        if let bot = windowState.selectedBot(in: appState) {
                            let vm = appState.viewModel(for: bot)
                            ZStack {
                                AmbientBackground(
                                    botAccentColor: botAccentColor(for: bot),
                                    botState: ambientState(from: vm.botState),
                                    isConnected: vm.connectionState == .connected
                                )
                                ChatContainerView(viewModel: vm, showMessageSearch: $showMessageSearch)
                            }
                        } else {
                            ZStack {
                                AmbientBackground(
                                    botAccentColor: .optaPrimary,
                                    botState: .idle,
                                    isConnected: false
                                )
                                EmptyStateView()
                            }
                        }
                    }
                }
                .background(Color.optaVoid)
                .navigationSplitViewStyle(.balanced)
            }

            // Command Palette overlay
            if showCommandPalette {
                CommandPaletteView(
                    isPresented: $showCommandPalette,
                    onSearchMessages: { showMessageSearch = true },
                    onToggleSessions: {
                        if let vm = windowState.selectedViewModel(in: appState) {
                            withAnimation(.optaSpring) {
                                vm.isSessionDrawerOpen.toggle()
                            }
                        }
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
                .zIndex(100)
            }

            // Keyboard Shortcuts overlay
            if showKeyboardShortcuts {
                KeyboardShortcutsView(isPresented: $showKeyboardShortcuts)
                    .zIndex(101)
            }

            // Bot Switch HUD overlay
            if let botName = botSwitchOverlay {
                BotSwitchHUD(botName: botName)
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                    .zIndex(102)
            }
        }
        .animation(.optaSnap, value: showCommandPalette)
        .animation(.optaSnap, value: showKeyboardShortcuts)
        .animation(.optaSpring, value: botSwitchOverlay != nil)
        .background {
            // Hidden buttons for keyboard shortcuts
            Group {
                Button("") { showCommandPalette.toggle() }
                    .keyboardShortcut("p", modifiers: .command)
                Button("") { showMessageSearch.toggle() }
                    .keyboardShortcut("f", modifiers: .command)
                Button("") { showKeyboardShortcuts.toggle() }
                    .keyboardShortcut("/", modifiers: .command)
                Button("") { detailMode = detailMode == .dashboard ? .chat : .dashboard }
                    .keyboardShortcut("d", modifiers: .command)
                Button("") { detailMode = detailMode == .automations ? .chat : .automations }
                    .keyboardShortcut("j", modifiers: .command)
                Button("") { detailMode = detailMode == .botWeb ? .chat : .botWeb }
                    .keyboardShortcut("b", modifiers: [.command, .shift])
                Button("") { detailMode = detailMode == .debug ? .chat : .debug }
                    .keyboardShortcut("g", modifiers: [.command, .shift])
            }
            .frame(width: 0, height: 0)
            .opacity(0)
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleDashboard)) { _ in
            detailMode = detailMode == .dashboard ? .chat : .dashboard
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleAutomations)) { _ in
            detailMode = detailMode == .automations ? .chat : .automations
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleBotWeb)) { _ in
            detailMode = detailMode == .botWeb ? .chat : .botWeb
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleDebug)) { _ in
            detailMode = detailMode == .debug ? .chat : .debug
        }
        .onReceive(NotificationCenter.default.publisher(for: .switchToChat)) { _ in
            detailMode = .chat
        }
        .onChange(of: windowState.selectedBotId) { oldId, newId in
            guard let newId, oldId != nil, oldId != newId,
                  let bot = appState.bots.first(where: { $0.id == newId }) else { return }
            detailMode = .chat
            showBotSwitchHUD(bot.emoji + " " + bot.name)
        }
    }

    private func showBotSwitchHUD(_ name: String) {
        botSwitchOverlay = name
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.optaSpring) {
                botSwitchOverlay = nil
            }
        }
    }
}

// MARK: - Bot Switch HUD

struct BotSwitchHUD: View {
    let botName: String

    var body: some View {
        VStack {
            Spacer()
            Text(botName)
                .font(.sora(18, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.ultraThinMaterial)
                        .shadow(color: Color.optaPrimary.opacity(0.2), radius: 16, y: 4)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.optaPrimary.opacity(0.2), lineWidth: 1)
                )
            Spacer().frame(height: 80)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Window Drag Handle

/// Invisible drag area at the top of the window for hidden title bar.
/// Drag handle animates opacity based on mouse proximity.
struct WindowDragHandle: View {
    @State private var isHovered = false

    var body: some View {
        Color.clear
            .frame(height: 28)
            .background(
                LinearGradient(
                    colors: [Color.optaPrimary.opacity(0.02), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(alignment: .center) {
                Capsule()
                    .fill(Color.optaTextMuted.opacity(isHovered ? 0.4 : 0.15))
                    .frame(width: 36, height: 4)
                    .animation(.optaSnap, value: isHovered)
            }
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @State private var showingAddBot = false
    @State private var searchText = ""
    
    private var filteredBots: [BotConfig] {
        if searchText.isEmpty { return appState.bots }
        return appState.bots.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search field
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
                TextField("Filter bots…", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.sora(12))
                    .foregroundColor(.optaTextPrimary)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.optaElevated.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)
            
            List(selection: Binding(
                get: { windowState.selectedBotId },
                set: { id in
                    if let id = id, let bot = appState.bots.first(where: { $0.id == id }) {
                        windowState.selectBot(bot, in: appState)
                    }
                }
            )) {
                Section {
                    ForEach(filteredBots) { bot in
                        BotRow(bot: bot, viewModel: appState.viewModel(for: bot))
                            .tag(bot.id)
                    }
                } header: {
                    HStack {
                        Text("BOTS")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                        
                        Spacer()
                        
                        Button(action: { showingAddBot = true }) {
                            Image(systemName: "plus.circle")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add bot")
                        .accessibilityHint("Opens the add bot dialog")
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(
            LinearGradient(
                colors: [Color.optaVoid, Color.optaVoid.opacity(0.95), Color.optaElevated.opacity(0.3)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .safeAreaInset(edge: .bottom) {
            Text("OPTA+")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(.optaTextMuted.opacity(0.3))
                .frame(maxWidth: .infinity)
                .padding(.bottom, 8)
        }
        .sheet(isPresented: $showingAddBot) {
            AddBotSheet()
                .environmentObject(appState)
        }
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button(action: {
                    NotificationCenter.default.post(name: .toggleDashboard, object: nil)
                }) {
                    Image(systemName: "square.grid.2x2")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Dashboard")
                .help("Dashboard (⌘D)")
            }
            ToolbarItem(placement: .automatic) {
                Button(action: {
                    NotificationCenter.default.post(name: .toggleAutomations, object: nil)
                }) {
                    Image(systemName: "bolt.circle")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Automations")
                .help("Automations (⌘J)")
            }
            ToolbarItem(placement: .automatic) {
                Button(action: {
                    NotificationCenter.default.post(name: .toggleBotWeb, object: nil)
                }) {
                    Image(systemName: "globe.americas")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Bot Web")
                .help("Bot Web (⌘⇧B)")
            }
            ToolbarItem(placement: .automatic) {
                Button(action: {
                    NotificationCenter.default.post(name: .toggleDebug, object: nil)
                }) {
                    Image(systemName: "ant")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Debug")
                .help("Debug (⌘⇧G)")
            }
            ToolbarItem(placement: .automatic) {
                Button(action: { appState.showingSettings = true }) {
                    Image(systemName: "gear")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Settings")
            }
        }
    }
}

extension Notification.Name {
    static let toggleDashboard = Notification.Name("toggleDashboard")
    static let toggleAutomations = Notification.Name("toggleAutomations")
    static let toggleBotWeb = Notification.Name("toggleBotWeb")
    static let toggleDebug = Notification.Name("toggleDebug")
}

// MARK: - Bot Row

struct BotRow: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    @State private var isHovered = false
    @State private var breatheScale: CGFloat = 1.0
    @State private var showBotProfile = false
    
    private var accentColor: Color {
        botAccentColor(for: bot)
    }
    
    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaTextMuted
        }
    }
    
    private var isConnected: Bool {
        viewModel.connectionState == .connected
    }
    
    var body: some View {
        HStack(spacing: 10) {
            // Styled bot avatar circle with glow
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                
                Text(bot.emoji)
                    .font(.system(size: 18))
            }
            .shadow(color: accentColor.opacity(isConnected ? 0.5 : 0.2), radius: isConnected ? 10 : 4)
            .scaleEffect(isConnected ? 1.02 : 1.0)
            .animation(.optaGentle, value: isConnected)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(bot.name)
                    .font(.sora(13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(connectionColor)
                        .frame(width: 6, height: 6)
                        .shadow(color: connectionColor.opacity(0.6), radius: 4)
                    
                    Text(statusText)
                        .font(.sora(10))
                        .foregroundColor(.optaTextMuted)
                }
            }

            Spacer()

            // Session mode badge for active session
            if let session = viewModel.activeSession {
                Image(systemName: session.mode.icon)
                    .font(.system(size: 9))
                    .foregroundColor(accentColor)
                    .opacity(0.7)
            }
            
            if viewModel.botState == .typing || viewModel.botState == .thinking {
                ProgressView()
                    .scaleEffect(0.6)
                    .tint(.optaPrimary)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isHovered ? Color.optaSurface.opacity(0.4) : Color.clear)
                .background(Material.ultraThinMaterial.opacity(isHovered ? 0.3 : 0))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        )
        .overlay(alignment: .leading) {
            // Active bot left accent bar
            if viewModel.connectionState == .connected {
                RoundedRectangle(cornerRadius: 1)
                    .fill(accentColor)
                    .frame(width: 2, height: 24)
                    .shadow(color: accentColor.opacity(0.5), radius: 4)
                    .padding(.leading, -2)
            }
        }
        .onHover { hovering in
            withAnimation(.optaSnap) {
                isHovered = hovering
            }
        }
        .hoverScale(1.02)
        .animation(.optaSpring, value: viewModel.connectionState)
        .animation(.optaSpring, value: viewModel.botState)
        .contextMenu {
            Button { showBotProfile = true } label: {
                Label("Bot Info", systemImage: "info.circle")
            }
        }
        .sheet(isPresented: $showBotProfile) {
            BotProfileSheet(viewModel: viewModel)
        }
    }
    
    private var statusText: String {
        switch viewModel.connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Offline"
        }
    }
}

// MARK: - Bot Accent Color

/// Bridge from OptaMolt's `BotState` to the local `BotActivityState` used by `AmbientBackground`.
@MainActor
func ambientState(from botState: BotState) -> BotActivityState {
    switch botState {
    case .idle: return .idle
    case .thinking: return .thinking
    case .typing: return .typing
    }
}

@MainActor
func botAccentColor(for bot: BotConfig) -> Color {
    let tm = ThemeManager.shared
    if let hex = tm.botAccentOverrides[bot.id] {
        return Color(hex: hex)
    }
    switch bot.name {
    case "Opta Max": return .optaCoral
    case "Opta512": return tm.effectiveAccent
    case "Mono": return .optaGreen
    case "Floda": return .optaAmber
    case "Saturday": return .optaBlue
    case "YJ": return .optaAmber
    default: return tm.effectiveAccent
    }
}

// MARK: - Chat Container

struct ChatContainerView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var viewModel: ChatViewModel
    @Binding var showMessageSearch: Bool
    @State private var inputText = ""
    @State private var pendingAttachments: [ChatAttachment] = []
    @FocusState private var isInputFocused: Bool
    @State private var showContextPanel = false
    @State private var showExportMenu = false
    @State private var isDragTarget = false
    @State private var dragType: DropType = .file
    @State private var isAtBottom = true
    @State private var showNewMessagesPill = false
    @StateObject private var searchEngine = SearchEngine()
    @State private var newMessageCount = 0
    @State private var showConnectionToast = false
    @State private var connectionToastText = ""
    @State private var connectionToastIsSuccess = false
    @State private var previousConnectionState: ConnectionState?
    @State private var scrollToMessageId: String? = nil
    @State private var showSlashPopup = false
    @State private var showTemplatePicker = false
    @State private var inputHistory: InputHistory?
    @StateObject private var mentionAutocomplete = MentionAutocomplete()
    
    // Convert agent events to thinking events for the overlay
    private var thinkingEvents: [ThinkingEvent] {
        viewModel.agentEvents.compactMap { event in
            switch event.stream {
            case "lifecycle":
                if event.phase == "start" {
                    return ThinkingEvent(timestamp: event.timestamp, kind: .started, content: "Processing request")
                } else if event.phase == "end" {
                    return ThinkingEvent(timestamp: event.timestamp, kind: .ended, content: "Complete")
                }
            case "assistant":
                if let delta = event.delta, !delta.isEmpty {
                    return ThinkingEvent(timestamp: event.timestamp, kind: .streaming, content: "Generating: \(String(delta.prefix(40)))…")
                }
            case "tool_call", "tool":
                let name = event.toolName ?? "tool"
                return ThinkingEvent(timestamp: event.timestamp, kind: .toolCall(name: name), content: name)
            case "thinking":
                let text = event.text ?? event.delta ?? ""
                return ThinkingEvent(timestamp: event.timestamp, kind: .thinking(text: text), content: String(text.prefix(60)))
            default:
                break
            }
            return nil
        }
    }
    
    // Parse context files for the panel
    private var contextItems: [ContextItem] {
        // Build from known workspace files (from gateway hello)
        // For now, use common OpenClaw workspace files as defaults
        var items: [ContextItem] = [
            ContextItem(name: "System Prompt", path: "system", kind: .system, sizeHint: nil),
            ContextItem(name: "AGENTS.md", path: "AGENTS.md", kind: .workspace, sizeHint: nil),
            ContextItem(name: "SOUL.md", path: "SOUL.md", kind: .workspace, sizeHint: nil),
            ContextItem(name: "USER.md", path: "USER.md", kind: .workspace, sizeHint: nil),
            ContextItem(name: "TOOLS.md", path: "TOOLS.md", kind: .workspace, sizeHint: nil),
            ContextItem(name: "HEARTBEAT.md", path: "HEARTBEAT.md", kind: .workspace, sizeHint: nil),
            ContextItem(name: "MEMORY.md", path: "MEMORY.md", kind: .memory, sizeHint: "~23KB"),
            ContextItem(name: "IDENTITY.md", path: "IDENTITY.md", kind: .workspace, sizeHint: nil),
        ]
        
        // Add any from gateway hello payload
        for file in viewModel.contextFiles {
            if let name = file["name"] as? String ?? file["path"] as? String {
                let kind: ContextItem.ContextKind = name.contains("memory") ? .memory : .injected
                let size = file["size"] as? Int
                let sizeHint = size.map { formatBytes($0) }
                items.append(ContextItem(name: name, path: name, kind: kind, sizeHint: sizeHint))
            }
        }
        
        return items
    }
    
    var body: some View {
        bodyContent
    }

    // MARK: - Body Content (view + modifiers)

    @ViewBuilder
    private var bodyContent: some View {
        mainLayout
            .onDrop(of: [.fileURL, .image, .pdf, .plainText, .url, .utf8PlainText], isTargeted: $isDragTarget) { providers in
                handleDrop(providers)
                return true
            }
            .animation(.optaSpring, value: isDragTarget)
            .animation(.optaSpring, value: viewModel.isSessionDrawerOpen)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: mentionAutocomplete.isActive)
            .onAppear { handleContainerAppear() }
            .onChange(of: inputText) { _, newText in handleInputTextChange(newText) }
            .onReceive(NotificationCenter.default.publisher(for: .optaPlusFocusInput)) { _ in
                isInputFocused = true
            }
            .onReceive(NotificationCenter.default.publisher(for: .optaPlusNotificationReply)) { notification in
                handleNotificationReply(notification)
            }
            .onChange(of: viewModel.connectionState) { oldState, newState in
                handleConnectionStateChange(from: oldState, to: newState)
            }
            .animation(.optaSnap, value: showMessageSearch)
            .alert("Clear Chat History",
                   isPresented: $viewModel.showClearConfirmation) {
                Button("Clear", role: .destructive) {
                    viewModel.clearChat()
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Clear chat history for \(viewModel.botConfig.name)? This removes local messages only.")
            }
            .onKeyPress(.escape) { handleEscapeKey() }
            .onReceive(NotificationCenter.default.publisher(for: .searchEngineQueryReady)) { _ in
                handleSearchQuery()
            }
            .onChange(of: searchEngine.currentIndex) { _, _ in scrollToCurrentMatch() }
            .onChange(of: searchEngine.results.count) { _, _ in scrollToCurrentMatch() }
            .background { searchKeyboardShortcuts }
    }

    // MARK: - Main Layout

    @ViewBuilder
    private var mainLayout: some View {
        HStack(spacing: 0) {
            chatColumnWithOverlays

            if viewModel.isSessionDrawerOpen {
                Divider()
                    .background(Color.optaBorder)
                SessionDrawerView(viewModel: viewModel)
                    .frame(width: 240)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .background(Color.clear)
        .overlay { dragOverlayView }
    }

    // MARK: - Chat Column with Floating Overlays

    @ViewBuilder
    private var chatColumnWithOverlays: some View {
        ZStack(alignment: .topTrailing) {
            chatColumnView
            chatFloatingOverlays
        }
    }

    // MARK: - Chat Column View

    @ViewBuilder
    private var chatColumnView: some View {
        VStack(spacing: 0) {
            ChatHeaderView(viewModel: viewModel)
            searchBarView
            scrollableMessageArea
            chatInputSection
        }
    }

    // MARK: - Search Bar View

    @ViewBuilder
    private var searchBarView: some View {
        if showMessageSearch {
            MessageSearchBar(
                searchEngine: searchEngine,
                onDismiss: {
                    withAnimation(.optaSnap) {
                        showMessageSearch = false
                        searchEngine.reset()
                    }
                },
                onNext: { searchEngine.nextMatch() },
                onPrevious: { searchEngine.previousMatch() }
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    // MARK: - Scrollable Message Area

    @ViewBuilder
    private var scrollableMessageArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    Color.clear.frame(height: 8)
                    skeletonLoadingView
                    emptyStateView
                    messageListContent
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
                .animation(.optaSpring, value: viewModel.messages.count)
                .animation(.optaSpring, value: viewModel.streamingContent.isEmpty)
            }
            .onChange(of: viewModel.messages.count) { oldCount, newCount in
                handleMessagesCountChange(proxy: proxy, oldCount: oldCount, newCount: newCount)
            }
            .onChange(of: viewModel.streamingContent) { _, _ in
                if isAtBottom {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: viewModel.botState) { _, _ in
                if isAtBottom {
                    withAnimation(.optaSnap) {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }
            .onChange(of: scrollToMessageId) { _, id in
                if let id {
                    withAnimation(.optaSpring) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                    scrollToMessageId = nil
                }
            }
            .overlay(alignment: .bottomTrailing) {
                scrollToBottomButton(proxy: proxy)
            }
        }
        .mask(fadeMask)
        .overlay {
            ThinkingOverlay(
                viewModel: viewModel,
                events: thinkingEvents,
                isActive: viewModel.botState != .idle
            )
        }
    }

    // MARK: - Skeleton Loading View

    @ViewBuilder
    private var skeletonLoadingView: some View {
        if viewModel.isLoading && viewModel.messages.isEmpty {
            ForEach(0..<4, id: \.self) { i in
                SkeletonBubble(isUser: i % 3 == 1, width: [0.45, 0.55, 0.65, 0.4][i])
                    .transition(.opacity)
            }
        }
    }

    // MARK: - Empty State View

    @ViewBuilder
    private var emptyStateView: some View {
        if viewModel.messages.isEmpty && !viewModel.isLoading && viewModel.streamingContent.isEmpty {
            ChatEmptyState(
                botName: viewModel.botConfig.name,
                botEmoji: viewModel.botConfig.emoji,
                isConnected: viewModel.connectionState == .connected,
                onReconnect: { viewModel.connect() }
            )
            .frame(maxWidth: .infinity)
            .padding(.top, 80)
        }
    }

    // MARK: - Scroll To Bottom Button

    @ViewBuilder
    private func scrollToBottomButton(proxy: ScrollViewProxy) -> some View {
        if !isAtBottom {
            Button(action: {
                withAnimation(.optaSpring) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                    showNewMessagesPill = false
                    newMessageCount = 0
                    isAtBottom = true
                }
            }) {
                ZStack(alignment: .topTrailing) {
                    Circle()
                        .fill(botAccentColor(for: viewModel.botConfig).opacity(0.9))
                        .frame(width: 40, height: 40)
                        .shadow(color: botAccentColor(for: viewModel.botConfig).opacity(0.4), radius: 10, y: 3)
                        .overlay(
                            Image(systemName: "arrow.down")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                        )

                    if newMessageCount > 0 {
                        Text("\(newMessageCount)")
                            .font(.sora(9, weight: .bold))
                            .foregroundColor(.white)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(Circle().fill(Color.optaRed))
                            .offset(x: 4, y: -4)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Scroll to bottom")
            .accessibilityHint(newMessageCount > 0 ? "\(newMessageCount) new messages" : "Jump to latest messages")
            .padding(.bottom, 16)
            .padding(.trailing, 16)
            .transition(.scale(scale: 0.3).combined(with: .opacity))
        }
    }

    // MARK: - Fade Mask

    @ViewBuilder
    private var fadeMask: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [.clear, .white], startPoint: .top, endPoint: .bottom)
                .frame(height: 40)
            Color.white
            LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 40)
        }
    }

    // MARK: - Chat Floating Overlays

    @ViewBuilder
    private var chatFloatingOverlays: some View {
        Group {
            if showConnectionToast {
                ConnectionToast(
                    text: connectionToastText,
                    isSuccess: connectionToastIsSuccess
                )
                .padding(.top, 56)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(10)
            }

            ContextPanel(items: contextItems, isExpanded: $showContextPanel)
                .padding(.top, 52)
                .padding(.trailing, 12)
        }
    }

    // MARK: - Drag Overlay View

    @ViewBuilder
    private var dragOverlayView: some View {
        if isDragTarget {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.optaPrimary, lineWidth: 2)
                .background(.ultraThinMaterial.opacity(0.3))
                .overlay {
                    VStack(spacing: 8) {
                        Image(systemName: dragType.icon)
                            .font(.system(size: 32))
                            .symbolEffect(.pulse, isActive: true)
                        Text(dragType.label)
                            .font(.sora(14, weight: .medium))
                    }
                    .foregroundStyle(Color.optaPrimary)
                }
                .transition(.opacity)
        }
    }

    // MARK: - Search Keyboard Shortcuts

    @ViewBuilder
    private var searchKeyboardShortcuts: some View {
        Group {
            Button("") {
                guard showMessageSearch else { return }
                searchEngine.nextMatch()
            }
            .keyboardShortcut("g", modifiers: .command)

            Button("") {
                guard showMessageSearch else { return }
                searchEngine.previousMatch()
            }
            .keyboardShortcut("g", modifiers: [.command, .shift])
        }
        .frame(width: 0, height: 0)
        .opacity(0)
    }

    // MARK: - Helper Methods (modifier closures)

    private func handleContainerAppear() {
        if viewModel.connectionState == .disconnected {
            viewModel.connect()
        }
        isInputFocused = true
        previousConnectionState = viewModel.connectionState
        if inputHistory == nil { inputHistory = InputHistory(botId: viewModel.botConfig.id) }

        if let window = NSApp.keyWindow {
            WindowStatePersistence.saveFrame(window.frame)
            WindowStatePersistence.saveSelectedBot(viewModel.botConfig.id)
        }
    }

    private func handleInputTextChange(_ newText: String) {
        showSlashPopup = newText.hasPrefix("/") && newText.count < 20
        inputHistory?.reset()
        mentionAutocomplete.update(
            text: newText,
            cursorOffset: newText.count,
            bots: appState.bots
        )
    }

    private func handleNotificationReply(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let botId = userInfo["botId"] as? String,
              botId == viewModel.botConfig.id,
              let text = userInfo["text"] as? String else { return }
        Task { await viewModel.send(text, attachments: []) }
    }

    private func handleConnectionStateChange(from oldState: ConnectionState?, to newState: ConnectionState?) {
        let wasDisconnectedOrReconnecting = (previousConnectionState == .reconnecting || previousConnectionState == .connecting)
        previousConnectionState = newState

        if newState == .connecting || newState == .reconnecting {
            connectionToastText = newState == .reconnecting ? "Reconnecting…" : "Connecting…"
            connectionToastIsSuccess = false
            withAnimation(.optaGentle) {
                showConnectionToast = true
            }
        } else if newState == .connected && wasDisconnectedOrReconnecting {
            connectionToastText = "Connected to \(viewModel.botConfig.name) ✓"
            connectionToastIsSuccess = true
            SoundManager.shared.play(.connected)
            withAnimation(.optaSpring) {
                showConnectionToast = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                withAnimation(.optaGentle) {
                    showConnectionToast = false
                }
            }
        } else {
            withAnimation(.optaSpring) {
                showConnectionToast = false
            }
        }
    }

    private func handleEscapeKey() -> KeyPress.Result {
        if mentionAutocomplete.isActive {
            mentionAutocomplete.dismiss()
            return .handled
        }
        if showMessageSearch {
            withAnimation(.optaSnap) {
                showMessageSearch = false
                searchEngine.reset()
            }
            return .handled
        }
        if viewModel.botState != .idle {
            Task { await viewModel.abort() }
            return .handled
        }
        if viewModel.isSessionDrawerOpen {
            withAnimation(.optaSpring) {
                viewModel.isSessionDrawerOpen = false
            }
            return .handled
        }
        if isInputFocused {
            isInputFocused = false
            return .handled
        }
        return .ignored
    }

    private func handleMessagesCountChange(proxy: ScrollViewProxy, oldCount: Int, newCount: Int) {
        if isAtBottom {
            withAnimation(.optaSpring) {
                proxy.scrollTo("bottom", anchor: .bottom)
            }
        } else {
            newMessageCount += (newCount - oldCount)
            withAnimation(.optaSpring) {
                showNewMessagesPill = true
            }
        }
        if newCount > oldCount, let last = viewModel.messages.last,
           case .bot(let name) = last.sender {
            SoundManager.shared.play(.receiveMessage)
            NotificationManager.shared.notifyIfNeeded(botName: name, botId: viewModel.botConfig.id, message: last.content)
        }
    }

    private func handleSearchQuery() {
        guard showMessageSearch else { return }
        if searchEngine.scope == .thisChat {
            searchEngine.searchLocal(messages: viewModel.messages)
        } else {
            searchEngine.searchGlobal(viewModel: viewModel)
        }
    }

    private func scrollToCurrentMatch() {
        if let result = searchEngine.currentResult {
            scrollToMessageId = result.messageId
        }
    }

    // MARK: - Extracted Views (type-checker relief)

    @ViewBuilder
    private var messageListContent: some View {
        ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
            let isSearchMatch = showMessageSearch && searchEngine.results.contains(where: { $0.messageId == message.id })
            let isCurrentMatch = searchEngine.currentResult?.messageId == message.id
            MessageRow(
                message: message,
                index: index,
                total: viewModel.messages.count,
                showTimestamp: shouldShowTimestamp(messages: viewModel.messages, at: index),
                allMessages: viewModel.messages,
                botId: viewModel.botConfig.id,
                botName: viewModel.botConfig.name,
                onReply: { msg in viewModel.replyingTo = msg },
                onScrollTo: { id in scrollToMessageId = id }
            )
                .searchMatchGlow(isMatch: isSearchMatch, isCurrent: isCurrentMatch)
                .transition(.asymmetric(
                    insertion: .move(edge: .bottom).combined(with: .opacity),
                    removal: .opacity
                ))
        }

        // Enhanced typing indicator
        if viewModel.botState == .thinking && viewModel.streamingContent.isEmpty {
            HStack {
                EnhancedTypingIndicator(
                    botName: viewModel.botConfig.name,
                    isActive: true
                )
                Spacer()
            }
        }

        // Streaming content
        if !viewModel.streamingContent.isEmpty {
            MessageBubble(
                streamingContent: viewModel.streamingContent,
                sender: .bot(name: viewModel.botConfig.name),
                showTypingCursor: viewModel.botState == .typing
            )
            .transition(.asymmetric(
                insertion: .move(edge: .bottom).combined(with: .opacity),
                removal: .opacity
            ))
        }

        // Error display
        if let error = viewModel.errorMessage {
            ErrorBanner(message: error) {
                viewModel.errorMessage = nil
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }

        Color.clear.frame(height: 1).id("bottom")
            .onAppear {
                isAtBottom = true
                showNewMessagesPill = false
                newMessageCount = 0
            }
            .onDisappear {
                isAtBottom = false
            }
    }

    @ViewBuilder
    private var chatInputSection: some View {
        // Reply preview above input
        if let replyMsg = viewModel.replyingTo {
            ReplyInputPreview(message: replyMsg) {
                viewModel.replyingTo = nil
            }
        }

        // @mention autocomplete popup
        if mentionAutocomplete.isActive {
            MentionSuggestionsPopup(
                suggestions: mentionAutocomplete.suggestions,
                onSelect: { bot in
                    let result = mentionAutocomplete.accept(bot: bot, in: inputText)
                    inputText = result.newText
                }
            )
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }

        // Floating input bar
        ChatInputBar(
            text: $inputText,
            attachments: $pendingAttachments,
            isFocused: $isInputFocused,
            isStreaming: viewModel.botState != .idle,
            sessionMode: viewModel.activeSession?.mode ?? .direct,
            queuedCount: viewModel.queuedMessageCount,
            onSend: {
                let text = inputText
                let files = pendingAttachments
                inputText = ""
                pendingAttachments = []
                mentionAutocomplete.dismiss()
                SoundManager.shared.play(.sendMessage)

                // Route to mentioned bot if @mention targets a different bot
                if let targetBotId = MentionParser.firstMentionedBotId(from: text, knownBots: appState.bots),
                   targetBotId != viewModel.botConfig.id,
                   let targetBot = appState.bots.first(where: { $0.id == targetBotId }) {
                    let targetVM = appState.viewModel(for: targetBot)
                    if targetVM.connectionState == .disconnected {
                        targetVM.connect()
                    }
                    Task { await targetVM.send(text, attachments: files) }
                } else {
                    Task { await viewModel.send(text, attachments: files) }
                }
            },
            onAbort: {
                Task { await viewModel.abort() }
            }
        )
    }

    private func handleDrop(_ providers: [NSItemProvider]) {
        for provider in providers {
            // Handle plain text drops → send as message
            if provider.hasItemConformingToTypeIdentifier(UTType.utf8PlainText.identifier),
               !provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.utf8PlainText.identifier, options: nil) { item, _ in
                    guard let data = item as? Data, let text = String(data: data, encoding: .utf8),
                          !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                    Task { @MainActor in
                        // If it looks like a URL, prefix it
                        if text.hasPrefix("http://") || text.hasPrefix("https://") {
                            inputText = text
                        } else {
                            inputText = text
                        }
                    }
                }
                continue
            }

            // Handle URL drops → paste URL as message text
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
               !provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    if let url = item as? URL {
                        Task { @MainActor in
                            inputText = url.absoluteString
                        }
                    } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                        Task { @MainActor in
                            inputText = url.absoluteString
                        }
                    }
                }
                continue
            }

            // Handle file drops
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    guard let data = item as? Data,
                          let url = URL(dataRepresentation: data, relativeTo: nil) else { return }

                    guard url.startAccessingSecurityScopedResource() else { return }
                    defer { url.stopAccessingSecurityScopedResource() }

                    guard let fileData = try? Data(contentsOf: url),
                          fileData.count <= AttachmentLimits.maxFileBytes else { return }

                    let mimeType = UTType(filenameExtension: url.pathExtension)?
                        .preferredMIMEType ?? "application/octet-stream"

                    let attachment = ChatAttachment(
                        filename: url.lastPathComponent,
                        mimeType: mimeType,
                        sizeBytes: fileData.count,
                        data: fileData
                    )
                    Task { @MainActor in
                        guard pendingAttachments.count < AttachmentLimits.maxAttachmentsPerMessage else { return }
                        pendingAttachments.append(attachment)
                    }
                }
            }
        }
    }

    private func formatBytes(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes)B" }
        if bytes < 1024 * 1024 { return String(format: "%.1fKB", Double(bytes) / 1024) }
        return String(format: "%.1fMB", Double(bytes) / (1024 * 1024))
    }
}

// MARK: - Message Search Bar

struct MessageSearchBar: View {
    @ObservedObject var searchEngine: SearchEngine
    let onDismiss: () -> Void
    let onNext: () -> Void
    let onPrevious: () -> Void
    @FocusState private var isFocused: Bool

    private var totalMatches: Int { searchEngine.results.count }
    private var currentIndex: Int { searchEngine.currentIndex }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundColor(.optaTextMuted)

            TextField("Search messages…", text: $searchEngine.query)
                .textFieldStyle(.plain)
                .font(.sora(13))
                .foregroundColor(.optaTextPrimary)
                .focused($isFocused)
                .onAppear { isFocused = true }
                .onSubmit { onNext() }

            // Scope toggle
            Picker("", selection: $searchEngine.scope) {
                ForEach(SearchScope.allCases, id: \.self) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 160)

            if !searchEngine.query.isEmpty {
                if searchEngine.isSearching {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 40)
                } else {
                    Text(totalMatches > 0 ? "\(min(currentIndex + 1, totalMatches)) of \(totalMatches)" : "No results")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(totalMatches > 0 ? .optaTextSecondary : .optaTextMuted)
                }

                Button(action: onPrevious) {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous match")
                .disabled(totalMatches == 0)

                Button(action: onNext) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next match")
                .disabled(totalMatches == 0)
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close search")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            Color.optaElevated
        )
    }
}


// MARK: - Message Row (with entrance animation)

// MARK: - Timestamp Grouping

/// Format a timestamp for display between message groups.
func groupTimestamp(_ date: Date) -> String {
    let cal = Calendar.current
    let formatter = DateFormatter()
    formatter.dateFormat = "h:mm a"
    let time = formatter.string(from: date)

    if cal.isDateInToday(date) {
        return time
    } else if cal.isDateInYesterday(date) {
        return "Yesterday \(time)"
    } else {
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        return "\(df.string(from: date)), \(time)"
    }
}

/// Whether a timestamp separator should appear before this message.
func shouldShowTimestamp(messages: [ChatMessage], at index: Int) -> Bool {
    guard index < messages.count else { return false }
    let msg = messages[index]
    if index == 0 { return true }
    let prev = messages[index - 1]
    return msg.timestamp.timeIntervalSince(prev.timestamp) > 120 // 2 minutes
}

struct TimestampSeparator: View {
    let date: Date

    var body: some View {
        Text(groupTimestamp(date))
            .font(.sora(10, weight: .medium))
            .foregroundColor(.optaTextMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
    }
}

struct MessageRow: View {
    let message: ChatMessage
    let index: Int
    let total: Int
    let showTimestamp: Bool
    var allMessages: [ChatMessage] = []
    var botId: String = ""
    var botName: String = ""
    var onReply: ((ChatMessage) -> Void)? = nil
    var onScrollTo: ((String) -> Void)? = nil
    
    @State private var appeared = false
    @State private var floatY: CGFloat = 0
    
    private var isRecent: Bool { total - index <= 3 }
    
    var body: some View {
        VStack(spacing: 4) {
            if showTimestamp {
                TimestampSeparator(date: message.timestamp)
            }
            MessageBubble(
                message: message,
                hideTimestamp: !showTimestamp,
                allMessages: allMessages,
                botId: botId,
                botName: botName,
                onReply: onReply,
                onScrollTo: onScrollTo
            )
            .id(message.id)
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? floatY : 16)
        .scaleEffect(appeared ? 1 : 0.97)
        .onAppear {
            if isRecent {
                withAnimation(.optaGentle.delay(0.03 * Double(total - index))) {
                    appeared = true
                }
            } else {
                appeared = true
            }
            // Removed per-message float animation — caused N concurrent repeatForever animations
        }
    }
}

// MARK: - Error Banner

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.optaAmber)
                .font(.system(size: 14))
            
            Text(message)
                .font(.sora(12))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(2)
            
            Spacer()
            
            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.optaTextMuted)
                    .font(.system(size: 14))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss error")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaAmber.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.optaAmber.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Chat Header

struct ChatHeaderView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var connGlow: CGFloat = 0
    @State private var connectingPulse: CGFloat = 1.0
    @State private var showBotProfile = false
    @State private var showPinnedSheet = false
    @State private var showBookmarksSheet = false
    @StateObject private var pinManager = PinManager.shared
    
    private var accentColor: Color {
        botAccentColor(for: viewModel.botConfig)
    }
    
    private var isConnecting: Bool {
        viewModel.connectionState == .connecting || viewModel.connectionState == .reconnecting
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Button(action: { showBotProfile = true }) {
                Text(viewModel.botConfig.emoji)
                    .font(.soraTitle2)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(viewModel.botConfig.name) profile")
            .help("Bot Info")
            .sheet(isPresented: $showBotProfile) {
                BotProfileSheet(viewModel: viewModel)
            }
            
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(viewModel.botConfig.name)
                        .font(.sora(16, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                    
                    // Connection route indicator (LAN vs Remote)
                    ConnectionRouteBadge(route: viewModel.connectionRoute, isConnected: viewModel.connectionState == .connected)

                    if let session = viewModel.activeSession {
                        SessionBadge(session: session, accentColor: accentColor)
                            .transition(.scale(scale: 0.8).combined(with: .opacity))
                    }
                }
                
                Text(statusText)
                    .font(.sora(11))
                    .foregroundColor(statusColor)
                    .contentTransition(.numericText())
                    .animation(.optaSpring, value: statusText)
            }
            
            Spacer()

            // Reconnect button when disconnected
            if viewModel.connectionState == .disconnected {
                Button(action: { viewModel.connect() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11))
                        Text("Reconnect")
                            .font(.sora(11, weight: .medium))
                    }
                    .foregroundColor(.optaAmber)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule().fill(Color.optaAmber.opacity(0.12))
                    )
                    .overlay(Capsule().stroke(Color.optaAmber.opacity(0.3), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Reconnect to \(viewModel.botConfig.name)")
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }

            // Pinned messages button
            Button(action: { showPinnedSheet = true }) {
                Image(systemName: "pin")
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Pinned messages")
            .help("View Pinned Messages")

            // Bookmarks button
            Button(action: { showBookmarksSheet = true }) {
                Image(systemName: "bookmark")
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Bookmarks")
            .help("Bookmarks")

            // Export menu
            Menu {
                ForEach(ChatExportFormat.allCases, id: \.rawValue) { format in
                    Button("\(format.label) (.\(format.fileExtension))") {
                        ChatExporter.saveWithPanel(
                            messages: viewModel.messages,
                            botName: viewModel.botConfig.name,
                            format: format
                        )
                    }
                }
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13))
                    .foregroundColor(.optaTextSecondary)
            }
            .menuStyle(.borderlessButton)
            .frame(width: 20)
            .accessibilityLabel("Export chat")
            .help("Export chat")
            .disabled(viewModel.messages.isEmpty)

            // Session drawer toggle with rotation
            Button(action: {
                withAnimation(.optaSpring) {
                    viewModel.isSessionDrawerOpen.toggle()
                }
            }) {
                Image(systemName: "rectangle.righthalf.inset.filled")
                    .font(.system(size: 14))
                    .foregroundColor(viewModel.isSessionDrawerOpen ? .optaPrimary : .optaTextSecondary)
                    .scaleEffect(x: viewModel.isSessionDrawerOpen ? -1 : 1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(viewModel.isSessionDrawerOpen ? "Close sessions panel" : "Open sessions panel")
            .help("Toggle sessions panel")
            
            // Connection indicator with glow ring
            ZStack {
                // Glow ring
                Circle()
                    .fill(statusColor.opacity(0.15 * connGlow))
                    .frame(width: 18, height: 18)
                    .blur(radius: 3)
                
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .shadow(color: statusColor.opacity(0.5), radius: 3 + 2 * connGlow)
            }
            .scaleEffect(isConnecting ? connectingPulse : (viewModel.connectionState == .connected ? 1 : 0.7))
            .animation(.optaSnap, value: viewModel.connectionState)
            .onAppear {
                connGlow = 1
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            ZStack {
                Color.optaElevated // Solid dark glass (was ultraThinMaterial)

                // Bot accent color tint gradient at top
                VStack {
                    LinearGradient(
                        colors: [accentColor.opacity(0.03), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 20)
                    Spacer()
                }
                
                // Bottom edge glow based on state
                VStack {
                    Spacer()
                    LinearGradient(
                        colors: [.clear, statusColor.opacity(0.06), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                }
            }
        )
        .sheet(isPresented: $showPinnedSheet) {
            PinnedMessagesSheet(
                messages: pinManager.pinnedMessages(from: viewModel.messages, botId: viewModel.botConfig.id),
                botName: viewModel.botConfig.name,
                onScrollTo: { _ in }
            )
        }
        .sheet(isPresented: $showBookmarksSheet) {
            BookmarksView()
        }
    }
    
    private var statusText: String {
        switch viewModel.connectionState {
        case .connected:
            switch viewModel.botState {
            case .idle: return "Online"
            case .thinking: return "Thinking…"
            case .typing: return "Typing…"
            }
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Offline"
        }
    }
    
    private var statusColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaRed
        }
    }
}

// MARK: - Connection Route Badge

struct ConnectionRouteBadge: View {
    let route: NetworkEnvironment.ConnectionType
    let isConnected: Bool

    var body: some View {
        if isConnected {
            HStack(spacing: 3) {
                Image(systemName: route == .remote ? "globe" : "wifi")
                    .font(.system(size: 8))
                Text(route == .remote ? "Remote" : "LAN")
                    .font(.sora(9, weight: .medium))
            }
            .foregroundColor(route == .remote ? .optaAmber : .optaGreen)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill((route == .remote ? Color.optaAmber : Color.optaGreen).opacity(0.15))
            )
            .overlay(
                Capsule()
                    .stroke((route == .remote ? Color.optaAmber : Color.optaGreen).opacity(0.3), lineWidth: 0.5)
            )
        }
    }
}

// MARK: - Session Badge

struct SessionBadge: View {
    let session: ChatSession
    var accentColor: Color? = nil
    
    private var badgeColor: Color {
        accentColor ?? sessionModeColor(session.mode)
    }
    
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: session.mode.icon)
                .font(.system(size: 8))
            
            Text(session.name)
                .font(.sora(9, weight: .medium))
        }
        .foregroundColor(badgeColor)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            Capsule()
                .fill(badgeColor.opacity(0.15))
        )
        .overlay(
            Capsule()
                .stroke(badgeColor.opacity(0.3), lineWidth: 0.5)
        )
    }
}

// MARK: - Chat Input Bar

struct ChatInputBar: View {
    @Binding var text: String
    @Binding var attachments: [ChatAttachment]
    var isFocused: FocusState<Bool>.Binding
    let isStreaming: Bool
    let sessionMode: SessionMode
    var queuedCount: Int = 0
    let onSend: () -> Void
    let onAbort: () -> Void
    var onUpArrow: (() -> Void)? = nil
    var onDownArrow: (() -> Void)? = nil
    var onSaveTemplate: ((String) -> Void)? = nil

    @AppStorage("optaplus.deviceName") private var deviceName = "MacBook"
    @AppStorage("optaplus.deviceEmoji") private var deviceEmoji = ""
    @State private var glowPhase: CGFloat = 0
    @State private var sendScale: CGFloat = 1
    @StateObject private var voiceRecorder = VoiceRecorder()

    private var hasContent: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Attachment preview strip (above input when attachments present)
            if !attachments.isEmpty {
                AttachmentPreviewStrip(attachments: $attachments)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Top edge glow (animates when streaming)
            LinearGradient(
                colors: [
                    .clear,
                    isStreaming ? Color.optaPrimary.opacity(0.2 * glowPhase) : (hasContent ? Color.optaPrimary.opacity(0.08) : .clear),
                    .clear
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)

            // Device identity badge
            if !deviceName.isEmpty {
                HStack(spacing: 4) {
                    if !deviceEmoji.isEmpty {
                        Text(deviceEmoji)
                            .font(.system(size: 11))
                    }
                    Text("Sending as: \(deviceName)")
                        .font(.sora(10))
                        .foregroundColor(.optaTextMuted)
                    Spacer()
                }
                .padding(.horizontal, 16)
            }

            // Offline queue indicator
            if queuedCount > 0 {
                HStack(spacing: 5) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 10))
                    Text("\(queuedCount) queued — sending when connected...")
                        .font(.sora(10, weight: .medium))
                }
                .foregroundColor(.optaAmber)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(Color.optaAmber.opacity(0.1))
                )
                .padding(.horizontal, 16)
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }

            // Voice recording bar (replaces text input when recording)
            if voiceRecorder.isRecording {
                HStack(spacing: 10) {
                    RecordingIndicator(
                        duration: voiceRecorder.recordingDuration,
                        audioLevel: voiceRecorder.audioLevel
                    )

                    Spacer()

                    Button(action: { voiceRecorder.cancel() }) {
                        Text("Cancel")
                            .font(.sora(12, weight: .medium))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                    .help("Cancel recording")

                    Button(action: { stopAndSendMacOSVoice() }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.optaPrimary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Send voice message")
                    .help("Send voice message")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Microphone permission denied
            if voiceRecorder.permissionDenied {
                HStack(spacing: 6) {
                    Image(systemName: "mic.slash")
                        .font(.system(size: 11))
                    Text("Microphone access denied. Enable in System Settings.")
                        .font(.sora(10))
                }
                .foregroundColor(.optaAmber)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color.optaAmber.opacity(0.1)))
                .padding(.horizontal, 16)
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }

            if !voiceRecorder.isRecording {
                HStack(spacing: 10) {
                    // Session mode indicator with subtle pulse
                    Image(systemName: sessionMode.icon)
                        .font(.system(size: 11))
                        .foregroundColor(sessionModeColor(sessionMode))
                        .frame(width: 16)
                        .help(sessionMode.description)
                        .scaleEffect(isStreaming ? 1 + 0.1 * glowPhase : 1)

                    // Attachment picker
                    AttachmentPicker(attachments: $attachments)

                    VStack(alignment: .trailing, spacing: 2) {
                        ChatTextInput(
                            text: $text,
                            placeholder: "Message…",
                            font: .systemFont(ofSize: 14),
                            textColor: NSColor(Color.optaTextPrimary),
                            onSend: { if hasContent { triggerSend() } },
                            onImagePasted: { attachment in
                                attachments.append(attachment)
                            }
                        )
                        .frame(minHeight: 22, maxHeight: 120)
                        .focused(isFocused)

                        // Character count for long messages
                        if text.count > 1000 {
                            Text("\(text.count)")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(text.count > 4000 ? .optaAmber : .optaTextMuted)
                                .transition(.opacity)
                        }
                    }

                    // Mic button
                    Button(action: { voiceRecorder.start() }) {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Record voice message")
                    .help("Record voice message")

                    // Send / Abort button with spring animation
                    Group {
                        if isStreaming {
                            Button(action: onAbort) {
                                Image(systemName: "stop.circle.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(.optaRed)
                                    .scaleEffect(1 + 0.08 * glowPhase)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Stop generation")
                            .help("Stop generation")
                            .transition(.scale(scale: 0.5).combined(with: .opacity))
                        } else {
                            Button(action: { if hasContent { triggerSend() } }) {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(hasContent ? .optaPrimary : .optaTextMuted)
                                    .shadow(color: hasContent ? Color.optaPrimary.opacity(0.3) : .clear, radius: 6)
                                    .scaleEffect(sendScale)
                            }
                            .buttonStyle(.plain)
                            .disabled(!hasContent)
                            .accessibilityLabel("Send message")
                            .help("Send message (⏎)")
                            .overlay(alignment: .topTrailing) {
                                if queuedCount > 0 {
                                    Text("\(queuedCount)")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundColor(.white)
                                        .frame(minWidth: 14, minHeight: 14)
                                        .background(Circle().fill(Color.optaAmber))
                                        .offset(x: 5, y: -5)
                                        .transition(.scale(scale: 0.5).combined(with: .opacity))
                                }
                            }
                            .transition(.scale(scale: 0.5).combined(with: .opacity))
                        }
                    }
                    .animation(.optaSpring, value: isStreaming)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
        }
        .background(
            ZStack {
                Color.optaElevated // Solid dark glass (was ultraThinMaterial)

                // Subtle glow behind input when streaming
                if isStreaming {
                    Color.optaPrimary.opacity(0.02 * glowPhase)
                }
            }
        )
        .onAppear {
            glowPhase = 1
        }
        .animation(.optaSpring, value: queuedCount)
        .animation(.optaSpring, value: voiceRecorder.isRecording)
    }

    private func triggerSend() {
        // Bounce animation on send
        withAnimation(.optaSnap) {
            sendScale = 0.85
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.optaSnap) {
                sendScale = 1
            }
        }
        onSend()
    }

    private func stopAndSendMacOSVoice() {
        guard let audioData = voiceRecorder.stop() else { return }
        let attachment = ChatAttachment(
            filename: "voice-\(UUID().uuidString.prefix(8)).m4a",
            mimeType: "audio/mp4",
            sizeBytes: audioData.count,
            data: audioData
        )
        attachments.append(attachment)
        onSend()
    }
}

// MARK: - Thinking Indicator

struct ThinkingIndicator: View {
    let botName: String
    @State private var isAnimating = false
    
    var body: some View {
        HStack {
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color.optaPrimary)
                        .frame(width: 7, height: 7)
                        .scaleEffect(isAnimating ? 1.0 : 0.5)
                        .opacity(isAnimating ? 1 : 0.3)
                        .animation(
                            .optaSpring
                                .repeatForever(autoreverses: true)
                                .delay(Double(i) * 0.15),
                            value: isAnimating
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.optaSurface.opacity(0.7))
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Color.optaBorder.opacity(0.3), lineWidth: 1)
            )
            .shadow(color: Color.optaPrimary.opacity(0.1), radius: 8, y: 2)
            .onAppear {
                isAnimating = true
            }
            
            Spacer(minLength: 60)
        }
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    @State private var isAnimating = false
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 52))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.optaPrimary, .optaNeonPurple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .opacity(isAnimating ? 1 : 0.5)
                .scaleEffect(isAnimating ? 1 : 0.9)
                .animation(.optaPulse, value: isAnimating)
            
            Text("Select a bot to start chatting")
                .font(.sora(16, weight: .medium))
                .foregroundColor(.optaTextSecondary)

            Text("Your bots are listed in the sidebar")
                .font(.sora(13))
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.optaVoid)
        .onAppear { isAnimating = true }
    }
}

// MARK: - Add Bot Sheet

struct AddBotSheet: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    @State private var name = ""
    @State private var host = "127.0.0.1"
    @State private var port = "18793"
    @State private var token = ""
    @State private var showToken = false
    @State private var emoji = "🤖"
    @State private var sessionKey = "main"
    
    private var hostValidation: FieldValidation { host.isEmpty ? .valid : validateHostname(host) }
    private var portValidation: FieldValidation { port.isEmpty ? .valid : validatePort(port) }
    private var isFormValid: Bool {
        !name.isEmpty && hostValidation.isValid && portValidation.isValid && !host.isEmpty && !port.isEmpty
    }
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Add Bot")
                .font(.sora(18, weight: .bold))
                .foregroundColor(.optaTextPrimary)
            
            VStack(alignment: .leading, spacing: 12) {
                LabeledField("Name", text: $name, placeholder: "My Bot")
                LabeledField("Host", text: $host, placeholder: "127.0.0.1", validation: hostValidation)
                LabeledField("Port", text: $port, placeholder: "18793", validation: portValidation)
                // Token with show/hide
                VStack(alignment: .leading, spacing: 4) {
                    Text("Token")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                    HStack(spacing: 6) {
                        Group {
                            if showToken {
                                TextField("Gateway auth token", text: $token)
                            } else {
                                SecureField("Gateway auth token", text: $token)
                            }
                        }
                        .textFieldStyle(.plain)
                        .font(.sora(13))
                        .foregroundColor(.optaTextPrimary)
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.optaElevated))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.optaBorder, lineWidth: 1))
                        
                        Button(action: { showToken.toggle() }) {
                            Image(systemName: showToken ? "eye.slash" : "eye")
                                .font(.system(size: 12))
                                .foregroundColor(.optaTextMuted)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(showToken ? "Hide token" : "Show token")
                    }
                }
                LabeledField("Emoji", text: $emoji, placeholder: "🤖")
            }
            
            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Add") {
                    let bot = BotConfig(
                        name: name,
                        host: host,
                        port: Int(port) ?? 18793,
                        token: token,
                        emoji: emoji.isEmpty ? "🤖" : emoji,
                        sessionKey: sessionKey.isEmpty ? "main" : sessionKey
                    )
                    appState.addBot(bot)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isFormValid)
            }
        }
        .padding(24)
        .frame(width: 400)
        .background(
            ZStack {
                Color.optaSurface.opacity(0.7)
                    .background(.ultraThinMaterial)
                // Violet tint
                Color.optaPrimary.opacity(0.02)
            }
        )
        .preferredColorScheme(.dark)
    }
}


// MARK: - Preview

#if DEBUG
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(AppState())
            .frame(width: 900, height: 600)
    }
}
#endif
