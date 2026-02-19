import Foundation

/// Server-Sent Events client using URLSession.bytes.
/// Produces an AsyncStream of decoded SSE messages with auto-reconnect.
actor SSEClient {
    private let baseURL: String
    private let adminKey: String
    private let session: URLSession
    private var currentTask: Task<Void, Never>?

    /// Maximum reconnection attempts before giving up.
    private let maxRetries = 10
    /// Base retry interval in seconds.
    private let baseRetryInterval: TimeInterval = 3

    init(baseURL: String, adminKey: String) {
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.adminKey = adminKey

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 0 // No resource timeout for SSE
        self.session = URLSession(configuration: config)
    }

    /// Connect to `/admin/events` SSE endpoint and yield `ServerStatus` updates.
    /// Auto-reconnects with exponential backoff on failure.
    func events() -> AsyncStream<SSEEvent> {
        AsyncStream { continuation in
            let task = Task { [weak self] in
                guard let self else {
                    continuation.finish()
                    return
                }

                var retries = 0
                while !Task.isCancelled && retries < self.maxRetries {
                    do {
                        continuation.yield(.connecting)
                        try await self.streamEvents(continuation: continuation)
                        // Clean exit — server closed connection
                        retries = 0
                    } catch is CancellationError {
                        break
                    } catch {
                        retries += 1
                        continuation.yield(.error(error.localizedDescription))

                        if retries >= self.maxRetries {
                            continuation.yield(.disconnected)
                            break
                        }

                        // Exponential backoff with jitter
                        let backoff = self.baseRetryInterval * pow(2, Double(retries - 1))
                        let jitter = Double.random(in: 0...backoff * 0.5)
                        let delay = min(backoff + jitter, 30)
                        try? await Task.sleep(for: .seconds(delay))
                    }
                }
                continuation.finish()
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    private func streamEvents(continuation: AsyncStream<SSEEvent>.Continuation) async throws {
        var request = URLRequest(url: URL(string: "\(baseURL)/admin/events")!)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !adminKey.isEmpty {
            request.setValue(adminKey, forHTTPHeaderField: "X-Admin-Key")
        }

        let (bytes, response) = try await session.bytes(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw SSEError.connectionFailed(code)
        }

        continuation.yield(.connected)

        let decoder = JSONDecoder()
        for try await line in bytes.lines {
            try Task.checkCancellation()

            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("data:") else { continue }
            let data = String(trimmed.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            if data.isEmpty || data == "[DONE]" { continue }

            guard let jsonData = data.data(using: .utf8) else { continue }

            if let status = try? decoder.decode(ServerStatus.self, from: jsonData) {
                continuation.yield(.status(status))
            }
        }
    }

    func disconnect() {
        currentTask?.cancel()
        currentTask = nil
    }
}

// MARK: - Types

enum SSEEvent: Sendable {
    case connecting
    case connected
    case status(ServerStatus)
    case error(String)
    case disconnected
}

enum SSEError: LocalizedError {
    case connectionFailed(Int)

    var errorDescription: String? {
        switch self {
        case .connectionFailed(let code): return "SSE connection failed: HTTP \(code)"
        }
    }
}
