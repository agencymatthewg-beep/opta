//
//  MemoryService.swift
//  OptaNative
//
//  Memory management service for monitoring and purging memory.
//  Provides memory usage stats and cleanup capabilities.
//
//  Created for Opta Native macOS - MCP Quick Win 4
//

import Foundation

// MARK: - Memory Stats

struct MemoryStats: Sendable {
    let totalBytes: UInt64
    let usedBytes: UInt64
    let freeBytes: UInt64
    let activeBytes: UInt64
    let wiredBytes: UInt64
    let compressedBytes: UInt64
    let cachedBytes: UInt64
    let timestamp: Date

    var usagePercent: Double {
        guard totalBytes > 0 else { return 0 }
        return Double(usedBytes) / Double(totalBytes) * 100
    }

    var totalGB: Double { Double(totalBytes) / (1024 * 1024 * 1024) }
    var usedGB: Double { Double(usedBytes) / (1024 * 1024 * 1024) }
    var freeGB: Double { Double(freeBytes) / (1024 * 1024 * 1024) }

    /// Memory pressure level
    var pressureLevel: MemoryPressureLevel {
        if usagePercent >= 90 { return .critical }
        if usagePercent >= 75 { return .warning }
        return .normal
    }
}

enum MemoryPressureLevel: String, Sendable {
    case normal = "Normal"
    case warning = "Warning"
    case critical = "Critical"
}

// MARK: - Purge Result

struct MemoryPurgeResult: Sendable {
    let success: Bool
    let beforeBytes: UInt64
    let afterBytes: UInt64
    let freedBytes: UInt64
    let freedMB: Int
    let message: String
}

// MARK: - Memory Service

actor MemoryService {

    // MARK: - Memory Stats

    /// Get current memory statistics
    func getMemoryStats() -> MemoryStats {
        // Get total physical memory
        var totalMemory: UInt64 = 0
        var size = MemoryLayout<UInt64>.size
        sysctlbyname("hw.memsize", &totalMemory, &size, nil, 0)

        // Get VM statistics
        var vmStats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)

        let result = withUnsafeMutablePointer(to: &vmStats) { ptr in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { statsPtr in
                host_statistics64(mach_host_self(), HOST_VM_INFO64, statsPtr, &count)
            }
        }

        guard result == KERN_SUCCESS else {
            return MemoryStats(
                totalBytes: totalMemory,
                usedBytes: 0,
                freeBytes: totalMemory,
                activeBytes: 0,
                wiredBytes: 0,
                compressedBytes: 0,
                cachedBytes: 0,
                timestamp: Date()
            )
        }

        let pageSize = UInt64(vm_kernel_page_size)

        let active = UInt64(vmStats.active_count) * pageSize
        let wired = UInt64(vmStats.wire_count) * pageSize
        let compressed = UInt64(vmStats.compressor_page_count) * pageSize
        let cached = UInt64(vmStats.external_page_count) * pageSize
        let free = UInt64(vmStats.free_count) * pageSize
        let inactive = UInt64(vmStats.inactive_count) * pageSize
        let speculative = UInt64(vmStats.speculative_count) * pageSize

        // Used = Active + Wired + Compressed
        let used = active + wired + compressed

        // Free includes inactive, speculative, and actual free
        let actualFree = free + inactive + speculative

        return MemoryStats(
            totalBytes: totalMemory,
            usedBytes: used,
            freeBytes: actualFree,
            activeBytes: active,
            wiredBytes: wired,
            compressedBytes: compressed,
            cachedBytes: cached,
            timestamp: Date()
        )
    }

    // MARK: - Memory Purge

    /// Purge inactive memory to free up space
    /// Note: The `purge` command may require sudo on some systems
    func purgeMemory(aggressive: Bool = false) async -> MemoryPurgeResult {
        let beforeStats = getMemoryStats()

        // Use memory_pressure tool which doesn't require sudo
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/memory_pressure")

        if aggressive {
            task.arguments = ["-l", "critical"]
        } else {
            task.arguments = ["-l", "warn"]
        }

        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            // Wait briefly for memory to settle
            try await Task.sleep(nanoseconds: 500_000_000)

            let afterStats = getMemoryStats()
            let freedBytes = beforeStats.usedBytes > afterStats.usedBytes
                ? beforeStats.usedBytes - afterStats.usedBytes
                : 0

            return MemoryPurgeResult(
                success: true,
                beforeBytes: beforeStats.usedBytes,
                afterBytes: afterStats.usedBytes,
                freedBytes: freedBytes,
                freedMB: Int(freedBytes / (1024 * 1024)),
                message: freedBytes > 0
                    ? "Freed \(freedBytes / (1024 * 1024)) MB of memory"
                    : "Memory purge complete (no significant change)"
            )
        } catch {
            // Log the error before falling back
            print("[MemoryService] Primary purge failed: \(error.localizedDescription), trying fallback")
            return await fallbackPurge(beforeBytes: beforeStats.usedBytes)
        }
    }

    /// Fallback purge using vm_pageout
    private func fallbackPurge(beforeBytes: UInt64) async -> MemoryPurgeResult {
        // Try to force memory compression by touching swap
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/purge")
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            try await Task.sleep(nanoseconds: 500_000_000)

            let afterStats = getMemoryStats()
            let freedBytes = beforeBytes > afterStats.usedBytes
                ? beforeBytes - afterStats.usedBytes
                : 0

            return MemoryPurgeResult(
                success: true,
                beforeBytes: beforeBytes,
                afterBytes: afterStats.usedBytes,
                freedBytes: freedBytes,
                freedMB: Int(freedBytes / (1024 * 1024)),
                message: "Memory purge complete"
            )
        } catch {
            return MemoryPurgeResult(
                success: false,
                beforeBytes: beforeBytes,
                afterBytes: beforeBytes,
                freedBytes: 0,
                freedMB: 0,
                message: "Memory purge failed: \(error.localizedDescription)"
            )
        }
    }

    // MARK: - Memory Warnings

    /// Check if memory pressure is high
    func isMemoryPressureHigh() -> Bool {
        let stats = getMemoryStats()
        return stats.pressureLevel != .normal
    }

    /// Get recommendation based on current memory state
    func getMemoryRecommendation() -> String? {
        let stats = getMemoryStats()

        switch stats.pressureLevel {
        case .critical:
            return "Critical memory pressure (\(String(format: "%.1f", stats.usagePercent))% used). Close unused apps or purge memory."
        case .warning:
            return "Memory usage is high (\(String(format: "%.1f", stats.usagePercent))%). Consider closing unused apps."
        case .normal:
            return nil
        }
    }
}
