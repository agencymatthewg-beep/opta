//
//  ChatView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

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
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if viewModel.messages.isEmpty && viewModel.connectionState == .connected {
                        emptyChat
                    }

                    ForEach(viewModel.messages) { message in
                        MessageBubble(message: message, botName: botConfig.name)
                            .id(message.id)
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
        guard var session = viewModel.activeSession else { return }
        // Create new session with different mode
        if mode == .isolated {
            let newSession = viewModel.createSession(name: mode.label, mode: mode)
            viewModel.switchSession(newSession)
        } else {
            // For synced/direct, modify existing
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
