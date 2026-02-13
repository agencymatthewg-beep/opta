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

// MARK: - Content View

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @EnvironmentObject var animPrefs: AnimationPreferences
    
    var body: some View {
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
                        
                        ChatContainerView(viewModel: vm)
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
    }
}

// MARK: - Window Drag Handle

/// Invisible drag area at the top of the window for hidden title bar.
struct WindowDragHandle: View {
    var body: some View {
        Color.clear
            .frame(height: 28)
            .background(.ultraThinMaterial.opacity(0.01))
            .overlay(alignment: .center) {
                Capsule()
                    .fill(Color.optaTextMuted.opacity(0.2))
                    .frame(width: 36, height: 4)
            }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @State private var showingAddBot = false
    
    var body: some View {
        List(selection: Binding(
            get: { windowState.selectedBotId },
            set: { id in
                if let id = id, let bot = appState.bots.first(where: { $0.id == id }) {
                    windowState.selectBot(bot, in: appState)
                }
            }
        )) {
            Section {
                ForEach(appState.bots) { bot in
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
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Color.optaVoid)
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
            // Styled bot avatar circle
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                
                Text(bot.emoji)
                    .font(.system(size: 18))
            }
            .shadow(color: accentColor.opacity(0.4), radius: 8)
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
                    withAnimation(.easeInOut(duration: 0.3)) {
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
                .fill(accentColor.opacity(isHovered ? 0.05 : 0))
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .hoverScale(1.02)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.connectionState)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.botState)
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
    switch bot.name {
    case "Opta Max": return .optaCoral
    case "Opta512": return .optaPrimary
    case "Mono": return .optaGreen
    case "Floda": return .optaAmber
    case "Saturday": return .optaBlue
    case "YJ": return .optaAmber
    default: return .optaPrimary
    }
}

// MARK: - Chat Container

struct ChatContainerView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var inputText = ""
    @State private var pendingAttachments: [ChatAttachment] = []
    @FocusState private var isInputFocused: Bool
    @State private var showContextPanel = false
    @State private var isDragTarget = false
    
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
                    
                    // Messages area (no divider — floating design)
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                // Top spacer for breathing room
                                Color.clear.frame(height: 8)
                                
                                ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
                                    MessageRow(message: message, index: index, total: viewModel.messages.count)
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
                        .onChange(of: viewModel.messages.count) { _, _ in
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
                        }
                        .onChange(of: viewModel.streamingContent) { _, _ in
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                        .onChange(of: viewModel.botState) { _, _ in
                            withAnimation(.spring(response: 0.25)) {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
                        }
                    }
                    
                    .overlay(alignment: .bottomLeading) {
                        if viewModel.botState != .idle {
                            ThinkingOverlay(
                                viewModel: viewModel,
                                events: thinkingEvents,
                                isActive: true
                            )
                            .frame(maxWidth: 280)
                            .padding(.leading, 12)
                            .padding(.bottom, 12)
                            .allowsHitTesting(false)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                            .animation(.spring(response: 0.3, dampingFraction: 0.85), value: viewModel.botState)
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
                            Task { await viewModel.send(text, attachments: files) }
                        },
                        onAbort: {
                            Task { await viewModel.abort() }
                        }
                    )
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
                            Image(systemName: "arrow.down.doc")
                                .font(.system(size: 32))
                            Text("Drop files to attach")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .foregroundStyle(Color.optaPrimary)
                    }
                    .transition(.opacity)
            }
        }
        .onDrop(of: [.fileURL, .image, .pdf], isTargeted: $isDragTarget) { providers in
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
        }
    }
    
    private func handleDrop(_ providers: [NSItemProvider]) {
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier("public.file-url") {
                provider.loadItem(forTypeIdentifier: "public.file-url", options: nil) { item, _ in
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
        .background(Color.optaSurface.opacity(0.4))
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
        .background(Color.optaSurface)
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

struct MessageRow: View {
    let message: ChatMessage
    let index: Int
    let total: Int
    
    @State private var appeared = false
    @State private var floatY: CGFloat = 0
    
    private var isRecent: Bool { total - index <= 3 }
    
    var body: some View {
        MessageBubble(message: message)
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
                // Very subtle ambient float for recent messages
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
    
    private var accentColor: Color {
        botAccentColor(for: viewModel.botConfig)
    }
    
    private var isConnecting: Bool {
        viewModel.connectionState == .connecting || viewModel.connectionState == .reconnecting
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Text(viewModel.botConfig.emoji)
                .font(.title2)
            
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
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Add Bot")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.optaTextPrimary)
            
            VStack(alignment: .leading, spacing: 12) {
                LabeledField("Name", text: $name, placeholder: "My Bot")
                LabeledField("Host", text: $host, placeholder: "127.0.0.1")
                LabeledField("Port", text: $port, placeholder: "18793")
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
                .disabled(name.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 400)
        .background(Color.optaSurface)
        .preferredColorScheme(.dark)
    }
}

struct LabeledField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    
    init(_ label: String, text: Binding<String>, placeholder: String) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
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
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        }
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

struct BotDetailEditor: View {
    let bot: BotConfig
    let onSave: (BotConfig) -> Void
    
    @State private var name: String
    @State private var host: String
    @State private var port: String
    @State private var token: String
    @State private var emoji: String
    
    init(bot: BotConfig, onSave: @escaping (BotConfig) -> Void) {
        self.bot = bot
        self.onSave = onSave
        _name = State(initialValue: bot.name)
        _host = State(initialValue: bot.host)
        _port = State(initialValue: String(bot.port))
        _token = State(initialValue: bot.token)
        _emoji = State(initialValue: bot.emoji)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LabeledField("Name", text: $name, placeholder: "Bot name")
            LabeledField("Host", text: $host, placeholder: "127.0.0.1")
            LabeledField("Port", text: $port, placeholder: "18793")
            LabeledField("Token", text: $token, placeholder: "Auth token")
            LabeledField("Emoji", text: $emoji, placeholder: "🤖")
            
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
            }
        }
    }
}

struct GeneralSettingsView: View {
    @EnvironmentObject var animPrefs: AnimationPreferences
    @AppStorage("optaplus.textAlignment") private var textAlignment: String = MessageTextAlignment.centeredExpanding.rawValue

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("OptaPlus v0.1.0")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    Text("Native OpenClaw chat client")
                        .font(.system(size: 13))
                        .foregroundColor(.optaTextSecondary)
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
