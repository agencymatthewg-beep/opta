//
//  ChatMessageBubble.swift
//  OptaApp
//
//  Individual chat message bubble with user/assistant styling,
//  streaming indicator, and metadata badge.
//  Follows obsidian+violet design language.
//

import SwiftUI

// MARK: - ChatMessageBubble

/// Renders a single chat message with role-appropriate styling.
///
/// - User messages: right-aligned, violet-tinted background
/// - Assistant messages: left-aligned, obsidian panel with border
/// - Streaming: animated dots indicator while generating
///
/// # Usage
///
/// ```swift
/// ChatMessageBubble(message: chatMessage)
/// ```
struct ChatMessageBubble: View {

    // MARK: - Properties

    /// The message to display
    let message: ChatMessage

    /// Color temperature from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                // Message content
                messageContent

                // Timestamp and metadata
                HStack(spacing: 6) {
                    if let metadata = message.metadata {
                        metadataBadge(metadata)
                    }

                    Text(relativeTime(from: message.timestamp))
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.35))
                }
            }

            if message.role == .assistant {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }

    // MARK: - Message Content

    @ViewBuilder
    private var messageContent: some View {
        if message.isStreaming && message.content.isEmpty {
            // Streaming indicator (no text yet)
            streamingIndicator
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(assistantBackground)
        } else {
            Text(message.content)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(message.role == .user ? .white : .white.opacity(0.9))
                .textSelection(.enabled)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    message.role == .user ? userBackground : assistantBackground
                )
        }
    }

    // MARK: - Backgrounds

    /// User message background: violet-tinted with rounded corners
    private var userBackground: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(colorTemp.violetColor.opacity(0.15))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(colorTemp.violetColor.opacity(0.25), lineWidth: 1)
            )
    }

    /// Assistant message background: obsidian panel with subtle border
    private var assistantBackground: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(obsidianBase.opacity(0.8))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(.white.opacity(0.08), lineWidth: 1)
            )
    }

    // MARK: - Streaming Indicator

    /// Animated dots showing generation in progress
    private var streamingIndicator: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(colorTemp.violetColor.opacity(0.6))
                    .frame(width: 6, height: 6)
                    .opacity(reduceMotion ? 0.6 : 1.0)
                    .animation(
                        reduceMotion ? nil :
                            .easeInOut(duration: 0.5)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.15),
                        value: message.isStreaming
                    )
                    .scaleEffect(message.isStreaming && !reduceMotion ? 1.0 : 0.6)
            }
        }
        .frame(height: 16)
    }

    // MARK: - Metadata Badge

    /// Small badge showing model and routing info
    private func metadataBadge(_ metadata: MessageMetadata) -> some View {
        HStack(spacing: 3) {
            Image(systemName: metadata.routedLocally ? "cpu" : "cloud")
                .font(.system(size: 9))

            Text(metadata.routedLocally ? "Local" : "Cloud")
                .font(.system(size: 10, weight: .medium))
        }
        .foregroundStyle(colorTemp.violetColor.opacity(0.6))
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            Capsule()
                .fill(colorTemp.violetColor.opacity(0.08))
        )
    }

    // MARK: - Helpers

    /// Format timestamp as relative time
    private func relativeTime(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)

        if interval < 60 {
            return "just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        }
    }
}
