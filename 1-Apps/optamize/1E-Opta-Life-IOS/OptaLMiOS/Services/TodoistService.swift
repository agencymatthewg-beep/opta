import Foundation
import SwiftUI

// MARK: - Todoist Service

/// Direct Todoist REST API v2 client with OAuth 2.0 support
@MainActor
final class TodoistService: ObservableObject {
    static let shared = TodoistService()

    // MARK: - Configuration

    private let baseURL = "https://api.todoist.com/rest/v2"
    private let oauthBaseURL = "https://todoist.com/oauth"

    private let clientID: String
    private let clientSecret: String
    private let redirectURI = "optalm://todoist-callback"
    private let scope = "data:read_write"
    private let configurationError: TodoistError?

    // MARK: - Published State

    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var lastError: String?
    @Published var projects: [TodoistProject] = []

    // MARK: - Rate Limiting

    private var rateLimitInfo = RateLimitInfo(requestsRemaining: 450, resetTime: Date())

    // MARK: - Access Token

    var accessToken: String? {
        get {
            KeychainHelper.get("todoist_access_token")
        }
        set {
            if let value = newValue {
                KeychainHelper.set(value, forKey: "todoist_access_token")
                isAuthenticated = true
            } else {
                KeychainHelper.delete("todoist_access_token")
                isAuthenticated = false
            }
        }
    }

    // MARK: - Initialization

    private init() {
        let resolvedClientID = Self.configurationValue(forKey: "TODOIST_CLIENT_ID")
        let resolvedClientSecret = Self.configurationValue(forKey: "TODOIST_CLIENT_SECRET")
        var missingKeys: [String] = []

        if resolvedClientID == nil {
            missingKeys.append("TODOIST_CLIENT_ID")
        }
        if resolvedClientSecret == nil {
            missingKeys.append("TODOIST_CLIENT_SECRET")
        }

        self.clientID = resolvedClientID ?? ""
        self.clientSecret = resolvedClientSecret ?? ""
        self.configurationError = missingKeys.isEmpty ? nil : .missingConfiguration(missingKeys.sorted())

        // Check if we have a stored token
        isAuthenticated = accessToken != nil

        if let configurationError {
            lastError = configurationError.localizedDescription
        }
    }

    // MARK: - OAuth Flow

    /// Initiate OAuth authorization flow
    /// Returns the authorization URL to open in Safari
    func initiateOAuth() -> URL? {
        if let configurationError {
            lastError = configurationError.localizedDescription
            return nil
        }

        var components = URLComponents(string: "\(oauthBaseURL)/authorize")
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "state", value: generateState())
        ]
        return components?.url
    }

    /// Handle OAuth callback with authorization code
    /// - Parameter code: Authorization code from callback URL
    func handleOAuthCallback(code: String) async throws {
        isLoading = true
        lastError = nil

        defer { isLoading = false }

        do {
            try requireOAuthConfiguration()
            let tokenResponse = try await exchangeCodeForToken(code: code)
            accessToken = tokenResponse.accessToken

            // Fetch initial data
            try await fetchProjects()

            HapticManager.shared.notification(.success)
        } catch {
            lastError = error.localizedDescription
            HapticManager.shared.notification(.error)
            throw error
        }
    }

    /// Sign out and revoke access
    func signOut() {
        accessToken = nil
        projects = []
        isAuthenticated = false
    }

    // MARK: - Tasks API

    /// Fetch all active tasks from Todoist
    /// - Parameter filter: Optional Todoist filter string (e.g., "today", "overdue")
    /// - Returns: Array of TodoistTask objects
    func fetchTasks(filter: String? = nil) async throws -> [TodoistTask] {
        try checkRateLimit()

        var endpoint = "/tasks"
        if let filter = filter {
            endpoint += "?filter=\(filter.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? filter)"
        }

        let tasks: [TodoistTask] = try await get(endpoint)
        rateLimitInfo.recordRequest()
        return tasks
    }

    /// Fetch a specific task by ID
    /// - Parameter taskId: Todoist task ID
    /// - Returns: TodoistTask object
    func fetchTask(taskId: String) async throws -> TodoistTask {
        try checkRateLimit()

        let task: TodoistTask = try await get("/tasks/\(taskId)")
        rateLimitInfo.recordRequest()
        return task
    }

    /// Create a new task in Todoist
    /// - Parameter taskRequest: TodoistTaskRequest with task details
    /// - Returns: Created TodoistTask
    func createTask(_ taskRequest: TodoistTaskRequest) async throws -> TodoistTask {
        try checkRateLimit()

        let task: TodoistTask = try await post("/tasks", body: taskRequest)
        rateLimitInfo.recordRequest()
        HapticManager.shared.notification(.success)
        return task
    }

    /// Update an existing task
    /// - Parameters:
    ///   - taskId: Todoist task ID
    ///   - taskRequest: TodoistTaskRequest with updated details
    /// - Returns: Updated TodoistTask
    func updateTask(taskId: String, _ taskRequest: TodoistTaskRequest) async throws -> TodoistTask {
        try checkRateLimit()

        let task: TodoistTask = try await post("/tasks/\(taskId)", body: taskRequest)
        rateLimitInfo.recordRequest()
        return task
    }

    /// Complete a task (close it)
    /// - Parameter taskId: Todoist task ID
    func completeTask(id: String) async throws {
        try checkRateLimit()

        let _: EmptyResponse = try await post("/tasks/\(id)/close", body: EmptyBody())
        rateLimitInfo.recordRequest()
        HapticManager.shared.notification(.success)
    }

    /// Reopen a completed task
    /// - Parameter taskId: Todoist task ID
    func reopenTask(id: String) async throws {
        try checkRateLimit()

        let _: EmptyResponse = try await post("/tasks/\(id)/reopen", body: EmptyBody())
        rateLimitInfo.recordRequest()
    }

    /// Delete a task
    /// - Parameter taskId: Todoist task ID
    func deleteTask(id: String) async throws {
        try checkRateLimit()

        try await delete("/tasks/\(id)")
        rateLimitInfo.recordRequest()
    }

    // MARK: - Projects API

    /// Fetch all projects
    /// - Returns: Array of TodoistProject objects
    func fetchProjects() async throws -> [TodoistProject] {
        try checkRateLimit()

        let fetchedProjects: [TodoistProject] = try await get("/projects")
        projects = fetchedProjects
        rateLimitInfo.recordRequest()
        return fetchedProjects
    }

    /// Fetch a specific project by ID
    /// - Parameter projectId: Todoist project ID
    /// - Returns: TodoistProject object
    func fetchProject(projectId: String) async throws -> TodoistProject {
        try checkRateLimit()

        let project: TodoistProject = try await get("/projects/\(projectId)")
        rateLimitInfo.recordRequest()
        return project
    }

    // MARK: - Sections API

    /// Fetch all sections in a project
    /// - Parameter projectId: Todoist project ID
    /// - Returns: Array of TodoistSection objects
    func fetchSections(projectId: String) async throws -> [TodoistSection] {
        try checkRateLimit()

        let sections: [TodoistSection] = try await get("/sections?project_id=\(projectId)")
        rateLimitInfo.recordRequest()
        return sections
    }

    // MARK: - Labels API

    /// Fetch all labels
    /// - Returns: Array of TodoistLabel objects
    func fetchLabels() async throws -> [TodoistLabel] {
        try checkRateLimit()

        let labels: [TodoistLabel] = try await get("/labels")
        rateLimitInfo.recordRequest()
        return labels
    }

    // MARK: - Private Helpers

    private static func configurationValue(forKey key: String) -> String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !value.contains("$(") else {
            return nil
        }

        return value
    }

    private func requireOAuthConfiguration() throws {
        if let configurationError {
            throw configurationError
        }
    }

    /// Exchange authorization code for access token
    private func exchangeCodeForToken(code: String) async throws -> TodoistTokenResponse {
        let url = URL(string: "\(oauthBaseURL)/access_token")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let params = [
            "client_id": clientID,
            "client_secret": clientSecret,
            "code": code,
            "redirect_uri": redirectURI
        ]

        var bodyComponents = URLComponents()
        bodyComponents.queryItems = params.map { key, value in
            URLQueryItem(name: key, value: value)
        }
        request.httpBody = bodyComponents.percentEncodedQuery?.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TodoistError.invalidResponse
        }

        if httpResponse.statusCode != 200 {
            if let error = try? JSONDecoder().decode(TodoistOAuthError.self, from: data) {
                throw TodoistError.oauthError(error.error)
            }
            throw TodoistError.httpError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(TodoistTokenResponse.self, from: data)
    }

    /// Generate a random state parameter for OAuth security
    private func generateState() -> String {
        UUID().uuidString
    }

    /// Check if rate limit allows making requests
    private func checkRateLimit() throws {
        if rateLimitInfo.isLimited {
            let timeRemaining = Int(rateLimitInfo.resetTime.timeIntervalSinceNow)
            throw TodoistError.rateLimited(resetIn: timeRemaining)
        }

        // Auto-reset if time has passed
        if Date() >= rateLimitInfo.resetTime {
            rateLimitInfo.reset()
        }
    }

    // MARK: - HTTP Methods

    private func get<T: Decodable>(_ endpoint: String) async throws -> T {
        guard let token = accessToken else {
            throw TodoistError.notAuthenticated
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw TodoistError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await execute(request)
    }

    private func post<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        guard let token = accessToken else {
            throw TodoistError.notAuthenticated
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw TodoistError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(body)

        return try await execute(request)
    }

    private func delete(_ endpoint: String) async throws {
        guard let token = accessToken else {
            throw TodoistError.notAuthenticated
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw TodoistError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TodoistError.invalidResponse
        }

        if httpResponse.statusCode != 204 {
            throw TodoistError.httpError(httpResponse.statusCode)
        }
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TodoistError.invalidResponse
        }

        // Handle rate limiting from headers
        if let remaining = httpResponse.value(forHTTPHeaderField: "X-RateLimit-Remaining"),
           let remainingInt = Int(remaining) {
            rateLimitInfo.requestsRemaining = remainingInt
        }

        if httpResponse.statusCode == 429 {
            throw TodoistError.rateLimited(resetIn: 900) // Default 15 min
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorData = String(data: data, encoding: .utf8) {
                throw TodoistError.serverError(errorData)
            }
            throw TodoistError.httpError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw TodoistError.decodingError(error)
        }
    }
}

// MARK: - Empty Body and Response

private struct EmptyBody: Encodable {}
private struct EmptyResponse: Decodable {}

// MARK: - Todoist Error

enum TodoistError: LocalizedError {
    case invalidURL
    case invalidResponse
    case notAuthenticated
    case missingConfiguration([String])
    case oauthError(String)
    case httpError(Int)
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case rateLimited(resetIn: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid Todoist API URL"
        case .invalidResponse:
            return "Invalid response from Todoist"
        case .notAuthenticated:
            return "Please connect your Todoist account"
        case .missingConfiguration(let keys):
            let keyList = keys.joined(separator: ", ")
            return "Missing Todoist configuration (\(keyList)). Set these keys in Info.plist via xcconfig."
        case .oauthError(let message):
            return "OAuth error: \(message)"
        case .httpError(let code):
            return "Todoist API error (HTTP \(code))"
        case .serverError(let message):
            return "Todoist error: \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Data parsing error: \(error.localizedDescription)"
        case .rateLimited(let resetIn):
            let minutes = resetIn / 60
            return "Rate limit reached. Try again in \(minutes) minutes."
        }
    }
}

// MARK: - URL Callback Handler

extension TodoistService {
    /// Check if URL is a Todoist OAuth callback
    static func isOAuthCallback(_ url: URL) -> Bool {
        return url.scheme == "optalm" && url.host == "todoist-callback"
    }

    /// Extract authorization code from callback URL
    static func extractCode(from url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            return nil
        }
        return code
    }
}
