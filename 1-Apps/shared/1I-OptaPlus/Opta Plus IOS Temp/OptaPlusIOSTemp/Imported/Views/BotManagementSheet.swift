//
//  BotManagementSheet.swift
//  OptaPlusIOS
//
//  Bot configuration management — health, model selection,
//  thinking level, and gateway actions.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotManagementSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var healthStatus: GatewayHealth?
    @State private var availableModels: [GatewayModel] = []
    @State private var currentModel: String = ""
    @State private var selectedModel: String = ""
    @State private var thinkingLevel: String = "off"
    @State private var configHash: String = ""
    @State private var isLoadingConfig = true
    @State private var isApplying = false
    @State private var configError: String?
    @State private var showRestartConfirm = false

    private var hasChanges: Bool {
        selectedModel != currentModel
    }

    var body: some View {
        NavigationStack {
            List {
                // Health
                Section("Health") {
                    if let health = healthStatus {
                        HStack {
                            Circle()
                                .fill(health.status == "ok" ? Color.optaGreen : Color.optaAmber)
                                .frame(width: 8, height: 8)
                            Text(health.status.capitalized)
                                .font(.soraBody)
                            Spacer()
                            Text("v\(health.version)")
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                        HStack {
                            Text("Uptime")
                                .font(.soraBody)
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Text(OptaFormatting.formatUptime(health.uptime))
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                        if let model = health.model {
                            HStack {
                                Text("Active Model")
                                    .font(.soraBody)
                                    .foregroundColor(.optaTextSecondary)
                                Spacer()
                                Text(model)
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundColor(.optaTextMuted)
                                    .lineLimit(1)
                            }
                        }
                        HStack {
                            Text("Sessions")
                                .font(.soraBody)
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Text("\(health.sessions)")
                                .foregroundColor(.optaTextMuted)
                        }
                    } else if isLoadingConfig {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Loading…")
                                .font(.soraCaption)
                                .foregroundColor(.optaTextMuted)
                        }
                    } else {
                        Text("Not available")
                            .font(.soraCaption)
                            .foregroundColor(.optaTextMuted)
                    }
                }

                // Model selection
                if !availableModels.isEmpty {
                    Section("Model") {
                        Picker("Model", selection: $selectedModel) {
                            ForEach(availableModels) { model in
                                Text(model.name ?? model.id)
                                    .tag(model.id)
                            }
                        }

                        Picker("Thinking", selection: $thinkingLevel) {
                            Text("Off").tag("off")
                            Text("Low").tag("low")
                            Text("High").tag("high")
                            Text("Stream").tag("stream")
                        }
                        .pickerStyle(.segmented)
                    }
                }

                // Actions
                Section("Actions") {
                    Button(action: { applyConfig() }) {
                        HStack {
                            Text(isApplying ? "Applying…" : "Apply Changes")
                            Spacer()
                            if isApplying {
                                ProgressView()
                                    .scaleEffect(0.7)
                            }
                        }
                    }
                    .disabled(!hasChanges || isApplying)

                    Button("Compact Context") {
                        compactContext()
                    }

                    Button("Restart Gateway", role: .destructive) {
                        showRestartConfirm = true
                    }
                }

                // Error
                if let error = configError {
                    Section {
                        Text(error)
                            .font(.soraCaption)
                            .foregroundColor(.optaRed)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle("Bot Config")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadBotConfig()
            }
            .confirmationDialog("Restart Gateway?", isPresented: $showRestartConfirm) {
                Button("Restart", role: .destructive) { restartGateway() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will restart the bot's gateway with the current configuration.")
            }
        }
    }

    // MARK: - Config Management

    private func loadBotConfig() async {
        guard viewModel.isGatewayReady else { isLoadingConfig = false; return }
        do {
            async let h = viewModel.call("health")
            async let c = viewModel.call("config.get")
            async let m = viewModel.call("models.list")
            let (healthRes, configRes, modelsRes) = try await (h, c, m)

            if let hd = healthRes?.dict {
                healthStatus = GatewayHealth(
                    status: hd["status"] as? String ?? "unknown",
                    uptime: hd["uptime"] as? Double ?? hd["uptimeMs"] as? Double ?? 0,
                    version: hd["version"] as? String ?? "?",
                    model: hd["model"] as? String,
                    sessions: hd["sessions"] as? Int ?? hd["activeSessions"] as? Int ?? 0,
                    cronJobs: hd["cronJobs"] as? Int ?? hd["scheduledJobs"] as? Int ?? 0
                )
                currentModel = hd["model"] as? String ?? ""
                selectedModel = currentModel
            }

            if let cd = configRes?.dict {
                configHash = cd["hash"] as? String ?? cd["baseHash"] as? String ?? ""
                if let parsed = cd["parsed"] as? [String: Any],
                   let agents = parsed["agents"] as? [String: Any],
                   let defaults = agents["defaults"] as? [String: Any] {
                    thinkingLevel = defaults["thinking"] as? String ?? "off"
                }
            }

            if let md = modelsRes?.dict,
               let models = md["models"] as? [[String: Any]] {
                availableModels = models.compactMap { m in
                    guard let id = m["id"] as? String else { return nil }
                    return GatewayModel(id: id, name: m["name"] as? String, provider: m["provider"] as? String)
                }
            } else if let arr = modelsRes?.array as? [[String: Any]] {
                availableModels = arr.compactMap { m in
                    guard let id = m["id"] as? String else { return nil }
                    return GatewayModel(id: id, name: m["name"] as? String, provider: m["provider"] as? String)
                }
            }
        } catch {
            configError = error.localizedDescription
        }
        isLoadingConfig = false
    }

    private func applyConfig() {
        isApplying = true
        configError = nil
        Task {
            do {
                let config = try await viewModel.call("config.get")
                let raw = config?.dict?["raw"] as? String ?? ""
                let hash = config?.dict?["hash"] as? String ?? configHash
                _ = try await viewModel.call("config.patch", params: [
                    "raw": raw,
                    "baseHash": hash,
                    "note": "Model: \(selectedModel), Thinking: \(thinkingLevel)"
                ] as [String: Any])
                HapticManager.shared.notification(.success)
                currentModel = selectedModel
            } catch {
                configError = error.localizedDescription
                HapticManager.shared.notification(.error)
            }
            isApplying = false
        }
    }

    private func compactContext() {
        guard let session = viewModel.activeSession else { return }
        Task {
            do {
                _ = try await viewModel.call("sessions.patch", params: [
                    "sessionKey": session.sessionKey,
                    "patch": ["compact": true] as [String: Any]
                ] as [String: Any])
                HapticManager.shared.notification(.success)
            } catch {
                configError = error.localizedDescription
            }
        }
    }

    private func restartGateway() {
        Task {
            do {
                let config = try await viewModel.call("config.get")
                let raw = config?.dict?["raw"] as? String ?? ""
                let hash = config?.dict?["hash"] as? String ?? configHash
                _ = try await viewModel.call("gateway.restart", params: [
                    "raw": raw,
                    "baseHash": hash,
                    "note": "Restart from OptaPlus iOS"
                ] as [String: Any])
                HapticManager.shared.notification(.success)
                await loadBotConfig()
            } catch {
                configError = error.localizedDescription
                HapticManager.shared.notification(.error)
            }
        }
    }

}
