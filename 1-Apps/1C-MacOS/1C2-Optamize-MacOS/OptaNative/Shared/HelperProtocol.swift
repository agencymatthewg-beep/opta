// HelperProtocol.swift
// Shared protocol between main app and privileged helper
// Created for Opta Native macOS - Plan 19-04

import Foundation

/// Protocol defining the privileged operations available via the helper tool.
/// This protocol is shared between the main app and the helper to ensure type-safe communication.
@objc public protocol HelperProtocol {
    /// Terminates a process with the given PID.
    /// First attempts SIGTERM for graceful termination, then SIGKILL if needed.
    /// - Parameters:
    ///   - pid: The process ID to terminate
    ///   - reply: Callback with success status and optional error message
    func terminateProcess(pid: Int32, reply: @escaping (Bool, String?) -> Void)

    /// Sets the priority (nice value) for a process.
    /// - Parameters:
    ///   - pid: The process ID to modify
    ///   - priority: The nice value (-20 to 19, lower = higher priority)
    ///   - reply: Callback with success status
    func setProcessPriority(pid: Int32, priority: Int32, reply: @escaping (Bool) -> Void)

    /// Returns the helper tool version for compatibility checking.
    /// - Parameter reply: Callback with version string
    func getVersion(reply: @escaping (String) -> Void)
}

/// Helper identifier constant - used for both installation and communication
public let kHelperToolMachServiceName = "com.opta.native.helper"
