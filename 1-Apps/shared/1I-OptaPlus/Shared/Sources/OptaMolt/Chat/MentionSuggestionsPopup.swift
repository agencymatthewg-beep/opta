//
//  MentionSuggestionsPopup.swift
//  OptaMolt
//
//  Cross-platform autocomplete popup showing bot suggestions when the user types @.
//  Renders above the input bar with glass styling and spring animations.
//

import SwiftUI

// MARK: - Mention Suggestions Popup

public struct MentionSuggestionsPopup: View {
    public let suggestions: [BotConfig]
    public let onSelect: (BotConfig) -> Void

    @State private var hoveredId: String?

    public init(suggestions: [BotConfig], onSelect: @escaping (BotConfig) -> Void) {
        self.suggestions = suggestions
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(spacing: 0) {
            ForEach(suggestions.prefix(5)) { bot in
                Button(action: { onSelect(bot) }) {
                    HStack(spacing: 10) {
                        // Bot emoji avatar
                        ZStack {
                            Circle()
                                .fill(Color.optaPrimary.opacity(0.15))
                                .frame(width: 28, height: 28)
                            Text(bot.emoji)
                                .font(.system(size: 14))
                        }

                        Text(bot.name)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.optaTextPrimary)

                        Spacer()

                        Text("@\(bot.name)")
                            .font(.system(size: 11))
                            .foregroundColor(.optaTextMuted)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(hoveredId == bot.id ? Color.optaPrimary.opacity(0.1) : Color.clear)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mention \(bot.name)")
                .onHover { isHovered in
                    hoveredId = isHovered ? bot.id : nil
                }

                if bot.id != suggestions.prefix(5).last?.id {
                    Divider()
                        .background(Color.optaBorder.opacity(0.3))
                        .padding(.horizontal, 12)
                }
            }
        }
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaElevated)
                .shadow(color: Color.black.opacity(0.3), radius: 12, y: -4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
        .padding(.horizontal, 16)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: suggestions.map(\.id))
    }
}
