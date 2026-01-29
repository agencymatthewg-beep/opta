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
/// - Connection status indicator in toolbar
/// - Uses scrollPosition(id:anchor:) for programmatic scroll control
struct ChatView: View {
    /// Chat view model (initialized with placeholder for now)
    @State private var viewModel: ChatViewModel

    /// Current scroll position tracking
    @State private var scrollPosition: MessageID?

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
                ForEach(viewModel.messages) { message in
                    MessageBubble(message: message)
                        .id(message.id)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $scrollPosition, anchor: .bottom)
        .onChange(of: viewModel.messages.count) { _, _ in
            // Auto-scroll to bottom when new message arrives
            withAnimation(.easeOut(duration: 0.2)) {
                scrollPosition = viewModel.messages.last?.id
            }
        }
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
