import Foundation
import Combine

// MARK: - API Service

@MainActor
class APIService: ObservableObject {
    static let shared = APIService()
    
    // Configure this to your deployed Next.js app URL
    private let baseURL: String
    
    @Published var isLoading = false
    @Published var lastError: String?
    
    private init() {
        // Points to the Opta AI Gateway (Next.js)
        self.baseURL = "https://lm.optamize.biz/api/mobile"
    }
    
    // MARK: - Tasks API
    
    func fetchTasksDashboard() async throws -> TaskDashboardData {
        let response: APIResponse<TaskDashboardData> = try await get("/tasks?view=dashboard")
        return try response.validatedData(endpoint: "/tasks?view=dashboard")
    }
    
    func fetchTodayTasks() async throws -> [OptaTask] {
        let response: APIResponse<[OptaTask]> = try await get("/tasks?view=today")
        return try response.validatedData(endpoint: "/tasks?view=today")
    }
    
    func createTask(content: String, dueString: String? = nil, priority: Int? = nil) async throws -> OptaTask {
        var body: [String: Any] = [
            "action": "create",
            "content": content
        ]
        if let dueString = dueString {
            body["due_string"] = dueString
        }
        if let priority = priority {
            body["priority"] = priority
        }

        let response: CreateTaskResponse = try await post("/tasks", body: body)
        let task = response.task

        // Schedule notification reminder if task has a due date
        await MainActor.run {
            NotificationManager.shared.scheduleTaskReminder(for: task)
        }

        return task
    }
    
    func completeTask(taskId: String) async throws {
        let body: [String: Any] = [
            "action": "complete",
            "taskId": taskId
        ]
        let response: APIResponse<EmptyData> = try await post("/tasks", body: body)
        _ = try response.validatedData(endpoint: "/tasks")
    }
    
    // MARK: - Calendar API
    
    func fetchCalendarEvents(range: String = "today") async throws -> [CalendarEvent] {
        let response: CalendarResponse = try await get("/calendar?range=\(range)")
        return response.events
    }
    
    func createCalendarEvent(summary: String, startTime: String, endTime: String? = nil) async throws {
        var body: [String: Any] = [
            "summary": summary,
            "startTime": startTime
        ]
        if let endTime = endTime {
            body["endTime"] = endTime
        }
        let response: APIResponse<EmptyData> = try await post("/calendar", body: body)
        _ = try response.validatedData(endpoint: "/calendar")
    }
    
    func deleteCalendarEvent(eventId: String) async throws {
        let response: APIResponse<EmptyData> = try await delete("/calendar?id=\(eventId)")
        _ = try response.validatedData(endpoint: "/calendar?id=\(eventId)")
    }
    
    // MARK: - Email API
    
    func fetchUnreadEmails() async throws -> [Email] {
        let response: EmailResponse = try await get("/email")
        return response.emails
    }
    
    func createEmailDraft(to: String, subject: String, body: String) async throws {
        let requestBody: [String: Any] = [
            "action": "draft",
            "to": to,
            "subject": subject,
            "body": body
        ]
        let response: APIResponse<EmptyData> = try await post("/email", body: requestBody)
        _ = try response.validatedData(endpoint: "/email")
    }
    
    // MARK: - AI API

    func sendAICommand(_ command: String, state: [String: Any] = [:]) async throws -> AICommandResponse {
        // Try backend first, fall back to local AI if unavailable
        do {
            let body: [String: Any] = [
                "action": "command",
                "command": command,
                "state": state
            ]
            return try await post("/ai", body: body)
        } catch {
            // Backend unavailable - use on-device AI
            return await LocalAIService.shared.processCommand(command, state: state)
        }
    }
    
    func fetchBriefing() async throws -> Briefing {
        do {
            let body: [String: Any] = ["action": "briefing"]
            let response: AIBriefingResponse = try await post("/ai", body: body)
            return response.briefing
        } catch {
            // Return a local briefing when backend unavailable
            let hour = Calendar.current.component(.hour, from: Date())
            let greeting = hour < 12 ? "Good morning!" : (hour < 17 ? "Good afternoon!" : "Good evening!")
            return Briefing(
                greeting: greeting,
                summary: "Welcome to Opta! Check your tasks and schedule below to stay organized today.",
                stats: BriefingStats(tasksToday: 0, tasksTotal: 0, upcomingEvents: 0, unreadEmails: 0),
                nextEvents: []
            )
        }
    }

    func fetchQuickStatus() async throws -> QuickStatusResponse {
        do {
            let body: [String: Any] = ["action": "quick_status"]
            return try await post("/ai", body: body)
        } catch {
            // Return a local status when backend unavailable
            return QuickStatusResponse(
                success: true,
                status: QuickStatus(tasksToday: 0, nextEvent: nil, nextEventTime: nil),
                spokenResponse: "Ready to help! Check your dashboard for today's overview."
            )
        }
    }
    
    // MARK: - Auth API
    
    func verifyAuth() async throws -> Bool {
        let response: AuthVerifyResponse = try await get("/auth")
        return response.authenticated
    }
    
    // MARK: - HTTP Methods
    
    private func get<T: Decodable>(_ endpoint: String) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        await refreshAccessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeaders(&request)
        
        return try await execute(request)
    }
    
    private func post<T: Decodable>(_ endpoint: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        await refreshAccessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        addAuthHeaders(&request)
        
        return try await execute(request)
    }
    
    private func delete<T: Decodable>(_ endpoint: String) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        await refreshAccessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeaders(&request)
        
        return try await execute(request)
    }
    
    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.serverError(errorResponse.error)
                }
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
            
        } catch let error as APIError {
            lastError = error.localizedDescription
            throw error
        } catch {
            lastError = error.localizedDescription
            throw APIError.networkError(error)
        }
    }
    
    private var cachedAccessToken: String?
    
    /// Pre-fetch the Supabase access token before making requests
    private func refreshAccessToken() async {
        cachedAccessToken = try? await SupabaseService.shared.client.auth.session.accessToken
    }
    
    private func addAuthHeaders(_ request: inout URLRequest) {
        if let token = cachedAccessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }
}

// MARK: - API Types

struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let message: String?
    
    func validatedData(endpoint: String) throws -> T {
        guard success else {
            throw APIError.serverError(message ?? "Request failed for \(endpoint)")
        }
        
        if let data {
            return data
        }
        
        // Some action endpoints may omit `data` but still indicate success.
        if let emptyData = EmptyData() as? T {
            return emptyData
        }
        
        throw APIError.serverError(message ?? "Invalid API response for \(endpoint): missing data")
    }
}

struct EmptyData: Decodable {}

struct ErrorResponse: Decodable {
    let error: String
}

struct AuthVerifyResponse: Decodable {
    let authenticated: Bool
    let user: UserInfo?
}

struct UserInfo: Decodable {
    let name: String?
    let email: String?
    let image: String?
}

struct CreateTaskResponse: Decodable {
    let success: Bool
    let task: OptaTask
    let message: String?
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case httpError(Int)
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Please sign in to continue"
        case .httpError(let code):
            return "Server error (HTTP \(code))"
        case .serverError(let message):
            return message
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        }
    }
}
