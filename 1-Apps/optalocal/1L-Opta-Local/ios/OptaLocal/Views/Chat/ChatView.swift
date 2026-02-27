import SwiftUI

struct ChatView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @State private var viewModel = ChatViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                OptaColors.void_.ignoresSafeArea()

                if let client = connectionManager.client {
                    VStack(spacing: 0) {
                        // Model picker
                        modelPicker

                        // Messages
                        ScrollViewReader { proxy in
                            ScrollView {
                                LazyVStack(spacing: 12) {
                                    ForEach(viewModel.messages) { message in
                                        MessageBubble(message: message)
                                            .id(message.id)
                                    }
                                }
                                .padding()
                            }
                            .onChange(of: viewModel.messages.last?.content) {
                                if let last = viewModel.messages.last {
                                    withAnimation(.optaSpring) {
                                        proxy.scrollTo(last.id, anchor: .bottom)
                                    }
                                }
                            }
                        }

                        // Error
                        if let error = viewModel.error {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(OptaColors.neonRed)
                                .padding(.horizontal)
                        }

                        // Input bar
                        inputBar(client: client)
                    }
                    .task {
                        await viewModel.loadModels(client: client)
                    }
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 48))
                            .foregroundStyle(OptaColors.textMuted)
                        Text("Connect to start chatting")
                            .foregroundStyle(OptaColors.textSecondary)
                    }
                }
            }
            .navigationTitle("Chat")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.isStreaming {
                        Button {
                            viewModel.cancelStream()
                        } label: {
                            Image(systemName: "stop.circle.fill")
                                .foregroundStyle(OptaColors.neonRed)
                        }
                    } else if !viewModel.messages.isEmpty {
                        Button {
                            viewModel.clearChat()
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(OptaColors.textSecondary)
                        }
                    }
                }
            }
        }
    }

    private var modelPicker: some View {
        Group {
            if !viewModel.availableModels.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.availableModels) { model in
                            Button {
                                OptaHaptics.select()
                                viewModel.selectedModel = model.id
                            } label: {
                                Text(model.id.split(separator: "/").last.map(String.init) ?? model.id)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(
                                        viewModel.selectedModel == model.id
                                            ? OptaColors.primary.opacity(0.3)
                                            : OptaColors.surface
                                    )
                                    .foregroundStyle(
                                        viewModel.selectedModel == model.id
                                            ? OptaColors.primary
                                            : OptaColors.textSecondary
                                    )
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .background(OptaColors.surface.opacity(0.5))
            }
        }
    }

    private func inputBar(client: LMXClient) -> some View {
        HStack(spacing: 12) {
            TextField("Message...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .foregroundStyle(OptaColors.textPrimary)
                .lineLimit(1...5)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(OptaColors.surface, in: RoundedRectangle(cornerRadius: 20))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(OptaColors.border.opacity(0.5), lineWidth: 0.5)
                )

            Button {
                OptaHaptics.tap()
                viewModel.sendMessage(client: client)
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(
                        viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isStreaming
                            ? OptaColors.textMuted
                            : OptaColors.primary
                    )
            }
            .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isStreaming)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(OptaColors.void_)
    }
}
