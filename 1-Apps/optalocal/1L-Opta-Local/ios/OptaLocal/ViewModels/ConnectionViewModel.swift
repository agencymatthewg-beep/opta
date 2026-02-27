import Foundation

@Observable @MainActor
final class ConnectionViewModel {
    var host = "192.168.188.11"
    var port = "1234"
    var adminKey = ""
    var isConnecting = false

    func connect(manager: ConnectionManager) async {
        let portInt = Int(port) ?? 1234
        isConnecting = true
        await manager.connect(host: host, port: portInt, adminKey: adminKey)
        isConnecting = false
    }

    func loadStoredKey(manager: ConnectionManager) {
        adminKey = manager.storedAdminKey
    }
}
