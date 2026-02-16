//
//  ReactionBar.swift
//  OptaMolt
//
//  Smart reaction bar with bot-command reactions.
//  Each emoji maps to a command sent via chat.send.
//  Hover (macOS) or long-press (iOS) to show reaction picker.
//

import SwiftUI

// MARK: - Reaction Action

/// A bot-command reaction. Each emoji maps to a command sent via chat.send.
public enum ReactionAction: String, CaseIterable, Sendable {
    case proceed   = "👍"
    case explain   = "❓"
    case revert    = "👎"
    case retry     = "🔄"
    case pause     = "⏸️"
    case resume    = "▶️"
    case summarize = "📋"
    case detail    = "🔍"

    /// The command text sent to the bot via chat.send.
    public var commandText: String {
        switch self {
        case .proceed:   return "[USER_REACTION: proceed] Continue with the next steps."
        case .explain:   return "[USER_REACTION: explain] Explain your last message in simpler terms."
        case .revert:    return "[USER_REACTION: revert] Undo or revert your last action."
        case .retry:     return "[USER_REACTION: retry] Regenerate your last response."
        case .pause:     return "[USER_REACTION: pause] Pause current work and save state."
        case .resume:    return "[USER_REACTION: resume] Resume paused work."
        case .summarize: return "[USER_REACTION: summarize] Summarize this conversation."
        case .detail:    return "[USER_REACTION: detail] Give me more detail on this."
        }
    }

    /// Human-readable label shown in tooltip.
    public var label: String {
        switch self {
        case .proceed:   return "Proceed"
        case .explain:   return "Explain"
        case .revert:    return "Revert"
        case .retry:     return "Retry"
        case .pause:     return "Pause"
        case .resume:    return "Resume"
        case .summarize: return "Summarize"
        case .detail:    return "Detail"
        }
    }
}

// MARK: - Reaction Store

/// Local storage for message reactions (visual state only)
@MainActor
public final class ReactionStore: ObservableObject {
    public static let shared = ReactionStore()

    /// messageId -> [emoji -> count]
    @Published private var reactions: [String: [String: Int]] = [:]

    public func getReactions(for messageId: String) -> [MessageReaction] {
        guard let messageReactions = reactions[messageId] else { return [] }
        return messageReactions.map { MessageReaction(emoji: $0.key, count: $0.value) }
            .sorted { $0.emoji < $1.emoji }
    }

    public func toggleReaction(_ emoji: String, for messageId: String) {
        if reactions[messageId] == nil {
            reactions[messageId] = [:]
        }
        if let current = reactions[messageId]?[emoji], current > 0 {
            reactions[messageId]?[emoji] = nil
        } else {
            reactions[messageId]?[emoji] = 1
        }
        if reactions[messageId]?.isEmpty == true {
            reactions[messageId] = nil
        }
    }
}

/// A reaction on a message (visual pill)
public struct MessageReaction: Identifiable, Equatable, Sendable {
    public let id: String
    public let emoji: String
    public var count: Int

    public init(emoji: String, count: Int = 1) {
        self.id = emoji
        self.emoji = emoji
        self.count = count
    }
}

// MARK: - Quick Reaction Bar

/// Floating bar with 8 smart reaction buttons
public struct QuickReactionBar: View {
    let messageId: String
    let onReact: (ReactionAction) -> Void

    public init(messageId: String, onReact: @escaping (ReactionAction) -> Void) {
        self.messageId = messageId
        self.onReact = onReact
    }

    public var body: some View {
        HStack(spacing: 4) {
            ForEach(ReactionAction.allCases, id: \.rawValue) { action in
                Button(action: { onReact(action) }) {
                    Text(action.rawValue)
                        .font(.system(size: 18))
                        .padding(4)
                }
                .buttonStyle(.plain)
                .help(action.label)
                .accessibilityLabel(action.label)
                .accessibilityHint("Sends \(action.label.lowercased()) reaction to bot")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color.optaSurface.opacity(0.85))
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
        )
        .overlay(
            Capsule()
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.3), radius: 8, y: 2)
    }
}

// MARK: - Reaction Pills Row

/// Displays reaction pills below a message
public struct ReactionPillsView: View {
    let messageId: String
    @ObservedObject private var store: ReactionStore

    public init(messageId: String, store: ReactionStore = .shared) {
        self.messageId = messageId
        self.store = store
    }

    public var body: some View {
        let reactions = store.getReactions(for: messageId)
        if !reactions.isEmpty {
            HStack(spacing: 4) {
                ForEach(reactions) { reaction in
                    Button(action: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            store.toggleReaction(reaction.emoji, for: messageId)
                        }
                    }) {
                        HStack(spacing: 2) {
                            Text(reaction.emoji)
                                .font(.system(size: 13))
                            if reaction.count > 1 {
                                Text("\(reaction.count)")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.optaTextSecondary)
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(Color.optaSurface.opacity(0.6))
                        )
                        .overlay(
                            Capsule()
                                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(reaction.emoji) reaction, count \(reaction.count)")
                    .accessibilityHint("Double tap to remove reaction")
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
    }
}

// MARK: - Reactive Message Wrapper

/// Wraps a message view with hover/long-press reaction bar
public struct ReactiveMessageWrapper<Content: View>: View {
    let messageId: String
    let onReact: (ReactionAction) -> Void
    let content: Content
    @StateObject private var store = ReactionStore.shared
    @State private var showReactionBar = false

    public init(messageId: String,
                onReact: @escaping (ReactionAction) -> Void,
                @ViewBuilder content: () -> Content) {
        self.messageId = messageId
        self.onReact = onReact
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .top) {
                content

                if showReactionBar {
                    QuickReactionBar(messageId: messageId) { action in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            store.toggleReaction(action.rawValue, for: messageId)
                            showReactionBar = false
                        }
                        onReact(action)
                    }
                    .offset(y: -40)
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                    .zIndex(10)
                }
            }
            #if canImport(AppKit)
            .onHover { hovering in
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                    showReactionBar = hovering
                }
            }
            #endif

            ReactionPillsView(messageId: messageId, store: store)
        }
        #if canImport(UIKit)
        .onLongPressGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                showReactionBar.toggle()
            }
        }
        #endif
    }
}

// MARK: - Preview

#if DEBUG
struct ReactionBar_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            QuickReactionBar(messageId: "test") { action in
                print("Reacted with \(action.label)")
            }

            ReactionPillsView(messageId: "test")
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
