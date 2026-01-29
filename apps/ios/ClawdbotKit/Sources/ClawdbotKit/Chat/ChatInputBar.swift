//
//  ChatInputBar.swift
//  ClawdbotKit
//
//  Minimal, focused input component for chat interface.
//  Follows "Keyboard-Aware Input with safeAreaInset" pattern from 04-RESEARCH.md.
//

import SwiftUI

/// Chat input bar with text field and send button
///
/// Features:
/// - TextField with focus state management
/// - Send button with enable/disable based on text content
/// - Keeps focus after sending for rapid messaging
/// - Styled with system bar background for blur effect
public struct ChatInputBar: View {

    // MARK: - Properties

    /// Text binding for input field
    @Binding var text: String

    /// Focus state binding for keyboard control
    @FocusState.Binding var isFocused: Bool

    /// Callback when send is triggered
    let onSend: () -> Void

    /// Whether the input is enabled (based on connection state)
    let isEnabled: Bool

    // MARK: - Initialization

    /// Initialize ChatInputBar
    /// - Parameters:
    ///   - text: Binding to the input text
    ///   - isFocused: FocusState binding for keyboard management
    ///   - onSend: Callback when message should be sent
    ///   - isEnabled: Whether input is enabled (default true)
    public init(
        text: Binding<String>,
        isFocused: FocusState<Bool>.Binding,
        onSend: @escaping () -> Void,
        isEnabled: Bool = true
    ) {
        self._text = text
        self._isFocused = isFocused
        self.onSend = onSend
        self.isEnabled = isEnabled
    }

    // MARK: - Body

    public var body: some View {
        HStack(spacing: 12) {
            inputField
            sendButton
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar) // System blur effect
    }

    // MARK: - Input Field

    /// Text field with focus and submit handling
    @ViewBuilder
    private var inputField: some View {
        TextField("Message", text: $text)
            .focused($isFocused)
            .onSubmit {
                guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                onSend()
                // Keep focus for rapid messaging - do NOT set isFocused = false
            }
            .submitLabel(.send)
            #if os(iOS)
            .textInputAutocapitalization(.sentences)
            #endif
            .autocorrectionDisabled(false)
            .textFieldStyle(PlainTextFieldStyle())
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.clawdbotSurface)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .disabled(!isEnabled)
    }

    // MARK: - Send Button

    /// Send button with arrow icon
    private var sendButton: some View {
        Button(action: {
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            onSend()
            // Keep focus for rapid messaging
        }) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.title2) // Good tap target
                .foregroundStyle(sendButtonColor)
        }
        .disabled(isSendDisabled)
        .animation(.easeInOut(duration: 0.15), value: isSendDisabled)
    }

    /// Whether send button should be disabled
    private var isSendDisabled: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !isEnabled
    }

    /// Color for send button based on state
    private var sendButtonColor: Color {
        isSendDisabled ? .clawdbotTextMuted : .clawdbotPurple
    }
}

// MARK: - Preview

#if DEBUG
struct ChatInputBar_Previews: PreviewProvider {
    static var previews: some View {
        ChatInputBarPreviewWrapper()
            .preferredColorScheme(.dark)
            .background(Color.clawdbotBackground)
    }
}

/// Preview wrapper to manage state
private struct ChatInputBarPreviewWrapper: View {
    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack {
            Spacer()
            VStack(spacing: 0) {
                Divider()
                ChatInputBar(
                    text: $text,
                    isFocused: $isFocused,
                    onSend: { print("Send: \(text)"); text = "" },
                    isEnabled: true
                )
            }
        }
    }
}
#endif
