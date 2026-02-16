//
//  ChatInputBar.swift
//  OptaPlusIOS
//

import SwiftUI
import AVFoundation
import OptaPlus
import OptaMolt

struct ChatInputBar: View {
    @Binding var text: String
    @Binding var attachments: [ChatAttachment]
    let isStreaming: Bool
    var queuedCount: Int = 0
    let onSend: () -> Void
    let onAbort: () -> Void

    @FocusState private var isFocused: Bool
    @State private var sendPulse = false
    @StateObject private var voiceRecorder = VoiceRecorder()
    @AppStorage("optaplus.deviceName") private var deviceName = "iPhone"
    @AppStorage("optaplus.deviceEmoji") private var deviceEmoji = ""

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var hasContent: Bool {
        !trimmedText.isEmpty || !attachments.isEmpty
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
                .animation(.optaSpring, value: isFocused)

            VStack(spacing: 4) {
                // Attachment preview strip
                if !attachments.isEmpty {
                    AttachmentPreviewStrip(attachments: $attachments)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

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

                // Offline queue indicator
                if queuedCount > 0 {
                    HStack(spacing: 5) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 10))
                        Text("\(queuedCount) queued — sending when connected...")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(.optaAmber)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.optaAmber.opacity(0.1))
                    )
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                }

                // Voice recording indicator (shown when actively recording)
                if voiceRecorder.isRecording {
                    HStack(spacing: 10) {
                        RecordingIndicator(
                            duration: voiceRecorder.recordingDuration,
                            audioLevel: voiceRecorder.audioLevel
                        )

                        Spacer()

                        // Cancel recording
                        Button(action: {
                            voiceRecorder.cancel()
                        }) {
                            Text("Cancel")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.optaTextMuted)
                        }

                        // Stop and send
                        Button(action: {
                            stopAndSendVoiceRecording()
                        }) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                                .foregroundColor(.optaPrimary)
                        }
                        .accessibilityLabel("Send voice message")
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Permission denied alert
                if voiceRecorder.permissionDenied {
                    HStack(spacing: 6) {
                        Image(systemName: "mic.slash")
                            .font(.system(size: 12))
                        Text("Microphone access denied. Enable in Settings.")
                            .font(.system(size: 11))
                    }
                    .foregroundColor(.optaAmber)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.optaAmber.opacity(0.1)))
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                }

                if !voiceRecorder.isRecording {
                    HStack(alignment: .bottom, spacing: 8) {
                        // Attachment picker (PhotosPicker + file importer)
                        AttachmentPicker(attachments: $attachments)

                        TextField("Message...", text: $text, axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .foregroundColor(.optaTextPrimary)
                            .lineLimit(1...6)
                            .focused($isFocused)
                            .accessibilityLabel("Message input")
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
                            .animation(.optaSnap, value: text.count)
                            .submitLabel(.send)
                            .onSubmit {
                                if hasContent { onSend() }
                            }

                        if isStreaming {
                            Button(action: onAbort) {
                                Image(systemName: "stop.circle.fill")
                                    .font(.title2)
                                    .foregroundColor(.optaRed)
                            }
                            .accessibilityLabel("Stop generation")
                        } else if hasContent {
                            Button(action: {
                                sendPulse = true
                                onSend()
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                    sendPulse = false
                                }
                            }) {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.title2)
                                    .foregroundColor(.optaPrimary)
                                    .scaleEffect(sendPulse ? 1.3 : 1.0)
                                    .animation(.spring(response: 0.25, dampingFraction: 0.5), value: sendPulse)
                            }
                            .accessibilityLabel("Send message")
                            .overlay(alignment: .topTrailing) {
                                if queuedCount > 0 {
                                    Text("\(queuedCount)")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundColor(.white)
                                        .frame(minWidth: 14, minHeight: 14)
                                        .background(Circle().fill(Color.optaAmber))
                                        .offset(x: 4, y: -4)
                                        .transition(.scale(scale: 0.5).combined(with: .opacity))
                                }
                            }
                        } else {
                            // Microphone button (shown when no text content)
                            Button(action: {
                                voiceRecorder.start()
                            }) {
                                Image(systemName: "mic.fill")
                                    .font(.title2)
                                    .foregroundColor(.optaTextMuted)
                            }
                            .accessibilityLabel("Record voice message")
                        }
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
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: attachments.count)
        .animation(.optaSpring, value: queuedCount)
        .animation(.optaSpring, value: voiceRecorder.isRecording)
    }

    private func stopAndSendVoiceRecording() {
        guard let audioData = voiceRecorder.stop() else { return }
        let attachment = ChatAttachment(
            filename: "voice-\(UUID().uuidString.prefix(8)).m4a",
            mimeType: "audio/mp4",
            sizeBytes: audioData.count,
            data: audioData
        )
        attachments.append(attachment)
        onSend()
    }
}
