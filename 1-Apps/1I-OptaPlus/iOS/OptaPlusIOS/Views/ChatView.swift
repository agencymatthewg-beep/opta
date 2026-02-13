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
    }
}

// MARK: - Chat View

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    let botConfig: BotConfig
    @State private var messageText = ""
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

    var body: some View {
        ZStack(alignment: .top) {
            Color.optaVoid.ignoresSafeArea()

            VStack(spacing: 0) {
                ZStack(alignment: .bottom) {
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

                    // Scroll to bottom FAB
                    if !isAtBottom {
                        Button {
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
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .transition(.scale.combined(with: .opacity))
                    }
                }

                // Reply preview
                if let replyMsg = viewModel.replyingTo {
                    ReplyInputPreview(message: replyMsg) {
                        viewModel.replyingTo = nil
                    }
                }

                ChatInputBar(
                    text: $messageText,
                    isStreaming: viewModel.botState != .idle,
                    onSend: sendMessage,
                    onAbort: abortMessage
                )
            }

            // Connection toast
            if showConnectionToast {
                Text(connectionToastMessage)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.optaGreen.opacity(0.9)))
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            if viewModel.botState == .thinking || !viewModel.agentEvents.isEmpty {
                ThinkingOverlay(
                    botState: viewModel.botState,
                    events: viewModel.agentEvents,
                    isExpanded: $showThinkingExpanded
                )
                .padding(.top, showConnectionToast ? 40 : 0)
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
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                sessionModePicker
            }
        }
        .onAppear {
            if viewModel.connectionState == .disconnected {
                viewModel.connect()
            }
        }
        .onChange(of: viewModel.connectionState) { old, new in
            if old != .connected && new == .connected {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                connectionToastMessage = "Connected to \(botConfig.name)"
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
                Task {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    withAnimation(.easeOut(duration: 0.3)) {
                        showConnectionToast = false
                    }
                }
            } else if old == .connected && new == .disconnected {
                connectionToastMessage = "Disconnected"
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    showConnectionToast = true
                }
                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    withAnimation(.easeOut(duration: 0.3)) {
                        showConnectionToast = false
                    }
                }
            }
        }
        .onChange(of: viewModel.errorMessage) { _, err in
            if err != nil {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
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
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    if viewModel.messages.isEmpty {
                        if viewModel.connectionState == .connected {
                            emptyChat
                        } else if viewModel.connectionState == .disconnected {
                            disconnectedState
                        }
                    }

                    ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
                        VStack(spacing: 4) {
                            if shouldShowDateSeparator(messages: viewModel.messages, at: index) {
                                DateSeparatorPill(text: dateSeparatorText(message.timestamp))
                            }
                            if shouldShowTimestamp(messages: viewModel.messages, at: index) {
                                TimestampSeparator(date: message.timestamp)
                            }
                            MessageBubble(
                                message: message,
                                botName: botConfig.name,
                                botId: botConfig.id,
                                allMessages: viewModel.messages,
                                onReply: { msg in viewModel.replyingTo = msg },
                                onScrollTo: { id in scrollToMessageId = id }
                            )
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
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .refreshable {
                await viewModel.loadHistory()
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.messages.count) { _, _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: viewModel.streamingContent) { _, _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: scrollToMessageId) { _, id in
                if let id {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                    scrollToMessageId = nil
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
        }
        .padding(.top, 60)
    }

    // MARK: - Toolbar

    private var connectionBadge: some View {
        Circle()
            .fill(viewModel.connectionState == .connected ? Color.optaGreen :
                  viewModel.connectionState == .disconnected ? Color.optaTextMuted : Color.optaAmber)
            .frame(width: 8, height: 8)
    }

    private var sessionModePicker: some View {
        Menu {
            if let session = viewModel.activeSession {
                ForEach(SessionMode.allCases, id: \.self) { mode in
                    Button {
                        switchMode(to: mode)
                    } label: {
                        Label(mode.label, systemImage: mode.icon)
                    }
                    .disabled(session.mode == mode)
                }
            }
        } label: {
            Image(systemName: viewModel.activeSession?.mode.icon ?? "link")
                .foregroundColor(.optaPrimary)
        }
    }

    // MARK: - Actions

    private func sendMessage() {
        let text = messageText
        messageText = ""
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            await viewModel.send(text)
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
            let newSession = viewModel.createSession(name: mode.label, mode: mode)
            viewModel.switchSession(newSession)
        } else {
            if let idx = viewModel.sessions.firstIndex(where: { $0.id == session.id }) {
                viewModel.sessions[idx] = ChatSession(
                    id: session.id,
                    name: session.name,
                    sessionKey: session.sessionKey,
                    mode: mode,
                    createdAt: session.createdAt,
                    isPinned: session.isPinned
                )
                viewModel.activeSession = viewModel.sessions[idx]
            }
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        let reduceMotion = UIAccessibility.isReduceMotionEnabled
        let animation: Animation = reduceMotion ? .easeOut(duration: 0.15) : .spring(response: 0.3, dampingFraction: 0.8)
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
                    withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                        visible = false
                    }
                }
            }
    }
}
