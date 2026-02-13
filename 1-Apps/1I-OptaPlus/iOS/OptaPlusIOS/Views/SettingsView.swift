//
//  SettingsView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var themeManager: ThemeManager = .shared
    @State private var showAddBot = false
    @State private var editingBot: BotConfig?
    @State private var fontScaleIndex: Double = 1

    var body: some View {
        NavigationStack {
            List {
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
                } header: {
                    Label("Bots", systemImage: "cpu")
                        .foregroundColor(.optaTextSecondary)
                }

                Section {
                    // Theme picker
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

                    // Font size
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Font Size — \(themeManager.fontScale.label)", systemImage: "textformat.size")
                            .foregroundColor(.optaTextSecondary)
                        Slider(value: $fontScaleIndex, in: 0...3, step: 1) {
                            Text("Font Size")
                        }
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

                    HStack {
                        Label("Reduce Motion", systemImage: "figure.walk")
                            .foregroundColor(.optaTextSecondary)
                        Spacer()
                        Text(UIAccessibility.isReduceMotionEnabled ? "On" : "Off")
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaSurface)
                } header: {
                    Label("Appearance", systemImage: "sparkles")
                        .foregroundColor(.optaTextSecondary)
                }

                Section {
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

                    HStack {
                        Label("Design System", systemImage: "paintpalette")
                            .foregroundColor(.optaTextSecondary)
                        Spacer()
                        Text("OptaMolt")
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaSurface)

                    NavigationLink {
                        AboutView()
                    } label: {
                        Label("About OptaPlus", systemImage: "info.circle.fill")
                            .foregroundColor(.optaPrimary)
                    }
                    .listRowBackground(Color.optaSurface)
                } header: {
                    Label("About OptaPlus", systemImage: "star.fill")
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

    private func connectionIndicator(for bot: BotConfig) -> some View {
        let vm = appState.viewModel(for: bot)
        return Circle()
            .fill(vm.connectionState == .connected ? Color.optaGreen :
                  vm.connectionState == .disconnected ? Color.optaTextMuted : Color.optaAmber)
            .frame(width: 8, height: 8)
    }
}

// MARK: - Bot Edit Sheet

struct BotEditSheet: View {
    let bot: BotConfig?
    let onSave: (BotConfig) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var host: String = ""
    @State private var port: String = ""
    @State private var token: String = ""
    @State private var emoji: String = "🤖"
    @State private var testResult: ConnectionTestResult = .idle

    private enum ConnectionTestResult {
        case idle, testing, success, failure(String)
    }

    private var isPortValid: Bool {
        guard let p = Int(port) else { return false }
        return p > 0 && p <= 65535
    }

    private var isHostValid: Bool {
        !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSave: Bool {
        !name.isEmpty && isHostValid && isPortValid
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Name", text: $name)
                    TextField("Emoji", text: $emoji)
                }

                Section {
                    TextField("Host", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    HStack {
                        TextField("Port", text: $port)
                            .keyboardType(.numberPad)
                        if !port.isEmpty && !isPortValid {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.optaAmber)
                                .font(.caption)
                        }
                    }
                    SecureField("Token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Connection")
                } footer: {
                    if !port.isEmpty && !isPortValid {
                        Text("Port must be 1–65535")
                            .font(.caption2)
                            .foregroundColor(.optaAmber)
                    }
                }

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
                        let p = Int(port) ?? 18793
                        let config = BotConfig(
                            id: bot?.id ?? UUID().uuidString,
                            name: name,
                            host: host,
                            port: p,
                            token: token,
                            emoji: emoji
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
                    port = String(bot.port)
                    token = bot.token
                    emoji = bot.emoji
                }
            }
        }
    }

    private func testConnection() {
        testResult = .testing
        let h = host.trimmingCharacters(in: .whitespacesAndNewlines)
        let p = Int(port) ?? 18793
        Task {
            do {
                let url = URL(string: "http://\(h):\(p)/health")!
                let (_, response) = try await URLSession.shared.data(from: url)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    testResult = .success
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } else {
                    testResult = .failure("Unexpected response")
                    UINotificationFeedbackGenerator().notificationOccurred(.error)
                }
            } catch {
                testResult = .failure(error.localizedDescription)
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }
}
