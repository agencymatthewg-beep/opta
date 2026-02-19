import Foundation

/// Errors from LMX API calls.
enum LMXError: LocalizedError {
    case connectionFailed(String)
    case unauthorized
    case serverUnavailable
    case invalidResponse(Int, String)
    case noData

    var errorDescription: String? {
        switch self {
        case .connectionFailed(let msg): return "Connection failed: \(msg)"
        case .unauthorized: return "Unauthorized — check admin key"
        case .serverUnavailable: return "Server unavailable"
        case .invalidResponse(let code, let body): return "HTTP \(code): \(body)"
        case .noData: return "No data in response"
        }
    }
}

/// Protocol for LMX API operations. All methods are Sendable-safe.
protocol LMXClientProtocol: Sendable {
    func getStatus() async throws -> ServerStatus
    func getModels() async throws -> ModelsResponse
    func healthCheck() async throws -> Bool
    func streamChat(model: String, messages: [ChatMessageParam], temperature: Double?, maxTokens: Int?) -> AsyncThrowingStream<String, Error>
    func loadModel(id: String) async throws -> LoadedModel
    func unloadModel(id: String) async throws
    func getSessions(limit: Int?, offset: Int?) async throws -> SessionListResponse
    func getSession(id: String) async throws -> SessionFull
}

/// Concrete LMX API client using URLSession.
final class LMXClient: LMXClientProtocol, Sendable {
    private let baseURL: String
    private let adminKey: String
    private let session: URLSession

    init(baseURL: String, adminKey: String) {
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.adminKey = adminKey

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }

    // MARK: - Private helpers

    private func makeRequest(path: String, method: String = "GET", body: Data? = nil) -> URLRequest {
        var request = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !adminKey.isEmpty {
            request.setValue(adminKey, forHTTPHeaderField: "X-Admin-Key")
        }
        request.httpBody = body
        return request
    }

    private func fetch<T: Decodable>(_ path: String, method: String = "GET", body: Data? = nil) async throws -> T {
        let request = makeRequest(path: path, method: method, body: body)
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw LMXError.connectionFailed("Invalid response")
        }

        switch httpResponse.statusCode {
        case 200..<300:
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        case 401, 403:
            throw LMXError.unauthorized
        case 503:
            throw LMXError.serverUnavailable
        default:
            let body = String(data: data, encoding: .utf8) ?? ""
            throw LMXError.invalidResponse(httpResponse.statusCode, body)
        }
    }

    // MARK: - Admin endpoints

    func getStatus() async throws -> ServerStatus {
        try await fetch("/admin/status")
    }

    func loadModel(id: String) async throws -> LoadedModel {
        let body = try JSONEncoder().encode(["model_id": id])
        return try await fetch("/admin/models/load", method: "POST", body: body)
    }

    func unloadModel(id: String) async throws {
        let body = try JSONEncoder().encode(["model_id": id])
        let _: EmptyResponse = try await fetch("/admin/models/unload", method: "POST", body: body)
    }

    func healthCheck() async throws -> Bool {
        do {
            _ = try await getStatus()
            return true
        } catch {
            return false
        }
    }

    // MARK: - Session endpoints

    func getSessions(limit: Int? = nil, offset: Int? = nil) async throws -> SessionListResponse {
        var params: [String] = []
        if let limit { params.append("limit=\(limit)") }
        if let offset { params.append("offset=\(offset)") }
        let qs = params.isEmpty ? "" : "?\(params.joined(separator: "&"))"
        return try await fetch("/admin/sessions\(qs)")
    }

    func getSession(id: String) async throws -> SessionFull {
        try await fetch("/admin/sessions/\(id)")
    }

    // MARK: - OpenAI-compatible endpoints

    func getModels() async throws -> ModelsResponse {
        try await fetch("/v1/models")
    }

    /// Streaming chat completions via SSE over URLSession.bytes.
    /// Yields content delta strings as they arrive.
    func streamChat(
        model: String,
        messages: [ChatMessageParam],
        temperature: Double? = nil,
        maxTokens: Int? = nil
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let request = ChatCompletionRequest(
                        model: model,
                        messages: messages,
                        stream: true,
                        temperature: temperature,
                        maxTokens: maxTokens
                    )
                    let body = try JSONEncoder().encode(request)
                    var urlRequest = makeRequest(path: "/v1/chat/completions", method: "POST", body: body)
                    urlRequest.timeoutInterval = 300

                    let (bytes, response) = try await session.bytes(for: urlRequest)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        throw LMXError.connectionFailed("Invalid response")
                    }
                    guard (200..<300).contains(httpResponse.statusCode) else {
                        throw LMXError.invalidResponse(httpResponse.statusCode, "Stream error")
                    }

                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespaces)
                        guard trimmed.hasPrefix("data:") else { continue }
                        let data = String(trimmed.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                        if data == "[DONE]" { break }

                        guard let jsonData = data.data(using: .utf8),
                              let chunk = try? JSONDecoder().decode(ChatCompletionChunk.self, from: jsonData),
                              let content = chunk.choices.first?.delta.content else { continue }
                        continuation.yield(content)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

private struct EmptyResponse: Decodable {}
