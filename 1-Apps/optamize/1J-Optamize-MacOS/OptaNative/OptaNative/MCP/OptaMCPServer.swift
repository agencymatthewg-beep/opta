//
//  OptaMCPServer.swift
//  OptaNative
//
//  Model Context Protocol server exposing Opta optimization capabilities.
//  Enables AI assistants to control system optimizations via natural language.
//
//  Created for Opta Native macOS - MCP Quick Wins
//

import Foundation

// MARK: - Opta MCP Server

actor OptaMCPServer {

    // MARK: - Services

    private let defaultsOptimizer = DefaultsOptimizerService()
    private let thermalService = ThermalPredictionService()
    private let powerService = PowerService()

    // MARK: - Tool Definitions

    static let tools: [MCPTool] = [
        // Tool 1: Apply Optimization
        MCPTool(
            name: "opta_apply_optimization",
            description: "Apply macOS system optimizations. Categories: dock, finder, screenshots, animations, keyboard. Use 'all' to apply all optimizations in a category, or specify individual optimization IDs.",
            inputSchema: MCPInputSchema(
                type: "object",
                properties: [
                    "category": MCPProperty(
                        type: "string",
                        description: "Optimization category",
                        enum: ["dock", "finder", "screenshots", "animations", "keyboard"]
                    ),
                    "action": MCPProperty(
                        type: "string",
                        description: "Action to perform",
                        enum: ["apply", "revert", "status"]
                    ),
                    "optimization_id": MCPProperty(
                        type: "string",
                        description: "Specific optimization ID (optional, applies all in category if omitted)",
                        enum: nil
                    )
                ],
                required: ["category", "action"]
            )
        ),

        // Tool 2: Process Priority
        MCPTool(
            name: "opta_set_process_priority",
            description: "Adjust process priority (NICE level). Lower values = higher priority. Range: -20 (highest) to 20 (lowest). Requires process name or PID.",
            inputSchema: MCPInputSchema(
                type: "object",
                properties: [
                    "process": MCPProperty(
                        type: "string",
                        description: "Process name (e.g., 'Steam', 'Finder') or PID",
                        enum: nil
                    ),
                    "priority": MCPProperty(
                        type: "string",
                        description: "Priority level",
                        enum: ["highest", "high", "normal", "low", "lowest"]
                    )
                ],
                required: ["process", "priority"]
            )
        ),

        // Tool 3: Memory Purge
        MCPTool(
            name: "opta_purge_memory",
            description: "Free up system memory by purging inactive memory and caches. Returns amount of memory freed.",
            inputSchema: MCPInputSchema(
                type: "object",
                properties: [
                    "mode": MCPProperty(
                        type: "string",
                        description: "Purge mode",
                        enum: ["gentle", "aggressive"]
                    )
                ],
                required: nil
            )
        ),

        // Tool 4: Power Profile
        MCPTool(
            name: "opta_set_power_profile",
            description: "Switch system power profile. Gaming mode prevents sleep and enables performance optimizations. Battery Health mode is conservative on thermals.",
            inputSchema: MCPInputSchema(
                type: "object",
                properties: [
                    "profile": MCPProperty(
                        type: "string",
                        description: "Power profile to activate",
                        enum: ["balanced", "high_performance", "power_saver", "gaming", "battery_health"]
                    )
                ],
                required: ["profile"]
            )
        ),

        // Tool 5: Thermal Status (also a resource)
        MCPTool(
            name: "opta_get_thermal_status",
            description: "Get current thermal status including CPU temperature, thermal state, time-to-throttle prediction, and recommendations.",
            inputSchema: MCPInputSchema(
                type: "object",
                properties: [:],
                required: nil
            )
        )
    ]

    // MARK: - Resource Definitions

    static let resources: [MCPResource] = [
        MCPResource(
            uri: "opta://thermal/status",
            name: "Thermal Status",
            description: "Real-time thermal telemetry including temperature, state, and throttle prediction",
            mimeType: "application/json"
        ),
        MCPResource(
            uri: "opta://power/profile",
            name: "Power Profile",
            description: "Current power profile and High Power Mode status",
            mimeType: "application/json"
        ),
        MCPResource(
            uri: "opta://optimizations/status",
            name: "Optimizations Status",
            description: "Status of all macOS optimizations by category",
            mimeType: "application/json"
        )
    ]

    // MARK: - Handle Request

    func handleRequest(_ request: MCPRequest) async -> MCPResponse {
        switch request.method {
        case "initialize":
            return initializeResponse(id: request.id)

        case "tools/list":
            return toolsListResponse(id: request.id)

        case "resources/list":
            return resourcesListResponse(id: request.id)

        case "tools/call":
            return await handleToolCall(request)

        case "resources/read":
            return await handleResourceRead(request)

        default:
            return MCPResponse(
                jsonrpc: "2.0",
                id: request.id,
                result: nil,
                error: MCPError(code: -32601, message: "Method not found", data: nil)
            )
        }
    }

    // MARK: - Protocol Responses

    private func initializeResponse(id: Int?) -> MCPResponse {
        return MCPResponse(
            jsonrpc: "2.0",
            id: id,
            result: AnyCodable([
                "protocolVersion": "2024-11-05",
                "capabilities": [
                    "tools": ["listChanged": false],
                    "resources": ["subscribe": false, "listChanged": false]
                ],
                "serverInfo": [
                    "name": "Opta Optimization Server",
                    "version": "1.0.0"
                ]
            ]),
            error: nil
        )
    }

    private func toolsListResponse(id: Int?) -> MCPResponse {
        let toolsData = Self.tools.map { tool -> [String: Any] in
            [
                "name": tool.name,
                "description": tool.description,
                "inputSchema": [
                    "type": tool.inputSchema.type,
                    "properties": tool.inputSchema.properties.mapValues { prop -> [String: Any] in
                        var dict: [String: Any] = [
                            "type": prop.type,
                            "description": prop.description
                        ]
                        if let enumValues = prop.enum {
                            dict["enum"] = enumValues
                        }
                        return dict
                    },
                    "required": tool.inputSchema.required ?? []
                ] as [String: Any]
            ]
        }

        return MCPResponse(
            jsonrpc: "2.0",
            id: id,
            result: AnyCodable(["tools": toolsData]),
            error: nil
        )
    }

    private func resourcesListResponse(id: Int?) -> MCPResponse {
        let resourcesData = Self.resources.map { resource -> [String: Any] in
            [
                "uri": resource.uri,
                "name": resource.name,
                "description": resource.description,
                "mimeType": resource.mimeType
            ]
        }

        return MCPResponse(
            jsonrpc: "2.0",
            id: id,
            result: AnyCodable(["resources": resourcesData]),
            error: nil
        )
    }

    // MARK: - Tool Handlers

    private func handleToolCall(_ request: MCPRequest) async -> MCPResponse {
        guard let params = request.params,
              let toolName = params["name"]?.value as? String,
              let arguments = params["arguments"]?.value as? [String: Any] else {
            return MCPResponse(
                jsonrpc: "2.0",
                id: request.id,
                result: nil,
                error: MCPError(code: -32602, message: "Invalid params", data: nil)
            )
        }

        let result: [String: Any]

        switch toolName {
        case "opta_apply_optimization":
            result = await handleApplyOptimization(arguments)

        case "opta_set_process_priority":
            result = await handleSetProcessPriority(arguments)

        case "opta_purge_memory":
            result = await handlePurgeMemory(arguments)

        case "opta_set_power_profile":
            result = await handleSetPowerProfile(arguments)

        case "opta_get_thermal_status":
            result = await handleGetThermalStatus()

        default:
            return MCPResponse(
                jsonrpc: "2.0",
                id: request.id,
                result: nil,
                error: MCPError(code: -32602, message: "Unknown tool: \(toolName)", data: nil)
            )
        }

        return MCPResponse(
            jsonrpc: "2.0",
            id: request.id,
            result: AnyCodable(["content": [["type": "text", "text": formatResult(result)]]]),
            error: nil
        )
    }

    // MARK: - Resource Handlers

    private func handleResourceRead(_ request: MCPRequest) async -> MCPResponse {
        guard let params = request.params,
              let uri = params["uri"]?.value as? String else {
            return MCPResponse(
                jsonrpc: "2.0",
                id: request.id,
                result: nil,
                error: MCPError(code: -32602, message: "Invalid params", data: nil)
            )
        }

        let content: [String: Any]

        switch uri {
        case "opta://thermal/status":
            content = await handleGetThermalStatus()

        case "opta://power/profile":
            content = await handleGetPowerProfile()

        case "opta://optimizations/status":
            content = await handleGetOptimizationsStatus()

        default:
            return MCPResponse(
                jsonrpc: "2.0",
                id: request.id,
                result: nil,
                error: MCPError(code: -32602, message: "Unknown resource: \(uri)", data: nil)
            )
        }

        return MCPResponse(
            jsonrpc: "2.0",
            id: request.id,
            result: AnyCodable([
                "contents": [[
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": formatResult(content)
                ]]
            ]),
            error: nil
        )
    }

    // MARK: - Tool Implementations

    private func handleApplyOptimization(_ args: [String: Any]) async -> [String: Any] {
        guard let categoryStr = args["category"] as? String,
              let action = args["action"] as? String else {
            return ["success": false, "error": "Missing category or action"]
        }

        let category: OptimizationCategory
        switch categoryStr.lowercased() {
        case "dock": category = .dock
        case "finder": category = .finder
        case "screenshots": category = .screenshots
        case "animations": category = .animations
        case "keyboard": category = .keyboard
        default:
            return ["success": false, "error": "Unknown category: \(categoryStr)"]
        }

        do {
            switch action {
            case "apply":
                try await defaultsOptimizer.applyCategory(category)
                return [
                    "success": true,
                    "message": "Applied all \(category.rawValue) optimizations",
                    "category": category.rawValue
                ]

            case "revert":
                try await defaultsOptimizer.revertCategory(category)
                return [
                    "success": true,
                    "message": "Reverted all \(category.rawValue) optimizations",
                    "category": category.rawValue
                ]

            case "status":
                let states = await defaultsOptimizer.getOptimizationsByCategory()
                if let categoryStates = states[category] {
                    let applied = categoryStates.filter { $0.isApplied }.count
                    let total = categoryStates.count
                    return [
                        "success": true,
                        "category": category.rawValue,
                        "applied": applied,
                        "total": total,
                        "percentage": total > 0 ? Double(applied) / Double(total) * 100 : 0
                    ]
                }
                return ["success": false, "error": "No optimizations found"]

            default:
                return ["success": false, "error": "Unknown action: \(action)"]
            }
        } catch {
            return ["success": false, "error": error.localizedDescription]
        }
    }

    private func handleSetProcessPriority(_ args: [String: Any]) async -> [String: Any] {
        guard let process = args["process"] as? String,
              let priorityStr = args["priority"] as? String else {
            return ["success": false, "error": "Missing process or priority"]
        }

        let niceValue: Int32
        switch priorityStr {
        case "highest": niceValue = -20
        case "high": niceValue = -10
        case "normal": niceValue = 0
        case "low": niceValue = 10
        case "lowest": niceValue = 20
        default:
            return ["success": false, "error": "Unknown priority: \(priorityStr)"]
        }

        // Find PID by process name
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        task.arguments = ["-x", process]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  let pid = Int32(output.components(separatedBy: "\n").first ?? "") else {
                return ["success": false, "error": "Process not found: \(process)"]
            }

            // Set priority using renice
            let reniceTask = Process()
            reniceTask.executableURL = URL(fileURLWithPath: "/usr/bin/renice")
            reniceTask.arguments = [String(niceValue), "-p", String(pid)]
            reniceTask.standardError = FileHandle.nullDevice

            try reniceTask.run()
            reniceTask.waitUntilExit()

            if reniceTask.terminationStatus == 0 {
                return [
                    "success": true,
                    "message": "Set \(process) (PID \(pid)) priority to \(priorityStr)",
                    "process": process,
                    "pid": Int(pid),
                    "nice_value": Int(niceValue)
                ]
            } else {
                return ["success": false, "error": "Failed to set priority (may require sudo)"]
            }
        } catch {
            return ["success": false, "error": error.localizedDescription]
        }
    }

    private func handlePurgeMemory(_ args: [String: Any]) async -> [String: Any] {
        let mode = (args["mode"] as? String) ?? "gentle"

        // Get memory before
        let beforeUsed = getMemoryUsed()

        // Run purge command
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/purge")
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            // Brief delay for memory to settle
            try await Task.sleep(nanoseconds: 500_000_000)

            // Get memory after
            let afterUsed = getMemoryUsed()
            let freedMB = max(0, (beforeUsed - afterUsed)) / (1024 * 1024)

            return [
                "success": true,
                "message": "Memory purge complete",
                "mode": mode,
                "memory_freed_mb": Int(freedMB),
                "before_used_mb": Int(beforeUsed / (1024 * 1024)),
                "after_used_mb": Int(afterUsed / (1024 * 1024))
            ]
        } catch {
            return ["success": false, "error": "Purge failed (may require sudo): \(error.localizedDescription)"]
        }
    }

    private func handleSetPowerProfile(_ args: [String: Any]) async -> [String: Any] {
        guard let profileStr = args["profile"] as? String else {
            return ["success": false, "error": "Missing profile"]
        }

        let profile: PowerProfile
        switch profileStr {
        case "balanced": profile = .balanced
        case "high_performance": profile = .highPerformance
        case "power_saver": profile = .powerSaver
        case "gaming": profile = .gaming
        case "battery_health": profile = .batteryHealth
        default:
            return ["success": false, "error": "Unknown profile: \(profileStr)"]
        }

        await powerService.setProfile(profile)

        let highPowerStatus = await powerService.getHighPowerModeStatus()

        var result: [String: Any] = [
            "success": true,
            "message": "Switched to \(profile.rawValue) profile",
            "profile": profile.rawValue,
            "description": profile.description
        ]

        if let rec = highPowerStatus.recommendation {
            result["recommendation"] = rec
        }

        return result
    }

    private func handleGetThermalStatus() async -> [String: Any] {
        guard let prediction = await thermalService.getLastPrediction() else {
            // No prediction yet, return basic info
            return [
                "status": "initializing",
                "message": "Thermal monitoring is starting up"
            ]
        }

        var result: [String: Any] = [
            "temperature_celsius": prediction.currentTemperature,
            "state": prediction.state.rawValue,
            "trend_celsius_per_minute": prediction.temperatureTrend,
            "form_factor": prediction.formFactor.rawValue,
            "has_passive_cooling": prediction.formFactor.hasPassiveCooling,
            "throttle_temperature": prediction.formFactor.throttleTemperature
        ]

        if let seconds = prediction.secondsToThrottle {
            result["seconds_to_throttle"] = seconds
            result["throttle_imminent"] = prediction.throttleImminent
        }

        if let rec = prediction.recommendation {
            result["recommendation"] = rec
        }

        return result
    }

    private func handleGetPowerProfile() async -> [String: Any] {
        let profile = await powerService.getActiveProfile()
        let highPowerStatus = await powerService.getHighPowerModeStatus()

        var result: [String: Any] = [
            "current_profile": profile.rawValue,
            "description": profile.description,
            "high_power_mode_supported": highPowerStatus.isSupported
        ]

        if let enabled = highPowerStatus.isEnabled {
            result["high_power_mode_enabled"] = enabled
        }

        if let rec = highPowerStatus.recommendation {
            result["recommendation"] = rec
        }

        return result
    }

    private func handleGetOptimizationsStatus() async -> [String: Any] {
        let states = await defaultsOptimizer.getOptimizationsByCategory()

        var categories: [[String: Any]] = []
        var totalApplied = 0
        var totalCount = 0

        for category in OptimizationCategory.allCases {
            if let categoryStates = states[category] {
                let applied = categoryStates.filter { $0.isApplied }.count
                let count = categoryStates.count
                totalApplied += applied
                totalCount += count

                categories.append([
                    "category": category.rawValue,
                    "applied": applied,
                    "total": count,
                    "fully_applied": applied == count
                ])
            }
        }

        return [
            "total_applied": totalApplied,
            "total_available": totalCount,
            "percentage": totalCount > 0 ? Double(totalApplied) / Double(totalCount) * 100 : 0,
            "categories": categories
        ]
    }

    // MARK: - Helpers

    private func getMemoryUsed() -> UInt64 {
        var vmStats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)

        let result = withUnsafeMutablePointer(to: &vmStats) { ptr in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { statsPtr in
                host_statistics64(mach_host_self(), HOST_VM_INFO64, statsPtr, &count)
            }
        }

        guard result == KERN_SUCCESS else { return 0 }

        let pageSize = UInt64(vm_kernel_page_size)
        let active = UInt64(vmStats.active_count) * pageSize
        let wired = UInt64(vmStats.wire_count) * pageSize
        let compressed = UInt64(vmStats.compressor_page_count) * pageSize

        return active + wired + compressed
    }

    private func formatResult(_ result: [String: Any]) -> String {
        if let data = try? JSONSerialization.data(withJSONObject: result, options: .prettyPrinted),
           let string = String(data: data, encoding: .utf8) {
            return string
        }
        return String(describing: result)
    }
}
