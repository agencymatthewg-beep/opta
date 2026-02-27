//
//  DebugDiagnostics.swift
//  OptaPlusIOS
//
//  Extracted diagnostic components for the Debug page:
//  HealthExplanation, PortProbeView, EnhancedSessionRow,
//  NodeDetailSheet, ConnectionTimelineView.
//

import SwiftUI
import OptaPlus
import OptaMolt

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
                            .font(.sora(11, weight: .regular))
                            .foregroundColor(warning.color)
                            .frame(width: 16)
                        Text(warning.text)
                            .font(.sora(12, weight: .regular))
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
                .font(.sora(12, weight: .regular))
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
                OptaLoader(size: 14)

            case .reachable:
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.sora(12, weight: .regular))
                        .foregroundColor(.optaGreen)
                    Text("Reachable")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.optaGreen)
                }

            case .unreachable:
                HStack(spacing: 4) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.sora(12, weight: .regular))
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
            if reachable {
                HapticManager.shared.notification(.success)
            } else {
                HapticManager.shared.notification(.error)
            }
            // Reset after 5 seconds
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

    private var channel: String? {
        session["channel"] as? String
    }

    private var kind: String? {
        session["kind"] as? String
    }

    private var label: String? {
        session["label"] as? String
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
        if contextRatio < 0.5 { return .optaGreen }
        if contextRatio < 0.8 { return .optaAmber }
        return .optaRed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header row: key + badges + delete
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
                        .font(.sora(11, weight: .regular))
                        .foregroundColor(.optaRed.opacity(0.7))
                }
                .buttonStyle(.plain)
            }

            if let label = label, !label.isEmpty {
                Text(label)
                    .font(.sora(11, weight: .regular))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(1)
            }

            // Context bar
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

            // Context warning
            if contextRatio > 0.8 {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.sora(10, weight: .regular))
                        .foregroundColor(.optaAmber)
                    Text("Context \(Int(contextRatio * 100))% full")
                        .font(.sora(10, weight: .regular))
                        .foregroundColor(.optaAmber)
                }
            }

            // Last active
            if let lastActive = session["lastActiveAt"] as? Double {
                let date = Date(timeIntervalSince1970: lastActive / 1000)
                let seconds = Int(Date().timeIntervalSince(date))
                Text(seconds < 60 ? "just now" : seconds < 3600 ? "\(seconds / 60)m ago" : "\(seconds / 3600)h ago")
                    .font(.sora(10, weight: .regular))
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

// MARK: - Node Detail Sheet

struct NodeDetailSheet: View {
    let node: [String: Any]
    @Environment(\.dismiss) private var dismiss

    private var name: String {
        node["name"] as? String ?? node["nodeId"] as? String ?? "Unknown"
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Node Info") {
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
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle(name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
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

            DebugRow(
                label: "Reconnects",
                value: "\(viewModel.reconnectCount)",
                color: viewModel.reconnectCount > 3 ? .optaAmber : nil
            )

            DebugRow(
                label: "Errors",
                value: "\(viewModel.errorCount)",
                color: viewModel.errorCount > 0 ? .optaRed : nil
            )
        }
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeStyle = .medium
        return f.string(from: date)
    }
}
