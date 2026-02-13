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

// MARK: - Chat View

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    let botConfig: BotConfig
    @State private var messageText = ""
    @State private var showThinkingExpanded = false

    var body: some View {
        ZStack(alignment: .top) {
            Color.optaVoid.ignoresSafeArea()

            VStack(spacing: 0) {
                messageList
                ChatInputBar(
                    text: $messageText,
                    isStreaming: viewModel.botState != .idle,
                    onSend: sendMessage,
                    onAbort: abortMessage
                )
            }

            if viewModel.botState == .thinking || !viewModel.agentEvents.isEmpty {
                ThinkingOverlay(
                    botState: viewModel.botState,
                    events: viewModel.agentEvents,
                    isExpanded: $showThinkingExpanded
                )
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
            }
        }
        .onChange(of: viewModel.errorMessage) { _, err in
            if err != nil {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
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
                            if shouldShowTimestamp(messages: viewModel.messages, at: index) {
                                TimestampSeparator(date: message.timestamp)
                            }
                            MessageBubble(message: message, botName: botConfig.name)
                                .id(message.id)
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
        }
    }

    private var streamingBubble: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(viewModel.streamingContent + "▊")
                    .font(.body)
                    .foregroundColor(.optaTextPrimary)
                    .textSelection(.enabled)
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
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            if !viewModel.streamingContent.isEmpty {
                proxy.scrollTo("streaming", anchor: .bottom)
            } else if let last = viewModel.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}
