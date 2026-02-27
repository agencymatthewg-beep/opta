//
//  ConnectionDiagnosticsView.swift
//  OptaPlusMacOS
//
//  Detailed connection diagnostics panel for debugging network issues.
//  Shows real-time connection state, latency history, reconnect log,
//  and network environment details.
//
//  v0.9.1 — macOS only
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Connection Diagnostics View

struct ConnectionDiagnosticsView: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel

    @State private var latencyHistory: [LatencySample] = []
    @State private var reconnectLog: [ReconnectEvent] = []
    @State private var lanProbeResult: String = "—"
    @State private var remoteProbeResult: String = "—"
    @State private var isProbing = false
    @State private var refreshTimer: Timer?

    struct LatencySample: Identifiable {
        let id = UUID()
        let timestamp: Date
        let ms: Double
    }

    struct ReconnectEvent: Identifiable {
        let id = UUID()
        let timestamp: Date
        let fromState: String
        let toState: String
        let reason: String?
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Connection Status Card
                connectionStatusCard

                // Latency Section
                latencySection

                // Network Routes
                networkRoutesSection

                // Reconnect History
                reconnectHistorySection

                // Raw Details
                rawDetailsSection
            }
            .padding(16)
        }
        .background(Color.optaVoid)
        .onAppear { startRefresh() }
        .onDisappear { stopRefresh() }
    }

    // MARK: - Connection Status Card

    private var connectionStatusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Connection Status", systemImage: "network")
                    .font(.sora(14, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                statusBadge
            }

            HStack(spacing: 24) {
                statItem("Uptime", value: viewModel.formattedUptime)
                statItem("Reconnects", value: "\(viewModel.reconnectCount)")
                statItem("Errors", value: "\(viewModel.errorCount)")
                statItem("Route", value: viewModel.connectionRoute.rawValue.capitalized)
            }

            if let countdown = viewModel.reconnectCountdown {
                HStack(spacing: 6) {
                    ProgressView()
                        .scaleEffect(0.5)
                    Text("Reconnecting in \(countdown)s...")
                        .font(.sora(11))
                        .foregroundColor(.optaTextSecondary)
                }
            }
        }
        .padding(14)
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var statusBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(stateColor)
                .frame(width: 8, height: 8)
            Text(viewModel.connectionState.description)
                .font(.sora(11, weight: .medium))
                .foregroundColor(stateColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(stateColor.opacity(0.12))
        .clipShape(Capsule())
    }

    private var stateColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .yellow
        case .disconnected: return .optaRed
        }
    }

    // MARK: - Latency Section

    private var latencySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Latency", systemImage: "waveform.path.ecg")
                    .font(.sora(14, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                if let ms = viewModel.pingLatencyMs {
                    Text(String(format: "%.0fms", ms))
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(ms < 50 ? .optaGreen : ms < 200 ? .yellow : .optaRed)
                } else {
                    Text("—")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                }
            }

            // Mini sparkline of latency history
            if !latencyHistory.isEmpty {
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(latencyHistory.suffix(30)) { sample in
                        let maxMs = latencyHistory.map(\.ms).max() ?? 100
                        let height = max(2, CGFloat(sample.ms / maxMs) * 30)
                        RoundedRectangle(cornerRadius: 1)
                            .fill(sample.ms < 50 ? Color.optaGreen : sample.ms < 200 ? .yellow : .optaRed)
                            .frame(width: 4, height: height)
                    }
                    Spacer()
                }
                .frame(height: 32)
            }
        }
        .padding(14)
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Network Routes

    private var networkRoutesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Network Routes", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(.sora(14, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Button("Probe") { probeRoutes() }
                    .font(.sora(11))
                    .disabled(isProbing)
            }

            VStack(spacing: 6) {
                routeRow("LAN", url: bot.lanURL?.absoluteString ?? "—", result: lanProbeResult)
                routeRow("Remote", url: bot.remoteAccessURL?.absoluteString ?? "Not configured", result: remoteProbeResult)
            }
        }
        .padding(14)
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func routeRow(_ label: String, url: String, result: String) -> some View {
        HStack {
            Text(label)
                .font(.sora(11, weight: .medium))
                .foregroundColor(.optaTextSecondary)
                .frame(width: 50, alignment: .leading)
            Text(url)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)
            Spacer()
            Text(result)
                .font(.sora(11))
                .foregroundColor(result == "✓" ? .optaGreen : result == "✗" ? .optaRed : .optaTextMuted)
        }
    }

    // MARK: - Reconnect History

    private var reconnectHistorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Reconnect Log", systemImage: "arrow.triangle.2.circlepath")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            if reconnectLog.isEmpty {
                Text("No reconnection events")
                    .font(.sora(11))
                    .foregroundColor(.optaTextMuted)
            } else {
                ForEach(reconnectLog.suffix(10).reversed()) { event in
                    HStack {
                        Text(event.timestamp, style: .time)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                        Text("\(event.fromState) → \(event.toState)")
                            .font(.sora(11))
                            .foregroundColor(.optaTextSecondary)
                        if let reason = event.reason {
                            Text(reason)
                                .font(.sora(10))
                                .foregroundColor(.optaTextMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                    }
                }
            }
        }
        .padding(14)
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Raw Details

    private var rawDetailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Connection Details", systemImage: "info.circle")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            VStack(alignment: .leading, spacing: 4) {
                detailRow("Host", bot.host)
                detailRow("Port", "\(bot.port)")
                detailRow("Mode", bot.connectionMode.rawValue)
                detailRow("Token", bot.token.isEmpty ? "(empty)" : "\(bot.token.prefix(8))...")
                detailRow("Remote URL", bot.remoteURL ?? "(none)")
                detailRow("Health", viewModel.health.label)
                detailRow("Messages", "\(viewModel.totalMessageCount)")
                detailRow("Queued", "\(viewModel.queuedMessageCount)")
            }
        }
        .padding(14)
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.sora(11, weight: .medium))
                .foregroundColor(.optaTextSecondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
                .textSelection(.enabled)
            Spacer()
        }
    }

    // MARK: - Helpers

    private func statItem(_ label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
            Text(label)
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
        }
    }

    private func probeRoutes() {
        isProbing = true
        lanProbeResult = "..."
        remoteProbeResult = "..."

        Task {
            let env = NetworkEnvironment()
            let lanOK = await env.probeLAN(host: bot.host, port: bot.port)
            lanProbeResult = lanOK ? "✓" : "✗"

            if let remote = bot.remoteAccessURL {
                let remoteOK = await env.probeLAN(
                    host: remote.host ?? "",
                    port: remote.port ?? (remote.scheme == "wss" ? 443 : 80)
                )
                remoteProbeResult = remoteOK ? "✓" : "✗"
            } else {
                remoteProbeResult = "N/A"
            }

            isProbing = false
        }
    }

    private func startRefresh() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            Task { @MainActor in
                if let ms = viewModel.pingLatencyMs {
                    latencyHistory.append(LatencySample(timestamp: Date(), ms: ms))
                    // Keep last 60 samples
                    if latencyHistory.count > 60 {
                        latencyHistory.removeFirst(latencyHistory.count - 60)
                    }
                }
            }
        }
    }

    private func stopRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
}

// MARK: - ConnectionState Description

extension ConnectionState: CustomStringConvertible {
    public var description: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting"
        case .connected: return "Connected"
        case .reconnecting: return "Reconnecting"
        }
    }
}
