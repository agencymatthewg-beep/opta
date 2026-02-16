//
//  DebugView.swift
//  OptaPlusMacOS
//
//  Gateway diagnostics — health, connectivity, sessions, nodes, and timeline.
//  Ported from iOS DebugView + DebugDiagnostics.
//  macOS adaptations: no bot picker (uses sidebar), manual refresh, hover effects, SoundManager.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Debug View

struct DebugView: View {
    let bot: BotConfig?
    let viewModel: ChatViewModel?
    @EnvironmentObject var appState: AppState

    @State private var healthData: [String: Any]?
    @State private var sessions: [[String: Any]] = []
    @State private var nodes: [[String: Any]] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedNode: [String: Any]?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Label("Debug", systemImage: "ant")
                    .font(.sora(16, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                if let bot = bot {
                    Text(bot.emoji)
                        .font(.sora(14))
                    Text(bot.name)
                        .font(.sora(13))
                        .foregroundColor(.optaTextSecondary)
                }

                Spacer()

                if isLoading {
                    ProgressView()
                        .scaleEffect(0.6)
                }

                Button(action: { Task { await loadAll() } }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .help("Refresh diagnostics")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.optaElevated)

            Divider().background(Color.optaBorder.opacity(0.3))

            // Content
            if viewModel == nil {
                VStack(spacing: 12) {
                    Image(systemName: "ant")
                        .font(.system(size: 48))
                        .foregroundColor(.optaTextMuted)
                    Text("Select a bot to debug")
                        .font(.soraHeadline)
                        .foregroundColor(.optaTextSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let vm = viewModel, !vm.isGatewayReady {
                disconnectedState
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        gatewayHealthSection
                            .optaEntrance(delay: 0.0)
                        connectivitySection
                            .optaEntrance(delay: 0.05)
                        connectionTimelineSection
                            .optaEntrance(delay: 0.10)
                        sessionsSection
                            .optaEntrance(delay: 0.15)
                        nodesSection
                            .optaEntrance(delay: 0.20)
                    }
                    .padding()
                }
            }
        }
        .background(Color.optaVoid)
        .task {
            await loadAll()
        }
        .sheet(item: Binding(
            get: { selectedNode.map { IdentifiableNode(node: $0) } },
            set: { selectedNode = $0?.node }
        )) { wrapper in
            NodeDetailSheet(node: wrapper.node)
        }
    }

    // MARK: - Disconnected State

    private var disconnectedState: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 32))
                .foregroundColor(.optaTextMuted)
            Text("Not connected")
                .font(.soraHeadline)
                .foregroundColor(.optaTextSecondary)
            if let bot = bot {
                Button("Connect to \(bot.name)") {
                    appState.viewModel(for: bot).connect()
                }
                .buttonStyle(.borderedProminent)
                .tint(.optaPrimary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Gateway Health Section

    private var gatewayHealthSection: some View {
        DebugSection(title: "Gateway", icon: "server.rack") {
            if let health = healthData {
                let healthy = health["healthy"] as? Bool ?? false

                HStack {
                    Circle()
                        .fill(healthy ? Color.optaGreen : Color.optaRed)
                        .frame(width: 10, height: 10)
                    Text(healthy ? "Healthy" : "Unhealthy")
                        .font(.sora(14, weight: .semibold))
                        .foregroundColor(healthy ? .optaGreen : .optaRed)
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
                    DebugRow(label: "Uptime", value: OptaFormatting.formatUptime(Double(uptime)))
                } else if let uptime = health["uptimeMs"] as? Int {
                    DebugRow(label: "Uptime", value: OptaFormatting.formatUptime(Double(uptime / 1000)))
                }

                if let protocol_ = health["protocol"] as? Int {
                    DebugRow(label: "Protocol", value: "v\(protocol_)")
                }

                if let version = health["version"] as? String {
                    DebugRow(label: "Version", value: version)
                }

                // Health explanations
                if let vm = viewModel {
                    HealthExplanation(
                        healthData: health,
                        connectionState: vm.connectionState,
                        connectionRoute: vm.connectionRoute,
                        latencyMs: vm.pingLatencyMs
                    )
                }
            } else {
                Text("No health data")
                    .font(.sora(13))
                    .foregroundColor(.optaTextMuted)
            }
        }
    }

    // MARK: - Connectivity Section

    private var connectivitySection: some View {
        DebugSection(title: "Connectivity", icon: "network") {
            if let vm = viewModel {
                DebugRow(label: "WebSocket", value: vm.connectionState.displayName,
                         color: vm.connectionState == .connected ? .optaGreen : .optaAmber)

                DebugRow(label: "Route", value: vm.connectionRoute.rawValue.capitalized,
                         icon: vm.connectionRoute == .lan ? "wifi" : "globe")

                if let latency = vm.pingLatencyMs {
                    DebugRow(label: "Latency", value: "\(Int(latency))ms",
                             color: latency > 500 ? .optaAmber : nil)
                }

                DebugRow(label: "Reconnects", value: "\(vm.reconnectCount)",
                         color: vm.reconnectCount > 3 ? .optaAmber : nil)

                if let bot = bot {
                    DebugRow(label: "LAN", value: "\(bot.host):\(bot.port)", icon: "wifi")
                    if let remote = bot.remoteURL, !remote.isEmpty {
                        DebugRow(label: "Remote", value: remote, icon: "globe")
                    }
                    DebugRow(label: "Mode", value: bot.connectionMode.rawValue.capitalized)

                    // Port probe
                    PortProbeView(host: bot.host, port: bot.port)
                }
            }
        }
    }

    // MARK: - Connection Timeline

    private var connectionTimelineSection: some View {
        DebugSection(title: "Connection Timeline", icon: "clock.arrow.2.circlepath") {
            if let vm = viewModel {
                ConnectionTimelineView(viewModel: vm)
            }
        }
    }

    // MARK: - Sessions Section

    private var sessionsSection: some View {
        DebugSection(title: "Sessions (\(sessions.count))", icon: "text.bubble") {
            if sessions.isEmpty {
                Text("No active sessions")
                    .font(.sora(13))
                    .foregroundColor(.optaTextMuted)
            } else {
                ForEach(Array(sessions.prefix(20).enumerated()), id: \.offset) { index, session in
                    let sessionKey = session["sessionKey"] as? String ?? session["key"] as? String ?? "?"
                    EnhancedSessionRow(session: session) {
                        deleteSession(key: sessionKey)
                    }
                    if index < min(sessions.count, 20) - 1 {
                        Divider().opacity(0.3)
                    }
                }
            }
        }
    }

    // MARK: - Nodes Section

    private var nodesSection: some View {
        DebugSection(title: "Nodes", icon: "desktopcomputer") {
            if nodes.isEmpty {
                Text("No nodes connected")
                    .font(.sora(13))
                    .foregroundColor(.optaTextMuted)
            } else {
                ForEach(Array(nodes.enumerated()), id: \.offset) { _, node in
                    Button {
                        selectedNode = node
                    } label: {
                        NodeRow(node: node)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadAll() async {
        guard let vm = viewModel, vm.isGatewayReady else { return }
        isLoading = true
        defer { isLoading = false }

        async let healthTask: Void = {
            let result = try? await vm.call("health", params: ["probe": true])
            if let dict = result?.dict {
                await MainActor.run { healthData = dict }
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

        _ = await (healthTask, sessionsTask, nodesTask)
    }

    // MARK: - Session Delete

    private func deleteSession(key: String) {
        guard let vm = viewModel else { return }
        SoundManager.shared.play(.sendMessage)
        Task {
            do {
                _ = try await vm.call("sessions.delete", params: ["sessionKey": key])
                withAnimation(.optaSpring) {
                    sessions.removeAll { ($0["sessionKey"] as? String ?? $0["key"] as? String) == key }
                }
            } catch {
                errorMessage = "Delete failed: \(error.localizedDescription)"
            }
        }
    }

}

// MARK: - Identifiable Node Wrapper

private struct IdentifiableNode: Identifiable {
    let id: String
    let node: [String: Any]

    init(node: [String: Any]) {
        self.id = node["nodeId"] as? String ?? node["name"] as? String ?? UUID().uuidString
        self.node = node
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
                .font(.sora(13, weight: .semibold))
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
                .font(.sora(12))
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
                .lineLimit(1)
        }
    }
}

// MARK: - Node Row

struct NodeRow: View {
    let node: [String: Any]
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: nodeIcon)
                .font(.system(size: 14))
                .foregroundColor(.optaTextSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(node["name"] as? String ?? node["nodeId"] as? String ?? "Unknown")
                        .font(.sora(13, weight: .semibold))
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
                        .fill(connected ? Color.optaGreen : Color.optaRed)
                        .frame(width: 6, height: 6)
                }
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isHovered ? Color.optaSurface.opacity(0.4) : Color.clear)
        )
        .onHover { hovering in
            withAnimation(.optaSnap) {
                isHovered = hovering
            }
        }
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

// MARK: - Health Explanation

struct HealthExplanation: View {
    let healthData: [String: Any]
    let connectionState: ConnectionState
    let connectionRoute: NetworkEnvironment.ConnectionType
    let latencyMs: Double?

    private var warnings: [(icon: String, text: String, color: Color)] {
        var result: [(String, String, Color)] = []
        let healthy = healthData["healthy"] as? Bool ?? true
        if !healthy {
            result.append(("exclamationmark.triangle.fill", "Gateway reporting unhealthy. Check server logs.", .optaRed))
        }
        if let authAge = healthData["authAge"] as? Int, authAge > 24 {
            result.append(("key.fill", "Auth token is stale (\(authAge)h). Reconnect to refresh.", .optaAmber))
        }
        if let latency = latencyMs, latency > 500 {
            result.append(("gauge.with.needle.fill", "High latency (\(Int(latency))ms). Consider switching to LAN.", .optaAmber))
        }
        if connectionRoute == .remote {
            result.append(("globe", "Connected via relay. LAN may be faster.", .optaTextSecondary))
        }
        return result
    }

    var body: some View {
        if !warnings.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(warnings.enumerated()), id: \.offset) { _, warning in
                    HStack(spacing: 8) {
                        Image(systemName: warning.icon)
                            .font(.system(size: 11))
                            .foregroundColor(warning.color)
                            .frame(width: 16)
                        Text(warning.text)
                            .font(.sora(12))
                            .foregroundColor(warning.color)
                    }
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.optaAmber.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.optaAmber.opacity(0.2), lineWidth: 1)
            )
        }
    }
}

// MARK: - Port Probe View

struct PortProbeView: View {
    let host: String
    let port: Int

    enum ProbeState {
        case idle, probing, reachable, unreachable
    }

    @State private var probeState: ProbeState = .idle
    private let networkEnv = NetworkEnvironment()

    var body: some View {
        HStack {
            Text("LAN Probe")
                .font(.sora(12))
                .foregroundColor(.optaTextMuted)
            Spacer()

            switch probeState {
            case .idle:
                Button {
                    runProbe()
                } label: {
                    Label("Probe", systemImage: "antenna.radiowaves.left.and.right")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.optaPrimary.opacity(0.15)))
                }
                .buttonStyle(.plain)

            case .probing:
                ProgressView()
                    .scaleEffect(0.6)

            case .reachable:
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.optaGreen)
                    Text("Reachable")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.optaGreen)
                }

            case .unreachable:
                HStack(spacing: 4) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.optaRed)
                    Text("Unreachable")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.optaRed)
                }
            }
        }
    }

    private func runProbe() {
        probeState = .probing
        Task {
            let reachable = await networkEnv.probeLAN(host: host, port: port)
            withAnimation(.optaSpring) {
                probeState = reachable ? .reachable : .unreachable
            }
            SoundManager.shared.play(reachable ? .connected : .error)
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            withAnimation(.optaSpring) {
                probeState = .idle
            }
        }
    }
}

// MARK: - Enhanced Session Row

struct EnhancedSessionRow: View {
    let session: [String: Any]
    let onDelete: () -> Void

    private var key: String {
        session["sessionKey"] as? String ?? session["key"] as? String ?? "?"
    }

    private var channel: String? { session["channel"] as? String }
    private var kind: String? { session["kind"] as? String }
    private var label: String? { session["label"] as? String }

    private var contextTokens: Int {
        if let usage = session["usage"] as? [String: Any] {
            return usage["totalTokens"] as? Int ?? 0
        }
        return session["contextTokens"] as? Int ?? 0
    }

    private var maxTokens: Int { 200_000 }

    private var contextRatio: Double {
        guard maxTokens > 0 else { return 0 }
        return min(Double(contextTokens) / Double(maxTokens), 1.0)
    }

    private var barColor: Color {
        if contextRatio < 0.5 { return .optaGreen }
        if contextRatio < 0.8 { return .optaAmber }
        return .optaRed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(key)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)

                if let channel = channel {
                    BadgePill(text: channel, color: .optaPrimary)
                }
                if let kind = kind {
                    BadgePill(text: kind, color: .optaTextMuted)
                }

                Spacer()

                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 11))
                        .foregroundColor(.optaRed.opacity(0.7))
                }
                .buttonStyle(.plain)
            }

            if let label = label, !label.isEmpty {
                Text(label)
                    .font(.sora(11))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(1)
            }

            HStack(spacing: 6) {
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

                Text("\(contextTokens / 1000)k")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                    .frame(width: 36, alignment: .trailing)
            }

            if contextRatio > 0.8 {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.optaAmber)
                    Text("Context \(Int(contextRatio * 100))% full")
                        .font(.sora(10))
                        .foregroundColor(.optaAmber)
                }
            }

            if let lastActive = session["lastActiveAt"] as? Double {
                let date = Date(timeIntervalSince1970: lastActive / 1000)
                let seconds = Int(Date().timeIntervalSince(date))
                Text(seconds < 60 ? "just now" : seconds < 3600 ? "\(seconds / 60)m ago" : "\(seconds / 3600)h ago")
                    .font(.sora(10))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Badge Pill

struct BadgePill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.sora(9, weight: .medium))
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}

// MARK: - Node Detail Sheet (macOS)

struct NodeDetailSheet: View {
    let node: [String: Any]
    @Environment(\.dismiss) private var dismiss

    private var name: String {
        node["name"] as? String ?? node["nodeId"] as? String ?? "Unknown"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(name)
                    .font(.sora(16, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider().background(Color.optaBorder.opacity(0.3))

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    LabeledRow(label: "Name", value: name)
                    if let nodeId = node["nodeId"] as? String {
                        LabeledRow(label: "Node ID", value: nodeId, mono: true)
                    }
                    if let type = node["type"] as? String {
                        LabeledRow(label: "Type", value: type.capitalized)
                    }
                    if let os = node["os"] as? String {
                        LabeledRow(label: "OS", value: os)
                    }
                    if let ip = node["ip"] as? String ?? node["address"] as? String {
                        LabeledRow(label: "IP", value: ip, mono: true)
                    }
                    if let version = node["version"] as? String {
                        LabeledRow(label: "Version", value: version)
                    }
                    let connected = node["connected"] as? Bool ?? (node["status"] as? String == "connected")
                    LabeledRow(label: "Status", value: connected ? "Connected" : "Disconnected")
                }
                .padding()
            }
        }
        .frame(width: 380)
        .frame(minHeight: 300)
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Connection Timeline View

struct ConnectionTimelineView: View {
    let viewModel: ChatViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let since = viewModel.connectedSince {
                DebugRow(label: "Connected Since", value: formatTime(since))
            }
            DebugRow(label: "Total Uptime", value: viewModel.formattedUptime)
            DebugRow(label: "Reconnects", value: "\(viewModel.reconnectCount)",
                     color: viewModel.reconnectCount > 3 ? .optaAmber : nil)
            DebugRow(label: "Errors", value: "\(viewModel.errorCount)",
                     color: viewModel.errorCount > 0 ? .optaRed : nil)
        }
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeStyle = .medium
        return f.string(from: date)
    }
}
