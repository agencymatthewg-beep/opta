//
//  NetworkMonitor.swift
//  ClawdbotKit
//
//  Monitors network reachability using NWPathMonitor.
//  Detects network changes to trigger reconnection behavior.
//

import Foundation
import Network
import Combine

// MARK: - Network Status

/// Current network status
public enum NetworkStatus: String, Sendable, Equatable {
    case connected
    case disconnected
    case requiresConnection  // e.g., captive portal

    /// Whether network is usable for WebSocket
    public var isUsable: Bool {
        self == .connected
    }
}

/// Network interface type
public enum NetworkInterface: String, Sendable {
    case wifi
    case cellular
    case wiredEthernet
    case loopback
    case other
    case unknown

    init(from interface: NWInterface.InterfaceType) {
        switch interface {
        case .wifi:
            self = .wifi
        case .cellular:
            self = .cellular
        case .wiredEthernet:
            self = .wiredEthernet
        case .loopback:
            self = .loopback
        case .other:
            self = .other
        @unknown default:
            self = .unknown
        }
    }
}

/// Network path information
public struct NetworkPath: Sendable, Equatable {
    public let status: NetworkStatus
    public let interfaces: [NetworkInterface]
    public let isExpensive: Bool      // Cellular or hotspot
    public let isConstrained: Bool    // Low Data Mode
    public let supportsIPv4: Bool
    public let supportsIPv6: Bool

    /// Primary interface (first available)
    public var primaryInterface: NetworkInterface? {
        interfaces.first
    }

    /// Whether connection is via VPN (including Tailscale)
    public var usesVPN: Bool {
        // VPN connections often appear as "other" interface type
        interfaces.contains(.other)
    }
}

// MARK: - Network Monitor

/// Monitors network reachability changes
public final class NetworkMonitor: @unchecked Sendable {

    // MARK: - Properties

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "com.clawdbot.networkmonitor", qos: .utility)
    private var isMonitoring = false

    private let pathSubject = CurrentValueSubject<NetworkPath?, Never>(nil)
    private let statusSubject = CurrentValueSubject<NetworkStatus, Never>(.disconnected)

    /// Current network path
    public var currentPath: NetworkPath? {
        pathSubject.value
    }

    /// Current network status
    public var status: NetworkStatus {
        statusSubject.value
    }

    /// Publisher for network path changes
    public var pathPublisher: AnyPublisher<NetworkPath?, Never> {
        pathSubject.eraseToAnyPublisher()
    }

    /// Publisher for status changes only
    public var statusPublisher: AnyPublisher<NetworkStatus, Never> {
        statusSubject
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    // MARK: - Initialization

    public init() {
        self.monitor = NWPathMonitor()
    }

    /// Initialize for specific interface type
    public init(requiredInterfaceType: NWInterface.InterfaceType) {
        self.monitor = NWPathMonitor(requiredInterfaceType: requiredInterfaceType)
    }

    deinit {
        stop()
    }

    // MARK: - Monitoring

    /// Start monitoring network changes
    public func start() {
        guard !isMonitoring else { return }

        monitor.pathUpdateHandler = { [weak self] path in
            self?.handlePathUpdate(path)
        }

        monitor.start(queue: queue)
        isMonitoring = true
    }

    /// Stop monitoring
    public func stop() {
        guard isMonitoring else { return }

        monitor.cancel()
        isMonitoring = false
    }

    // MARK: - Path Handling

    private func handlePathUpdate(_ path: NWPath) {
        let status: NetworkStatus
        switch path.status {
        case .satisfied:
            status = .connected
        case .unsatisfied:
            status = .disconnected
        case .requiresConnection:
            status = .requiresConnection
        @unknown default:
            status = .disconnected
        }

        let interfaces = path.availableInterfaces.map {
            NetworkInterface(from: $0.type)
        }

        let networkPath = NetworkPath(
            status: status,
            interfaces: interfaces,
            isExpensive: path.isExpensive,
            isConstrained: path.isConstrained,
            supportsIPv4: path.supportsIPv4,
            supportsIPv6: path.supportsIPv6
        )

        pathSubject.send(networkPath)
        statusSubject.send(status)
    }

    // MARK: - Utilities

    /// Check if a specific host is reachable
    public func isReachable(host: String, port: UInt16 = 443) async -> Bool {
        return await withCheckedContinuation { continuation in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: port)!
            )
            let connection = NWConnection(to: endpoint, using: .tcp)

            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    connection.cancel()
                    continuation.resume(returning: true)
                case .failed, .cancelled:
                    continuation.resume(returning: false)
                default:
                    break
                }
            }

            connection.start(queue: self.queue)

            // Timeout after 5 seconds
            DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
                if connection.state != .cancelled {
                    connection.cancel()
                    continuation.resume(returning: false)
                }
            }
        }
    }
}
