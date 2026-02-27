import Foundation

struct ConnectionConfig: Codable, Identifiable, Sendable, Hashable {
    let id: UUID
    var name: String
    var type: ConnectionType
    var host: String
    var port: Int
    var isActive: Bool

    enum ConnectionType: String, Codable, Sendable, Hashable {
        case lan
        case wan
    }

    init(id: UUID = UUID(), name: String, type: ConnectionType = .lan, host: String, port: Int = 1234, isActive: Bool = false) {
        self.id = id
        self.name = name
        self.type = type
        self.host = host
        self.port = port
        self.isActive = isActive
    }

    var baseURL: String {
        switch type {
        case .lan:
            return "http://\(host):\(port)"
        case .wan:
            return host // WAN URL is full HTTPS URL
        }
    }
}

enum ConnectionState: Sendable {
    case disconnected
    case connecting
    case connected(ConnectionConfig.ConnectionType)
    case error(String)

    var isConnected: Bool {
        if case .connected = self { return true }
        return false
    }
}
