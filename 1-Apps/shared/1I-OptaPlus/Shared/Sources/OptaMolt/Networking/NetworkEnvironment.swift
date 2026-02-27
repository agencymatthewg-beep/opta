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

    deinit {
        monitor.cancel()
    }

    /// Quick TCP probe to check if LAN host is reachable (200ms timeout).
    public func probeLAN(host: String, port: Int) async -> Bool {
        await withCheckedContinuation { continuation in
            guard let nwPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
                continuation.resume(returning: false)
                return
            }
            let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: nwPort)
            let connection = NWConnection(to: endpoint, using: .tcp)
            let lock = NSLock()
            var resumed = false

            func safeResume(_ value: Bool) {
                lock.lock()
                defer { lock.unlock() }
                guard !resumed else { return }
                resumed = true
                connection.cancel()
                continuation.resume(returning: value)
            }

            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    safeResume(true)
                case .failed, .cancelled:
                    safeResume(false)
                default:
                    break
                }
            }

            connection.start(queue: .global())

            // 200ms timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) {
                safeResume(false)
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

    /// Callback fired when a network path change is detected.
    /// ChatViewModel observes this to trigger reconnection on network toggle.
    public var onNetworkChange: (() -> Void)?

    /// Whether the network is currently satisfied (has connectivity).
    @Published public var isNetworkAvailable: Bool = true

    /// Track the previous path status to detect actual transitions.
    private var previousPathStatus: NWPath.Status?

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self = self else { return }
                let wasAvailable = self.isNetworkAvailable
                self.isNetworkAvailable = path.status == .satisfied

                // Detect actual network transition (not just initial report)
                let isTransition = self.previousPathStatus != nil && path.status != self.previousPathStatus
                self.previousPathStatus = path.status

                // Network changed — invalidate cached route
                self.connectionType = .unknown

                // If network came back up (or interface changed), notify listeners
                if isTransition && self.isNetworkAvailable {
                    self.onNetworkChange?()
                }
            }
        }
        monitor.start(queue: .global())
    }
}
