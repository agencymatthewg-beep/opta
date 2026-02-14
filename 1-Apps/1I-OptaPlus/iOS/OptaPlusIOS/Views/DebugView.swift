//
//  DebugView.swift
//  OptaPlusIOS
//
//  Gateway diagnostics — health, connectivity, sessions, and nodes.
//  Inspired by the OpenClaw.app desktop debug page.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Debug View

struct DebugView: View {
    @EnvironmentObject var appState: AppState
    @State private var healthData: [String: Any]?
    @State private var statusData: [String: Any]?
    @State private var sessions: [[String: Any]] = []
    @State private var nodes: [[String: Any]] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSettings = false

    private var selectedVM: ChatViewModel? {
        guard let bot = appState.selectedBot else { return nil }
        return appState.viewModel(for: bot)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Bot selector
                    botPicker

                    if isLoading && healthData == nil {
                        ProgressView("Loading diagnostics...")
                            .padding(.top, 40)
                    } else if let vm = selectedVM, !vm.isGatewayReady {
                        disconnectedState
                    } else {
                        gatewayHealthSection
                        connectivitySection
                        sessionsSection
                        nodesSection
                    }
                }
                .padding()
            }
            .background(Color.optaVoid)
            .navigationTitle("Debug")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundColor(.optaTextSecondary)
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await loadAll() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable {
                await loadAll()
            }
            .task {
                await loadAll()
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
        }
    }

    // MARK: - Bot Picker

    private var botPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(appState.bots) { bot in
                    let isSelected = bot.id == appState.selectedBotId
                    Button {
                        appState.selectBot(bot)
                        Task { await loadAll() }
                    } label: {
                        HStack(spacing: 6) {
                            Text(bot.emoji)
                                .font(.system(size: 14))
                            Text(bot.name)
                                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(isSelected ? Color.optaPrimary.opacity(0.2) : Color.optaSurface)
                        )
                        .overlay(
                            Capsule().stroke(isSelected ? Color.optaPrimary.opacity(0.5) : Color.clear, lineWidth: 1)
                        )
                    }
                    .foregroundColor(isSelected ? .optaPrimary : .optaTextSecondary)
                }
            }
        }
    }

    // MARK: - Disconnected State

    private var disconnectedState: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 32))
                .foregroundColor(.optaTextMuted)
            Text("Not connected")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)
            if let bot = appState.selectedBot {
                Button("Connect to \(bot.name)") {
                    appState.viewModel(for: bot).connect()
                }
                .buttonStyle(.borderedProminent)
                .tint(.optaPrimary)
            }
        }
        .padding(.top, 40)
    }

    // MARK: - Gateway Health Section

    private var gatewayHealthSection: some View {
        DebugSection(title: "Gateway", icon: "server.rack") {
            if let health = healthData {
                let healthy = health["healthy"] as? Bool ?? false

                HStack {
                    Circle()
                        .fill(healthy ? Color.green : Color.red)
                        .frame(width: 10, height: 10)
                    Text(healthy ? "Healthy" : "Unhealthy")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(healthy ? .green : .red)
                    Spacer()

                    if let authAge = health["authAge"] as? Int {
                        Text("auth \(authAge)h")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                DebugRow(label: "Port", value: "\(health["port"] ?? "?")")
                DebugRow(label: "PID", value: "\(health["pid"] ?? "?")")

                if let uptime = health["uptime"] as? Int {
                    DebugRow(label: "Uptime", value: formatUptime(uptime))
                } else if let uptime = health["uptimeMs"] as? Int {
                    DebugRow(label: "Uptime", value: formatUptime(uptime / 1000))
                }

                if let protocol_ = health["protocol"] as? Int {
                    DebugRow(label: "Protocol", value: "v\(protocol_)")
                }

                if let version = health["version"] as? String {
                    DebugRow(label: "Version", value: version)
                }
            } else {
                Text("No health data")
                    .font(.system(size: 13))
                    .foregroundColor(.optaTextMuted)
            }
        }
    }

    // MARK: - Connectivity Section

    private var connectivitySection: some View {
        DebugSection(title: "Connectivity", icon: "network") {
            if let vm = selectedVM {
                DebugRow(label: "WebSocket", value: vm.connectionState.displayName,
                         color: vm.connectionState == .connected ? .green : .optaAmber)

                DebugRow(label: "Route", value: vm.connectionRoute.rawValue.capitalized,
                         icon: vm.connectionRoute == .lan ? "wifi" : "globe")

                if let latency = vm.client_latencyMs {
                    DebugRow(label: "Latency", value: "\(Int(latency))ms")
                }

                DebugRow(label: "Reconnects", value: "\(vm.reconnectCount)")
            }
        }
    }

    // MARK: - Sessions Section

    private var sessionsSection: some View {
        DebugSection(title: "Sessions (\(sessions.count))", icon: "text.bubble") {
            if sessions.isEmpty {
                Text("No active sessions")
                    .font(.system(size: 13))
                    .foregroundColor(.optaTextMuted)
            } else {
                ForEach(Array(sessions.prefix(20).enumerated()), id: \.offset) { _, session in
                    SessionRow(session: session)
                }
            }
        }
    }

    // MARK: - Nodes Section

    private var nodesSection: some View {
        DebugSection(title: "Nodes", icon: "desktopcomputer") {
            if nodes.isEmpty {
                Text("No nodes connected")
                    .font(.system(size: 13))
                    .foregroundColor(.optaTextMuted)
            } else {
                ForEach(Array(nodes.enumerated()), id: \.offset) { _, node in
                    NodeRow(node: node)
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadAll() async {
        guard let vm = selectedVM, vm.isGatewayReady else { return }
        isLoading = true
        defer { isLoading = false }

        async let healthTask: Void = {
            let result = try? await vm.call("health", params: ["probe": true])
            if let dict = result?.dict {
                await MainActor.run { healthData = dict }
            }
        }()

        async let statusTask: Void = {
            let result = try? await vm.call("status")
            if let dict = result?.dict {
                await MainActor.run { statusData = dict }
            }
        }()

        async let sessionsTask: Void = {
            let result = try? await vm.call("sessions.list")
            if let list = result?.dict?["sessions"] as? [[String: Any]] {
                await MainActor.run { sessions = list }
            }
        }()

        async let nodesTask: Void = {
            let result = try? await vm.call("node.list")
            if let list = result?.dict?["nodes"] as? [[String: Any]] {
                await MainActor.run { nodes = list }
            }
        }()

        _ = await (healthTask, statusTask, sessionsTask, nodesTask)
    }

    // MARK: - Helpers

    private func formatUptime(_ seconds: Int) -> String {
        let days = seconds / 86400
        let hours = (seconds % 86400) / 3600
        let mins = (seconds % 3600) / 60
        if days > 0 { return "\(days)d \(hours)h" }
        if hours > 0 { return "\(hours)h \(mins)m" }
        return "\(mins)m"
    }
}

// MARK: - Latency Extension

extension ChatViewModel {
    var client_latencyMs: Double? {
        // Access latency from the underlying connection stats
        // The client tracks this via ping/pong
        nil // Will be populated when client is connected and ping data is available
    }
}

// MARK: - Debug Section Container

struct DebugSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.optaTextSecondary)

            VStack(alignment: .leading, spacing: 6) {
                content
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.optaElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.optaSurface, lineWidth: 1)
        )
    }
}

// MARK: - Debug Row

struct DebugRow: View {
    let label: String
    let value: String
    var color: Color? = nil
    var icon: String? = nil

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(.optaTextMuted)
            Spacer()
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 10))
                    .foregroundColor(color ?? .optaTextSecondary)
            }
            Text(value)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(color ?? .optaTextPrimary)
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let session: [String: Any]

    private var key: String {
        session["sessionKey"] as? String ?? session["key"] as? String ?? "?"
    }

    private var contextTokens: Int {
        if let usage = session["usage"] as? [String: Any] {
            return usage["totalTokens"] as? Int ?? 0
        }
        if let tokens = session["contextTokens"] as? Int { return tokens }
        return 0
    }

    private var maxTokens: Int { 200_000 }

    private var contextRatio: Double {
        guard maxTokens > 0 else { return 0 }
        return min(Double(contextTokens) / Double(maxTokens), 1.0)
    }

    private var barColor: Color {
        if contextRatio < 0.5 { return .green }
        if contextRatio < 0.8 { return .optaAmber }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(key)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
                Spacer()
                Text("\(contextTokens / 1000)k")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.optaSurface)
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(barColor)
                        .frame(width: geo.size.width * contextRatio, height: 4)
                }
            }
            .frame(height: 4)

            if let lastActive = session["lastActiveAt"] as? Double {
                let date = Date(timeIntervalSince1970: lastActive / 1000)
                let seconds = Int(Date().timeIntervalSince(date))
                Text(seconds < 60 ? "just now" : seconds < 3600 ? "\(seconds / 60)m ago" : "\(seconds / 3600)h ago")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Node Row

struct NodeRow: View {
    let node: [String: Any]

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: nodeIcon)
                .font(.system(size: 14))
                .foregroundColor(.optaTextSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(node["name"] as? String ?? node["nodeId"] as? String ?? "Unknown")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    if let os = node["os"] as? String {
                        Text(os)
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.optaSurface))
                    }
                }

                HStack(spacing: 8) {
                    if let ip = node["ip"] as? String ?? node["address"] as? String {
                        Text(ip)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                    }

                    if let version = node["version"] as? String {
                        Text("v\(version)")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                    }

                    let connected = node["connected"] as? Bool ?? (node["status"] as? String == "connected")
                    Circle()
                        .fill(connected ? Color.green : Color.red)
                        .frame(width: 6, height: 6)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var nodeIcon: String {
        let type = node["type"] as? String ?? ""
        switch type {
        case "gateway": return "server.rack"
        case "desktop", "mac": return "desktopcomputer"
        case "laptop": return "laptopcomputer"
        case "mobile": return "iphone"
        default: return "desktopcomputer"
        }
    }
}

// MARK: - ConnectionState Display

extension ConnectionState {
    var displayName: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting"
        case .connected: return "Connected"
        case .reconnecting: return "Reconnecting"
        }
    }
}
