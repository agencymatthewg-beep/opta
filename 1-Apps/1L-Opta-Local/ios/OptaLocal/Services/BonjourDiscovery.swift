import Foundation
import Network

/// Discovers Opta LMX servers on the local network via Bonjour/mDNS.
@Observable @MainActor
final class BonjourDiscovery {
    /// Discovered LMX servers.
    private(set) var servers: [DiscoveredServer] = []
    /// Whether discovery is actively scanning.
    private(set) var isScanning = false

    private var browser: NWBrowser?

    struct DiscoveredServer: Identifiable, Sendable, Hashable {
        let id: String
        let name: String
        let host: String
        let port: Int

        var baseURL: String { "http://\(host):\(port)" }
    }

    /// Start scanning for `_opta-lmx._tcp` services.
    func startScan() {
        guard !isScanning else { return }
        servers.removeAll()
        isScanning = true

        let params = NWParameters()
        params.includePeerToPeer = true
        let browser = NWBrowser(for: .bonjour(type: "_opta-lmx._tcp", domain: nil), using: params)

        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                guard let self else { return }
                switch state {
                case .failed:
                    self.isScanning = false
                case .cancelled:
                    self.isScanning = false
                default:
                    break
                }
            }
        }

        browser.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in
                guard let self else { return }
                await self.processResults(results)
            }
        }

        browser.start(queue: .main)
        self.browser = browser
    }

    /// Stop scanning.
    func stopScan() {
        browser?.cancel()
        browser = nil
        isScanning = false
    }

    // MARK: - Private

    private func processResults(_ results: Set<NWBrowser.Result>) async {
        var discovered: [DiscoveredServer] = []

        for result in results {
            guard case let .service(name, _, _, _) = result.endpoint else { continue }

            // Resolve the endpoint to get host/port
            if let server = await resolveEndpoint(result.endpoint, name: name) {
                discovered.append(server)
            }
        }

        self.servers = discovered
    }

    private func resolveEndpoint(_ endpoint: NWEndpoint, name: String) async -> DiscoveredServer? {
        await withCheckedContinuation { continuation in
            let connection = NWConnection(to: endpoint, using: .tcp)
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    if let path = connection.currentPath,
                       let endpoint = path.remoteEndpoint,
                       case let .hostPort(host, port) = endpoint {
                        let hostStr: String
                        switch host {
                        case .ipv4(let addr):
                            hostStr = "\(addr)"
                        case .ipv6(let addr):
                            hostStr = "\(addr)"
                        case .name(let name, _):
                            hostStr = name
                        @unknown default:
                            hostStr = "unknown"
                        }
                        let server = DiscoveredServer(
                            id: name,
                            name: name,
                            host: hostStr,
                            port: Int(port.rawValue)
                        )
                        connection.cancel()
                        continuation.resume(returning: server)
                    } else {
                        connection.cancel()
                        continuation.resume(returning: nil)
                    }
                case .failed, .cancelled:
                    continuation.resume(returning: nil)
                default:
                    break
                }
            }
            connection.start(queue: .global())

            // Timeout after 3 seconds
            DispatchQueue.global().asyncAfter(deadline: .now() + 3) {
                connection.cancel()
            }
        }
    }
}
