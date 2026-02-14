import SwiftUI

struct OpenClawSettingsView: View {
    @ObservedObject private var service = OpenClawService.shared
    @State private var serverURL: String = ""
    @State private var autoConnect: Bool = true
    @State private var showingResetConfirmation = false
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            List {
                // Connection Status Section
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Connection Status")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)

                            Text(service.connectionState.displayText)
                                .font(.caption)
                                .foregroundColor(service.connectionState.color)
                        }

                        Spacer()

                        Circle()
                            .fill(service.connectionState.color)
                            .frame(width: 12, height: 12)
                            .optaGlow(service.connectionState.color, radius: 6)
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    if service.isConnected {
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await service.disconnect()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "wifi.slash")
                                    .foregroundColor(.optaNeonRed)
                                Text("Disconnect")
                                    .foregroundColor(.optaNeonRed)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } else if service.connectionState != .connecting {
                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                await service.connect()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "wifi")
                                    .foregroundColor(.optaNeonCyan)
                                Text("Connect")
                                    .foregroundColor(.optaNeonCyan)

                                Spacer()

                                if service.connectionState == .connecting {
                                    ProgressView()
                                        .tint(.optaNeonCyan)
                                }
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        .disabled(serverURL.isEmpty)
                    }
                } header: {
                    Text("Status")
                }

                // Server Configuration Section
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Server URL")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)

                        TextField("ws://192.168.1.100:8080", text: $serverURL)
                            .font(.system(.body, design: .monospaced))
                            .foregroundColor(.optaTextPrimary)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .onChange(of: serverURL) { _, newValue in
                                service.setServerURL(newValue)
                            }

                        Text("WebSocket server address (e.g., ws://your-server:8080)")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(Color.optaGlassBackground)

                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Auto-connect")
                                .font(.subheadline)
                                .foregroundColor(.optaTextPrimary)

                            Text("Automatically connect on app launch")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }

                        Spacer()

                        Toggle("", isOn: $autoConnect)
                            .labelsHidden()
                            .tint(.optaNeonCyan)
                            .onChange(of: autoConnect) { _, newValue in
                                service.setAutoConnect(newValue)
                            }
                    }
                    .listRowBackground(Color.optaGlassBackground)
                } header: {
                    Text("Configuration")
                } footer: {
                    Text("Enter your OpenClaw server's WebSocket URL. The server should be running on your local network or accessible via Tailscale.")
                        .foregroundColor(.optaTextMuted)
                }

                // Bot State Section (when connected)
                if service.isConnected {
                    Section {
                        HStack {
                            Text("Bot State")
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Text(service.botState.displayText)
                                .foregroundColor(.optaTextPrimary)
                        }
                        .listRowBackground(Color.optaGlassBackground)

                        HStack {
                            Text("Messages")
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Text("\(service.messages.count)")
                                .foregroundColor(.optaTextPrimary)
                        }
                        .listRowBackground(Color.optaGlassBackground)

                        Button {
                            HapticManager.shared.impact(.light)
                            service.clearMessages()
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                    .foregroundColor(.optaNeonAmber)
                                Text("Clear Messages")
                                    .foregroundColor(.optaNeonAmber)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Session")
                    }
                }

                // Error Section
                if let error = service.lastError {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.optaNeonRed)

                            Text(error)
                                .font(.subheadline)
                                .foregroundColor(.optaNeonRed)
                        }
                        .listRowBackground(Color.optaNeonRed.opacity(0.1))
                    } header: {
                        Text("Error")
                    }
                }

                // Reset Section
                Section {
                    Button {
                        showingResetConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundColor(.optaTextMuted)
                            Text("Reset to Defaults")
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)
                } footer: {
                    Text("This will disconnect and clear all OpenClaw settings.")
                        .foregroundColor(.optaTextMuted)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("OpenClaw Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            serverURL = service.serverURL
            autoConnect = service.autoConnect
        }
        .confirmationDialog(
            "Reset OpenClaw Settings?",
            isPresented: $showingResetConfirmation,
            titleVisibility: .visible
        ) {
            Button("Reset", role: .destructive) {
                HapticManager.shared.notification(.warning)
                service.resetToDefaults()
                serverURL = ""
                autoConnect = true
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will disconnect from the server and clear all settings. You can reconfigure at any time.")
        }
    }
}

#Preview {
    NavigationStack {
        OpenClawSettingsView()
    }
}
