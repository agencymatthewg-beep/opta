//
//  NetworkMonitor.swift
//  Opta Scan
//
//  Monitors network connectivity for model download availability
//  Created by Matthew Byrden
//

import Foundation
import Network

@MainActor
@Observable
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    // MARK: - State

    private(set) var isConnected = false
    private(set) var isExpensive = false  // Cellular
    private(set) var connectionType: ConnectionType = .unknown

    // MARK: - Connection Type

    enum ConnectionType {
        case wifi
        case cellular
        case ethernet
        case unknown
    }

    // MARK: - Private

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "opta.networkmonitor")

    // MARK: - Initialization

    private init() {
        startMonitoring()
    }

    // MARK: - Methods

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.updateState(from: path)
            }
        }
        monitor.start(queue: queue)
    }

    private func updateState(from path: NWPath) {
        isConnected = path.status == .satisfied
        isExpensive = path.isExpensive

        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
    }

    func stopMonitoring() {
        monitor.cancel()
    }
}
