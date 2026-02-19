import Foundation

@Observable @MainActor
final class DashboardViewModel {
    var status: ServerStatus?
    var isLoading = false
    var isConnected = false
    var error: String?

    private var sseClient: SSEClient?
    private var streamTask: Task<Void, Never>?

    /// Start monitoring via SSE stream from `/admin/events`.
    func startMonitoring(baseURL: String, adminKey: String) {
        stopMonitoring()
        isLoading = true
        error = nil

        let client = SSEClient(baseURL: baseURL, adminKey: adminKey)
        sseClient = client

        streamTask = Task {
            for await event in await client.events() {
                guard !Task.isCancelled else { break }
                switch event {
                case .connecting:
                    isLoading = true
                    isConnected = false
                case .connected:
                    isLoading = false
                    isConnected = true
                    error = nil
                case .status(let serverStatus):
                    self.status = serverStatus
                    isLoading = false
                    isConnected = true
                    error = nil
                case .error(let message):
                    self.error = message
                    isConnected = false
                case .disconnected:
                    isConnected = false
                    isLoading = false
                }
            }
        }
    }

    /// Stop SSE monitoring.
    func stopMonitoring() {
        streamTask?.cancel()
        streamTask = nil
        if let client = sseClient {
            Task { await client.disconnect() }
        }
        sseClient = nil
    }

    /// Fetch server status once (pull-to-refresh fallback).
    func refresh(client: LMXClient) async {
        isLoading = true
        error = nil
        do {
            status = try await client.getStatus()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
