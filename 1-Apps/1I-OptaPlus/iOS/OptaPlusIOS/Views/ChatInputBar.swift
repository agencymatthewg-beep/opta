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
    @State private var sendPulse = false
    @AppStorage("optaplus.deviceName") private var deviceName = "iPhone"
    @AppStorage("optaplus.deviceEmoji") private var deviceEmoji = ""

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Glowing top border when typing
            Rectangle()
                .fill(
                    isFocused
                        ? LinearGradient(colors: [Color.optaPrimary.opacity(0.6), Color.optaPrimary.opacity(0)], startPoint: .center, endPoint: .leading)
                        : LinearGradient(colors: [Color.optaBorder, Color.optaBorder], startPoint: .leading, endPoint: .trailing)
                )
                .frame(height: isFocused ? 1.5 : 0.5)
                .animation(.easeInOut(duration: 0.3), value: isFocused)

            VStack(spacing: 4) {
                // Device identity badge
                if !deviceName.isEmpty {
                    HStack(spacing: 4) {
                        if !deviceEmoji.isEmpty {
                            Text(deviceEmoji)
                                .font(.system(size: 11))
                        }
                        Text("Sending as: \(deviceName)")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                }

                HStack(alignment: .bottom, spacing: 8) {
                    // Attachment button
                    Button {
                        // Placeholder — camera/photo picker
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.optaTextMuted)
                    }

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
                                        .stroke(isFocused ? Color.optaPrimary.opacity(0.3) : Color.optaBorder, lineWidth: 1)
                                )
                        )
                        .animation(.easeInOut(duration: 0.2), value: text.count)
                        .submitLabel(.send)
                        .onSubmit {
                            if !trimmedText.isEmpty { onSend() }
                        }

                    if isStreaming {
                        Button(action: onAbort) {
                            Image(systemName: "stop.circle.fill")
                                .font(.title2)
                                .foregroundColor(.optaRed)
                        }
                    } else {
                        Button(action: {
                            guard !trimmedText.isEmpty else { return }
                            sendPulse = true
                            onSend()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                sendPulse = false
                            }
                        }) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                                .foregroundColor(trimmedText.isEmpty ? .optaTextMuted : .optaPrimary)
                                .scaleEffect(sendPulse ? 1.3 : 1.0)
                                .animation(.spring(response: 0.25, dampingFraction: 0.5), value: sendPulse)
                        }
                        .disabled(trimmedText.isEmpty)
                    }
                }

                // Character count for long messages
                if text.count > 500 {
                    HStack {
                        Spacer()
                        Text("\(text.count)")
                            .font(.caption2)
                            .foregroundColor(text.count > 4000 ? .optaRed : .optaTextMuted)
                            .monospacedDigit()
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.optaVoid)
        }
    }
}
