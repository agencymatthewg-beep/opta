// HelperTool.swift
// Privileged helper tool for elevated operations
// Created for Opta Native macOS - Plan 19-04

import Foundation

/// Main helper tool class that runs as a privileged launchd daemon.
/// Handles process termination and priority adjustment with root privileges.
class HelperTool: NSObject, NSXPCListenerDelegate, HelperProtocol {

    // MARK: - Properties

    private var listener: NSXPCListener?
    private var connections: [NSXPCConnection] = []
    private var shouldQuit = false

    // MARK: - Version

    static let version = "1.0.0"

    // MARK: - Main Entry Point

    func run() {
        // Create XPC listener with the helper's Mach service name
        listener = NSXPCListener(machServiceName: kHelperToolMachServiceName)
        listener?.delegate = self
        listener?.resume()

        // Keep running until signaled to quit
        while !shouldQuit {
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 1))
        }
    }

    // MARK: - NSXPCListenerDelegate

    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection newConnection: NSXPCConnection) -> Bool {
        // Configure the connection
        newConnection.exportedInterface = NSXPCInterface(with: HelperProtocol.self)
        newConnection.exportedObject = self

        // Handle connection invalidation
        newConnection.invalidationHandler = { [weak self] in
            self?.connections.removeAll { $0 === newConnection }
        }

        // Accept and resume the connection
        connections.append(newConnection)
        newConnection.resume()

        return true
    }

    // MARK: - HelperProtocol Implementation

    func terminateProcess(pid: Int32, reply: @escaping (Bool, String?) -> Void) {
        // First, try graceful termination with SIGTERM
        var result = kill(pid, SIGTERM)

        if result != 0 {
            // If SIGTERM failed, try SIGKILL
            result = kill(pid, SIGKILL)
        }

        if result == 0 {
            reply(true, nil)
        } else {
            let errorMessage = String(cString: strerror(errno))
            reply(false, "Failed to terminate process \(pid): \(errorMessage)")
        }
    }

    func setProcessPriority(pid: Int32, priority: Int32, reply: @escaping (Bool) -> Void) {
        // Clamp priority to valid range (-20 to 19)
        let clampedPriority = max(-20, min(19, priority))

        let result = setpriority(PRIO_PROCESS, UInt32(pid), clampedPriority)
        reply(result == 0)
    }

    func getVersion(reply: @escaping (String) -> Void) {
        reply(HelperTool.version)
    }
}

// MARK: - Main Entry Point

@main
struct HelperMain {
    static func main() {
        let helper = HelperTool()
        helper.run()
    }
}
