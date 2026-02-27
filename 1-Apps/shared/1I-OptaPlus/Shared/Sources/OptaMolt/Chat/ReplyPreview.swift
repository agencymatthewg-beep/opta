//
//  ReplyPreview.swift
//  OptaMolt
//
//  Compact reply/quote preview shown above a message or input bar.
//

import SwiftUI

// MARK: - Reply Preview (above message bubble)

public struct ReplyQuoteView: View {
    let originalMessage: ChatMessage?
    let onTap: (() -> Void)?

    public init(originalMessage: ChatMessage?, onTap: (() -> Void)? = nil) {
        self.originalMessage = originalMessage
        self.onTap = onTap
    }

    public var body: some View {
        if let msg = originalMessage {
            Button(action: { onTap?() }) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(Color.optaPrimary.opacity(0.6))
                        .frame(width: 3)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(msg.sender == .user ? "You" : msg.sender.accessibleName)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.optaPrimary)
                        Text(msg.content.prefix(100))
                            .font(.system(size: 11))
                            .foregroundColor(.optaTextSecondary)
                            .lineLimit(2)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaPrimary.opacity(0.06))
                )
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Reply Input Bar Preview (above input, dismissable)

public struct ReplyInputPreview: View {
    let message: ChatMessage
    let onDismiss: () -> Void

    public init(message: ChatMessage, onDismiss: @escaping () -> Void) {
        self.message = message
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(Color.optaPrimary)
                .frame(width: 3, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text("Replying to \(message.sender == .user ? "yourself" : message.sender.accessibleName)")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.optaPrimary)
                Text(message.content.prefix(80))
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.optaSurface.opacity(0.5))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
