//
//  ChatInputView.swift
//  OptaApp
//
//  Multi-line text input with send/cancel buttons and model selector.
//  Obsidian panel with violet border glow when focused.
//

import SwiftUI

// MARK: - ChatInputView

/// Text input area for the AI Chat with send button and model indicator.
///
/// Features:
/// - Multi-line TextEditor (max 4 lines before scroll)
/// - Send button (violet circle with arrow.up)
/// - Cancel button during generation (stop.circle)
/// - Cmd+Enter keyboard shortcut to send
/// - Model indicator pill
///
/// # Usage
///
/// ```swift
/// ChatInputView(viewModel: chatViewModel)
/// ```
struct ChatInputView: View {

    // MARK: - Properties

    /// The chat view model
    @Bindable var viewModel: ChatViewModel

    /// Whether the text field is focused
    @FocusState private var isFocused: Bool

    /// Color temperature from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    /// Maximum visible lines before scrolling
    private let maxVisibleLines: Int = 4

    /// Line height for text
    private let lineHeight: CGFloat = 20

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Top divider
            Rectangle()
                .fill(.white.opacity(0.06))
                .frame(height: 1)

            HStack(alignment: .bottom, spacing: 12) {
                // Model indicator
                modelIndicator

                // Text input area
                textInputArea

                // Send or Cancel button
                actionButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(hex: "09090B"))
        }
    }

    // MARK: - Model Indicator

    /// Small pill showing current model selection
    private var modelIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: viewModel.selectedModel.icon)
                .font(.system(size: 10))

            Text(viewModel.selectedModel.displayName)
                .font(.system(size: 11, weight: .medium))
        }
        .foregroundStyle(colorTemp.violetColor.opacity(0.7))
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(
            Capsule()
                .fill(colorTemp.violetColor.opacity(0.08))
                .overlay(
                    Capsule()
                        .stroke(colorTemp.violetColor.opacity(0.15), lineWidth: 1)
                )
        )
        .padding(.bottom, 4)
    }

    // MARK: - Text Input Area

    /// Multi-line text editor with placeholder and focus styling
    private var textInputArea: some View {
        ZStack(alignment: .topLeading) {
            // Placeholder text
            if viewModel.inputText.isEmpty {
                Text("Message Opta...")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.3))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .allowsHitTesting(false)
            }

            // TextEditor
            TextEditor(text: $viewModel.inputText)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .frame(
                    minHeight: lineHeight + 16,
                    maxHeight: CGFloat(maxVisibleLines) * lineHeight + 16
                )
                .fixedSize(horizontal: false, vertical: true)
                .focused($isFocused)
        }
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(obsidianBase.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            isFocused
                                ? colorTemp.violetColor.opacity(0.4)
                                : .white.opacity(0.08),
                            lineWidth: 1
                        )
                )
                .shadow(
                    color: isFocused ? colorTemp.violetColor.opacity(0.15) : .clear,
                    radius: 8,
                    x: 0,
                    y: 0
                )
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }

    // MARK: - Action Button

    /// Send button or cancel button depending on generation state
    @ViewBuilder
    private var actionButton: some View {
        if viewModel.isGenerating {
            // Cancel button
            Button {
                viewModel.cancelGeneration()
            } label: {
                Image(systemName: "stop.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.red.opacity(0.8))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 4)
            .help("Cancel generation")
        } else {
            // Send button
            Button {
                viewModel.sendMessage()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(
                        canSend
                            ? colorTemp.violetColor
                            : .white.opacity(0.2)
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .padding(.bottom, 4)
            .keyboardShortcut(.return, modifiers: .command)
            .help("Send message (Cmd+Enter)")
        }
    }

    // MARK: - Computed

    /// Whether the send button should be enabled
    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !viewModel.isGenerating
    }
}
