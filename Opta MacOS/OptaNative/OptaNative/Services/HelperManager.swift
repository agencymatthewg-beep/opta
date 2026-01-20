// HelperManager.swift
// Service for installing and communicating with privileged helper
// Created for Opta Native macOS - Plan 19-04

import Foundation
import ServiceManagement

/// Manages the privileged helper tool installation and XPC communication.
/// Uses SMJobBless pattern for privilege escalation with user authorization.
@Observable
class HelperManager {

    // MARK: - Constants

    /// The helper tool's bundle identifier
    private let helperID = "com.opta.native.helper"

    // MARK: - Properties

    /// Current connection to the helper tool
    private var connection: NSXPCConnection?

    /// Whether the helper is currently installed and running
    var isHelperInstalled: Bool = false

    /// Last error message if operation failed
    var lastError: String?

    // MARK: - Initialization

    init() {
        // Check if helper is already installed on init
        checkHelperStatus()
    }

    // MARK: - Installation

    /// Installs the privileged helper tool using SMJobBless.
    /// This will prompt the user for admin credentials.
    func installHelper() async throws {
        // Reset error state
        lastError = nil

        do {
            // Register the helper with launchd
            let service = SMAppService.daemon(plistName: "\(helperID).plist")
            try await service.register()

            // Update installed status
            await MainActor.run {
                self.isHelperInstalled = true
            }
        } catch {
            await MainActor.run {
                self.lastError = "Failed to install helper: \(error.localizedDescription)"
                self.isHelperInstalled = false
            }
            throw error
        }
    }

    /// Checks if the helper is already installed via launchd.
    func checkHelperStatus() {
        let service = SMAppService.daemon(plistName: "\(helperID).plist")
        isHelperInstalled = (service.status == .enabled)
    }

    /// Uninstalls the helper tool.
    func uninstallHelper() async throws {
        let service = SMAppService.daemon(plistName: "\(helperID).plist")
        try await service.unregister()
        await MainActor.run {
            self.isHelperInstalled = false
        }
    }

    // MARK: - XPC Communication

    /// Gets a remote proxy to the helper tool.
    private func getHelperProxy() throws -> HelperProtocol {
        // Create new connection if needed
        if connection == nil {
            connection = NSXPCConnection(machServiceName: kHelperToolMachServiceName,
                                         options: .privileged)
            connection?.remoteObjectInterface = NSXPCInterface(with: HelperProtocol.self)
            connection?.invalidationHandler = { [weak self] in
                self?.connection = nil
            }
            connection?.resume()
        }

        guard let proxy = connection?.remoteObjectProxyWithErrorHandler({ error in
            print("XPC error: \(error.localizedDescription)")
        }) as? HelperProtocol else {
            throw HelperError.connectionFailed
        }

        return proxy
    }

    // MARK: - Helper Operations

    /// Terminates a process using the privileged helper.
    /// - Parameter pid: The process ID to terminate
    /// - Returns: Tuple of (success, errorMessage)
    func terminateProcess(pid: Int32) async -> (success: Bool, error: String?) {
        do {
            let proxy = try getHelperProxy()

            return await withCheckedContinuation { continuation in
                proxy.terminateProcess(pid: pid) { success, errorMessage in
                    continuation.resume(returning: (success, errorMessage))
                }
            }
        } catch {
            return (false, error.localizedDescription)
        }
    }

    /// Sets the priority of a process using the privileged helper.
    /// - Parameters:
    ///   - pid: The process ID to modify
    ///   - priority: Nice value (-20 to 19, lower = higher priority)
    /// - Returns: Whether the operation succeeded
    func setProcessPriority(pid: Int32, priority: Int32) async -> Bool {
        do {
            let proxy = try getHelperProxy()

            return await withCheckedContinuation { continuation in
                proxy.setProcessPriority(pid: pid, priority: priority) { success in
                    continuation.resume(returning: success)
                }
            }
        } catch {
            return false
        }
    }

    /// Gets the helper tool version for compatibility checking.
    /// - Returns: The version string, or nil if communication failed
    func getHelperVersion() async -> String? {
        do {
            let proxy = try getHelperProxy()

            return await withCheckedContinuation { continuation in
                proxy.getVersion { version in
                    continuation.resume(returning: version)
                }
            }
        } catch {
            return nil
        }
    }

    // MARK: - Cleanup

    /// Disconnects from the helper tool.
    func disconnect() {
        connection?.invalidate()
        connection = nil
    }
}

// MARK: - Errors

enum HelperError: LocalizedError {
    case connectionFailed
    case installationFailed(String)
    case operationFailed(String)

    var errorDescription: String? {
        switch self {
        case .connectionFailed:
            return "Failed to connect to helper tool"
        case .installationFailed(let message):
            return "Helper installation failed: \(message)"
        case .operationFailed(let message):
            return "Helper operation failed: \(message)"
        }
    }
}
