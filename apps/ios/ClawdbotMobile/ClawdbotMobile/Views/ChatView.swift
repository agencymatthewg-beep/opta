//
//  ChatView.swift
//  ClawdbotMobile
//
//  Main chat interface with message list, auto-scroll, and connection status.
//  Uses iOS 17+ scrollPosition API for smooth scroll control.
//

import SwiftUI
import ClawdbotKit

/// Main chat interface view
///
/// Features:
/// - ScrollView with LazyVStack for efficient message rendering
/// - Auto-scroll to bottom on new messages
/// - Real-time streaming message display
/// - Connection status indicator in toolbar
/// - Uses scrollPosition(id:anchor:) for programmatic scroll control
/// - ChatInputBar with keyboard-aware layout via safeAreaInset
struct ChatView: View {
    /// Chat view model (initialized with placeholder for now)
    @State private var viewModel: ChatViewModel

    /// Current scroll position tracking (String to handle both MessageID and streaming IDs)
    @State private var scrollPosition: String?

    /// Input text for message composition
    @State private var inputText = ""

    /// Focus state for keyboard management
    @FocusState private var isInputFocused: Bool

    /// Sorted streaming message IDs for consistent ordering
    private var sortedStreamingIDs: [String] {
        viewModel.streamingMessages.keys.sorted()
    }

    /// Initialize with a protocol handler
    /// - Parameter protocolHandler: The protocol handler for message operations
    init(protocolHandler: ProtocolHandler) {
        _viewModel = State(initialValue: ChatViewModel(protocolHandler: protocolHandler))
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            messageList
                .navigationTitle("Clawdbot")
                .toolbarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        connectionStatusIndicator
                    }
                }
                .background(Color.clawdbotBackground)
        }
    }

    // MARK: - Message List

    /// Scrollable message list with auto-scroll behavior
    private var messageList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                // Completed messages
                ForEach(viewModel.messages) { message in
                    MessageBubble(message: message)
                        .id(message.id.value)
                }

                // Streaming messages (actively being received)
                ForEach(sortedStreamingIDs, id: \.self) { messageID in
                    if let content = viewModel.streamingMessages[messageID] {
                        MessageBubble(
                            streamingContent: content,
                            sender: .bot(name: "Clawdbot")
                        )
                        .id("streaming-\(messageID)")
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $scrollPosition, anchor: .bottom)
        .onChange(of: viewModel.messages.count) { _, _ in
            // Auto-scroll to bottom when new message arrives
            scrollToBottom()
        }
        .onChange(of: viewModel.streamingMessages.count) { _, _ in
            // Auto-scroll when streaming messages change
            scrollToBottom()
        }
        .onChange(of: streamingContentChanged) { _, _ in
            // Auto-scroll as streaming content updates
            scrollToBottom()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                Divider()
                ChatInputBar(
                    text: $inputText,
                    isFocused: $isInputFocused,
                    onSend: sendMessage,
                    isEnabled: viewModel.connectionState == .connected
                )
            }
        }
    }

    /// Computed property to trigger updates when any streaming content changes
    private var streamingContentChanged: Int {
        viewModel.streamingMessages.values.reduce(0) { $0 + $1.count }
    }

    /// Scroll to the bottom of the chat
    private func scrollToBottom() {
        withAnimation(.easeOut(duration: 0.2)) {
            // If streaming, scroll to the streaming message
            if let lastStreamingID = sortedStreamingIDs.last {
                scrollPosition = "streaming-\(lastStreamingID)"
            } else if let lastMessage = viewModel.messages.last {
                scrollPosition = lastMessage.id.value
            }
        }
    }

    // MARK: - Send Message

    /// Send the current input text as a message
    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        inputText = ""  // Clear input immediately for rapid messaging
        Task {
            await viewModel.send(text)
        }
        // Keep keyboard open - do NOT set isInputFocused = false
    }

    // MARK: - Connection Status

    /// Connection status indicator dot
    private var connectionStatusIndicator: some View {
        Circle()
            .fill(connectionStatusColor)
            .frame(width: 10, height: 10)
            .overlay(
                Circle()
                    .stroke(connectionStatusColor.opacity(0.3), lineWidth: 2)
            )
    }

    /// Color for connection status
    private var connectionStatusColor: Color {
        switch viewModel.connectionState {
        case .connected:
            return .clawdbotGreen
        case .connecting:
            return .clawdbotAmber
        case .disconnected:
            return .clawdbotRed
        case .reconnecting:
            return .clawdbotAmber
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ChatView_Previews: PreviewProvider {
    static var previews: some View {
        // Note: Preview requires mock ProtocolHandler
        // For now, we'll show a placeholder
        NavigationStack {
            VStack {
                Text("Chat Preview")
                    .font(.headline)
                Text("Requires ProtocolHandler initialization")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .navigationTitle("Clawdbot")
            .toolbarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
    }
}
#endif
