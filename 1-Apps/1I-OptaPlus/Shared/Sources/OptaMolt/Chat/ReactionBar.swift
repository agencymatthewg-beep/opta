//
//  ReactionBar.swift
//  OptaMolt
//
//  Quick reaction bar and reaction pills for messages.
//  Hover (macOS) or long-press (iOS) to show reaction picker.
//  Reactions stored locally with spring-animated pills.
//

import SwiftUI

// MARK: - Reaction Model

/// A reaction on a message
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

// MARK: - Reaction Store

/// Local storage for message reactions
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
        // Clean up empty entries
        if reactions[messageId]?.isEmpty == true {
            reactions[messageId] = nil
        }
    }
}

// MARK: - Quick Reaction Bar

/// Floating bar with quick reaction emoji options
public struct QuickReactionBar: View {
    let messageId: String
    let onReact: (String) -> Void

    private let quickReactions = ["👍", "❤️", "😂", "🤔", "👀", "🔥"]

    public init(messageId: String, onReact: @escaping (String) -> Void) {
        self.messageId = messageId
        self.onReact = onReact
    }

    public var body: some View {
        HStack(spacing: 4) {
            ForEach(quickReactions, id: \.self) { emoji in
                Button(action: { onReact(emoji) }) {
                    Text(emoji)
                        .font(.system(size: 18))
                        .padding(4)
                        .background(Color.clear)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .scaleEffect(1.0)
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
    let content: Content
    @StateObject private var store = ReactionStore.shared
    @State private var showReactionBar = false

    public init(messageId: String, @ViewBuilder content: () -> Content) {
        self.messageId = messageId
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .top) {
                content

                if showReactionBar {
                    QuickReactionBar(messageId: messageId) { emoji in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            store.toggleReaction(emoji, for: messageId)
                            showReactionBar = false
                        }
                    }
                    .offset(y: -40)
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                    .zIndex(10)
                }
            }
            #if canImport(AppKit)
            .onHover { hovering in
                withAnimation(.easeInOut(duration: 0.2)) {
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
            QuickReactionBar(messageId: "test") { emoji in
                print("Reacted with \(emoji)")
            }

            ReactionPillsView(messageId: "test")
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
