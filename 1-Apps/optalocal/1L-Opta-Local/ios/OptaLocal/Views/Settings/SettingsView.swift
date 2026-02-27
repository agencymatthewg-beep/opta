import SwiftUI

struct SettingsView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @State private var viewModel = ConnectionViewModel()
    @State private var showDiscovery = false

    var body: some View {
        NavigationStack {
            ZStack {
                OptaColors.void_.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Connection status
                        connectionStatusSection

                        // Manual connection
                        manualConnectionSection

                        // Bonjour discovery
                        discoverySection

                        // Saved connections
                        if !connectionManager.savedConnections.isEmpty {
                            savedConnectionsSection
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                viewModel.loadStoredKey(manager: connectionManager)
            }
        }
    }

    private var connectionStatusSection: some View {
        HStack {
            ConnectionDot(state: connectionManager.state)
            Text(statusText)
                .font(.subheadline)
                .foregroundStyle(OptaColors.textPrimary)
            Spacer()
            if connectionManager.state.isConnected {
                Button("Disconnect") {
                    OptaHaptics.tap()
                    connectionManager.disconnect()
                }
                .font(.caption.bold())
                .foregroundStyle(OptaColors.neonRed)
            }
        }
        .padding()
        .glassPanel()
    }

    private var statusText: String {
        switch connectionManager.state {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting..."
        case .connected(.lan): return "Connected (LAN)"
        case .connected(.wan): return "Connected (WAN)"
        case .error(let msg): return "Error: \(msg)"
        }
    }

    private var manualConnectionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Manual Connection")
                .font(.caption)
                .foregroundStyle(OptaColors.textMuted)
                .textCase(.uppercase)
                .tracking(1)

            VStack(spacing: 10) {
                HStack(spacing: 10) {
                    TextField("Host", text: $viewModel.host)
                        .textFieldStyle(.plain)
                        .foregroundStyle(OptaColors.textPrimary)
                        .padding(10)
                        .background(OptaColors.surface, in: RoundedRectangle(cornerRadius: 8))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    TextField("Port", text: $viewModel.port)
                        .textFieldStyle(.plain)
                        .foregroundStyle(OptaColors.textPrimary)
                        .padding(10)
                        .background(OptaColors.surface, in: RoundedRectangle(cornerRadius: 8))
                        .keyboardType(.numberPad)
                        .frame(width: 80)
                }

                SecureField("Admin Key", text: $viewModel.adminKey)
                    .textFieldStyle(.plain)
                    .foregroundStyle(OptaColors.textPrimary)
                    .padding(10)
                    .background(OptaColors.surface, in: RoundedRectangle(cornerRadius: 8))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                Button {
                    OptaHaptics.tap()
                    Task {
                        await viewModel.connect(manager: connectionManager)
                    }
                } label: {
                    HStack {
                        if viewModel.isConnecting {
                            ProgressView()
                                .tint(OptaColors.textPrimary)
                        }
                        Text("Connect")
                            .font(.subheadline.bold())
                    }
                    .foregroundStyle(OptaColors.textPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(OptaColors.primary, in: RoundedRectangle(cornerRadius: 10))
                }
                .disabled(viewModel.isConnecting)
            }
        }
        .padding()
        .glassPanel()
    }

    private var discoverySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Network Discovery")
                .font(.caption)
                .foregroundStyle(OptaColors.textMuted)
                .textCase(.uppercase)
                .tracking(1)

            DiscoveryView()
        }
        .padding()
        .glassPanel()
    }

    private var savedConnectionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Saved Connections")
                .font(.caption)
                .foregroundStyle(OptaColors.textMuted)
                .textCase(.uppercase)
                .tracking(1)

            ForEach(connectionManager.savedConnections) { config in
                HStack {
                    Image(systemName: config.type == .lan ? "wifi" : "globe")
                        .foregroundStyle(OptaColors.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(config.name)
                            .font(.subheadline)
                            .foregroundStyle(OptaColors.textPrimary)
                        Text(config.baseURL)
                            .font(.caption)
                            .foregroundStyle(OptaColors.textSecondary)
                    }
                    Spacer()
                    if config.isActive {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(OptaColors.neonGreen)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .glassPanel()
    }
}
