import Foundation

struct ServerStatus: Codable, Sendable {
    let vramUsedGb: Double
    let vramTotalGb: Double
    let loadedModels: [LoadedModel]
    let activeRequests: Int
    let tokensPerSecond: Double
    let temperatureCelsius: Double
    let uptimeSeconds: Int

    enum CodingKeys: String, CodingKey {
        case vramUsedGb = "vram_used_gb"
        case vramTotalGb = "vram_total_gb"
        case loadedModels = "loaded_models"
        case activeRequests = "active_requests"
        case tokensPerSecond = "tokens_per_second"
        case temperatureCelsius = "temperature_celsius"
        case uptimeSeconds = "uptime_seconds"
    }
}

struct LoadedModel: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let vramGb: Double
    let quantization: String
    let contextLength: Int
    let loadedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case vramGb = "vram_gb"
        case quantization
        case contextLength = "context_length"
        case loadedAt = "loaded_at"
    }
}

struct ModelsResponse: Codable, Sendable {
    let object: String
    let data: [ModelInfo]
}

struct ModelInfo: Codable, Identifiable, Sendable {
    let id: String
    let object: String
    let created: Int
    let ownedBy: String

    enum CodingKeys: String, CodingKey {
        case id, object, created
        case ownedBy = "owned_by"
    }
}
