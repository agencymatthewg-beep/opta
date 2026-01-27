//
//  MCPBonjourService.swift
//  OptaNative
//
//  Bonjour/mDNS service advertisement for MCP auto-discovery.
//  AI assistants can discover Opta's MCP server on the local network.
//
//  Created for Opta Native macOS - Quick Win 3
//

import Foundation

// MARK: - Bonjour Service Configuration

struct MCPBonjourConfiguration: Sendable {
    /// Service type for MCP servers
    static let serviceType = "_mcp._tcp."

    /// Domain for local network
    static let domain = "local."

    /// Service name
    let name: String

    /// HTTP port
    let httpPort: Int

    /// WebSocket port
    let wsPort: Int

    /// Additional TXT record data
    var txtRecords: [String: String]

    init(
        name: String = "Opta MCP Server",
        httpPort: Int = 9876,
        wsPort: Int = 9877
    ) {
        self.name = name
        self.httpPort = httpPort
        self.wsPort = wsPort
        self.txtRecords = [
            "version": "1.0.0",
            "protocol": "mcp-2024-11-05",
            "wsPort": String(wsPort),
            "capabilities": "tools,resources,notifications"
        ]
    }

    /// Convert string records to Data records for NetService
    func txtRecordData() -> [String: Data] {
        var dataRecords: [String: Data] = [:]
        for (key, value) in txtRecords {
            if let data = value.data(using: .utf8) {
                dataRecords[key] = data
            }
        }
        return dataRecords
    }
}

// MARK: - Bonjour Service

@MainActor
final class MCPBonjourService: NSObject, NetServiceDelegate {

    // MARK: - Properties

    private var netService: NetService?
    private var configuration: MCPBonjourConfiguration
    private var isPublishing = false

    // MARK: - Initialization

    init(configuration: MCPBonjourConfiguration = MCPBonjourConfiguration()) {
        self.configuration = configuration
        super.init()
    }

    // MARK: - Publishing

    /// Start advertising the MCP server via Bonjour
    func startAdvertising() {
        guard !isPublishing else {
            print("MCPBonjour: Already publishing")
            return
        }

        // Create and configure NetService
        let service = NetService(
            domain: MCPBonjourConfiguration.domain,
            type: MCPBonjourConfiguration.serviceType,
            name: configuration.name,
            port: Int32(configuration.httpPort)
        )

        // Set TXT record with service metadata
        let txtData = NetService.data(fromTXTRecord: configuration.txtRecordData())
        service.setTXTRecord(txtData)

        // Set delegate and publish
        service.delegate = self
        service.publish(options: [.listenForConnections])

        netService = service
        isPublishing = true

        print("MCPBonjour: Started advertising '\(configuration.name)' on port \(configuration.httpPort)")
        print("MCPBonjour: TXT records: \(configuration.txtRecords)")
    }

    /// Stop advertising
    func stopAdvertising() {
        guard isPublishing else { return }

        netService?.stop()
        netService = nil
        isPublishing = false

        print("MCPBonjour: Stopped advertising")
    }

    /// Update TXT records while publishing
    func updateTXTRecords(_ records: [String: String]) {
        for (key, value) in records {
            configuration.txtRecords[key] = value
        }

        if isPublishing, let service = netService {
            let txtData = NetService.data(fromTXTRecord: configuration.txtRecordData())
            service.setTXTRecord(txtData)
            print("MCPBonjour: Updated TXT records")
        }
    }

    /// Get current publishing status
    func isCurrentlyPublishing() -> Bool {
        return isPublishing
    }

    // MARK: - NetServiceDelegate

    func netServiceWillPublish(_ sender: NetService) {
        print("MCPBonjour: Will publish service '\(sender.name)'")
    }

    func netServiceDidPublish(_ sender: NetService) {
        print("MCPBonjour: Published service '\(sender.name)' successfully")
        print("MCPBonjour: Service available at \(sender.name).\(MCPBonjourConfiguration.serviceType)\(MCPBonjourConfiguration.domain)")
    }

    func netService(_ sender: NetService, didNotPublish errorDict: [String : NSNumber]) {
        print("MCPBonjour: Failed to publish service: \(errorDict)")
    }

    func netServiceDidStop(_ sender: NetService) {
        print("MCPBonjour: Service '\(sender.name)' stopped")
    }
}

// MARK: - Service Browser (for discovering other MCP servers)

@MainActor
final class MCPServiceBrowser: NSObject, NetServiceBrowserDelegate {

    // MARK: - Properties

    private var browser: NetServiceBrowser?
    private var discoveredServices: [String: DiscoveredMCPService] = [:]
    private var isSearching = false

    // MARK: - Callbacks

    var onServiceFound: ((DiscoveredMCPService) -> Void)?
    var onServiceLost: ((String) -> Void)?

    // MARK: - Discovered Service

    struct DiscoveredMCPService: Sendable {
        let name: String
        let host: String
        let port: Int
        let wsPort: Int?
        let version: String?
        let capabilities: [String]
    }

    // MARK: - Browsing

    /// Start searching for MCP servers on the network
    func startSearching() {
        guard !isSearching else { return }

        let newBrowser = NetServiceBrowser()
        newBrowser.delegate = self
        newBrowser.searchForServices(
            ofType: MCPBonjourConfiguration.serviceType,
            inDomain: MCPBonjourConfiguration.domain
        )

        browser = newBrowser
        isSearching = true

        print("MCPBonjour: Started searching for MCP servers")
    }

    /// Stop searching
    func stopSearching() {
        guard isSearching else { return }

        browser?.stop()
        browser = nil
        isSearching = false

        print("MCPBonjour: Stopped searching")
    }

    /// Get all discovered services
    func getDiscoveredServices() -> [DiscoveredMCPService] {
        return Array(discoveredServices.values)
    }

    // MARK: - NetServiceBrowserDelegate

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        handleServiceFound(service)
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
        handleServiceLost(service.name)
    }

    func netServiceBrowserWillSearch(_ browser: NetServiceBrowser) {
        print("MCPBonjour: Browser will search")
    }

    func netServiceBrowserDidStopSearch(_ browser: NetServiceBrowser) {
        print("MCPBonjour: Browser stopped searching")
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String : NSNumber]) {
        print("MCPBonjour: Browser failed to search: \(errorDict)")
    }

    // MARK: - Private

    private func handleServiceFound(_ service: NetService) {
        print("MCPBonjour: Found service '\(service.name)'")

        // Parse TXT records
        var wsPort: Int?
        var version: String?
        var capabilities: [String] = []

        if let txtData = service.txtRecordData() {
            let records = NetService.dictionary(fromTXTRecord: txtData)
            for (key, data) in records {
                if let value = String(data: data, encoding: .utf8) {
                    switch key {
                    case "wsPort":
                        wsPort = Int(value)
                    case "version":
                        version = value
                    case "capabilities":
                        capabilities = value.components(separatedBy: ",")
                    default:
                        break
                    }
                }
            }
        }

        let discovered = DiscoveredMCPService(
            name: service.name,
            host: service.hostName ?? "localhost",
            port: service.port,
            wsPort: wsPort,
            version: version,
            capabilities: capabilities
        )

        discoveredServices[service.name] = discovered
        onServiceFound?(discovered)
    }

    private func handleServiceLost(_ name: String) {
        discoveredServices.removeValue(forKey: name)
        onServiceLost?(name)
        print("MCPBonjour: Lost service '\(name)'")
    }
}
