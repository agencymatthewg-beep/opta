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

// MARK: - Content View

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @EnvironmentObject var animPrefs: AnimationPreferences

    @State private var showCommandPalette = false
    @State private var showKeyboardShortcuts = false
    @State private var showMessageSearch = false
    @State private var botSwitchOverlay: String? = nil
    @State private var showDashboard = false
    
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Custom drag handle for hidden title bar
                WindowDragHandle()
                
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    if showDashboard {
                        DashboardView()
                            .environmentObject(appState)
                            .environmentObject(windowState)
                    } else if let bot = windowState.selectedBot(in: appState) {
                        let vm = appState.viewModel(for: bot)
                        ZStack {
                            // Ambient background responds to bot state
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
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
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
        .animation(.spring(response: 0.25, dampingFraction: 0.85), value: showCommandPalette)
        .animation(.spring(response: 0.25, dampingFraction: 0.85), value: showKeyboardShortcuts)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: botSwitchOverlay != nil)
        .background {
            // Hidden buttons for keyboard shortcuts
            Group {
                Button("") { showCommandPalette.toggle() }
                    .keyboardShortcut("p", modifiers: .command)
                Button("") { showMessageSearch.toggle() }
                    .keyboardShortcut("f", modifiers: .command)
                Button("") { showKeyboardShortcuts.toggle() }
                    .keyboardShortcut("/", modifiers: .command)
                Button("") { showDashboard.toggle() }
                    .keyboardShortcut("d", modifiers: .command)
            }
            .frame(width: 0, height: 0)
            .opacity(0)
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleDashboard)) { _ in
            showDashboard.toggle()
        }
        .onChange(of: windowState.selectedBotId) { oldId, newId in
            guard let newId, oldId != nil, oldId != newId,
                  let bot = appState.bots.first(where: { $0.id == newId }) else { return }
            showDashboard = false
            showBotSwitchHUD(bot.emoji + " " + bot.name)
        }
    }

    private func showBotSwitchHUD(_ name: String) {
        botSwitchOverlay = name
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
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
                .font(.system(size: 18, weight: .semibold))
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
                    .animation(.spring(response: 0.25, dampingFraction: 0.8), value: isHovered)
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
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextPrimary)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
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
            .scaleEffect(breatheScale)
            .onAppear {
                if isConnected {
                    withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                        breatheScale = 1.03
                    }
                }
            }
            .onChange(of: isConnected) { _, connected in
                if connected {
                    withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                        breatheScale = 1.03
                    }
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        breatheScale = 1.0
                    }
                }
            }
            
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
                        .font(.system(size: 10))
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
            withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                isHovered = hovering
            }
        }
        .hoverScale(1.02)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.connectionState)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.botState)
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
    @State private var searchQuery = ""
    @State private var currentMatchIndex = 0
    @State private var newMessageCount = 0
    @State private var showConnectionToast = false
    @State private var connectionToastText = ""
    @State private var connectionToastIsSuccess = false
    @State private var previousConnectionState: ConnectionState?
    @State private var scrollToMessageId: String? = nil
    @State private var showSlashPopup = false
    @State private var showTemplatePicker = false
    @State private var inputHistory: InputHistory?
    
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
        HStack(spacing: 0) {
            // Main chat area with floating overlays
            ZStack(alignment: .topTrailing) {
                // Base chat layer
                VStack(spacing: 0) {
                    ChatHeaderView(viewModel: viewModel)

                    // Message search bar
                    if showMessageSearch {
                        MessageSearchBar(
                            query: $searchQuery,
                            currentIndex: $currentMatchIndex,
                            totalMatches: searchMatches.count,
                            onDismiss: {
                                withAnimation(.spring(response: 0.25)) {
                                    showMessageSearch = false
                                    searchQuery = ""
                                }
                            }
                        )
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }
                    
                    // Messages area (no divider — floating design)
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                // Top spacer for breathing room
                                Color.clear.frame(height: 8)

                                // Skeleton loading placeholders
                                if viewModel.isLoading && viewModel.messages.isEmpty {
                                    ForEach(0..<4, id: \.self) { i in
                                        SkeletonBubble(isUser: i % 3 == 1, width: [0.45, 0.55, 0.65, 0.4][i])
                                            .transition(.opacity)
                                    }
                                }
                                
                                // Empty state when no messages
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

                                ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
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
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: viewModel.messages.count)
                            .animation(.spring(response: 0.3, dampingFraction: 0.9), value: viewModel.streamingContent.isEmpty)
                        }
                        .onChange(of: viewModel.messages.count) { oldCount, newCount in
                            if isAtBottom {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            } else {
                                newMessageCount += (newCount - oldCount)
                                withAnimation(.spring(response: 0.3)) {
                                    showNewMessagesPill = true
                                }
                            }
                            // Notify for new bot messages
                            if newCount > oldCount, let last = viewModel.messages.last,
                               case .bot(let name) = last.sender {
                                SoundManager.shared.play(.receiveMessage)
                                NotificationManager.shared.notifyIfNeeded(botName: name, botId: viewModel.botConfig.id, message: last.content)
                            }
                        }
                        .onChange(of: viewModel.streamingContent) { _, _ in
                            if isAtBottom {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
                        }
                        .onChange(of: viewModel.botState) { _, _ in
                            if isAtBottom {
                                withAnimation(.spring(response: 0.25)) {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                        .onChange(of: scrollToMessageId) { _, id in
                            if let id {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                    proxy.scrollTo(id, anchor: .center)
                                }
                                scrollToMessageId = nil
                            }
                        }
                        .overlay(alignment: .bottomTrailing) {
                            if showNewMessagesPill {
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
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
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundColor(.white)
                                                .frame(minWidth: 16, minHeight: 16)
                                                .background(Circle().fill(Color.optaRed))
                                                .offset(x: 4, y: -4)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .padding(.bottom, 16)
                                .padding(.trailing, 16)
                                .transition(.scale(scale: 0.3).combined(with: .opacity))
                            }
                        }
                    }
                    
                    .mask(
                        VStack(spacing: 0) {
                            LinearGradient(colors: [.clear, .white], startPoint: .top, endPoint: .bottom)
                                .frame(height: 40)
                            Color.white
                            LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .bottom)
                                .frame(height: 40)
                        }
                    )
                    .overlay {
                        ThinkingOverlay(
                            viewModel: viewModel,
                            events: thinkingEvents,
                            isActive: viewModel.botState != .idle
                        )
                    }
                    
                    // Reply preview above input
                    if let replyMsg = viewModel.replyingTo {
                        ReplyInputPreview(message: replyMsg) {
                            viewModel.replyingTo = nil
                        }
                    }

                    // Floating input bar
                    ChatInputBar(
                        text: $inputText,
                        attachments: $pendingAttachments,
                        isFocused: $isInputFocused,
                        isStreaming: viewModel.botState != .idle,
                        sessionMode: viewModel.activeSession?.mode ?? .direct,
                        onSend: {
                            let text = inputText
                            let files = pendingAttachments
                            inputText = ""
                            pendingAttachments = []
                            SoundManager.shared.play(.sendMessage)
                            Task { await viewModel.send(text, attachments: files) }
                        },
                        onAbort: {
                            Task { await viewModel.abort() }
                        }
                    )
                }
                
                // Connection toast (top center)
                if showConnectionToast {
                    ConnectionToast(
                        text: connectionToastText,
                        isSuccess: connectionToastIsSuccess
                    )
                    .padding(.top, 56)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(10)
                }
                
                // Floating context panel (top-right)
                ContextPanel(items: contextItems, isExpanded: $showContextPanel)
                    .padding(.top, 52) // Below header
                    .padding(.trailing, 12)
                
                // ThinkingOverlay is now an overlay on the ScrollView above
            }
            
            // Session drawer (slides in from right)
            if viewModel.isSessionDrawerOpen {
                Divider()
                    .background(Color.optaBorder)
                
                SessionDrawerView(viewModel: viewModel)
                    .frame(width: 240)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .background(Color.clear) // Let ambient background show through
        .overlay {
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
                                .font(.system(size: 14, weight: .medium))
                        }
                        .foregroundStyle(Color.optaPrimary)
                    }
                    .transition(.opacity)
            }
        }
        .onDrop(of: [.fileURL, .image, .pdf, .plainText, .url, .utf8PlainText], isTargeted: $isDragTarget) { providers in
            handleDrop(providers)
            return true
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: isDragTarget)
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: viewModel.isSessionDrawerOpen)
        .onAppear {
            if viewModel.connectionState == .disconnected {
                viewModel.connect()
            }
            isInputFocused = true
            previousConnectionState = viewModel.connectionState
            if inputHistory == nil { inputHistory = InputHistory(botId: viewModel.botConfig.id) }
            
            // Save window state periodically
            if let window = NSApp.keyWindow {
                WindowStatePersistence.saveFrame(window.frame)
                WindowStatePersistence.saveSelectedBot(viewModel.botConfig.id)
            }
        }
        .onChange(of: inputText) { _, newText in
            showSlashPopup = newText.hasPrefix("/") && newText.count < 20
            inputHistory?.reset()
        }
        .onReceive(NotificationCenter.default.publisher(for: .optaPlusFocusInput)) { _ in
            isInputFocused = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .optaPlusNotificationReply)) { notification in
            guard let userInfo = notification.userInfo,
                  let botId = userInfo["botId"] as? String,
                  botId == viewModel.botConfig.id,
                  let text = userInfo["text"] as? String else { return }
            Task { await viewModel.send(text, attachments: []) }
        }
        .onChange(of: viewModel.connectionState) { oldState, newState in
            let wasDisconnectedOrReconnecting = (previousConnectionState == .reconnecting || previousConnectionState == .connecting)
            previousConnectionState = newState
            
            if newState == .connecting || newState == .reconnecting {
                connectionToastText = newState == .reconnecting ? "Reconnecting…" : "Connecting…"
                connectionToastIsSuccess = false
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
            } else if newState == .connected && wasDisconnectedOrReconnecting {
                connectionToastText = "Connected to \(viewModel.botConfig.name) ✓"
                connectionToastIsSuccess = true
                SoundManager.shared.play(.connected)
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        showConnectionToast = false
                    }
                }
            } else {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    showConnectionToast = false
                }
            }
        }
        .animation(.spring(response: 0.25, dampingFraction: 0.85), value: showMessageSearch)
        .alert("Clear Chat History",
               isPresented: $viewModel.showClearConfirmation) {
            Button("Clear", role: .destructive) {
                viewModel.clearChat()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Clear chat history for \(viewModel.botConfig.name)? This removes local messages only.")
        }
        .onKeyPress(.escape) {
            // Escape: close search > abort streaming > close drawer > close settings > unfocus
            if showMessageSearch {
                withAnimation(.spring(response: 0.25)) {
                    showMessageSearch = false
                    searchQuery = ""
                }
                return .handled
            }
            if viewModel.botState != .idle {
                Task { await viewModel.abort() }
                return .handled
            }
            if viewModel.isSessionDrawerOpen {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
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
    }
    
    // MARK: - Input Area (extracted to reduce body complexity)

    @ViewBuilder
    private var inputAreaView: some View {
        // Quick action chips when empty & connected
        if viewModel.messages.isEmpty && !viewModel.isLoading && viewModel.connectionState == .connected {
            QuickActionsView { prompt in inputText = prompt }
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }

        // Slash command popup
        if showSlashPopup {
            SlashCommandPopup(
                query: inputText,
                onSelect: { cmd in
                    handleSlashCommand(cmd)
                    showSlashPopup = false
                    inputText = ""
                },
                onDismiss: { showSlashPopup = false }
            )
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .padding(.horizontal, 16)
        }

        // Template picker
        if showTemplatePicker {
            TemplatePickerView(
                botName: viewModel.botConfig.name,
                onSelect: { text in
                    inputText = text
                    showTemplatePicker = false
                },
                onDismiss: { showTemplatePicker = false }
            )
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .padding(.horizontal, 16)
        }

        // Reply preview above input
        if let replyMsg = viewModel.replyingTo {
            ReplyInputPreview(message: replyMsg) {
                viewModel.replyingTo = nil
            }
        }

        // Floating input bar
        ChatInputBar(
            text: $inputText,
            attachments: $pendingAttachments,
            isFocused: $isInputFocused,
            isStreaming: viewModel.botState != .idle,
            sessionMode: viewModel.activeSession?.mode ?? .direct,
            onSend: {
                let text = inputText
                let files = pendingAttachments
                inputText = ""
                pendingAttachments = []
                inputHistory?.record(text)
                SoundManager.shared.play(.sendMessage)
                Task { await viewModel.send(text, attachments: files) }
            },
            onAbort: {
                Task { await viewModel.abort() }
            },
            onUpArrow: {
                if let hist = inputHistory, let text = hist.up(currentText: inputText) {
                    inputText = text
                }
            },
            onDownArrow: {
                if let hist = inputHistory, let text = hist.down() {
                    inputText = text
                }
            },
            onSaveTemplate: { text in
                MessageTemplateManager.shared.add(name: String(text.prefix(30)), content: text)
            }
        )
    }

    private func handleSlashCommand(_ cmd: SlashCommand) {
        switch cmd.name {
        case "/clear":
            viewModel.showClearConfirmation = true
        case "/export":
            ChatExporter.saveWithPanel(
                messages: viewModel.messages,
                botName: viewModel.botConfig.name,
                format: .markdown
            )
        case "/pin":
            if let last = viewModel.messages.last {
                PinManager.shared.togglePin(last.id, botId: viewModel.botConfig.id)
            }
        case "/search":
            showMessageSearch = true
        case "/theme":
            break // Could open theme settings
        case "/dashboard":
            NotificationCenter.default.post(name: .toggleDashboard, object: nil)
        case "/shortcuts":
            // Post notification or set state for keyboard shortcuts
            break
        case "/template":
            break // TODO: template picker
        default:
            break
        }
    }

    private var searchMatches: [ChatMessage] {
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        let q = searchQuery.lowercased()
        return viewModel.messages.filter { $0.content.lowercased().contains(q) }
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
                          fileData.count <= 50 * 1024 * 1024 else { return }

                    let mimeType = UTType(filenameExtension: url.pathExtension)?
                        .preferredMIMEType ?? "application/octet-stream"

                    let attachment = ChatAttachment(
                        filename: url.lastPathComponent,
                        mimeType: mimeType,
                        sizeBytes: fileData.count,
                        data: fileData
                    )
                    Task { @MainActor in
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
    @Binding var query: String
    @Binding var currentIndex: Int
    let totalMatches: Int
    let onDismiss: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundColor(.optaTextMuted)

            TextField("Search messages…", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .foregroundColor(.optaTextPrimary)
                .focused($isFocused)
                .onAppear { isFocused = true }

            if !query.isEmpty {
                Text(totalMatches > 0 ? "\(min(currentIndex + 1, totalMatches)) of \(totalMatches)" : "No results")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(totalMatches > 0 ? .optaTextSecondary : .optaTextMuted)

                Button(action: {
                    if totalMatches > 0 { currentIndex = (currentIndex - 1 + totalMatches) % totalMatches }
                }) {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .disabled(totalMatches == 0)

                Button(action: {
                    if totalMatches > 0 { currentIndex = (currentIndex + 1) % totalMatches }
                }) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .disabled(totalMatches == 0)
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            Color.optaSurface.opacity(0.6)
                .background(.ultraThinMaterial)
        )
        .onChange(of: query) { _, _ in
            currentIndex = 0
        }
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
            .font(.system(size: 10, weight: .medium))
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
                withAnimation(.spring(response: 0.45, dampingFraction: 0.75).delay(0.03 * Double(total - index))) {
                    appeared = true
                }
            } else {
                appeared = true
            }
            if isRecent {
                let duration = 4.0 + Double.random(in: 0...1.5)
                withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true).delay(Double.random(in: 0...1))) {
                    floatY = CGFloat.random(in: -0.5...0.5)
                }
            }
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
                .font(.system(size: 12))
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
                    .font(.title2)
            }
            .buttonStyle(.plain)
            .help("Bot Info")
            .sheet(isPresented: $showBotProfile) {
                BotProfileSheet(viewModel: viewModel)
            }
            
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(viewModel.botConfig.name)
                        .font(.sora(16, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                    
                    // Connection security indicator
                    ConnectionSecurityBadge(host: viewModel.botConfig.host)
                    
                    if let session = viewModel.activeSession {
                        SessionBadge(session: session, accentColor: accentColor)
                            .transition(.scale(scale: 0.8).combined(with: .opacity))
                    }
                }
                
                Text(statusText)
                    .font(.system(size: 11))
                    .foregroundColor(statusColor)
                    .contentTransition(.numericText())
                    .animation(.spring(response: 0.3), value: statusText)
            }
            
            Spacer()

            // Reconnect button when disconnected
            if viewModel.connectionState == .disconnected {
                Button(action: { viewModel.connect() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11))
                        Text("Reconnect")
                            .font(.system(size: 11, weight: .medium))
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
            .help("View Pinned Messages")

            // Bookmarks button
            Button(action: { showBookmarksSheet = true }) {
                Image(systemName: "bookmark")
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextSecondary)
            }
            .buttonStyle(.plain)
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
            .help("Export chat")
            .disabled(viewModel.messages.isEmpty)

            // Session drawer toggle with rotation
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
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
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: viewModel.connectionState)
            .onAppear {
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                    connGlow = 1
                }
                if isConnecting {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.8).repeatForever(autoreverses: true)) {
                        connectingPulse = 1.3
                    }
                }
            }
            .onChange(of: isConnecting) { _, connecting in
                if connecting {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.8).repeatForever(autoreverses: true)) {
                        connectingPulse = 1.3
                    }
                } else {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                        connectingPulse = 1.0
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            ZStack {
                Color.optaSurface.opacity(0.5)
                    .background(.ultraThinMaterial)
                
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
                .font(.system(size: 9, weight: .medium))
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
    let onSend: () -> Void
    let onAbort: () -> Void
    var onUpArrow: (() -> Void)? = nil
    var onDownArrow: (() -> Void)? = nil
    var onSaveTemplate: ((String) -> Void)? = nil

    @State private var glowPhase: CGFloat = 0
    @State private var sendScale: CGFloat = 1

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
                        .transition(.scale(scale: 0.5).combined(with: .opacity))
                    }
                }
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isStreaming)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(
            ZStack {
                Color.optaSurface.opacity(0.5)
                    .background(.ultraThinMaterial)
                
                // Subtle glow behind input when streaming
                if isStreaming {
                    Color.optaPrimary.opacity(0.02 * glowPhase)
                }
            }
        )
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                glowPhase = 1
            }
        }
    }
    
    private func triggerSend() {
        // Bounce animation on send
        withAnimation(.spring(response: 0.15, dampingFraction: 0.5)) {
            sendScale = 0.85
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                sendScale = 1
            }
        }
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
                            .easeInOut(duration: 0.5)
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
                .animation(.easeInOut(duration: 2).repeatForever(autoreverses: true), value: isAnimating)
            
            Text("Select a bot to start chatting")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.optaTextSecondary)
            
            Text("Your bots are listed in the sidebar")
                .font(.system(size: 13))
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
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.optaTextPrimary)
            
            VStack(alignment: .leading, spacing: 12) {
                LabeledField("Name", text: $name, placeholder: "My Bot")
                LabeledField("Host", text: $host, placeholder: "127.0.0.1", validation: hostValidation)
                LabeledField("Port", text: $port, placeholder: "18793", validation: portValidation)
                // Token with show/hide
                VStack(alignment: .leading, spacing: 4) {
                    Text("Token")
                        .font(.system(size: 11, weight: .medium))
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
                        .font(.system(size: 13))
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
