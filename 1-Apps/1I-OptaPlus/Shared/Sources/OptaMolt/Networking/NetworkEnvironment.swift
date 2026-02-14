//
//  NetworkEnvironment.swift
//  OptaMolt
//
//  Detects LAN availability and resolves the best connection URL for a bot.
//  Used for auto-mode: prefer LAN when available, fall back to remote.
//

import Foundation
import Network

@MainActor
public final class NetworkEnvironment: ObservableObject {

    @Published public var isOnLAN: Bool = false
    @Published public var connectionType: ConnectionType = .unknown

    public enum ConnectionType: String, Sendable {
        case lan
        case remote
        case unknown
    }

    private let monitor = NWPathMonitor()

    public init() {
        startMonitoring()
    }

    /// Quick TCP probe to check if LAN host is reachable (200ms timeout).
    public func probeLAN(host: String, port: Int) async -> Bool {
        await withCheckedContinuation { continuation in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: UInt16(port))!
            )
            let connection = NWConnection(to: endpoint, using: .tcp)
            var resumed = false

            connection.stateUpdateHandler = { state in
                guard !resumed else { return }
                switch state {
                case .ready:
                    resumed = true
                    connection.cancel()
                    continuation.resume(returning: true)
                case .failed, .cancelled:
                    resumed = true
                    continuation.resume(returning: false)
                default:
                    break
                }
            }

            connection.start(queue: .global())

            // 200ms timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) {
                guard !resumed else { return }
                resumed = true
                connection.cancel()
                continuation.resume(returning: false)
            }
        }
    }

    /// Determine the best URL for a bot config.
    public func resolveURL(for config: BotConfig) async -> URL? {
        switch config.connectionMode {
        case .lan:
            connectionType = .lan
            isOnLAN = true
            return config.lanURL
        case .remote:
            connectionType = .remote
            isOnLAN = false
            return config.remoteAccessURL
        case .auto:
            // Try LAN first
            if await probeLAN(host: config.host, port: config.port) {
                isOnLAN = true
                connectionType = .lan
                return config.lanURL
            }
            // Fall back to remote
            if let remote = config.remoteAccessURL {
                isOnLAN = false
                connectionType = .remote
                return remote
            }
            // No remote URL configured, try LAN anyway
            connectionType = .lan
            return config.lanURL
        }
    }

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] _ in
            Task { @MainActor in
                // Network changed — re-probe on next connection attempt
                self?.connectionType = .unknown
            }
        }
        monitor.start(queue: .global())
    }
}
