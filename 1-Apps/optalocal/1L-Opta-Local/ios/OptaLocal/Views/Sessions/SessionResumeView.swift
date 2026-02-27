import SwiftUI

/// Loads a full session and displays it in a streaming chat view for resumption.
struct SessionResumeView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    let session: Session

    @State private var messages: [ChatMessage] = []
    @State private var isLoadingHistory = true
    @State private var loadError: String?
    @State private var viewModel = ChatViewModel()

    var body: some View {
        ZStack {
            OptaColors.void_.ignoresSafeArea()

            if isLoadingHistory {
                VStack(spacing: 12) {
                    ProgressView()
                        .tint(OptaColors.primary)
                    Text("Loading session...")
                        .font(.caption)
                        .foregroundStyle(OptaColors.textMuted)
                }
            } else if let loadError {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundStyle(OptaColors.neonAmber)
                    Text(loadError)
                        .font(.subheadline)
                        .foregroundStyle(OptaColors.textSecondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task { await loadSession() }
                    }
                    .foregroundStyle(OptaColors.primary)
                }
                .padding()
            } else if let client = connectionManager.client {
                VStack(spacing: 0) {
                    // Model badge
                    HStack {
                        Label(SessionsViewModel.shortModelName(session.model), systemImage: "cpu")
                            .font(.caption)
                            .foregroundStyle(OptaColors.primary)
                        Spacer()
                        Text("\(viewModel.messages.count) messages")
                            .font(.caption)
                            .foregroundStyle(OptaColors.textMuted)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 6)
                    .background(OptaColors.surface.opacity(0.5))

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
            }
        }
        .navigationTitle(session.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.isStreaming {
                    Button {
                        viewModel.cancelStream()
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .foregroundStyle(OptaColors.neonRed)
                    }
                }
            }
        }
        .task {
            await loadSession()
        }
    }

    private func loadSession() async {
        guard let client = connectionManager.client else {
            loadError = "Not connected"
            return
        }
        isLoadingHistory = true
        loadError = nil
        do {
            let full = try await client.getSession(id: session.id)
            let loaded = full.messages.map { msg in
                ChatMessage(
                    role: MessageRole(rawValue: msg.role) ?? .user,
                    content: msg.content,
                    model: msg.role == "assistant" ? session.model : nil
                )
            }
            viewModel.messages = loaded
            viewModel.selectedModel = session.model
            OptaHaptics.success()
        } catch {
            loadError = error.localizedDescription
            OptaHaptics.error()
        }
        isLoadingHistory = false
    }

    private func inputBar(client: LMXClient) -> some View {
        HStack(spacing: 12) {
            TextField("Continue conversation...", text: $viewModel.inputText, axis: .vertical)
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
