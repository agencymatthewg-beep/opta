//
//  SettingsViews.swift
//  OptaPlusMacOS
//
//  Settings views: General, Bots, Telegram, theme picker.
//  Extracted from ContentView.swift for maintainability.
//

import SwiftUI
import OptaMolt

// MARK: - Validation Helpers

enum FieldValidation {
    case valid
    case invalid(String)
    
    var isValid: Bool {
        if case .valid = self { return true }
        return false
    }
    
    var errorMessage: String? {
        if case .invalid(let msg) = self { return msg }
        return nil
    }
}

func validateHostname(_ host: String) -> FieldValidation {
    let trimmed = host.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { return .invalid("Hostname is required") }
    if trimmed.contains(" ") { return .invalid("Hostname cannot contain spaces") }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: ".-_"))
    if trimmed.unicodeScalars.contains(where: { !allowed.contains($0) }) {
        return .invalid("Invalid characters in hostname")
    }
    return .valid
}

func validatePort(_ port: String) -> FieldValidation {
    let trimmed = port.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { return .invalid("Port is required") }
    guard let portNum = Int(trimmed) else { return .invalid("Port must be a number") }
    if portNum < 1 || portNum > 65535 { return .invalid("Port must be 1–65535") }
    return .valid
}

struct LabeledField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    var validation: FieldValidation?
    
    init(_ label: String, text: Binding<String>, placeholder: String, validation: FieldValidation? = nil) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.validation = validation
    }
    
    private var hasError: Bool {
        if case .invalid = validation { return true }
        return false
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.sora(11, weight: .medium))
                .foregroundColor(.optaTextMuted)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.sora(13))
                .foregroundColor(.optaTextPrimary)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaElevated)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(hasError ? Color.optaRed.opacity(0.6) : Color.optaBorder, lineWidth: 1)
                )
            
            if let errorMsg = validation?.errorMessage {
                Text(errorMsg)
                    .font(.sora(10))
                    .foregroundColor(.optaRed)
                    .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.2), value: hasError)
    }
}


// MARK: - Settings View

struct SettingsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            BotsSettingsView()
                .environmentObject(appState)
                .tabItem {
                    Label("Bots", systemImage: "cpu")
                }

            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }

            TelegramSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label("Telegram", systemImage: "paperplane")
                }
        }
        .frame(width: 500, height: 450)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Telegram Settings Tab

struct TelegramSettingsTab: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        // Telegram sync requires TDLibKit — show placeholder until integrated
        VStack(spacing: 16) {
            Image(systemName: "paperplane")
                .font(.system(size: 32))
                .foregroundColor(.optaTextMuted)

            Text("Telegram Sync")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextSecondary)

            Text("Bidirectional Telegram sync is planned but requires TDLibKit integration.\nMessages sent from OptaPlus will be relayed by the bot.")
                .font(.sora(12))
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct BotsSettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedBotId: String?
    
    var body: some View {
        HStack(spacing: 0) {
            List(selection: $selectedBotId) {
                ForEach(appState.bots) { bot in
                    HStack {
                        Text(bot.emoji)
                        Text(bot.name)
                            .font(.sora(13))
                    }
                    .tag(bot.id)
                }
            }
            .frame(width: 160)
            
            Divider()
            
            if let botId = selectedBotId,
               let bot = appState.bots.first(where: { $0.id == botId }) {
                BotDetailEditor(bot: bot) { updated in
                    appState.updateBot(updated)
                }
                .padding()
            } else {
                Text("Select a bot to edit")
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

// MARK: - Connection Test State

enum ConnectionTestResult {
    case idle
    case testing
    case success
    case failure(String)
}

struct BotDetailEditor: View {
    let bot: BotConfig
    let onSave: (BotConfig) -> Void

    @State private var name: String
    @State private var host: String
    @State private var port: String
    @State private var token: String
    @State private var emoji: String
    @State private var remoteURL: String
    @State private var connectionMode: BotConfig.ConnectionMode
    @State private var testResult: ConnectionTestResult = .idle
    @ObservedObject private var themeManager = ThemeManager.shared
    @State private var botAccentColorBinding: Color = .optaPrimary
    @State private var hasBotAccentOverride: Bool = false

    init(bot: BotConfig, onSave: @escaping (BotConfig) -> Void) {
        self.bot = bot
        self.onSave = onSave
        _name = State(initialValue: bot.name)
        _host = State(initialValue: bot.host)
        _port = State(initialValue: String(bot.port))
        _token = State(initialValue: bot.token)
        _emoji = State(initialValue: bot.emoji)
        _remoteURL = State(initialValue: bot.remoteURL ?? "")
        _connectionMode = State(initialValue: bot.connectionMode)
    }
    
    private var hostValidation: FieldValidation { validateHostname(host) }
    private var portValidation: FieldValidation { validatePort(port) }
    private var isFormValid: Bool {
        !name.isEmpty && hostValidation.isValid && portValidation.isValid
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LabeledField("Name", text: $name, placeholder: "Bot name")
            LabeledField("Host", text: $host, placeholder: "127.0.0.1", validation: hostValidation)
            LabeledField("Port", text: $port, placeholder: "18793", validation: portValidation)
            LabeledField("Token", text: $token, placeholder: "Auth token")
            LabeledField("Emoji", text: $emoji, placeholder: "🤖")

            // Remote access
            VStack(alignment: .leading, spacing: 8) {
                Text("REMOTE ACCESS")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                LabeledField("Remote URL", text: $remoteURL, placeholder: "wss://gateway.optamize.biz")

                Picker("Connection Mode", selection: $connectionMode) {
                    Text("Auto (LAN preferred)").tag(BotConfig.ConnectionMode.auto)
                    Text("LAN Only").tag(BotConfig.ConnectionMode.lan)
                    Text("Remote Only").tag(BotConfig.ConnectionMode.remote)
                }
                .pickerStyle(.segmented)
            }

            // Bot accent color
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Accent Color")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                    Spacer()
                    if hasBotAccentOverride {
                        Button("Reset") {
                            themeManager.clearBotAccent(forBotId: bot.id)
                            hasBotAccentOverride = false
                            botAccentColorBinding = botAccentColor(for: bot)
                        }
                        .font(.sora(10))
                        .foregroundColor(.optaTextMuted)
                        .buttonStyle(.plain)
                    }
                }
                ColorPicker("", selection: $botAccentColorBinding, supportsOpacity: false)
                    .labelsHidden()
                    .onChange(of: botAccentColorBinding) { _, newColor in
                        themeManager.setBotAccent(newColor, forBotId: bot.id)
                        hasBotAccentOverride = true
                    }
            }
            .onAppear {
                hasBotAccentOverride = themeManager.botAccentOverrides[bot.id] != nil
                botAccentColorBinding = botAccentColor(for: bot)
            }

            // Connection test
            HStack(spacing: 10) {
                Button(action: testConnection) {
                    HStack(spacing: 6) {
                        if case .testing = testResult {
                            OptaLoader(size: 14, lineWidth: 1.5)
                        } else {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                                .font(.system(size: 12))
                        }
                        Text("Test Connection")
                            .font(.sora(12, weight: .medium))
                    }
                    .foregroundColor(.optaTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaElevated)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.optaBorder, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(!hostValidation.isValid || !portValidation.isValid || {
                    if case .testing = testResult { return true }
                    return false
                }())
                
                switch testResult {
                case .idle:
                    EmptyView()
                case .testing:
                    EmptyView()
                case .success:
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.optaGreen)
                            .font(.system(size: 14))
                        Text("Connected")
                            .font(.sora(11))
                            .foregroundColor(.optaGreen)
                    }
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                case .failure(let error):
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.optaRed)
                            .font(.system(size: 14))
                        Text(error)
                            .font(.sora(11))
                            .foregroundColor(.optaRed)
                            .lineLimit(1)
                    }
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: {
                switch testResult {
                case .idle: return 0
                case .testing: return 1
                case .success: return 2
                case .failure: return 3
                }
            }())
            
            Spacer()
            
            HStack {
                Spacer()
                Button("Save") {
                    let updated = BotConfig(
                        id: bot.id,
                        name: name,
                        host: host,
                        port: Int(port) ?? bot.port,
                        token: token,
                        emoji: emoji,
                        sessionKey: bot.sessions.first?.sessionKey ?? "main",
                        remoteURL: remoteURL.isEmpty ? nil : remoteURL,
                        connectionMode: connectionMode
                    )
                    onSave(updated)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isFormValid)
            }
        }
    }
    
    private func testConnection() {
        testResult = .testing
        let testHost = host
        let testPort = Int(port) ?? 0
        
        Task {
            do {
                guard let url = URL(string: "ws://\(testHost):\(testPort)") else {
                    testResult = .failure("Invalid URL")
                    return
                }
                let session = URLSession(configuration: .default)
                let task = session.webSocketTask(with: url)
                task.resume()
                
                // Try to receive a message within 5 seconds
                let _ = try await withThrowingTaskGroup(of: Bool.self) { group in
                    group.addTask {
                        // Try receiving a message (the gateway sends hello)
                        let _ = try await task.receive()
                        return true
                    }
                    group.addTask {
                        try await Task.sleep(nanoseconds: 5_000_000_000)
                        throw URLError(.timedOut)
                    }
                    let result = try await group.next()!
                    group.cancelAll()
                    return result
                }
                
                task.cancel(with: .goingAway, reason: nil)
                await MainActor.run { testResult = .success }
            } catch {
                await MainActor.run {
                    let msg = error.localizedDescription
                    testResult = .failure(msg.count > 40 ? String(msg.prefix(40)) + "…" : msg)
                }
            }
        }
    }
}

struct GeneralSettingsView: View {
    @EnvironmentObject var animPrefs: AnimationPreferences
    @ObservedObject var themeManager: ThemeManager = .shared
    @AppStorage("optaplus.textAlignment") private var textAlignment: String = MessageTextAlignment.centeredExpanding.rawValue
    @AppStorage("optaplus.deviceName") private var deviceName = "MacBook"
    @AppStorage("optaplus.deviceEmoji") private var deviceEmoji = ""

    @State private var fontScaleIndex: Double = 1
    @State private var showCustomAccent = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }
    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // About section
                VStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [themeManager.effectiveAccent, themeManager.currentTheme.accentGlow],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("OptaPlus")
                        .font(.sora(18, weight: .bold))
                        .foregroundColor(.optaTextPrimary)

                    Text("v\(appVersion) (\(buildNumber))")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Text("Native OpenClaw chat client")
                        .font(.sora(13))
                        .foregroundColor(.optaTextSecondary)
                }

                Divider().background(Color.optaBorder)

                // Device Identity
                VStack(alignment: .leading, spacing: 8) {
                    Text("DEVICE IDENTITY")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    LabeledField("Device Name", text: $deviceName, placeholder: "MacBook")

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Device Emoji")
                            .font(.sora(11, weight: .medium))
                            .foregroundColor(.optaTextMuted)
                        HStack(spacing: 6) {
                            ForEach(["📱", "💻", "🖥️", "⌚", "🎧", "🎮", "📡", "🏠", "🏢", "🚀", "⚡", "🔮"], id: \.self) { e in
                                DeviceEmojiButton(emoji: e, isSelected: deviceEmoji == e) {
                                    deviceEmoji = (deviceEmoji == e) ? "" : e
                                }
                            }
                        }
                    }

                    Text("Messages will be tagged with this name and emoji so bots know the source device.")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Theme picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("THEME")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    HStack(spacing: 8) {
                        ForEach(AppTheme.allBuiltIn) { theme in
                            ThemePreviewCard(
                                theme: theme,
                                isSelected: themeManager.currentTheme.id == theme.id,
                                onTap: { themeManager.currentTheme = theme }
                            )
                        }
                    }
                }

                // Custom accent color
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("CUSTOM ACCENT")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        Spacer()

                        if themeManager.customAccentColor != nil {
                            Button("Reset") {
                                themeManager.customAccentColor = nil
                            }
                            .font(.sora(10, weight: .medium))
                            .foregroundColor(.optaTextMuted)
                            .buttonStyle(.plain)
                        }
                    }

                    ColorPicker(
                        "Accent Color",
                        selection: Binding(
                            get: { themeManager.customAccentColor ?? themeManager.currentTheme.accentColor },
                            set: { themeManager.customAccentColor = $0 }
                        ),
                        supportsOpacity: false
                    )
                    .font(.sora(12))
                    .foregroundColor(.optaTextSecondary)

                    Text("Override the theme's accent color with any color you choose.")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Font scale
                VStack(alignment: .leading, spacing: 8) {
                    Text("FONT SIZE")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    HStack {
                        Text("A")
                            .font(.sora(10))
                            .foregroundColor(.optaTextMuted)
                        Slider(value: $fontScaleIndex, in: 0...3, step: 1)
                            .onChange(of: fontScaleIndex) { _, newVal in
                                themeManager.fontScale = FontScale(index: newVal)
                            }
                        Text("A")
                            .font(.sora(18, weight: .bold))
                            .foregroundColor(.optaTextMuted)
                    }

                    Text(themeManager.fontScale.label)
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                }

                // Chat density
                VStack(alignment: .leading, spacing: 8) {
                    Text("CHAT DENSITY")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Density", selection: $themeManager.chatDensity) {
                        ForEach(ChatDensity.allCases, id: \.self) { density in
                            Text(density.label).tag(density)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text("Affects message spacing and bubble size.")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Background mode
                VStack(alignment: .leading, spacing: 8) {
                    Text("AMBIENT BACKGROUND")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Background", selection: $themeManager.backgroundMode) {
                        ForEach(BackgroundMode.allCases, id: \.self) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text(backgroundModeDescription)
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }

                Divider().background(Color.optaBorder)

                // Animation level picker
                AnimationLevelPicker(prefs: animPrefs)

                Divider().background(Color.optaBorder)

                // Text alignment picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("MESSAGE ALIGNMENT")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)

                    Picker("Alignment", selection: $textAlignment) {
                        ForEach(MessageTextAlignment.allCases, id: \.rawValue) { alignment in
                            Text(alignment.label).tag(alignment.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text("Controls how chat messages are positioned in the window.")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            fontScaleIndex = themeManager.fontScale.index
        }
    }

    private var backgroundModeDescription: String {
        switch themeManager.backgroundMode {
        case .on: return "Full ambient particles and gradient orbs."
        case .off: return "Pure void background — saves GPU."
        case .subtle: return "Reduced particles and orb opacity."
        }
    }
}

// MARK: - Theme Preview Card

struct ThemePreviewCard: View {
    let theme: AppTheme
    let isSelected: Bool
    let onTap: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(theme.backgroundColor)
                    .frame(height: 40)
                    .overlay(
                        Circle()
                            .fill(theme.accentColor)
                            .frame(width: 14, height: 14)
                            .shadow(color: theme.accentColor.opacity(isHovered ? 0.8 : 0.6), radius: isHovered ? 8 : 6)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(isSelected ? theme.accentColor : (isHovered ? Color.optaTextMuted.opacity(0.3) : Color.optaBorder), lineWidth: isSelected ? 2 : (isHovered ? 1 : 0.5))
                    )

                Text(theme.name)
                    .font(.sora(10, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? .optaTextPrimary : (isHovered ? .optaTextSecondary : .optaTextMuted))
            }
        }
        .buttonStyle(.plain)
        .scaleEffect(isHovered ? 1.05 : 1)
        .animation(.optaSnap, value: isHovered)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Device Emoji Button

struct DeviceEmojiButton: View {
    let emoji: String
    let isSelected: Bool
    let onTap: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: onTap) {
            Text(emoji)
                .font(.system(size: 16))
                .frame(width: 28, height: 28)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isSelected ? Color.optaPrimary.opacity(0.2) : (isHovered ? Color.optaSurface.opacity(0.6) : Color.optaElevated))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(isSelected ? Color.optaPrimary : (isHovered ? Color.optaTextMuted.opacity(0.3) : Color.clear), lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(isHovered ? 1.1 : 1)
        .animation(.optaSnap, value: isHovered)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Chat Empty State (Bot Selected, No Messages)

struct ChatEmptyState: View {
    let botName: String
    let botEmoji: String
    let isConnected: Bool
    let onReconnect: () -> Void

    @State private var pulse: CGFloat = 0.9

    var body: some View {
        VStack(spacing: 16) {
            Text(botEmoji)
                .font(.system(size: 56))
                .scaleEffect(pulse)
                .onAppear {
                    withAnimation(.optaPulse) {
                        pulse = 1.05
                    }
                }

            if isConnected {
                Text("Start a conversation with \(botName)")
                    .font(.sora(16, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                Text("Type a message below to begin")
                    .font(.sora(13))
                    .foregroundColor(.optaTextMuted)
            } else {
                Text("\(botName) is disconnected")
                    .font(.sora(16, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                Button(action: onReconnect) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12))
                        Text("Reconnect")
                            .font(.sora(13, weight: .medium))
                    }
                    .foregroundColor(.optaPrimary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        Capsule().fill(Color.optaPrimary.opacity(0.12))
                    )
                    .overlay(Capsule().stroke(Color.optaPrimary.opacity(0.3), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Skeleton Bubble

struct SkeletonBubble: View {
    let isUser: Bool
    let width: CGFloat
    @State private var shimmerOffset: CGFloat = -1
    
    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 0) }
            
            RoundedRectangle(cornerRadius: 18)
                .fill(Color.optaSurface.opacity(0.4))
                .frame(maxWidth: width * 600, minHeight: isUser ? 36 : 52)
                .overlay(
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [.clear, Color.optaGlassHighlight, .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.4)
                        .offset(x: shimmerOffset * geo.size.width)
                    }
                    .clipped()
                )
                .clipShape(RoundedRectangle(cornerRadius: 18))
            
            if !isUser { Spacer(minLength: 0) }
        }
        .onAppear {
            withAnimation(.spring(response: 1.5, dampingFraction: 1.0).repeatForever(autoreverses: false)) {
                shimmerOffset = 1.5
            }
        }
    }
}

// MARK: - Connection Toast

struct ConnectionToast: View {
    let text: String
    let isSuccess: Bool
    @State private var pulse: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 8) {
            if isSuccess {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.optaGreen)
            } else {
                OptaLoader(size: 12, lineWidth: 1.5, color: .optaPrimary)
            }
            
            Text(text)
                .font(.sora(12, weight: .medium))
                .foregroundColor(isSuccess ? .optaGreen : .optaTextSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .shadow(color: Color.optaVoid.opacity(0.2), radius: 8, y: 2)
        )
        .overlay(
            Capsule()
                .stroke(
                    (isSuccess ? Color.optaGreen : Color.optaAmber).opacity(0.3),
                    lineWidth: 0.5
                )
        )
    }
}

