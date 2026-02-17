//
//  ChatView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Timestamp Helpers

private func groupTimestamp(_ date: Date) -> String {
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

private func shouldShowTimestamp(messages: [ChatMessage], at index: Int) -> Bool {
    guard index < messages.count else { return false }
    let msg = messages[index]
    if index == 0 { return true }
    let prev = messages[index - 1]
    return msg.timestamp.timeIntervalSince(prev.timestamp) > 120
}

private func shouldShowDateSeparator(messages: [ChatMessage], at index: Int) -> Bool {
    guard index < messages.count else { return false }
    if index == 0 { return true }
    let cal = Calendar.current
    return !cal.isDate(messages[index].timestamp, inSameDayAs: messages[index - 1].timestamp)
}

private func dateSeparatorText(_ date: Date) -> String {
    let cal = Calendar.current
    if cal.isDateInToday(date) { return "Today" }
    if cal.isDateInYesterday(date) { return "Yesterday" }
    let f = DateFormatter()
    f.dateFormat = "EEEE, MMM d"
    return f.string(from: date)
}

// MARK: - Timestamp Separator

private struct TimestampSeparator: View {
    let date: Date

    var body: some View {
        Text(groupTimestamp(date))
            .font(.system(size: 10, weight: .medium))
            .foregroundColor(.optaTextMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .accessibilityLabel("Timestamp: \(groupTimestamp(date))")
    }
}

// MARK: - Date Separator Pill

private struct DateSeparatorPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundColor(.optaTextMuted)
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            .background(Capsule().fill(Color.optaSurface))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .accessibilityLabel("Date: \(text)")
    }
}

// MARK: - Typing Indicator

private struct TypingIndicator: View {
    @State private var phase = 0
    private let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.optaTextMuted)
                    .frame(width: 6, height: 6)
                    .offset(y: phase == i ? -4 : 0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.5), value: phase)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.optaBorder, lineWidth: 1))
        )
        .onReceive(timer) { _ in
            phase = (phase + 1) % 4
        }
        .accessibilityLabel("Bot is typing")
    }
}

// MARK: - Scroll Position Tracking

private struct BottomAnchorYKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Chat View

struct ChatView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var viewModel: ChatViewModel
    let botConfig: BotConfig
    @State private var messageText = ""
    @State private var pendingAttachments: [ChatAttachment] = []
    @State private var showThinkingExpanded = false
    @State private var showExportSheet = false
    @State private var exportFileURL: URL?
    @State private var showConnectionToast = false
    @State private var connectionToastMessage = ""
    @State private var isAtBottom = true
    @State private var unreadCount = 0
    @State private var showPinnedSheet = false
    @State private var showBookmarksSheet = false
    @State private var scrollToMessageId: String? = nil
    @StateObject private var pinManager = PinManager.shared
    @StateObject private var searchEngine = SearchEngine()
    @State private var showChannelSwitcher = false
    @StateObject private var mentionAutocomplete = MentionAutocomplete()

    var body: some View {
        ZStack(alignment: .top) {
            Color.optaVoid.ignoresSafeArea()

            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    messageList

                    // Gradient fade at top
                    LinearGradient(
                        colors: [Color.optaVoid, Color.optaVoid.opacity(0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 40)
                    .allowsHitTesting(false)
                }

                // Reply preview
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
                            let result = mentionAutocomplete.accept(bot: bot, in: messageText)
                            messageText = result.newText
                        }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                ChatInputBar(
                    text: $messageText,
                    attachments: $pendingAttachments,
                    isStreaming: viewModel.botState != .idle,
                    queuedCount: viewModel.queuedMessageCount,
                    onSend: sendMessage,
                    onAbort: abortMessage
                )
                .onChange(of: messageText) { _, newText in
                    mentionAutocomplete.update(
                        text: newText,
                        cursorOffset: newText.count,
                        bots: appState.bots
                    )
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: mentionAutocomplete.isActive)

            // Offline banner (shown when not connected and not showing success toast)
            if !showConnectionToast && viewModel.connectionState != .connected {
                offlineBanner
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            // Connection success toast
            if showConnectionToast {
                Text(connectionToastMessage)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.optaGreen.opacity(0.9)))
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityLabel(connectionToastMessage)
            }

            if viewModel.botState == .thinking || !viewModel.agentEvents.isEmpty {
                ThinkingOverlay(
                    botState: viewModel.botState,
                    events: viewModel.agentEvents,
                    isExpanded: $showThinkingExpanded
                )
                .padding(.top, showConnectionToast || viewModel.connectionState != .connected ? 56 : 0)
            }
        }
        .navigationTitle(botConfig.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 8) {
                    Text(botConfig.emoji)
                    Text(botConfig.name)
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)
                    connectionBadge
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(botConfig.name), \(viewModel.connectionState == .connected ? "connected" : viewModel.connectionState == .disconnected ? "disconnected" : "connecting")")
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    ForEach(ChatExportFormat.allCases, id: \.rawValue) { format in
                        Button("\(format.label) (.\(format.fileExtension))") {
                            if let url = ChatExporter.temporaryFileURL(
                                messages: viewModel.messages,
                                botName: botConfig.name,
                                format: format
                            ) {
                                exportFileURL = url
                                showExportSheet = true
                            }
                        }
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Export chat")
                .accessibilityHint("Export chat history in various formats")
                .disabled(viewModel.messages.isEmpty)
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        showPinnedSheet = true
                    } label: {
                        Label("Pinned Messages", systemImage: "pin")
                    }
                    Button {
                        showBookmarksSheet = true
                    } label: {
                        Label("Bookmarks", systemImage: "bookmark")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("More options")
                .accessibilityHint("View pinned messages and bookmarks")
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showChannelSwitcher = true
                } label: {
                    channelIndicator
                }
                .accessibilityLabel("Switch channel")
                .accessibilityHint("Opens channel and session switcher")
            }
        }
        .onAppear {
            if viewModel.connectionState == .disconnected {
                viewModel.connect()
            }
        }
        .onChange(of: viewModel.connectionState) { old, new in
            if old != .connected && new == .connected {
                HapticManager.shared.notification(.success)
                connectionToastMessage = "Connected to \(botConfig.name)"
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
                Task {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    withAnimation(.optaSpring) {
                        showConnectionToast = false
                    }
                }
            } else if old == .connected && new == .disconnected {
                HapticManager.shared.notification(.warning)
                connectionToastMessage = "Disconnected"
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    withAnimation(.optaSpring) {
                        showConnectionToast = false
                    }
                }
            }
        }
        .onChange(of: viewModel.errorMessage) { _, err in
            if err != nil {
                HapticManager.shared.notification(.error)
            }
        }
        .onChange(of: viewModel.messages.count) { old, new in
            if new > old && !isAtBottom {
                unreadCount += (new - old)
            }
        }
        .alert("Clear Chat History",
               isPresented: $viewModel.showClearConfirmation) {
            Button("Clear", role: .destructive) {
                viewModel.clearChat()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Clear chat history for \(botConfig.name)? This removes local messages only.")
        }
        .sheet(isPresented: $showExportSheet) {
            if let url = exportFileURL {
                ShareSheet(activityItems: [url])
            }
        }
        .sheet(isPresented: $showPinnedSheet) {
            PinnedMessagesSheet(
                messages: pinManager.pinnedMessages(from: viewModel.messages, botId: botConfig.id),
                botName: botConfig.name,
                onScrollTo: { id in
                    scrollToMessageId = id
                }
            )
        }
        .sheet(isPresented: $showBookmarksSheet) {
            BookmarksView()
        }
        .sheet(isPresented: $showChannelSwitcher) {
            ChannelSwitcherSheet(viewModel: viewModel, botConfig: botConfig)
        }
        .searchable(text: $searchEngine.query, prompt: "Search messages...")
        .searchScopes($searchEngine.scope) {
            ForEach(SearchScope.allCases, id: \.self) { scope in
                Text(scope.rawValue).tag(scope)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .searchEngineQueryReady)) { _ in
            if searchEngine.scope == .thisChat {
                searchEngine.searchLocal(messages: viewModel.messages)
            } else {
                searchEngine.searchGlobal(viewModel: viewModel)
            }
        }
        .onChange(of: searchEngine.scope) { _, _ in
            let trimmed = searchEngine.query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if searchEngine.scope == .thisChat {
                searchEngine.searchLocal(messages: viewModel.messages)
            } else {
                searchEngine.searchGlobal(viewModel: viewModel)
            }
        }
        .searchSuggestions {
            if !searchEngine.query.isEmpty && !searchEngine.results.isEmpty {
                ForEach(searchEngine.results.prefix(8)) { result in
                    Button {
                        scrollToMessageId = result.messageId
                    } label: {
                        SearchSnippetView(result: result, query: searchEngine.query)
                    }
                }
            }
        }
    }

    // MARK: - Message Filtering

    /// Messages suitable for display — hides empty, heartbeat protocol, and pure-whitespace messages.
    private var displayMessages: [ChatMessage] {
        viewModel.messages.filter { msg in
            let trimmed = msg.content.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return false }
            if trimmed == "HEARTBEAT_OK" || trimmed == "AT_OK" { return false }
            if trimmed.count <= 2, trimmed.allSatisfy(\.isNumber) { return false }
            return true
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    let filtered = displayMessages
                    if filtered.isEmpty {
                        if viewModel.connectionState == .connected {
                            emptyChat
                        } else if viewModel.connectionState == .disconnected {
                            disconnectedState
                        }
                    }

                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, message in
                        let isSearchMatch = !searchEngine.query.isEmpty && searchEngine.results.contains(where: { $0.messageId == message.id })
                        let isCurrentMatch = searchEngine.currentResult?.messageId == message.id

                        VStack(spacing: 4) {
                            if shouldShowDateSeparator(messages: filtered, at: index) {
                                DateSeparatorPill(text: dateSeparatorText(message.timestamp))
                            }
                            if shouldShowTimestamp(messages: filtered, at: index) {
                                TimestampSeparator(date: message.timestamp)
                            }
                            MessageBubble(
                                message: message,
                                botName: botConfig.name,
                                botId: botConfig.id,
                                allMessages: filtered,
                                onReply: { msg in viewModel.replyingTo = msg },
                                onScrollTo: { id in scrollToMessageId = id },
                                onReact: { action, messageId in
                                    HapticManager.shared.impact(.medium)
                                    Task { await viewModel.sendReaction(action, for: messageId) }
                                },
                                onRetry: { failedMsg in
                                    HapticManager.shared.impact(.light)
                                    Task { await viewModel.retrySend(failedMsg) }
                                }
                            )
                            .searchMatchGlow(isMatch: isSearchMatch, isCurrent: isCurrentMatch)
                            .id(message.id)
                        }
                    }

                    // Enhanced typing indicator
                    if viewModel.botState == .thinking || viewModel.botState == .typing {
                        if viewModel.streamingContent.isEmpty {
                            HStack {
                                EnhancedTypingIndicator(
                                    botName: botConfig.name,
                                    isActive: true
                                )
                                Spacer()
                            }
                        }
                    }

                    // Streaming bubble
                    if !viewModel.streamingContent.isEmpty {
                        streamingBubble
                            .id("streaming")
                    }

                    // Bottom sentinel for scroll position tracking
                    Color.clear
                        .frame(height: 1)
                        .id("bottomAnchor")
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: BottomAnchorYKey.self,
                                    value: geo.frame(in: .named("chatScroll")).minY
                                )
                            }
                        )
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .coordinateSpace(name: "chatScroll")
            .onPreferenceChange(BottomAnchorYKey.self) { bottomY in
                let threshold: CGFloat = 80
                let scrollViewHeight = UIScreen.main.bounds.height
                let newAtBottom = bottomY <= scrollViewHeight + threshold
                if newAtBottom != isAtBottom {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        isAtBottom = newAtBottom
                    }
                    if newAtBottom { unreadCount = 0 }
                }
            }
            .refreshable {
                HapticManager.shared.impact(.rigid)
                await viewModel.loadHistory()
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.messages.count) { _, _ in
                if isAtBottom { scrollToBottom(proxy: proxy) }
            }
            .onChange(of: viewModel.streamingContent) { _, _ in
                if isAtBottom { scrollToBottom(proxy: proxy) }
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
                // Scroll to bottom FAB
                if !isAtBottom {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            proxy.scrollTo("bottomAnchor", anchor: .bottom)
                        }
                        isAtBottom = true
                        unreadCount = 0
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "chevron.down")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 36, height: 36)
                                .background(Color.optaPrimary)
                                .clipShape(Circle())
                                .shadow(color: Color.optaPrimary.opacity(0.4), radius: 8)

                            if unreadCount > 0 {
                                Text("\(unreadCount)")
                                    .font(.caption2.bold())
                                    .foregroundColor(.white)
                                    .frame(minWidth: 18, minHeight: 18)
                                    .background(Color.optaRed)
                                    .clipShape(Capsule())
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                    .padding(.trailing, 16)
                    .padding(.bottom, 8)
                    .transition(.scale.combined(with: .opacity))
                    .accessibilityLabel("Scroll to bottom")
                    .accessibilityHint(unreadCount > 0 ? "\(unreadCount) unread messages" : "Jump to latest messages")
                }
            }
        }
    }

    private var streamingBubble: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 0) {
                    Text(viewModel.streamingContent)
                        .font(.body)
                        .foregroundColor(.optaTextPrimary)
                        .textSelection(.enabled)
                    BlinkingCursor()
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaElevated)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.optaBorder, lineWidth: 1)
                    )
            )
            Spacer(minLength: 60)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Bot is responding: \(viewModel.streamingContent)")
    }

    private var emptyChat: some View {
        VStack(spacing: 12) {
            Text(botConfig.emoji)
                .font(.system(size: 48))
            Text("Start a conversation with \(botConfig.name)")
                .font(.subheadline)
                .foregroundColor(.optaTextSecondary)
        }
        .padding(.top, 60)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("No messages yet. Start a conversation with \(botConfig.name)")
    }

    private var disconnectedState: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 36))
                .foregroundColor(.optaTextMuted)
            Text("Disconnected")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)
            Button {
                viewModel.connect()
            } label: {
                Label("Reconnect", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.optaPrimary)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(
                        Capsule()
                            .stroke(Color.optaPrimary, lineWidth: 1.5)
                    )
            }
            .accessibilityLabel("Reconnect to \(botConfig.name)")
            .accessibilityHint("Attempts to establish a WebSocket connection")
        }
        .padding(.top, 60)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Disconnected from \(botConfig.name)")
    }

    // MARK: - Offline Banner

    private var offlineBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: viewModel.connectionState == .reconnecting ? "arrow.triangle.2.circlepath" : "wifi.slash")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
                .rotationEffect(viewModel.connectionState == .reconnecting ? .degrees(360) : .degrees(0))
                .animation(.optaSpin, value: viewModel.connectionState == .reconnecting)

            VStack(alignment: .leading, spacing: 1) {
                if viewModel.connectionState == .reconnecting {
                    if let countdown = viewModel.reconnectCountdown {
                        Text("Reconnecting in \(countdown)s...")
                            .font(.caption.weight(.medium))
                            .foregroundColor(.white)
                    } else {
                        Text("Reconnecting...")
                            .font(.caption.weight(.medium))
                            .foregroundColor(.white)
                    }
                } else {
                    Text("Offline")
                        .font(.caption.weight(.medium))
                        .foregroundColor(.white)
                }

                if viewModel.queuedMessageCount > 0 {
                    Text("\(viewModel.queuedMessageCount) message\(viewModel.queuedMessageCount == 1 ? "" : "s") queued")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.8))
                } else {
                    Text("Messages will be sent when connected")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.8))
                }
            }

            Spacer()

            Button {
                HapticManager.shared.impact(.medium)
                viewModel.reconnect()
            } label: {
                Text("Reconnect")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.optaAmber)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(0.15))
                    )
            }
            .accessibilityLabel("Reconnect now")
            .accessibilityHint("Immediately attempts to reconnect to \(botConfig.name)")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaAmber.opacity(0.85))
        )
        .padding(.horizontal, 12)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            viewModel.connectionState == .reconnecting
                ? "Reconnecting to \(botConfig.name). \(viewModel.queuedMessageCount) messages queued."
                : "Offline. \(viewModel.queuedMessageCount) messages queued."
        )
    }

    // MARK: - Toolbar

    private var connectionBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(viewModel.connectionState == .connected ? Color.optaGreen :
                      viewModel.connectionState == .disconnected ? Color.optaTextMuted : Color.optaAmber)
                .frame(width: 8, height: 8)

            if viewModel.connectionState == .connected {
                Image(systemName: viewModel.connectionRoute == .remote ? "globe" : "wifi")
                    .font(.system(size: 9))
                    .foregroundColor(viewModel.connectionRoute == .remote ? .optaAmber : .optaGreen)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Connection status")
        .accessibilityValue(viewModel.connectionState == .connected ? "Connected via \(viewModel.connectionRoute == .remote ? "remote" : "LAN")" : viewModel.connectionState == .disconnected ? "Disconnected" : "Connecting")
    }

    private var channelIndicator: some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2)
                .fill(activeChannelColor)
                .frame(width: 3, height: 16)

            Image(systemName: viewModel.activeSession?.channelType?.icon ?? viewModel.activeSession?.mode.icon ?? "link")
                .font(.system(size: 13))
                .foregroundColor(activeChannelColor)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Channel: \(viewModel.activeSession?.channelType?.label ?? viewModel.activeSession?.mode.label ?? "Default")")
    }

    private var activeChannelColor: Color {
        if let ct = viewModel.activeSession?.channelType {
            switch ct {
            case .telegram: return .optaBlue
            case .direct: return .optaCoral
            case .whatsapp: return .optaGreen
            case .discord: return .optaIndigo
            }
        }
        return .optaPrimary
    }

    // MARK: - Actions

    private func sendMessage() {
        let text = messageText
        let files = pendingAttachments
        messageText = ""
        pendingAttachments = []
        mentionAutocomplete.dismiss()
        HapticManager.shared.impact(.light)

        // Check for @mention routing to a different bot
        if let targetBotId = MentionParser.firstMentionedBotId(from: text, knownBots: appState.bots),
           targetBotId != botConfig.id,
           let targetBot = appState.bots.first(where: { $0.id == targetBotId }) {
            let targetVM = appState.viewModel(for: targetBot)
            if targetVM.connectionState == .disconnected {
                targetVM.connect()
            }
            Task { await targetVM.send(text, attachments: files) }
        } else {
            Task { await viewModel.send(text, attachments: files) }
        }
    }

    private func abortMessage() {
        Task {
            await viewModel.abort()
        }
    }

    private func switchMode(to mode: SessionMode) {
        guard let session = viewModel.activeSession else { return }
        if mode == .isolated {
            if let newSession = viewModel.createSession(name: mode.label, mode: mode) {
                viewModel.switchSession(newSession)
            }
        } else {
            if let idx = viewModel.sessions.firstIndex(where: { $0.id == session.id }) {
                viewModel.sessions[idx] = ChatSession(
                    id: session.id,
                    name: session.name,
                    sessionKey: session.sessionKey,
                    mode: mode,
                    createdAt: session.createdAt,
                    isPinned: session.isPinned,
                    channelType: session.channelType,
                    colorTag: session.colorTag
                )
                viewModel.activeSession = viewModel.sessions[idx]
            }
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        let reduceMotion = UIAccessibility.isReduceMotionEnabled
        let animation: Animation = reduceMotion ? .optaSnap : .spring(response: 0.3, dampingFraction: 0.8)
        withAnimation(animation) {
            if !viewModel.streamingContent.isEmpty {
                proxy.scrollTo("streaming", anchor: .bottom)
            } else if let last = viewModel.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Blinking Cursor

private struct BlinkingCursor: View {
    @State private var visible = true

    var body: some View {
        Text("▊")
            .font(.body)
            .foregroundColor(.optaPrimary)
            .opacity(visible ? 1.0 : 0.0)
            .onAppear {
                if !UIAccessibility.isReduceMotionEnabled {
                    withAnimation(.optaPulse) {
                        visible = false
                    }
                }
            }
    }
}
