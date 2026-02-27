//
//  ChannelSwitcherSheet.swift
//  OptaPlusIOS
//
//  Channel-based session switcher sheet.
//  Shows existing channels/chats with color indicators,
//  "Add Channel" for future integrations, and "New Chat" with 5-session limit.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct ChannelSwitcherSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    let botConfig: BotConfig
    @Environment(\.dismiss) private var dismiss
    @State private var showNewChat = false
    @State private var newChatName = ""

    private var atLimit: Bool {
        viewModel.sessions.count >= ChatViewModel.maxSessionsPerBot
    }

    var body: some View {
        NavigationStack {
            List {
                // Active channels
                Section {
                    ForEach(viewModel.sessions) { session in
                        Button {
                            viewModel.switchSession(session)
                            dismiss()
                        } label: {
                            ChannelSessionRow(
                                session: session,
                                isActive: viewModel.activeSession?.id == session.id
                            )
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if !session.isPinned && session.channelType == nil {
                                Button(role: .destructive) {
                                    viewModel.deleteSession(session)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                } header: {
                    Text("Channels & Chats")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextMuted)
                }
                .listRowBackground(Color.optaSurface)

                // Add channel (placeholder for future WhatsApp/Discord)
                Section {
                    Menu {
                        Button {
                            addChannel(.whatsapp)
                        } label: {
                            Label("WhatsApp", systemImage: "phone.fill")
                        }
                        .disabled(hasChannel(.whatsapp))

                        Button {
                            addChannel(.discord)
                        } label: {
                            Label("Discord", systemImage: "gamecontroller.fill")
                        }
                        .disabled(hasChannel(.discord))
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "plus.circle")
                                .font(.system(size: 18))
                                .foregroundColor(.optaPrimary)
                                .frame(width: 32, height: 32)

                            Text("Add Channel")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(.optaTextPrimary)

                            Spacer()

                            Text("Coming Soon")
                                .font(.system(size: 11))
                                .foregroundColor(.optaTextMuted)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(Color.optaSurface))
                        }
                    }
                    .disabled(atLimit)

                    // New custom chat
                    Button {
                        showNewChat = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "bubble.left.and.bubble.right")
                                .font(.system(size: 16))
                                .foregroundColor(atLimit ? .optaTextMuted : .optaPrimary)
                                .frame(width: 32, height: 32)

                            Text("New Chat")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(atLimit ? .optaTextMuted : .optaTextPrimary)

                            Spacer()

                            Text("\(viewModel.sessions.count)/\(ChatViewModel.maxSessionsPerBot)")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .disabled(atLimit)
                    .accessibilityLabel("New chat")
                    .accessibilityHint(atLimit ? "Session limit reached" : "Creates a new isolated chat session")
                }
                .listRowBackground(Color.optaSurface)
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle("Channels")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(.optaPrimary)
                }
            }
            .alert("New Chat", isPresented: $showNewChat) {
                TextField("Chat name", text: $newChatName)
                Button("Create") {
                    let name = newChatName.isEmpty ? "Chat \(viewModel.sessions.count + 1)" : newChatName
                    if let session = viewModel.createSession(name: name, mode: .isolated) {
                        viewModel.switchSession(session)
                        dismiss()
                    }
                    newChatName = ""
                }
                Button("Cancel", role: .cancel) { newChatName = "" }
            } message: {
                Text("Create a new isolated chat with \(botConfig.name)")
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func hasChannel(_ type: ChannelType) -> Bool {
        viewModel.sessions.contains { $0.channelType == type }
    }

    private func addChannel(_ type: ChannelType) {
        let mode: SessionMode = type.shouldDeliver ? .synced : .direct
        if let session = viewModel.createSession(name: type.label, mode: mode, channelType: type) {
            viewModel.switchSession(session)
            dismiss()
        }
    }
}

// MARK: - Session Row

private struct ChannelSessionRow: View {
    let session: ChatSession
    let isActive: Bool

    var body: some View {
        HStack(spacing: 10) {
            // Color indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(colorForSession)
                .frame(width: 4, height: 32)

            // Icon
            Image(systemName: session.channelType?.icon ?? "bubble.left")
                .font(.system(size: 16))
                .foregroundColor(colorForSession)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(session.name)
                    .font(.system(size: 15, weight: isActive ? .semibold : .regular))
                    .foregroundColor(.optaTextPrimary)

                Text(session.channelType?.label ?? session.mode.label)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
            }

            Spacer()

            if isActive {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.optaPrimary)
            }

            if session.isPinned {
                Image(systemName: "pin.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(.vertical, 4)
    }

    private var colorForSession: Color {
        if let channelType = session.channelType {
            switch channelType {
            case .telegram: return .optaBlue
            case .direct: return .optaCoral
            case .whatsapp: return .optaGreen
            case .discord: return .optaIndigo
            }
        }
        if let tag = session.colorTag {
            switch tag {
            case "optaNeonPurple": return .optaNeonPurple
            case "optaCyan": return .optaCyan
            case "optaPink": return .optaPink
            case "optaAmber": return .optaAmber
            case "optaBlue": return .optaBlue
            case "optaCoral": return .optaCoral
            case "optaGreen": return .optaGreen
            case "optaIndigo": return .optaIndigo
            default: return .optaPrimary
            }
        }
        return .optaPrimary
    }
}
