//
//  AiChatView.swift
//  OptaApp
//
//  Main AI Chat interface with message list, empty state suggestions,
//  model selector, and input field.
//  Features obsidian depth hierarchy with branch-energy violet accents.
//

import SwiftUI

// MARK: - AiChatView

/// The main AI Chat view showing conversation messages and input.
///
/// Layout:
/// - Header: "AI Chat" title with model picker and clear button
/// - Messages: ScrollView with ChatMessageBubble for each message
/// - Empty State: Icon + suggestions when no messages exist
/// - Input: ChatInputView pinned at bottom
///
/// # Usage
///
/// ```swift
/// AiChatView()
/// ```
struct AiChatView: View {

    // MARK: - Properties

    /// Chat view model (Swift-side, not Crux)
    @State private var viewModel = ChatViewModel()

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Core manager for navigation
    @Environment(\.optaCoreManager) private var coreManager: OptaCoreManager?

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    /// Suggestion chips for empty state
    private let suggestions = [
        "Optimize my CPU usage",
        "What's using my RAM?",
        "Reduce fan noise",
        "Speed up my Mac"
    ]

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection

            // Content area (messages or empty state)
            if viewModel.messages.isEmpty {
                emptyStateView
            } else {
                messageListView
            }

            // Input area
            ChatInputView(viewModel: viewModel)
        }
        .background(Color(hex: "09090B"))
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack(spacing: 12) {
            // Back button
            Button {
                coreManager?.navigate(to: .dashboard)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(width: 28, height: 28)
                    .background(
                        Circle()
                            .fill(.white.opacity(0.06))
                    )
            }
            .buttonStyle(.plain)

            // Title
            VStack(alignment: .leading, spacing: 2) {
                Text("AI Chat")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)

                Text(viewModel.selectedModel.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
            }

            Spacer()

            // Model picker
            modelPicker

            // Clear button
            if !viewModel.messages.isEmpty {
                Button {
                    viewModel.clearConversation()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.5))
                        .frame(width: 28, height: 28)
                        .background(
                            Circle()
                                .fill(.white.opacity(0.06))
                        )
                }
                .buttonStyle(.plain)
                .help("Clear conversation")
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(
            obsidianBase.opacity(0.6)
                .overlay(
                    Rectangle()
                        .fill(.white.opacity(0.04))
                        .frame(height: 1),
                    alignment: .bottom
                )
        )
    }

    // MARK: - Model Picker

    /// Segmented model selector
    private var modelPicker: some View {
        HStack(spacing: 2) {
            ForEach(LLMModel.allCases, id: \.rawValue) { model in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        viewModel.selectedModel = model
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: model.icon)
                            .font(.system(size: 10))

                        Text(model.displayName)
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(
                        viewModel.selectedModel == model
                            ? .white
                            : .white.opacity(0.4)
                    )
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(
                                viewModel.selectedModel == model
                                    ? colorTemp.violetColor.opacity(0.2)
                                    : .clear
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(
            Capsule()
                .fill(obsidianBase.opacity(0.8))
                .overlay(
                    Capsule()
                        .stroke(.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    // MARK: - Empty State

    /// Welcome view with icon and suggestion chips
    private var emptyStateView: some View {
        VStack(spacing: 24) {
            Spacer()

            // Icon
            ZStack {
                Circle()
                    .fill(colorTemp.violetColor.opacity(0.08))
                    .frame(width: 80, height: 80)

                Image(systemName: "message.badge.waveform")
                    .font(.system(size: 32))
                    .foregroundStyle(colorTemp.violetColor.opacity(0.6))
            }

            // Title
            VStack(spacing: 8) {
                Text("Ask Opta Anything")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)

                Text("Get insights about your system performance,\noptimization suggestions, and more.")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.4))
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
            }

            // Suggestion chips
            VStack(spacing: 8) {
                ForEach(suggestions, id: \.self) { suggestion in
                    Button {
                        viewModel.inputText = suggestion
                        viewModel.sendMessage()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "sparkle")
                                .font(.system(size: 12))
                                .foregroundStyle(colorTemp.violetColor.opacity(0.6))

                            Text(suggestion)
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.7))

                            Spacer()

                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 10))
                                .foregroundStyle(.white.opacity(0.3))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(obsidianBase.opacity(0.6))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(.white.opacity(0.06), lineWidth: 1)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 40)
            .padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Message List

    /// Scrollable message list with auto-scroll to bottom
    private var messageListView: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    ForEach(viewModel.messages.filter { $0.role != .system }) { message in
                        ChatMessageBubble(message: message)
                            .id(message.id)
                    }

                    // Scroll anchor
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(.vertical, 16)
            }
            .onChange(of: viewModel.messages.count) { _, _ in
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: viewModel.streamingText) { _, _ in
                proxy.scrollTo("bottom", anchor: .bottom)
            }
        }
    }
}
