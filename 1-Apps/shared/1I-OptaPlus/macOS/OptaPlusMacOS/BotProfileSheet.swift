//
//  BotProfileSheet.swift
//  OptaPlusMacOS
//
//  Bot profile detail sheet — glass card with animated glow,
//  connection info, session stats, and accent color tinting.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Bot Profile Sheet

struct BotProfileSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) var dismiss

    private var bot: BotConfig { viewModel.botConfig }

    private var accentColor: Color {
        botAccentColor(for: bot)
    }

    private var connectionLabel: String {
        switch viewModel.connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Disconnected"
        }
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaRed
        }
    }

    private var sessionUptime: String {
        guard viewModel.connectionState == .connected else { return "—" }
        // Approximate from first message in current session
        guard let first = viewModel.messages.first else { return "Just started" }
        let interval = Date().timeIntervalSince(first.timestamp)
        if interval < 60 { return "\(Int(interval))s" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        return "\(Int(interval / 3600))h \(Int((interval.truncatingRemainder(dividingBy: 3600)) / 60))m"
    }

    private var messagesSent: Int {
        viewModel.messages.filter { if case .user = $0.sender { return true }; return false }.count
    }

    private var messagesReceived: Int {
        viewModel.messages.filter { if case .bot = $0.sender { return true }; return false }.count
    }

    private var lastMessageTime: String {
        guard let last = viewModel.messages.last else { return "—" }
        return last.timestamp.formatted(date: .omitted, time: .shortened)
    }

    @State private var emojiGlow: CGFloat = 0
    @State private var appeared = false

    // Config editing state
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

    var body: some View {
        VStack(spacing: 0) {
            // Header with large emoji
            VStack(spacing: 16) {
                ZStack {
                    // Animated glow ring
                    Circle()
                        .fill(accentColor.opacity(0.15 + 0.1 * emojiGlow))
                        .frame(width: 100, height: 100)
                        .blur(radius: 20)

                    Circle()
                        .fill(accentColor.opacity(0.08))
                        .frame(width: 80, height: 80)

                    Text(bot.emoji)
                        .font(.system(size: 44))
                }
                .shadow(color: accentColor.opacity(0.4), radius: 20 + 10 * emojiGlow)
                .onAppear {
                    withAnimation(.optaPulse) {
                        emojiGlow = 1
                    }
                }

                Text(bot.name)
                    .font(.sora(22, weight: .bold))
                    .foregroundColor(.optaTextPrimary)

                Text("\(bot.host):\(bot.port)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.top, 28)
            .padding(.bottom, 20)

            // Connection status pill
            HStack(spacing: 6) {
                Circle()
                    .fill(connectionColor)
                    .frame(width: 8, height: 8)
                    .shadow(color: connectionColor.opacity(0.6), radius: 4)

                Text(connectionLabel)
                    .font(.sora(12, weight: .medium))
                    .foregroundColor(connectionColor)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(connectionColor.opacity(0.1))
            )
            .overlay(
                Capsule()
                    .stroke(connectionColor.opacity(0.2), lineWidth: 0.5)
            )
            .padding(.bottom, 20)

            // Active session info
            if let session = viewModel.activeSession {
                HStack(spacing: 8) {
                    Image(systemName: session.mode.icon)
                        .font(.system(size: 11))
                        .foregroundColor(sessionModeColor(session.mode))
                    Text(session.name)
                        .font(.sora(12, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                    Text("·")
                        .foregroundColor(.optaTextMuted)
                    Text(session.mode.label)
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }
                .padding(.bottom, 16)
            }

            // Stats section — glass card
            VStack(spacing: 12) {
                Text("SESSION STATS")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Gradient divider
                LinearGradient(
                    colors: [.clear, accentColor.opacity(0.2), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(height: 1)

                HStack(spacing: 0) {
                    StatCell(label: "Sent", value: "\(messagesSent)", color: .optaPrimary)
                    Spacer()
                    StatCell(label: "Received", value: "\(messagesReceived)", color: accentColor)
                    Spacer()
                    StatCell(label: "Uptime", value: sessionUptime, color: .optaGreen)
                }

                HStack {
                    Text("Last message")
                        .font(.sora(10))
                        .foregroundColor(.optaTextMuted)
                    Spacer()
                    Text(lastMessageTime)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextSecondary)
                }
                .padding(.top, 4)

                // Persistent stats
                let stats = viewModel.stats
                if stats.totalSent > 0 || stats.totalReceived > 0 {
                    LinearGradient(
                        colors: [.clear, accentColor.opacity(0.15), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                    .padding(.top, 4)

                    Text("ALL TIME")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)

                    HStack(spacing: 0) {
                        StatCell(label: "Total Sent", value: "\(stats.totalSent)", color: .optaPrimary)
                        Spacer()
                        StatCell(label: "Total Recv", value: "\(stats.totalReceived)", color: accentColor)
                        Spacer()
                        StatCell(label: "Avg Response", value: stats.formattedAvgResponseTime, color: .optaGreen)
                    }

                    HStack(spacing: 0) {
                        StatCell(label: "Streak", value: "\(stats.longestStreak)d", color: .optaAmber)
                        Spacer()
                        StatCell(label: "Peak Hour", value: stats.formattedMostActiveTime, color: .optaBlue)
                        Spacer()
                        StatCell(label: "", value: "", color: .clear)
                    }
                }
            }
            .padding(16)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.optaSurface.opacity(0.5))
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Accent tint
                    RoundedRectangle(cornerRadius: 16)
                        .fill(accentColor.opacity(0.03))
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [accentColor.opacity(0.15), Color.optaBorder.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.5
                    )
            )
            .padding(.horizontal, 24)

            // Config editing sections
            if !isLoadingConfig {
                VStack(spacing: 12) {
                    // Health status
                    if let health = healthStatus {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(health.status == "ok" ? Color.optaGreen : Color.optaAmber)
                                .frame(width: 6, height: 6)
                            Text("v\(health.version)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Text(OptaFormatting.formatUptime(health.uptime))
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                    }

                    // Model picker
                    if !availableModels.isEmpty {
                        HStack {
                            Text("Model")
                                .font(.sora(11, weight: .medium))
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            Picker("", selection: $selectedModel) {
                                ForEach(availableModels) { model in
                                    Text(model.name ?? model.id)
                                        .tag(model.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: 180)
                        }
                    }

                    // Thinking level
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Thinking")
                            .font(.sora(11, weight: .medium))
                            .foregroundColor(.optaTextSecondary)
                        Picker("", selection: $thinkingLevel) {
                            Text("Off").tag("off")
                            Text("Low").tag("low")
                            Text("High").tag("high")
                            Text("Stream").tag("stream")
                        }
                        .pickerStyle(.segmented)
                    }

                    // Action buttons
                    HStack(spacing: 8) {
                        Button(action: { applyConfig() }) {
                            Text(isApplying ? "Applying…" : "Apply")
                                .font(.sora(11, weight: .medium))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(accentColor)
                        .disabled(!hasConfigChanges || isApplying)
                        .accessibilityLabel(isApplying ? "Applying configuration" : "Apply configuration changes")

                        Button(action: { compactContext() }) {
                            Text("Compact")
                                .font(.sora(11, weight: .medium))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityLabel("Compact context")
                        .accessibilityHint("Compresses the current session context")

                        Button(role: .destructive, action: { showRestartConfirm = true }) {
                            Text("Restart")
                                .font(.sora(11, weight: .medium))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityLabel("Restart gateway")
                    }
                    .padding(.top, 4)

                    if let error = configError {
                        Text(error)
                            .font(.sora(10))
                            .foregroundColor(.optaRed)
                            .lineLimit(2)
                    }
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.optaSurface.opacity(0.5))
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.optaBorder.opacity(0.1), lineWidth: 0.5)
                )
                .padding(.horizontal, 24)
                .padding(.top, 12)
            } else if viewModel.isGatewayReady {
                ProgressView()
                    .scaleEffect(0.7)
                    .padding(.top, 12)
            }

            Spacer()

            // Close button
            Button("Done") { dismiss() }
                .keyboardShortcut(.cancelAction)
                .padding(.bottom, 20)
        }
        .frame(width: 360, height: 620)
        .confirmationDialog("Restart Gateway?", isPresented: $showRestartConfirm) {
            Button("Restart", role: .destructive) { restartGateway() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will restart the bot's gateway with the current configuration.")
        }
        .background(
            ZStack {
                Color.optaVoid

                // Accent gradient at top
                VStack {
                    RadialGradient(
                        colors: [accentColor.opacity(0.06), .clear],
                        center: .top,
                        startRadius: 0,
                        endRadius: 200
                    )
                    .frame(height: 200)
                    Spacer()
                }
            }
        )
        .preferredColorScheme(.dark)
        .opacity(appeared ? 1 : 0)
        .scaleEffect(appeared ? 1 : 0.95)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                appeared = true
            }
        }
        .task {
            await loadBotConfig()
        }
    }

    // MARK: - Config Management

    private var hasConfigChanges: Bool {
        selectedModel != currentModel || thinkingLevel != "off"
    }

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
                SoundManager.shared.play(.sendMessage)
                currentModel = selectedModel
            } catch {
                configError = error.localizedDescription
                SoundManager.shared.play(.error)
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
                SoundManager.shared.play(.sendMessage)
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
                    "note": "Restart from OptaPlus"
                ] as [String: Any])
                SoundManager.shared.play(.sendMessage)
                await loadBotConfig()
            } catch {
                configError = error.localizedDescription
                SoundManager.shared.play(.error)
            }
        }
    }

}

// MARK: - Stat Cell

private struct StatCell: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundColor(color)
            Text(label)
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
        }
        .frame(minWidth: 60)
    }
}
