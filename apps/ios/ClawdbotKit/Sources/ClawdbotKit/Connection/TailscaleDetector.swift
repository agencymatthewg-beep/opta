//
//  TailscaleDetector.swift
//  ClawdbotKit
//
//  Detects Tailscale mesh network availability.
//  Enables direct connections to Clawdbot servers via Tailscale VPN.
//
//  Tailscale IP range: 100.x.x.x (CGNAT range)
//

import Foundation
import Network
import Combine

// MARK: - Tailscale Status

/// Tailscale connection status
public enum TailscaleStatus: String, Sendable, Equatable {
    case connected      // Tailscale active and reachable
    case disconnected   // Tailscale not available
    case checking       // Currently checking status
}

/// Tailscale network information
public struct TailscaleInfo: Sendable, Equatable {
    public let status: TailscaleStatus
    public let localIP: String?           // Our Tailscale IP (100.x.x.x)
    public let canReachServer: Bool       // Can reach Clawdbot server
    public let serverIP: String?          // Configured server IP
    public let lastChecked: Date
}

// MARK: - Tailscale Detector

/// Detects and monitors Tailscale VPN connectivity
public final class TailscaleDetector: @unchecked Sendable {

    // MARK: - Constants

    /// Tailscale CGNAT IP range prefix
    private static let tailscalePrefix = "100."

    /// Known Clawdbot server IPs on Tailscale
    public struct KnownServers {
        /// Mac Studio (Mono, GLM-4.7)
        public static let macStudio = "100.75.167.36"

        /// Default server to check
        public static let `default` = macStudio
    }

    // MARK: - Properties

    private let serverIP: String
    private let checkInterval: TimeInterval
    private var checkTask: Task<Void, Never>?

    private let infoSubject = CurrentValueSubject<TailscaleInfo, Never>(
        TailscaleInfo(
            status: .disconnected,
            localIP: nil,
            canReachServer: false,
            serverIP: nil,
            lastChecked: Date()
        )
    )

    /// Current Tailscale info
    public var info: TailscaleInfo {
        infoSubject.value
    }

    /// Publisher for Tailscale status changes
    public var infoPublisher: AnyPublisher<TailscaleInfo, Never> {
        infoSubject.eraseToAnyPublisher()
    }

    /// Whether Tailscale is currently connected
    public var isConnected: Bool {
        infoSubject.value.status == .connected
    }

    // MARK: - Initialization

    /// Initialize with server IP and check interval
    /// - Parameters:
    ///   - serverIP: Tailscale IP of the Clawdbot server
    ///   - checkInterval: How often to recheck (0 for one-time check)
    public init(serverIP: String = KnownServers.default, checkInterval: TimeInterval = 60) {
        self.serverIP = serverIP
        self.checkInterval = checkInterval
    }

    deinit {
        stop()
    }

    // MARK: - Detection

    /// Start monitoring Tailscale status
    public func start() {
        stop()

        checkTask = Task { [weak self] in
            guard let self = self else { return }

            while !Task.isCancelled {
                await self.checkTailscale()

                guard self.checkInterval > 0 else { break }

                try? await Task.sleep(nanoseconds: UInt64(self.checkInterval * 1_000_000_000))
            }
        }
    }

    /// Stop monitoring
    public func stop() {
        checkTask?.cancel()
        checkTask = nil
    }

    /// Perform one-time Tailscale check
    @discardableResult
    public func check() async -> TailscaleInfo {
        await checkTailscale()
        return info
    }

    // MARK: - Internal

    private func checkTailscale() async {
        // Update to checking state
        var newInfo = TailscaleInfo(
            status: .checking,
            localIP: nil,
            canReachServer: false,
            serverIP: serverIP,
            lastChecked: Date()
        )
        infoSubject.send(newInfo)

        // 1. Check if we have a Tailscale IP
        let localIP = await getTailscaleIP()

        guard let localIP = localIP else {
            newInfo = TailscaleInfo(
                status: .disconnected,
                localIP: nil,
                canReachServer: false,
                serverIP: serverIP,
                lastChecked: Date()
            )
            infoSubject.send(newInfo)
            return
        }

        // 2. Check if we can reach the server
        let canReach = await isReachable(ip: serverIP)

        newInfo = TailscaleInfo(
            status: canReach ? .connected : .disconnected,
            localIP: localIP,
            canReachServer: canReach,
            serverIP: serverIP,
            lastChecked: Date()
        )
        infoSubject.send(newInfo)
    }

    /// Get our Tailscale IP address (100.x.x.x)
    private func getTailscaleIP() async -> String? {
        var addresses: [String] = []

        // Get all network interfaces
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let firstAddr = ifaddr else {
            return nil
        }
        defer { freeifaddrs(ifaddr) }

        var ptr = firstAddr
        while true {
            let interface = ptr.pointee

            // Check for IPv4
            if interface.ifa_addr.pointee.sa_family == UInt8(AF_INET) {
                var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(
                    interface.ifa_addr,
                    socklen_t(interface.ifa_addr.pointee.sa_len),
                    &hostname,
                    socklen_t(hostname.count),
                    nil,
                    0,
                    NI_NUMERICHOST
                )

                let address = String(cString: hostname)

                // Check if it's a Tailscale IP (100.x.x.x)
                if address.hasPrefix(Self.tailscalePrefix) {
                    addresses.append(address)
                }
            }

            guard let next = interface.ifa_next else { break }
            ptr = next
        }

        // Return first Tailscale IP found
        return addresses.first
    }

    /// Check if a Tailscale IP is reachable
    private func isReachable(ip: String, port: UInt16 = 443) async -> Bool {
        return await withCheckedContinuation { continuation in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(ip),
                port: NWEndpoint.Port(rawValue: port)!
            )
            let connection = NWConnection(to: endpoint, using: .tcp)

            var didResume = false

            connection.stateUpdateHandler = { state in
                guard !didResume else { return }

                switch state {
                case .ready:
                    didResume = true
                    connection.cancel()
                    continuation.resume(returning: true)
                case .failed, .cancelled:
                    didResume = true
                    continuation.resume(returning: false)
                default:
                    break
                }
            }

            connection.start(queue: DispatchQueue.global(qos: .utility))

            // Timeout after 3 seconds (Tailscale should be fast)
            DispatchQueue.global().asyncAfter(deadline: .now() + 3) {
                guard !didResume else { return }
                didResume = true
                connection.cancel()
                continuation.resume(returning: false)
            }
        }
    }

    // MARK: - URL Building

    /// Build WebSocket URL for Tailscale connection
    public func buildWebSocketURL(port: UInt16 = 8080, path: String = "/ws") -> URL? {
        guard isConnected else { return nil }
        return URL(string: "ws://\(serverIP):\(port)\(path)")
    }

    /// Build secure WebSocket URL for Tailscale connection
    public func buildSecureWebSocketURL(port: UInt16 = 443, path: String = "/ws") -> URL? {
        guard isConnected else { return nil }
        return URL(string: "wss://\(serverIP):\(port)\(path)")
    }
}
