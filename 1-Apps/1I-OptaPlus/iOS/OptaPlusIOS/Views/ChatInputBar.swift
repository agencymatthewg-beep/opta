//
//  ChatInputBar.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus

struct ChatInputBar: View {
    @Binding var text: String
    let isStreaming: Bool
    let onSend: () -> Void
    let onAbort: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.optaBorder)

            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message...", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1...6)
                    .focused($isFocused)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.optaElevated)
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(Color.optaBorder, lineWidth: 1)
                            )
                    )
                    .onSubmit {
                        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            onSend()
                        }
                    }

                if isStreaming {
                    Button(action: onAbort) {
                        Image(systemName: "stop.circle.fill")
                            .font(.title2)
                            .foregroundColor(.optaRed)
                    }
                } else {
                    Button(action: {
                        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            onSend()
                        }
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(
                                text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? .optaTextMuted : .optaPrimary
                            )
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.optaVoid)
        }
    }
}
