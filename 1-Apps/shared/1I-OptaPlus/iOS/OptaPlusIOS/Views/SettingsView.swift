//
//  SettingsView.swift
//  OptaPlusIOS
//
//  Refactored settings — picker-first philosophy, no debug overlap.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct SettingsView: View {
    var isModal: Bool = true

    @EnvironmentObject var appState: AppState
    @ObservedObject var themeManager: ThemeManager = .shared
    @State private var showAddBot = false
    @State private var editingBot: BotConfig?
    @State private var fontScaleIndex: Double = 1
    @AppStorage("optaplus.deviceName") private var deviceName = "iPhone"
    @AppStorage("optaplus.deviceEmoji") private var deviceEmoji = ""
    @AppStorage("optaplus.biometricLock") private var biometricLock = false
    @AppStorage("optaplus.privacyMode") private var privacyMode = false
    @AppStorage("optaplus.notifications") private var notificationsEnabled = true
    @AppStorage("optaplus.sounds") private var soundsEnabled = true
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Bot Management
                Section {
                    ForEach(appState.bots) { bot in
                        Button {
                            editingBot = bot
                        } label: {
                            HStack(spacing: 12) {
                                Text(bot.emoji)
                                    .font(.title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(bot.name)
                                        .font(.body)
                                        .foregroundColor(.optaTextPrimary)
                                    Text("\(bot.host):\(bot.port)")
                                        .font(.caption)
                                        .foregroundColor(.optaTextMuted)
                                }
                                Spacer()
                                connectionIndicator(for: bot)
                            }
                        }
                        .listRowBackground(Color.optaSurface)
                        .accessibilityLabel("\(bot.emoji) \(bot.name)")
                        .accessibilityValue("\(bot.host):\(bot.port)")
                        .accessibilityHint("Double-tap to edit bot settings")
                    }
                    .onDelete { indexSet in
                        for idx in indexSet {
                            appState.removeBot(id: appState.bots[idx].id)
                        }
                    }

                    Button {
                        showAddBot = true
                    } label: {
                        Label("Add Bot", systemImage: "plus.circle.fill")
                            .foregroundColor(.optaPrimary)
                    }
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Add bot")
                    .accessibilityHint("Opens a form to add a new bot connection")
                } header: {
                    Label("Bots", systemImage: "cpu")
                        .foregroundColor(.optaTextSecondary)
                }

                // Device Identity
                Section {
                    TextField("Device Name", text: $deviceName)
                        .textInputAutocapitalization(.words)
                        .listRowBackground(Color.optaSurface)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Device Emoji")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 8) {
                            ForEach(deviceEmojiOptions, id: \.self) { e in
                                Button {
                                    deviceEmoji = (deviceEmoji == e) ? "" : e
                                } label: {
                                    Text(e)
                                        .font(.title2)
                                        .frame(width: 40, height: 40)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(deviceEmoji == e ? Color.optaPrimary.opacity(0.2) : Color.clear)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(deviceEmoji == e ? Color.optaPrimary : Color.clear, lineWidth: 2)
                                        )
                                }
                                .accessibilityLabel("Device emoji \(e)")
                                .accessibilityValue(deviceEmoji == e ? "Selected" : "Not selected")
                            }
                        }
                    }
                    .listRowBackground(Color.optaSurface)
                } header: {
                    Label("Device Identity", systemImage: "iphone")
                        .foregroundColor(.optaTextSecondary)
                } footer: {
                    Text("Messages sent from this device will be tagged with this name and emoji.")
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                }

                // Appearance
                Section {
                    // Theme
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Theme", systemImage: "paintbrush.fill")
                            .foregroundColor(.optaTextSecondary)
                        Picker("Theme", selection: Binding(
                            get: { themeManager.currentTheme.id },
                            set: { id in
                                if let theme = AppTheme.allBuiltIn.first(where: { $0.id == id }) {
                                    themeManager.currentTheme = theme
                                }
                            }
                        )) {
                            ForEach(AppTheme.allBuiltIn) { theme in
                                Text(theme.name).tag(theme.id)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(Color.optaSurface)

                    // Custom accent
                    ColorPicker(selection: Binding(
                        get: { themeManager.customAccentColor ?? themeManager.currentTheme.accentColor },
                        set: { themeManager.customAccentColor = $0 }
                    ), supportsOpacity: false) {
                        Label("Custom Accent", systemImage: "paintpalette")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .listRowBackground(Color.optaSurface)

                    if themeManager.customAccentColor != nil {
                        Button("Reset Accent Color") {
                            themeManager.customAccentColor = nil
                        }
                        .foregroundColor(.optaRed)
                        .listRowBackground(Color.optaSurface)
                    }

                    // Font scale slider
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Font Size — \(themeManager.fontScale.label)", systemImage: "textformat.size")
                            .foregroundColor(.optaTextSecondary)
                        Slider(value: $fontScaleIndex, in: 0...3, step: 1) {
                            Text("Font Size")
                        }
                        .accessibilityLabel("Font size")
                        .accessibilityValue(themeManager.fontScale.label)
                        .onChange(of: fontScaleIndex) { _, newVal in
                            themeManager.fontScale = FontScale(index: newVal)
                        }
                    }
                    .listRowBackground(Color.optaSurface)

                    // Chat density
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Chat Density", systemImage: "line.3.horizontal")
                            .foregroundColor(.optaTextSecondary)
                        Picker("Density", selection: $themeManager.chatDensity) {
                            ForEach(ChatDensity.allCases, id: \.self) { d in
                                Text(d.label).tag(d)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(Color.optaSurface)

                    // Background mode
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Ambient Background", systemImage: "sparkles")
                            .foregroundColor(.optaTextSecondary)
                        Picker("Background", selection: $themeManager.backgroundMode) {
                            ForEach(BackgroundMode.allCases, id: \.self) { mode in
                                Text(mode.label).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(Color.optaSurface)

                    // Sounds toggle
                    Toggle(isOn: $soundsEnabled) {
                        Label("Sounds", systemImage: "speaker.wave.2")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Sounds")
                    .accessibilityValue(soundsEnabled ? "On" : "Off")
                    .accessibilityHint("Double-tap to toggle interface sounds")
                } header: {
                    Label("Appearance", systemImage: "sparkles")
                        .foregroundColor(.optaTextSecondary)
                }

                // Notifications
                Section {
                    Toggle(isOn: $notificationsEnabled) {
                        Label("Notifications", systemImage: "bell.fill")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Notifications")
                    .accessibilityValue(notificationsEnabled ? "On" : "Off")
                    .accessibilityHint("Double-tap to toggle push notifications")
                } header: {
                    Label("Notifications", systemImage: "bell")
                        .foregroundColor(.optaTextSecondary)
                }

                // Privacy & Security
                Section {
                    Toggle(isOn: $biometricLock) {
                        Label("Biometric Lock", systemImage: "faceid")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Biometric Lock")
                    .accessibilityValue(biometricLock ? "On" : "Off")
                    .accessibilityHint("Double-tap to toggle Face ID or Touch ID lock")

                    Toggle(isOn: $privacyMode) {
                        Label("Privacy Mode", systemImage: "eye.slash")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .tint(.optaPrimary)
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Privacy Mode")
                    .accessibilityValue(privacyMode ? "On" : "Off")
                    .accessibilityHint("Double-tap to toggle message content hiding")
                } header: {
                    Label("Privacy & Security", systemImage: "lock.shield")
                        .foregroundColor(.optaTextSecondary)
                }

                // Diagnostics & About
                Section {
                    NavigationLink {
                        DebugView()
                            .environmentObject(appState)
                    } label: {
                        HStack {
                            Label("Gateway Diagnostics", systemImage: "ant")
                                .foregroundColor(.optaTextSecondary)
                            Spacer()
                            if let bot = appState.selectedBot,
                               appState.viewModel(for: bot).connectionState == .connected {
                                Circle()
                                    .fill(Color.optaGreen)
                                    .frame(width: 6, height: 6)
                            }
                        }
                    }
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("Gateway Diagnostics")
                    .accessibilityHint("View health, connectivity, sessions, and node information")

                    NavigationLink {
                        AboutView()
                    } label: {
                        Label("About OptaPlus", systemImage: "info.circle.fill")
                            .foregroundColor(.optaPrimary)
                    }
                    .listRowBackground(Color.optaSurface)
                    .accessibilityLabel("About OptaPlus")
                    .accessibilityHint("View app information, links, and statistics")

                    HStack {
                        Label("Version", systemImage: "info.circle")
                            .foregroundColor(.optaTextSecondary)
                        Spacer()
                        Text("0.1.0")
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaSurface)

                    HStack {
                        Label("Build", systemImage: "hammer")
                            .foregroundColor(.optaTextSecondary)
                        Spacer()
                        Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1")
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaSurface)
                } header: {
                    Label("More", systemImage: "ellipsis.circle")
                        .foregroundColor(.optaTextSecondary)
                } footer: {
                    Text("OptaPlus — Premium AI Chat Client")
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle("Settings")
            .toolbar {
                if isModal {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
            }
            .sheet(isPresented: $showAddBot) {
                BotEditSheet(bot: nil) { newBot in
                    appState.addBot(newBot)
                }
            }
            .sheet(item: $editingBot) { bot in
                BotEditSheet(bot: bot) { updated in
                    appState.updateBot(updated)
                }
            }
            .onAppear {
                fontScaleIndex = themeManager.fontScale.index
            }
        }
    }

    private let deviceEmojiOptions = ["📱", "💻", "🖥️", "⌚", "🎧", "🎮", "📡", "🏠", "🏢", "🚀", "⚡", "🔮"]

    private func connectionIndicator(for bot: BotConfig) -> some View {
        let vm = appState.viewModel(for: bot)
        return Circle()
            .fill(vm.connectionState == .connected ? Color.optaGreen :
                  vm.connectionState == .disconnected ? Color.optaTextMuted : Color.optaAmber)
            .frame(width: 8, height: 8)
            .accessibilityLabel("Connection status")
            .accessibilityValue(vm.connectionState == .connected ? "Connected" : vm.connectionState == .disconnected ? "Disconnected" : "Connecting")
    }
}

// MARK: - Bot Edit Sheet (Picker-First)

struct BotEditSheet: View {
    let bot: BotConfig?
    let onSave: (BotConfig) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var host: String = ""
    @State private var port: Int = 18793
    @State private var token: String = ""
    @State private var emoji: String = "🤖"
    @State private var remoteURL: String = ""
    @State private var connectionMode: BotConfig.ConnectionMode = .auto
    @State private var testResult: ConnectionTestResult = .idle

    private let emojiOptions = ["🥷🏿", "🟢", "🟣", "🧪", "🔵", "⚡", "🤖", "🦊", "🔥", "💎", "🌟", "🎯"]

    private enum ConnectionTestResult {
        case idle, testing, success, failure(String)
    }

    private var isHostValid: Bool {
        !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSave: Bool {
        !name.isEmpty && isHostValid && port > 0 && port <= 65535
    }

    var body: some View {
        NavigationStack {
            Form {
                // Identity
                Section("Identity") {
                    TextField("Name", text: $name)

                    // Emoji grid picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Emoji")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 8) {
                            ForEach(emojiOptions, id: \.self) { e in
                                Button {
                                    emoji = e
                                } label: {
                                    Text(e)
                                        .font(.title2)
                                        .frame(width: 40, height: 40)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(emoji == e ? Color.optaPrimary.opacity(0.2) : Color.clear)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(emoji == e ? Color.optaPrimary : Color.clear, lineWidth: 2)
                                        )
                                }
                                .accessibilityLabel("Bot emoji \(e)")
                                .accessibilityValue(emoji == e ? "Selected" : "Not selected")
                            }
                        }
                    }
                }

                // Connection
                Section {
                    TextField("Host", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Stepper("Port: \(port)", value: $port, in: 1024...65535)

                    SecureField("Token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Connection")
                }

                // Remote Access
                Section {
                    TextField("Remote URL (wss://...)", text: $remoteURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))

                    Picker("Connection Mode", selection: $connectionMode) {
                        Text("Auto").tag(BotConfig.ConnectionMode.auto)
                        Text("LAN").tag(BotConfig.ConnectionMode.lan)
                        Text("Remote").tag(BotConfig.ConnectionMode.remote)
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Remote Access")
                } footer: {
                    Text("Auto tries LAN first, then falls back to the remote URL.")
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                }

                // Test
                Section("Test") {
                    Button {
                        testConnection()
                    } label: {
                        HStack {
                            Label("Test Connection", systemImage: "bolt.fill")
                            Spacer()
                            switch testResult {
                            case .idle:
                                EmptyView()
                            case .testing:
                                ProgressView()
                                    .tint(.optaPrimary)
                            case .success:
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.optaGreen)
                            case .failure:
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.optaRed)
                            }
                        }
                    }
                    .disabled(!canSave)
                    .accessibilityLabel("Test connection")
                    .accessibilityHint("Tests connectivity to the bot gateway")

                    if case .failure(let msg) = testResult {
                        Text(msg)
                            .font(.caption)
                            .foregroundColor(.optaRed)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle(bot == nil ? "Add Bot" : "Edit Bot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let config = BotConfig(
                            id: bot?.id ?? UUID().uuidString,
                            name: name,
                            host: host,
                            port: port,
                            token: token,
                            emoji: emoji,
                            remoteURL: remoteURL.isEmpty ? nil : remoteURL,
                            connectionMode: connectionMode
                        )
                        onSave(config)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
            .onAppear {
                if let bot = bot {
                    name = bot.name
                    host = bot.host
                    port = bot.port
                    token = bot.token
                    emoji = bot.emoji
                    remoteURL = bot.remoteURL ?? ""
                    connectionMode = bot.connectionMode
                }
            }
        }
    }

    private func testConnection() {
        testResult = .testing
        let h = host.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                guard let url = URL(string: "http://\(h):\(port)/health") else {
                    testResult = .failure("Invalid URL")
                    return
                }
                let (_, response) = try await URLSession.shared.data(from: url)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    testResult = .success
                    HapticManager.shared.notification(.success)
                } else {
                    testResult = .failure("Unexpected response")
                    HapticManager.shared.notification(.error)
                }
            } catch {
                testResult = .failure(error.localizedDescription)
                HapticManager.shared.notification(.error)
            }
        }
    }
}
