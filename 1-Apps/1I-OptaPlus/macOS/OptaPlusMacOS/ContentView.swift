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
    
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Custom drag handle for hidden title bar
                WindowDragHandle()
                
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    if let bot = windowState.selectedBot(in: appState) {
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
            }
            .frame(width: 0, height: 0)
            .opacity(0)
        }
        .onChange(of: windowState.selectedBotId) { oldId, newId in
            guard let newId, oldId != nil, oldId != newId,
                  let bot = appState.bots.first(where: { $0.id == newId }) else { return }
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
                Button(action: { appState.showingSettings = true }) {
                    Image(systemName: "gear")
                        .foregroundColor(.optaTextSecondary)
                }
                .accessibilityLabel("Settings")
            }
        }
    }
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
            .onChange(of: isConnected) { connected in
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
func ambientState(from botState: BotState) -> BotActivityState {
    switch botState {
    case .idle: return .idle
    case .thinking: return .thinking
    case .typing: return .typing
    }
}

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
                                        showTimestamp: shouldShowTimestamp(messages: viewModel.messages, at: index)
                                    )
                                        .transition(.asymmetric(
                                            insertion: .move(edge: .bottom).combined(with: .opacity),
                                            removal: .opacity
                                        ))
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
            
            // Save window state periodically
            if let window = NSApp.keyWindow {
                WindowStatePersistence.saveFrame(window.frame)
                WindowStatePersistence.saveSelectedBot(viewModel.botConfig.id)
            }
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

// MARK: - Session Drawer

struct SessionDrawerView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var showingNewSession = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Drawer header
            HStack {
                Text("SESSIONS")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                
                Spacer()
                
                Button(action: { showingNewSession = true }) {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 14))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            
            Divider()
                .background(Color.optaBorder)
            
            // Session list
            ScrollView {
                LazyVStack(spacing: 2) {
                    // Pinned sessions first
                    ForEach(viewModel.sessions.filter(\.isPinned)) { session in
                        SessionRow(
                            session: session,
                            isActive: viewModel.activeSession?.id == session.id,
                            onTap: { viewModel.switchSession(session) },
                            onDelete: { viewModel.deleteSession(session) },
                            onTogglePin: { viewModel.togglePin(session) }
                        )
                    }
                    
                    // Unpinned sessions
                    ForEach(viewModel.sessions.filter { !$0.isPinned }) { session in
                        SessionRow(
                            session: session,
                            isActive: viewModel.activeSession?.id == session.id,
                            onTap: { viewModel.switchSession(session) },
                            onDelete: { viewModel.deleteSession(session) },
                            onTogglePin: { viewModel.togglePin(session) }
                        )
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            
            Spacer()
        }
        .background(
            ZStack {
                Color.optaSurface.opacity(0.4)
                    .background(.ultraThinMaterial)
                // Subtle top highlight
                VStack {
                    LinearGradient(
                        colors: [Color.white.opacity(0.03), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 1)
                    Spacer()
                }
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 0))
        .sheet(isPresented: $showingNewSession) {
            NewSessionSheet(viewModel: viewModel)
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let session: ChatSession
    let isActive: Bool
    let onTap: () -> Void
    let onDelete: () -> Void
    let onTogglePin: () -> Void
    
    @State private var isHovering = false
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                // Mode icon
                Image(systemName: session.mode.icon)
                    .font(.system(size: 11))
                    .foregroundColor(sessionModeColor(session.mode))
                    .frame(width: 16)
                
                VStack(alignment: .leading, spacing: 1) {
                    Text(session.name)
                        .font(.system(size: 12, weight: isActive ? .semibold : .regular))
                        .foregroundColor(isActive ? .optaTextPrimary : .optaTextSecondary)
                        .lineLimit(1)
                    
                    Text(session.mode.label)
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                }
                
                Spacer()
                
                if session.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 8))
                        .foregroundColor(.optaTextMuted)
                        .rotationEffect(.degrees(45))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isActive ? Color.optaPrimary.opacity(0.15) : (isHovering ? Color.optaSurface.opacity(0.5) : Color.clear))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isActive ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .contextMenu {
            Button(action: onTogglePin) {
                Label(session.isPinned ? "Unpin" : "Pin", systemImage: session.isPinned ? "pin.slash" : "pin")
            }
            
            Divider()
            
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

// MARK: - New Session Sheet

struct NewSessionSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var name = ""
    @State private var selectedMode: SessionMode = .direct
    
    var body: some View {
        VStack(spacing: 20) {
            Text("New Session")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.optaTextPrimary)
            
            // Name field
            LabeledField("Name", text: $name, placeholder: "e.g., Research, Coding, Quick Chat")
            
            // Mode picker
            VStack(alignment: .leading, spacing: 8) {
                Text("Mode")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.optaTextMuted)
                
                ForEach(SessionMode.allCases, id: \.self) { mode in
                    SessionModeOption(
                        mode: mode,
                        isSelected: selectedMode == mode,
                        onTap: { selectedMode = mode }
                    )
                }
            }
            
            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Create") {
                    let session = viewModel.createSession(
                        name: name.isEmpty ? selectedMode.label : name,
                        mode: selectedMode
                    )
                    viewModel.switchSession(session)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
                .tint(.optaPrimary)
            }
        }
        .padding(24)
        .frame(width: 360)
        .background(
            ZStack {
                Color.optaSurface.opacity(0.7)
                    .background(.ultraThinMaterial)
                Color.optaPrimary.opacity(0.02)
            }
        )
        .preferredColorScheme(.dark)
    }
}

// MARK: - Session Mode Option

struct SessionModeOption: View {
    let mode: SessionMode
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: mode.icon)
                    .font(.system(size: 14))
                    .foregroundColor(sessionModeColor(mode))
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.optaTextPrimary)
                    
                    Text(mode.description)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.optaPrimary)
                        .font(.system(size: 16))
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.optaPrimary.opacity(0.1) : Color.optaElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.optaPrimary.opacity(0.4) : Color.optaBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Message Row (with entrance animation)

// MARK: - Timestamp Grouping

/// Format a timestamp for display between message groups.
func groupTimestamp(_ date: Date) -> String {
    let cal = Calendar.current
    let now = Date()
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
    
    @State private var appeared = false
    @State private var floatY: CGFloat = 0
    
    private var isRecent: Bool { total - index <= 3 }
    
    var body: some View {
        VStack(spacing: 4) {
            if showTimestamp {
                TimestampSeparator(date: message.timestamp)
            }
            MessageBubble(message: message, hideTimestamp: !showTimestamp)
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
            .onChange(of: isConnecting) { connecting in
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
                LabeledField("Token", text: $token, placeholder: "Gateway auth token")
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

// MARK: - Validation Helpers

enum FieldValidation {
    case valid
    case invalid(String)
    
    var isValid: Bool {
        if case .valid = self { return true }
        return false
    }
    
    var errorMessage: String? {
        if case .invalid(let msg) = self { return msg }
        return nil
    }
}

func validateHostname(_ host: String) -> FieldValidation {
    let trimmed = host.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { return .invalid("Hostname is required") }
    if trimmed.contains(" ") { return .invalid("Hostname cannot contain spaces") }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: ".-_"))
    if trimmed.unicodeScalars.contains(where: { !allowed.contains($0) }) {
        return .invalid("Invalid characters in hostname")
    }
    return .valid
}

func validatePort(_ port: String) -> FieldValidation {
    let trimmed = port.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { return .invalid("Port is required") }
    guard let portNum = Int(trimmed) else { return .invalid("Port must be a number") }
    if portNum < 1 || portNum > 65535 { return .invalid("Port must be 1–65535") }
    return .valid
}

struct LabeledField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    var validation: FieldValidation?
    
    init(_ label: String, text: Binding<String>, placeholder: String, validation: FieldValidation? = nil) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.validation = validation
    }
    
    private var hasError: Bool {
        if case .invalid = validation { return true }
        return false
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.optaTextMuted)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .foregroundColor(.optaTextPrimary)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaElevated)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(hasError ? Color.optaRed.opacity(0.6) : Color.optaBorder, lineWidth: 1)
                )
            
            if let errorMsg = validation?.errorMessage {
                Text(errorMsg)
                    .font(.system(size: 10))
                    .foregroundColor(.optaRed)
                    .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.2), value: hasError)
    }
}

// MARK: - Settings View

struct SettingsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            BotsSettingsView()
                .environmentObject(appState)
                .tabItem {
                    Label("Bots", systemImage: "cpu")
                }

            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }

            TelegramSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label("Telegram", systemImage: "paperplane")
                }
        }
        .frame(width: 500, height: 450)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Telegram Settings Tab

struct TelegramSettingsTab: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        // Telegram sync requires TDLibKit — show placeholder until integrated
        VStack(spacing: 16) {
            Image(systemName: "paperplane")
                .font(.system(size: 32))
                .foregroundColor(.optaTextMuted)

            Text("Telegram Sync")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.optaTextSecondary)

            Text("Bidirectional Telegram sync is planned but requires TDLibKit integration.\nMessages sent from OptaPlus will be relayed by the bot.")
                .font(.system(size: 12))
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct BotsSettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedBotId: String?
    
    var body: some View {
        HStack(spacing: 0) {
            List(selection: $selectedBotId) {
                ForEach(appState.bots) { bot in
                    HStack {
                        Text(bot.emoji)
                        Text(bot.name)
                            .font(.system(size: 13))
                    }
                    .tag(bot.id)
                }
            }
            .frame(width: 160)
            
            Divider()
            
            if let botId = selectedBotId,
               let bot = appState.bots.first(where: { $0.id == botId }) {
                BotDetailEditor(bot: bot) { updated in
                    appState.updateBot(updated)
                }
                .padding()
            } else {
                Text("Select a bot to edit")
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

// MARK: - Connection Test State

enum ConnectionTestResult {
    case idle
    case testing
    case success
    case failure(String)
}

struct BotDetailEditor: View {
    let bot: BotConfig
    let onSave: (BotConfig) -> Void
    
    @State private var name: String
    @State private var host: String
    @State private var port: String
    @State private var token: String
    @State private var emoji: String
    @State private var testResult: ConnectionTestResult = .idle
    @ObservedObject private var themeManager = ThemeManager.shared
    @State private var botAccentColorBinding: Color = .optaPrimary
    @State private var hasBotAccentOverride: Bool = false
    
    init(bot: BotConfig, onSave: @escaping (BotConfig) -> Void) {
        self.bot = bot
        self.onSave = onSave
        _name = State(initialValue: bot.name)
        _host = State(initialValue: bot.host)
        _port = State(initialValue: String(bot.port))
        _token = State(initialValue: bot.token)
        _emoji = State(initialValue: bot.emoji)
    }
    
    private var hostValidation: FieldValidation { validateHostname(host) }
    private var portValidation: FieldValidation { validatePort(port) }
    private var isFormValid: Bool {
        !name.isEmpty && hostValidation.isValid && portValidation.isValid
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LabeledField("Name", text: $name, placeholder: "Bot name")
            LabeledField("Host", text: $host, placeholder: "127.0.0.1", validation: hostValidation)
            LabeledField("Port", text: $port, placeholder: "18793", validation: portValidation)
            LabeledField("Token", text: $token, placeholder: "Auth token")
            LabeledField("Emoji", text: $emoji, placeholder: "🤖")

            // Bot accent color
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Accent Color")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                    Spacer()
                    if hasBotAccentOverride {
                        Button("Reset") {
                            themeManager.clearBotAccent(forBotId: bot.id)
                            hasBotAccentOverride = false
                            botAccentColorBinding = botAccentColor(for: bot)
                        }
                        .font(.system(size: 10))
                        .foregroundColor(.optaTextMuted)
                        .buttonStyle(.plain)
                    }
                }
                ColorPicker("", selection: $botAccentColorBinding, supportsOpacity: false)
                    .labelsHidden()
                    .onChange(of: botAccentColorBinding) { _, newColor in
                        themeManager.setBotAccent(newColor, forBotId: bot.id)
                        hasBotAccentOverride = true
                    }
            }
            .onAppear {
                hasBotAccentOverride = themeManager.botAccentOverrides[bot.id] != nil
                botAccentColorBinding = botAccentColor(for: bot)
            }

            // Connection test
            HStack(spacing: 10) {
                Button(action: testConnection) {
                    HStack(spacing: 6) {
                        if case .testing = testResult {
                            ProgressView()
                                .scaleEffect(0.6)
                                .frame(width: 14, height: 14)
                        } else {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                                .font(.system(size: 12))
                        }
                        Text("Test Connection")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundColor(.optaTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaElevated)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.optaBorder, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(!hostValidation.isValid || !portValidation.isValid || {
                    if case .testing = testResult { return true }
                    return false
                }())
                
                switch testResult {
                case .idle:
                    EmptyView()
                case .testing:
                    EmptyView()
                case .success:
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.optaGreen)
                            .font(.system(size: 14))
                        Text("Connected")
                            .font(.system(size: 11))
                            .foregroundColor(.optaGreen)
                    }
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                case .failure(let error):
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.optaRed)
                            .font(.system(size: 14))
                        Text(error)
                            .font(.system(size: 11))
                            .foregroundColor(.optaRed)
                            .lineLimit(1)
                    }
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: {
                switch testResult {
                case .idle: return 0
                case .testing: return 1
                case .success: return 2
                case .failure: return 3
                }
            }())
            
            Spacer()
            
            HStack {
                Spacer()
                Button("Save") {
                    let updated = BotConfig(
                        id: bot.id,
                        name: name,
                        host: host,
                        port: Int(port) ?? bot.port,
                        token: token,
                        emoji: emoji,
                        sessionKey: bot.sessions.first?.sessionKey ?? "main"
                    )
                    onSave(updated)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isFormValid)
            }
        }
    }
    
    private func testConnection() {
        testResult = .testing
        let testHost = host
        let testPort = Int(port) ?? 0
        
        Task {
            do {
                let url = URL(string: "ws://\(testHost):\(testPort)")!
                let session = URLSession(configuration: .default)
                let task = session.webSocketTask(with: url)
                task.resume()
                
                // Try to receive a message within 5 seconds
                let _ = try await withThrowingTaskGroup(of: Bool.self) { group in
                    group.addTask {
                        // Try receiving a message (the gateway sends hello)
                        let _ = try await task.receive()
                        return true
                    }
                    group.addTask {
                        try await Task.sleep(nanoseconds: 5_000_000_000)
                        throw URLError(.timedOut)
                    }
                    let result = try await group.next()!
                    group.cancelAll()
                    return result
                }
                
                task.cancel(with: .goingAway, reason: nil)
                await MainActor.run { testResult = .success }
            } catch {
                await MainActor.run {
                    let msg = error.localizedDescription
                    testResult = .failure(msg.count > 40 ? String(msg.prefix(40)) + "…" : msg)
                }
            }
        }
    }
}

struct GeneralSettingsView: View {
    @EnvironmentObject var animPrefs: AnimationPreferences
    @ObservedObject var themeManager: ThemeManager = .shared
    @AppStorage("optaplus.textAlignment") private var textAlignment: String = MessageTextAlignment.centeredExpanding.rawValue

    @State private var fontScaleIndex: Double = 1
    @State private var showCustomAccent = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }
    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // About section
                VStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [themeManager.effectiveAccent, themeManager.currentTheme.accentGlow],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("OptaPlus")
                        .font(.sora(18, weight: .bold))
                        .foregroundColor(.optaTextPrimary)

                    Text("v\(appVersion) (\(buildNumber))")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Text("Native OpenClaw chat client")
                        .font(.system(size: 13))
                        .foregroundColor(.optaTextSecondary)
                }

                Divider().background(Color.optaBorder)

                // Theme picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("THEME")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    HStack(spacing: 8) {
                        ForEach(AppTheme.allBuiltIn) { theme in
                            ThemePreviewCard(
                                theme: theme,
                                isSelected: themeManager.currentTheme.id == theme.id,
                                onTap: { themeManager.currentTheme = theme }
                            )
                        }
                    }
                }

                // Custom accent color
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("CUSTOM ACCENT")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        Spacer()

                        if themeManager.customAccentColor != nil {
                            Button("Reset") {
                                themeManager.customAccentColor = nil
                            }
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.optaTextMuted)
                            .buttonStyle(.plain)
                        }
                    }

                    ColorPicker(
                        "Accent Color",
                        selection: Binding(
                            get: { themeManager.customAccentColor ?? themeManager.currentTheme.accentColor },
                            set: { themeManager.customAccentColor = $0 }
                        ),
                        supportsOpacity: false
                    )
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextSecondary)

                    Text("Override the theme's accent color with any color you choose.")
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Font scale
                VStack(alignment: .leading, spacing: 8) {
                    Text("FONT SIZE")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    HStack {
                        Text("A")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                        Slider(value: $fontScaleIndex, in: 0...3, step: 1)
                            .onChange(of: fontScaleIndex) { _, newVal in
                                themeManager.fontScale = FontScale(index: newVal)
                            }
                        Text("A")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.optaTextMuted)
                    }

                    Text(themeManager.fontScale.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                }

                // Chat density
                VStack(alignment: .leading, spacing: 8) {
                    Text("CHAT DENSITY")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Density", selection: $themeManager.chatDensity) {
                        ForEach(ChatDensity.allCases, id: \.self) { density in
                            Text(density.label).tag(density)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text("Affects message spacing and bubble size.")
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Background mode
                VStack(alignment: .leading, spacing: 8) {
                    Text("AMBIENT BACKGROUND")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Background", selection: $themeManager.backgroundMode) {
                        ForEach(BackgroundMode.allCases, id: \.self) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text(backgroundModeDescription)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Animation level picker
                AnimationLevelPicker(prefs: animPrefs)

                Divider().background(Color.optaBorder)

                // Text alignment picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("MESSAGE ALIGNMENT")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Alignment", selection: $textAlignment) {
                        ForEach(MessageTextAlignment.allCases, id: \.rawValue) { alignment in
                            Text(alignment.label).tag(alignment.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text("Controls how chat messages are positioned in the window.")
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            fontScaleIndex = themeManager.fontScale.index
        }
    }

    private var backgroundModeDescription: String {
        switch themeManager.backgroundMode {
        case .on: return "Full ambient particles and gradient orbs."
        case .off: return "Pure void background — saves GPU."
        case .subtle: return "Reduced particles and orb opacity."
        }
    }
}

// MARK: - Theme Preview Card

struct ThemePreviewCard: View {
    let theme: AppTheme
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(theme.backgroundColor)
                    .frame(height: 40)
                    .overlay(
                        Circle()
                            .fill(theme.accentColor)
                            .frame(width: 14, height: 14)
                            .shadow(color: theme.accentColor.opacity(0.6), radius: 6)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(isSelected ? theme.accentColor : Color.optaBorder, lineWidth: isSelected ? 2 : 0.5)
                    )

                Text(theme.name)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? .optaTextPrimary : .optaTextMuted)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Chat Empty State (Bot Selected, No Messages)

struct ChatEmptyState: View {
    let botName: String
    let botEmoji: String
    let isConnected: Bool
    let onReconnect: () -> Void

    @State private var pulse: CGFloat = 0.9

    var body: some View {
        VStack(spacing: 16) {
            Text(botEmoji)
                .font(.system(size: 56))
                .scaleEffect(pulse)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                        pulse = 1.05
                    }
                }

            if isConnected {
                Text("Start a conversation with \(botName)")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                Text("Type a message below to begin")
                    .font(.system(size: 13))
                    .foregroundColor(.optaTextMuted)
            } else {
                Text("\(botName) is disconnected")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                Button(action: onReconnect) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12))
                        Text("Reconnect")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundColor(.optaPrimary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        Capsule().fill(Color.optaPrimary.opacity(0.12))
                    )
                    .overlay(Capsule().stroke(Color.optaPrimary.opacity(0.3), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Skeleton Bubble

struct SkeletonBubble: View {
    let isUser: Bool
    let width: CGFloat
    @State private var shimmerOffset: CGFloat = -1
    
    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 0) }
            
            RoundedRectangle(cornerRadius: 18)
                .fill(Color.optaSurface.opacity(0.4))
                .frame(maxWidth: width * 600, minHeight: isUser ? 36 : 52)
                .overlay(
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [.clear, Color.white.opacity(0.04), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.4)
                        .offset(x: shimmerOffset * geo.size.width)
                    }
                    .clipped()
                )
                .clipShape(RoundedRectangle(cornerRadius: 18))
            
            if !isUser { Spacer(minLength: 0) }
        }
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                shimmerOffset = 1.5
            }
        }
    }
}

// MARK: - Connection Toast

struct ConnectionToast: View {
    let text: String
    let isSuccess: Bool
    @State private var pulse: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 8) {
            if isSuccess {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.optaGreen)
            } else {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 12, height: 12)
            }
            
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(isSuccess ? .optaGreen : .optaTextSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .shadow(color: Color.black.opacity(0.2), radius: 8, y: 2)
        )
        .overlay(
            Capsule()
                .stroke(
                    (isSuccess ? Color.optaGreen : Color.optaAmber).opacity(0.3),
                    lineWidth: 0.5
                )
        )
    }
}

// MARK: - Color Helpers

func sessionModeColor(_ mode: SessionMode) -> Color {
    switch mode {
    case .synced: return .optaBlue
    case .direct: return .optaGreen
    case .isolated: return .optaPrimary
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
