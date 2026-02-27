//
//  MessageThreadingModule.swift
//  OptaPlusMacOS
//
//  F3. Message Threading (Slack-style) — reply to specific messages to create
//  visual threads. Threads appear as inline expandable cards with indented replies.
//  Uses the existing ChatMessage.replyTo field for thread linkage.
//
//  Module registration:  MessageThreadingModule.register()
//  Module removal:       Delete this file. Messages still have replyTo but it is unused visually.
//
//  Keyboard shortcuts:
//    Cmd+Shift+R  — Reply to selected message (opens thread composer)
//    Escape       — Close active thread view
//
//  Event bus:
//    Posts:    .module_threading_opened(parentMessageId: String)
//              .module_threading_closed
//    Listens:  .module_threading_replyTo(messageId: String)
//              .module_threading_open(parentMessageId: String)
//
//  Persistence:
//    No new persistence — uses ChatMessage.replyTo which is already stored by MessageStore.
//    Thread collapsed/expanded state is ephemeral (per-session only).
//
//  Inter-module interaction:
//    - ChatMessage.replyTo is the linking field (already exists in Models.swift)
//    - MessageBubble shows inline reply preview when replyTo is set
//    - SemanticSearchModule searches thread replies alongside main messages
//    - AnalyticsModule can count thread depths
//
//  How to add:
//    1. Wrap MessageBubble in ThreadedMessageView in ChatView's ForEach
//    2. Add "Reply" to MessageBubble context menu
//    3. Add ThreadComposer overlay to ChatView
//    4. Wire keyboard shortcuts
//
//  How to remove:
//    1. Delete this file
//    2. Unwrap ThreadedMessageView — show bare MessageBubble
//    3. Remove "Reply" from context menu
//    4. Existing messages with replyTo still load fine but are not visually threaded
//

import SwiftUI
import Combine
import OptaMolt
import os.log

// MARK: - Thread Info

/// Computed thread information for a message that has replies.
struct ThreadInfo: Identifiable, Equatable {
    let id: String  // Parent message ID
    let parentMessage: ChatMessage
    let replies: [ChatMessage]
    let lastReplyTimestamp: Date
    let participantCount: Int

    var replyCount: Int { replies.count }

    var participantNames: [String] {
        var names = Set<String>()
        for reply in replies {
            switch reply.sender {
            case .user: names.insert("You")
            case .bot(let name): names.insert(name)
            }
        }
        return Array(names).sorted()
    }
}

// MARK: - Thread State

/// Tracks which threads are expanded and the active thread for composing.
@MainActor
final class ThreadStateManager: ObservableObject {
    @Published var expandedThreadIds: Set<String> = []
    @Published var activeThreadParentId: String?  // Thread currently being composed into
    @Published var threadComposerText: String = ""
    @Published var hoveredThreadId: String?

    // MARK: - Thread Computation

    /// Build thread info from a flat message list.
    func buildThreads(from messages: [ChatMessage]) -> [String: ThreadInfo] {
        var threads: [String: [ChatMessage]] = [:]

        // Group replies by parent
        for msg in messages {
            if let parentId = msg.replyTo {
                threads[parentId, default: []].append(msg)
            }
        }

        // Build ThreadInfo for each parent
        var result: [String: ThreadInfo] = [:]
        for (parentId, replies) in threads {
            guard let parent = messages.first(where: { $0.id == parentId }) else { continue }

            let sortedReplies = replies.sorted { $0.timestamp < $1.timestamp }
            let participants = Set(replies.map { msg -> String in
                switch msg.sender {
                case .user: return "user"
                case .bot(let name): return name
                }
            })

            result[parentId] = ThreadInfo(
                id: parentId,
                parentMessage: parent,
                replies: sortedReplies,
                lastReplyTimestamp: sortedReplies.last?.timestamp ?? parent.timestamp,
                participantCount: participants.count
            )
        }

        return result
    }

    /// Messages that are NOT replies (top-level messages for the main list).
    func topLevelMessages(from messages: [ChatMessage]) -> [ChatMessage] {
        messages.filter { $0.replyTo == nil }
    }

    // MARK: - Thread Actions

    func toggleThread(_ parentId: String) {
        if expandedThreadIds.contains(parentId) {
            expandedThreadIds.remove(parentId)
        } else {
            expandedThreadIds.insert(parentId)
        }
    }

    func openComposer(for parentId: String) {
        activeThreadParentId = parentId
        threadComposerText = ""
        if !expandedThreadIds.contains(parentId) {
            expandedThreadIds.insert(parentId)
        }
        NotificationCenter.default.post(
            name: .module_threading_opened,
            object: nil,
            userInfo: ["parentMessageId": parentId]
        )
    }

    func closeComposer() {
        activeThreadParentId = nil
        threadComposerText = ""
        NotificationCenter.default.post(name: .module_threading_closed, object: nil)
    }
}

// MARK: - Threaded Message View

/// Wraps a MessageBubble and shows thread replies inline when expanded.
/// Drop this in place of `MessageBubble(...)` in the chat ForEach.
struct ThreadedMessageView: View {
    let message: ChatMessage
    let threadInfo: ThreadInfo?
    let botId: String

    @ObservedObject var threadState: ThreadStateManager
    @EnvironmentObject var appState: AppState

    private var accentColor: Color {
        if let bot = appState.bots.first(where: { $0.id == botId }) {
            return botAccentColor(for: bot)
        }
        return .optaPrimary
    }

    private var isExpanded: Bool {
        guard let info = threadInfo else { return false }
        return threadState.expandedThreadIds.contains(info.id)
    }

    private var isHovered: Bool {
        threadState.hoveredThreadId == message.id
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Main message bubble
            MessageBubble(
                message: message,
                botId: botId
            )
            .overlay(alignment: .bottomTrailing) {
                if threadInfo != nil {
                    threadIndicator
                        .offset(x: -8, y: 4)
                }
            }
            .onHover { hover in
                withAnimation(.optaSnap) {
                    threadState.hoveredThreadId = hover ? message.id : nil
                }
            }

            // Thread replies (expanded)
            if let info = threadInfo, isExpanded {
                threadRepliesView(info)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .top)),
                        removal: .opacity
                    ))
            }
        }
    }

    // MARK: - Thread Indicator

    private var threadIndicator: some View {
        Group {
            if let info = threadInfo {
                Button(action: {
                    withAnimation(.optaSpring) {
                        threadState.toggleThread(info.id)
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 8))

                        Text("\(info.replyCount)")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))

                        if isExpanded {
                            Image(systemName: "chevron.up")
                                .font(.system(size: 7))
                        }
                    }
                    .foregroundColor(isExpanded ? .optaPrimary : .optaTextSecondary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(
                        Capsule().fill(
                            isExpanded ? Color.optaPrimary.opacity(0.12) : Color.optaSurface.opacity(0.6)
                        )
                    )
                    .overlay(
                        Capsule().stroke(
                            isExpanded ? Color.optaPrimary.opacity(0.2) : Color.optaBorder.opacity(0.1),
                            lineWidth: 0.5
                        )
                    )
                }
                .buttonStyle(.plain)
                .help("\(info.replyCount) replies from \(info.participantNames.joined(separator: ", "))")
            }
        }
    }

    // MARK: - Thread Replies

    private func threadRepliesView(_ info: ThreadInfo) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Thread connector line
            HStack(spacing: 0) {
                threadConnector
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 4) {
                    // Thread header
                    HStack(spacing: 6) {
                        Text("Thread")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        Text("\(info.replyCount) replies")
                            .font(.sora(9))
                            .foregroundColor(.optaTextMuted)

                        Spacer()

                        Text(info.lastReplyTimestamp, style: .relative)
                            .font(.sora(9))
                            .foregroundColor(.optaTextMuted)
                    }
                    .padding(.top, 6)

                    // Reply bubbles (compact)
                    ForEach(Array(info.replies.enumerated()), id: \.element.id) { index, reply in
                        ThreadReplyBubble(
                            message: reply,
                            accentColor: accentColor,
                            entranceDelay: Double(index) * 0.04
                        )
                    }

                    // Thread composer
                    if threadState.activeThreadParentId == info.id {
                        threadComposer(info)
                    } else {
                        // Reply prompt
                        Button(action: {
                            withAnimation(.optaSpring) {
                                threadState.openComposer(for: info.id)
                            }
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "arrowshape.turn.up.left")
                                    .font(.system(size: 9))
                                Text("Reply in thread")
                                    .font(.sora(10))
                            }
                            .foregroundColor(.optaTextMuted)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.optaSurface.opacity(0.3))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 4)
                        .padding(.bottom, 6)
                    }
                }
                .padding(.trailing, 12)
            }
            .padding(.leading, 30)  // Indent thread under parent
        }
    }

    // MARK: - Thread Connector

    private var threadConnector: some View {
        GeometryReader { geo in
            Path { path in
                let x = geo.size.width / 2
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: geo.size.height))
            }
            .stroke(Color.optaPrimary.opacity(0.15), lineWidth: 1.5)
        }
    }

    // MARK: - Thread Composer

    private func threadComposer(_ info: ThreadInfo) -> some View {
        HStack(spacing: 8) {
            TextField("Reply in thread...", text: $threadState.threadComposerText)
                .textFieldStyle(.plain)
                .font(.sora(12))
                .foregroundColor(.optaTextPrimary)
                .onSubmit {
                    sendThreadReply(to: info.id)
                }

            Button(action: { sendThreadReply(to: info.id) }) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(
                        threadState.threadComposerText.isEmpty ? .optaTextMuted : .optaPrimary
                    )
            }
            .buttonStyle(.plain)
            .disabled(threadState.threadComposerText.isEmpty)

            Button(action: {
                withAnimation(.optaSnap) { threadState.closeComposer() }
            }) {
                Image(systemName: "xmark.circle")
                    .font(.system(size: 14))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.optaSurface.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.optaPrimary.opacity(0.15), lineWidth: 0.5)
        )
        .padding(.vertical, 6)
        .transition(.opacity.combined(with: .scale(scale: 0.95)))
    }

    private func sendThreadReply(to parentId: String) {
        let text = threadState.threadComposerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        // Send via the view model — set replyingTo so send() captures the reply link
        if let bot = appState.bots.first(where: { $0.id == botId }),
           let vm = appState.chatViewModels[bot.id] {
            let parentMsg = vm.messages.first(where: { $0.id == parentId })
            vm.replyingTo = parentMsg
            Task { await vm.send(text) }
        }

        threadState.threadComposerText = ""
    }
}

// MARK: - Thread Reply Bubble (Compact)

struct ThreadReplyBubble: View {
    let message: ChatMessage
    let accentColor: Color
    let entranceDelay: Double

    @State private var appeared = false
    @State private var isHovered = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // Sender indicator
            Circle()
                .fill(message.sender == .user ? Color.optaTextMuted : accentColor)
                .frame(width: 5, height: 5)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(message.sender.accessibleName)
                        .font(.sora(9, weight: .semibold))
                        .foregroundColor(message.sender == .user ? .optaTextMuted : accentColor)

                    Text(message.timestamp, style: .relative)
                        .font(.sora(8))
                        .foregroundColor(.optaTextMuted)
                }

                Text(message.content)
                    .font(.sora(11))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(isHovered ? nil : 4)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isHovered ? Color.optaElevated.opacity(0.4) : Color.clear)
        )
        .onHover { hover in
            withAnimation(.optaSnap) { isHovered = hover }
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 6)
        .onAppear {
            withAnimation(.optaSpring.delay(entranceDelay)) {
                appeared = true
            }
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_threading_opened = Notification.Name("module.threading.opened")
    static let module_threading_closed = Notification.Name("module.threading.closed")
    static let module_threading_replyTo = Notification.Name("module.threading.replyTo")
    static let module_threading_open = Notification.Name("module.threading.open")
}

// MARK: - Module Registration

/// **To add:**
///   1. Create a `@StateObject var threadState = ThreadStateManager()` in ContentView
///   2. In the message ForEach, wrap MessageBubble:
///      ```swift
///      let threads = threadState.buildThreads(from: vm.messages)
///      let topLevel = threadState.topLevelMessages(from: vm.messages)
///      ForEach(topLevel) { msg in
///          ThreadedMessageView(
///              message: msg,
///              threadInfo: threads[msg.id],
///              botId: bot.id,
///              threadState: threadState
///          )
///      }
///      ```
///   3. Add "Reply" to MessageBubble context menu:
///      ```swift
///      Button("Reply in Thread") {
///          threadState.openComposer(for: message.id)
///      }
///      ```
///   4. Wire Cmd+Shift+R to reply to the latest selected message
///
/// **To remove:**
///   1. Delete this file
///   2. Unwrap ThreadedMessageView — use bare MessageBubble
///   3. Remove "Reply" from context menu
///   4. Messages with replyTo still load fine but threads are not visualized
enum MessageThreadingModule {
    static func register() {
        // Module is view-driven. No background registration needed.
    }
}
