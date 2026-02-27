//
//  BotScanner.swift
//  OptaMolt
//
//  Bonjour-based discovery of OpenClaw gateways on the local network.
//  Wraps NWBrowser for _openclaw._tcp service type.
//

import Foundation
import Network
import os.log

public struct DiscoveredGateway: Identifiable, Sendable {
    public let fingerprint: String
    public let name: String
    public let host: String
    public let port: Int
    public let botCount: Int
    public let protocolVersion: Int
    public var bots: [DiscoveredBot]?

    public var id: String { fingerprint }

    public init(fingerprint: String, name: String, host: String, port: Int, botCount: Int, protocolVersion: Int, bots: [DiscoveredBot]? = nil) {
        self.fingerprint = fingerprint
        self.name = name
        self.host = host
        self.port = port
        self.botCount = botCount
        self.protocolVersion = protocolVersion
        self.bots = bots
    }
}

@MainActor
public final class BotScanner: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "BotScanner")
    private static let serviceType = "_openclaw._tcp"

    @Published public var discoveredGateways: [DiscoveredGateway] = []
    @Published public var isScanning: Bool = false
    @Published public var scanProgress: Double = 0

    private var browser: NWBrowser?
    private var scanTimer: Timer?

    public init() {}

    // MARK: - Passive Browsing

    public func startPassiveBrowsing() {
        guard browser == nil else { return }
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: .bonjour(type: Self.serviceType, domain: nil), using: params)

        browser?.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                switch state {
                case .ready:
                    Self.logger.info("Bonjour browser ready")
                case .failed(let error):
                    Self.logger.error("Bonjour browser failed: \(error.localizedDescription)")
                    self?.browser = nil
                default:
                    break
                }
            }
        }

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in
                self?.handleBrowseResults(results)
            }
        }

        browser?.start(queue: .main)
    }

    public func stopBrowsing() {
        browser?.cancel()
        browser = nil
    }

    // MARK: - Active Scan

    public func startActiveScan(duration: TimeInterval = 3.0) {
        isScanning = true
        scanProgress = 0
        discoveredGateways = []

        stopBrowsing()
        startPassiveBrowsing()

        let startTime = Date()
        scanTimer?.invalidate()
        scanTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] timer in
            Task { @MainActor [weak self] in
                guard let self else { timer.invalidate(); return }
                let elapsed = Date().timeIntervalSince(startTime)
                self.scanProgress = min(elapsed / duration, 1.0)
                if elapsed >= duration {
                    timer.invalidate()
                    self.isScanning = false
                }
            }
        }
    }

    // MARK: - Merge Logic

    public static func merge(paired: [BotNode], discovered: [DiscoveredGateway]) -> [BotNode] {
        var result = paired
        for gateway in discovered {
            for i in result.indices where result[i].gatewayFingerprint == gateway.fingerprint {
                result[i].gatewayHost = gateway.host
                result[i].gatewayPort = gateway.port
                result[i].lastSeen = Date()
            }
        }
        return result
    }

    public static func deduplicate(_ nodes: [BotNode]) -> [BotNode] {
        var seen: [String: BotNode] = [:]
        for node in nodes {
            if let existing = seen[node.id] {
                seen[node.id] = node.lastSeen > existing.lastSeen ? node : existing
            } else {
                seen[node.id] = node
            }
        }
        return Array(seen.values)
    }

    // MARK: - Private

    private func handleBrowseResults(_ results: Set<NWBrowser.Result>) {
        var gateways: [DiscoveredGateway] = []
        for result in results {
            if case .service(let name, _, _, _) = result.endpoint {
                let txt = parseTXTRecords(result.metadata)
                let gateway = DiscoveredGateway(
                    fingerprint: txt["fp"] ?? name,
                    name: txt["name"] ?? name,
                    host: name,
                    port: Int(txt["port"] ?? "3000") ?? 3000,
                    botCount: Int(txt["bots"] ?? "0") ?? 0,
                    protocolVersion: Int(txt["ver"] ?? "3") ?? 3
                )
                gateways.append(gateway)
            }
        }
        discoveredGateways = gateways
        Self.logger.info("Discovered \(gateways.count) gateways via Bonjour")
    }

    private func parseTXTRecords(_ metadata: NWBrowser.Result.Metadata?) -> [String: String] {
        guard case .bonjour(let txtRecord) = metadata else { return [:] }
        var dict: [String: String] = [:]
        // NWTXTRecord provides getEntry(for:) which returns .string, .opaque, or .none
        let knownKeys = ["fp", "name", "port", "bots", "ver"]
        for key in knownKeys {
            switch txtRecord.getEntry(for: key) {
            case .string(let value):
                dict[key] = value
            default:
                break
            }
        }
        return dict
    }
}
