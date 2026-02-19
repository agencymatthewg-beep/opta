import SwiftUI

struct DashboardView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @State private var viewModel = DashboardViewModel()
    @State private var appeared = false

    var body: some View {
        NavigationStack {
            ZStack {
                OptaColors.void_.ignoresSafeArea()

                if connectionManager.client != nil, let config = connectionManager.activeConfig {
                    ScrollView {
                        VStack(spacing: 16) {
                            if let status = viewModel.status {
                                VRAMGaugeView(
                                    used: status.vramUsedGb,
                                    total: status.vramTotalGb
                                )
                                .opacity(appeared ? 1 : 0)
                                .offset(y: appeared ? 0 : 20)
                                .animation(.optaSpring.delay(0.05), value: appeared)

                                ModelListView(
                                    models: status.loadedModels,
                                    onUnload: { modelId in
                                        Task { await unloadModel(id: modelId) }
                                    }
                                )
                                .opacity(appeared ? 1 : 0)
                                .offset(y: appeared ? 0 : 20)
                                .animation(.optaSpring.delay(0.1), value: appeared)

                                serverMetrics(status)
                                    .opacity(appeared ? 1 : 0)
                                    .offset(y: appeared ? 0 : 20)
                                    .animation(.optaSpring.delay(0.15), value: appeared)

                                // SSE connection indicator
                                sseIndicator
                                    .opacity(appeared ? 1 : 0)
                                    .animation(.optaSpring.delay(0.2), value: appeared)
                            } else if viewModel.isLoading {
                                ProgressView()
                                    .tint(OptaColors.primary)
                                    .padding(.top, 100)
                            }

                            if let error = viewModel.error {
                                Text(error)
                                    .foregroundStyle(OptaColors.neonRed)
                                    .font(.caption)
                            }
                        }
                        .padding()
                    }
                    .task {
                        viewModel.startMonitoring(
                            baseURL: config.baseURL,
                            adminKey: connectionManager.storedAdminKey
                        )
                        withAnimation { appeared = true }
                    }
                    .onDisappear {
                        viewModel.stopMonitoring()
                        appeared = false
                    }
                    .refreshable {
                        if let client = connectionManager.client {
                            await viewModel.refresh(client: client)
                        }
                    }
                } else {
                    disconnectedView
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ConnectionBadge(state: connectionManager.state)
                }
            }
        }
    }

    private var sseIndicator: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(viewModel.isConnected ? OptaColors.neonGreen : OptaColors.textMuted)
                .frame(width: 6, height: 6)
            Text(viewModel.isConnected ? "Live" : "Reconnecting…")
                .font(.caption2)
                .foregroundStyle(OptaColors.textMuted)
        }
        .animation(.optaSpring, value: viewModel.isConnected)
    }

    private func serverMetrics(_ status: ServerStatus) -> some View {
        VStack(spacing: 12) {
            HStack {
                metricCard("Active", "\(status.activeRequests)", icon: "bolt.fill")
                metricCard("Tok/s", String(format: "%.1f", status.tokensPerSecond), icon: "speedometer")
            }
            HStack {
                metricCard("Temp", "\(Int(status.temperatureCelsius))°C", icon: "thermometer.medium")
                metricCard("Uptime", formatUptime(status.uptimeSeconds), icon: "clock")
            }
        }
    }

    private func metricCard(_ title: String, _ value: String, icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundStyle(OptaColors.primary)
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(OptaColors.textPrimary)
                .contentTransition(.numericText())
            Text(title)
                .font(.caption)
                .foregroundStyle(OptaColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .glassPanel()
    }

    private var disconnectedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 48))
                .foregroundStyle(OptaColors.textMuted)
            Text("Not Connected")
                .font(.title3)
                .foregroundStyle(OptaColors.textSecondary)
            Text("Connect to an LMX server in Settings")
                .font(.caption)
                .foregroundStyle(OptaColors.textMuted)
        }
    }

    private func unloadModel(id: String) async {
        guard let client = connectionManager.client else { return }
        do {
            try await client.unloadModel(id: id)
            OptaHaptics.success()
        } catch {
            OptaHaptics.error()
        }
    }

    private func formatUptime(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        if hours > 0 { return "\(hours)h \(minutes)m" }
        return "\(minutes)m"
    }
}
