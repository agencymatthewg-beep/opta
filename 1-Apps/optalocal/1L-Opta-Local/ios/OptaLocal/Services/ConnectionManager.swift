import Foundation

/// Manages the active connection to an LMX server.
/// Handles LAN discovery, manual connection, and admin key storage.
@Observable @MainActor
final class ConnectionManager {
    /// Current connection state.
    private(set) var state: ConnectionState = .disconnected

    /// The active LMX client (nil when disconnected).
    private(set) var client: LMXClient?

    /// Active connection config.
    private(set) var activeConfig: ConnectionConfig?

    /// Saved connections.
    var savedConnections: [ConnectionConfig] = []

    /// Bonjour discovery service.
    let discovery = BonjourDiscovery()

    private static let adminKeyKeychainKey = "admin-key"
    private static let savedConnectionsKey = "opta-local:connections"

    init() {
        loadSavedConnections()
        loadAdminKey()
    }

    // MARK: - Connection

    /// Connect to a server with the given config and admin key.
    func connect(config: ConnectionConfig, adminKey: String) async {
        state = .connecting
        let lmxClient = LMXClient(baseURL: config.baseURL, adminKey: adminKey)

        do {
            let reachable = try await lmxClient.healthCheck()
            if reachable {
                self.client = lmxClient
                self.activeConfig = config
                self.state = .connected(config.type)
                OptaHaptics.success()

                // Save admin key to Keychain
                try? KeychainManager.save(key: Self.adminKeyKeychainKey, value: adminKey)

                // Save connection
                saveConnection(config)
            } else {
                self.state = .error("Server unreachable")
                OptaHaptics.error()
            }
        } catch {
            self.state = .error(error.localizedDescription)
            OptaHaptics.error()
        }
    }

    /// Connect to a discovered Bonjour server.
    func connect(discovered: BonjourDiscovery.DiscoveredServer, adminKey: String) async {
        let config = ConnectionConfig(
            name: discovered.name,
            type: .lan,
            host: discovered.host,
            port: discovered.port
        )
        await connect(config: config, adminKey: adminKey)
    }

    /// Connect with manual host/port.
    func connect(host: String, port: Int, adminKey: String) async {
        let config = ConnectionConfig(
            name: host,
            type: .lan,
            host: host,
            port: port
        )
        await connect(config: config, adminKey: adminKey)
    }

    /// Disconnect from the current server.
    func disconnect() {
        client = nil
        activeConfig = nil
        state = .disconnected
    }

    /// Try to reconnect to the last saved connection.
    func reconnect() async {
        guard let config = savedConnections.first(where: { $0.isActive }),
              let adminKey = KeychainManager.read(key: Self.adminKeyKeychainKey) else { return }
        await connect(config: config, adminKey: adminKey)
    }

    // MARK: - Admin key

    var storedAdminKey: String {
        KeychainManager.read(key: Self.adminKeyKeychainKey) ?? ""
    }

    func saveAdminKey(_ key: String) {
        try? KeychainManager.save(key: Self.adminKeyKeychainKey, value: key)
    }

    func clearAdminKey() {
        KeychainManager.delete(key: Self.adminKeyKeychainKey)
    }

    // MARK: - Persistence

    private func loadAdminKey() {
        // Admin key loaded on-demand from Keychain
    }

    private func loadSavedConnections() {
        guard let data = UserDefaults.standard.data(forKey: Self.savedConnectionsKey),
              let connections = try? JSONDecoder().decode([ConnectionConfig].self, from: data) else { return }
        savedConnections = connections
    }

    private func saveConnection(_ config: ConnectionConfig) {
        // Deactivate all, activate this one
        for i in savedConnections.indices {
            savedConnections[i].isActive = false
        }
        if let idx = savedConnections.firstIndex(where: { $0.id == config.id }) {
            savedConnections[idx] = config
            savedConnections[idx].isActive = true
        } else {
            var newConfig = config
            newConfig.isActive = true
            savedConnections.insert(newConfig, at: 0)
        }
        persistConnections()
    }

    private func persistConnections() {
        guard let data = try? JSONEncoder().encode(savedConnections) else { return }
        UserDefaults.standard.set(data, forKey: Self.savedConnectionsKey)
    }
}
