import Foundation

@Observable @MainActor
final class ChatViewModel {
    var messages: [ChatMessage] = []
    var inputText = ""
    var isStreaming = false
    var selectedModel: String?
    var availableModels: [ModelInfo] = []
    var error: String?

    private var streamTask: Task<Void, Never>?

    /// Load available models from the server.
    func loadModels(client: LMXClient) async {
        do {
            let response = try await client.getModels()
            availableModels = response.data
            if selectedModel == nil, let first = response.data.first {
                selectedModel = first.id
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Send a message and stream the response.
    func sendMessage(client: LMXClient) {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isStreaming else { return }
        guard let model = selectedModel else {
            error = "No model selected"
            return
        }

        // Add user message
        let userMessage = ChatMessage(role: .user, content: text)
        messages.append(userMessage)
        inputText = ""
        error = nil

        // Add placeholder assistant message
        let assistantMessage = ChatMessage(role: .assistant, content: "", model: model)
        messages.append(assistantMessage)
        let assistantIndex = messages.count - 1

        isStreaming = true

        streamTask = Task {
            do {
                let params = messages.dropLast().map { ChatMessageParam(role: $0.role.rawValue, content: $0.content) }
                let stream = client.streamChat(model: model, messages: Array(params))

                var firstToken = true
                for try await token in stream {
                    messages[assistantIndex].content += token
                    if firstToken {
                        OptaHaptics.lightTap()
                        firstToken = false
                    }
                }
                OptaHaptics.success()
            } catch is CancellationError {
                // User cancelled
            } catch {
                self.error = error.localizedDescription
                OptaHaptics.error()
            }
            isStreaming = false
        }
    }

    /// Cancel the current stream.
    func cancelStream() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
    }

    /// Clear all messages.
    func clearChat() {
        messages.removeAll()
        error = nil
    }
}
