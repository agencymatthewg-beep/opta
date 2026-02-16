import Foundation
import Supabase

// MARK: - Opta AI Service

/// High-tier AI service routing through the Opta AI Gateway (lm.optamize.biz)
@MainActor
class OptaAIService: ObservableObject {
    static let shared = OptaAIService()
    
    private let gatewayURL = URL(string: "https://lm.optamize.biz/api/chat")!
    private let authManager = AuthManager.shared
    
    @Published var isThinking = false
    
    private init() {}
    
    // MARK: - Chat Methods
    
    /// Send a chat request to the Opta AI Gateway
    func chat(messages: [OptaAIChatMessage], provider: AIProvider = .gemini) async throws -> String {
        isThinking = true
        defer { isThinking = false }
        
        // Ensure we have a session token
        guard let token = try? await SupabaseService.shared.client.auth.session.accessToken else {
            throw OptaAIError.unauthorized
        }
        
        // Prepare request body
        let requestBody: [String: Any] = [
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "provider": provider.rawValue
        ]
        
        var request = URLRequest(url: gatewayURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw OptaAIError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            throw OptaAIError.unauthorized
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw OptaAIError.gatewayError("HTTP \(httpResponse.statusCode)")
        }
        
        let result = try JSONDecoder().decode(ChatResponse.self, from: data)
        return result.content
    }
}

// MARK: - Models

struct OptaAIChatMessage: Codable {
    let role: String // "user", "assistant", "system"
    let content: String
}

enum AIProvider: String, Codable {
    case gemini = "gemini"
    case claude = "claude"
    case opencode = "opencode"
    case minimax = "minimax"
}

struct ChatResponse: Codable {
    let provider: String
    let model: String
    let content: String
    let usage: Usage?
    
    struct Usage: Codable {
        let prompt_tokens: Int?
        let completion_tokens: Int?
        let total_tokens: Int?
    }
}

// MARK: - Errors

enum OptaAIError: LocalizedError {
    case unauthorized
    case invalidResponse
    case gatewayError(String)
    
    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Authentication required. Please sign in to Opta Account."
        case .invalidResponse: return "Invalid response from AI gateway."
        case .gatewayError(let details): return "Gateway error: \(details)"
        }
    }
}
