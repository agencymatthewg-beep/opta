import SwiftUI

struct DiscoveryView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @State private var adminKey = ""
    @State private var showQRScanner = false

    var body: some View {
        let discovery = connectionManager.discovery

        VStack(spacing: 20) {
            // QR Scanner button for WAN
            Button {
                OptaHaptics.tap()
                showQRScanner = true
            } label: {
                Label("Scan Tunnel QR", systemImage: "qrcode.viewfinder")
                    .font(.subheadline.bold())
                    .foregroundStyle(OptaColors.textPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(OptaColors.primary.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(OptaColors.primary.opacity(0.3), lineWidth: 1)
                    )
            }

            // Scanning indicator
            if discovery.isScanning {
                VStack(spacing: 12) {
                    ProgressView()
                        .tint(OptaColors.primary)
                    Text("Scanning network...")
                        .font(.caption)
                        .foregroundStyle(OptaColors.textSecondary)
                }
                .padding()
            }

            // Discovered servers
            if !discovery.servers.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Found Servers")
                        .font(.caption)
                        .foregroundStyle(OptaColors.textMuted)
                        .textCase(.uppercase)
                        .tracking(1)

                    ForEach(discovery.servers) { server in
                        Button {
                            OptaHaptics.tap()
                            Task {
                                await connectionManager.connect(
                                    discovered: server,
                                    adminKey: adminKey.isEmpty ? connectionManager.storedAdminKey : adminKey
                                )
                            }
                        } label: {
                            HStack {
                                Image(systemName: "desktopcomputer")
                                    .foregroundStyle(OptaColors.primary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(server.name)
                                        .font(.subheadline.bold())
                                        .foregroundStyle(OptaColors.textPrimary)
                                    Text("\(server.host):\(server.port)")
                                        .font(.caption)
                                        .foregroundStyle(OptaColors.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(OptaColors.textMuted)
                            }
                            .padding()
                            .glassPanel()
                        }
                    }
                }
            } else if !discovery.isScanning {
                Text("No servers found")
                    .foregroundStyle(OptaColors.textSecondary)
            }

            // Scan button
            Button {
                OptaHaptics.tap()
                if discovery.isScanning {
                    discovery.stopScan()
                } else {
                    discovery.startScan()
                }
            } label: {
                Label(
                    discovery.isScanning ? "Stop Scanning" : "Scan Network",
                    systemImage: discovery.isScanning ? "stop.fill" : "antenna.radiowaves.left.and.right"
                )
                .font(.subheadline.bold())
                .foregroundStyle(OptaColors.textPrimary)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(OptaColors.primary.opacity(0.2), in: Capsule())
            }
        }
        .onAppear {
            adminKey = connectionManager.storedAdminKey
            discovery.startScan()
        }
        .onDisappear {
            discovery.stopScan()
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerView()
        }
    }
}
