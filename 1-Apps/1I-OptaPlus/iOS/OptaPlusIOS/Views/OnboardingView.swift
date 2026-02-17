//
//  OnboardingView.swift
//  OptaPlusIOS
//
//  3-page onboarding centered on Bot Map discovery.
//  Page 2 embeds the constellation view with auto-scan so the first-time
//  experience mirrors the ongoing Bot Map interaction.
//

import SwiftUI
import VisionKit
import OptaPlus
import OptaMolt

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var pairingCoordinator: PairingCoordinator
    @StateObject private var scanner = BotScanner()
    @AppStorage("optaplus.onboardingDone") private var onboardingDone = false

    @State private var currentPage = 0
    @State private var animateIn = false

    // Constellation state (shared between page 2 and 3)
    @State private var botNodes: [BotNode] = []
    @State private var starPositions: [StarPosition] = []
    @State private var constellationAppeared = false
    @State private var showQRScanner = false

    // Manual entry fallback
    @State private var botName = ""
    @State private var botHost = ""
    @State private var botPort = "18793"
    @State private var botToken = ""
    @State private var showManualEntry = false

    private let store = BotPairingStore()
    private let device = DeviceIdentity.current

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            TabView(selection: $currentPage) {
                welcomePage.tag(0)
                discoverPage.tag(1)
                completionPage.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .animation(.optaGentle, value: currentPage)
        }
        .onAppear {
            generateStars()
            withAnimation(.optaGentle) { animateIn = true }
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerSheet(
                onPairingDetected: { info in
                    HapticManager.shared.notification(.success)
                    pairingCoordinator.pendingPairingInfo = info
                    reloadBotNodes()
                },
                onDismiss: {
                    showQRScanner = false
                }
            )
            .interactiveDismissDisabled()
        }
    }

    // MARK: - Page 1: Welcome

    private var welcomePage: some View {
        VStack(spacing: 24) {
            Spacer()

            ZStack {
                // Outer glow
                Circle()
                    .fill(Color.optaPrimary.opacity(0.15))
                    .frame(width: 140, height: 140)
                    .blur(radius: 20)

                // Inner ring
                Circle()
                    .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1.5)
                    .frame(width: 100, height: 100)

                Text("O+")
                    .font(.system(size: 64, weight: .black, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.optaPrimary, .optaCyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .scaleEffect(animateIn ? 1 : 0.5)
            .opacity(animateIn ? 1 : 0)

            VStack(spacing: 8) {
                Text("Welcome to OptaPlus")
                    .font(.soraTitle2)
                    .foregroundColor(.optaTextPrimary)

                Text("Connect to your bots effortlessly.\nYour AI command center, one tap away.")
                    .font(.soraBody)
                    .foregroundColor(.optaTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            .opacity(animateIn ? 1 : 0)
            .animation(.optaGentle.delay(0.15), value: animateIn)

            Spacer()

            primaryButton("Get Started") {
                withAnimation(.optaSpring) {
                    currentPage = 1
                }
            }
        }
        .padding(32)
    }

    // MARK: - Page 2: Discover Your Bots

    private var discoverPage: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 6) {
                Text("Discover Your Bots")
                    .font(.soraTitle2)
                    .foregroundColor(.optaTextPrimary)

                Text("Scanning your local network for OpenClaw gateways...")
                    .font(.soraCaption)
                    .foregroundColor(.optaTextSecondary)
                    .opacity(scanner.isScanning ? 1 : 0.6)
            }
            .padding(.top, 24)
            .padding(.bottom, 8)

            // Constellation area — the core Bot Map experience
            ZStack {
                StarFieldView(stars: starPositions)

                if botNodes.isEmpty && !scanner.isScanning {
                    // No bots found — show options
                    discoverEmptyState
                } else {
                    // Constellation with discovered/paired bots
                    onboardingConstellation
                }

                // Radar sweep overlay
                RadarScanView(isScanning: $scanner.isScanning)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Bottom actions
            VStack(spacing: 12) {
                if !botNodes.isEmpty {
                    primaryButton("Continue") {
                        withAnimation(.optaSpring) {
                            currentPage = 2
                        }
                    }
                } else {
                    // Rescan button
                    Button {
                        scanner.startActiveScan()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                            Text("Scan Again")
                                .font(.soraHeadline)
                        }
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(
                            Capsule()
                                .stroke(Color.optaPrimary.opacity(0.5), lineWidth: 1)
                        )
                    }
                    .disabled(scanner.isScanning)

                    primaryButton("Continue Without Pairing") {
                        withAnimation(.optaSpring) {
                            currentPage = 2
                        }
                    }
                }
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .onAppear {
            // Auto-scan when page appears
            if !scanner.isScanning && botNodes.isEmpty {
                scanner.startActiveScan(duration: 4.0)
            }
            withAnimation(.optaGentle.delay(0.2)) {
                constellationAppeared = true
            }
        }
        .onChange(of: scanner.isScanning) { _, scanning in
            if !scanning {
                reloadAfterScan()
            }
        }
        .sheet(isPresented: $showManualEntry) {
            manualEntrySheet
        }
    }

    // MARK: - Discover: Empty State

    private var discoverEmptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.optaPrimary, .optaPrimaryGlow],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .optaBreathing(minOpacity: 0.5, maxOpacity: 1.0, minScale: 0.95, maxScale: 1.05)

            Text("No bots found nearby")
                .font(.soraTitle3)
                .foregroundColor(.optaTextPrimary)

            Text("Make sure a gateway is running on your network, or pair manually.")
                .font(.soraCaption)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            HStack(spacing: 16) {
                if DataScannerViewController.isSupported {
                    actionPill(icon: "qrcode.viewfinder", label: "QR Code") {
                        showQRScanner = true
                    }
                }

                actionPill(icon: "keyboard", label: "Manual") {
                    showManualEntry = true
                }
            }
            .padding(.top, 4)
        }
        .ignition(delay: 0.2)
    }

    // MARK: - Discover: Constellation (simplified for onboarding)

    private var onboardingConstellation: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let radius = min(geo.size.width, geo.size.height) * 0.32

            ZStack {
                // Tether lines
                ForEach(Array(botNodes.enumerated()), id: \.element.id) { index, node in
                    let angle = botAngle(index: index, count: botNodes.count)
                    let nodePosition = CGPoint(
                        x: center.x + radius * cos(angle),
                        y: center.y + radius * sin(angle)
                    )
                    TetherLine(
                        from: center,
                        to: nodePosition,
                        state: node.state,
                        appeared: constellationAppeared
                    )
                }

                // Center device node
                ConstellationDeviceNode(
                    emoji: deviceEmoji,
                    name: device.deviceName,
                    appeared: constellationAppeared
                )
                .position(center)

                // Bot nodes arranged radially
                ForEach(Array(botNodes.enumerated()), id: \.element.id) { index, node in
                    let angle = botAngle(index: index, count: botNodes.count)
                    let position = CGPoint(
                        x: center.x + radius * cos(angle),
                        y: center.y + radius * sin(angle)
                    )

                    BotConstellationNode(
                        node: node,
                        isSelected: false,
                        index: index,
                        appeared: constellationAppeared
                    )
                    .position(position)
                    .accessibilityLabel("\(node.name), \(node.state.rawValue)")
                }
            }
        }
    }

    // MARK: - Page 3: Completion

    private var completionPage: some View {
        VStack(spacing: 24) {
            Spacer()

            if !botNodes.isEmpty {
                // Bots were paired/discovered — show mini constellation
                pairedCompletionView
            } else {
                // No bots paired — reassure the user
                skippedCompletionView
            }

            Spacer()

            primaryButton("Launch OptaPlus") {
                onboardingDone = true
            }

            if botNodes.isEmpty {
                Button("Skip for now") {
                    onboardingDone = true
                }
                .font(.soraCaption)
                .foregroundColor(.optaTextMuted)
                .padding(.bottom, 8)
            }
        }
        .padding(32)
    }

    // MARK: - Completion: Bots Found

    private var pairedCompletionView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.optaGreen.opacity(0.12))
                    .frame(width: 88, height: 88)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.optaGreen)
            }
            .ignition(delay: 0.1)

            Text("You're All Set")
                .font(.soraTitle2)
                .foregroundColor(.optaTextPrimary)

            Text("\(botNodes.count) bot\(botNodes.count == 1 ? "" : "s") discovered on your network.")
                .font(.soraBody)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)

            // Mini bot list
            VStack(spacing: 8) {
                ForEach(botNodes.prefix(4)) { node in
                    HStack(spacing: 10) {
                        Text(node.emoji)
                            .font(.title3)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(node.name)
                                .font(.soraBody)
                                .foregroundColor(.optaTextPrimary)

                            HStack(spacing: 4) {
                                Circle()
                                    .fill(stateColor(node.state))
                                    .frame(width: 5, height: 5)
                                Text(node.state.rawValue.capitalized)
                                    .font(.soraCaption)
                                    .foregroundColor(.optaTextMuted)
                            }
                        }

                        Spacer()
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.optaSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.optaBorder, lineWidth: 0.5)
                            )
                    )
                }
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Completion: No Bots

    private var skippedCompletionView: some View {
        VStack(spacing: 16) {
            Image(systemName: "circle.hexagongrid")
                .font(.system(size: 56))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.optaPrimary, .optaCyan],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .optaBreathing(minOpacity: 0.5, maxOpacity: 1.0)

            Text("You're All Set")
                .font(.soraTitle2)
                .foregroundColor(.optaTextPrimary)

            Text("No bots paired yet, but that's okay.\nYou can discover and pair bots anytime from the Bot Map tab.")
                .font(.soraBody)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .ignition(delay: 0.1)
    }

    // MARK: - Manual Entry Sheet

    private var manualEntrySheet: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid.ignoresSafeArea()

                VStack(spacing: 20) {
                    Text("Add Bot Manually")
                        .font(.soraTitle3)
                        .foregroundColor(.optaTextPrimary)
                        .padding(.top, 8)

                    VStack(spacing: 12) {
                        onboardingField("Bot Name", text: $botName, icon: "person.fill")
                        onboardingField("Host", text: $botHost, icon: "globe")
                        onboardingField("Port", text: $botPort, icon: "number")
                            .keyboardType(.numberPad)
                        onboardingField("Token (optional)", text: $botToken, icon: "key.fill")
                    }

                    Spacer()

                    primaryButton("Add Bot") {
                        addManualBot()
                        showManualEntry = false
                    }
                    .disabled(!canAddManualBot)
                    .opacity(canAddManualBot ? 1 : 0.5)

                    Button("Cancel") {
                        showManualEntry = false
                    }
                    .font(.soraCaption)
                    .foregroundColor(.optaTextMuted)
                }
                .padding(24)
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color.optaElevated)
        }
    }

    // MARK: - Shared Components

    private func primaryButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.soraHeadline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(
                            LinearGradient(
                                colors: [.optaPrimary, .optaPrimary.opacity(0.7)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                )
        }
    }

    private func actionPill(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(label)
                    .font(.soraCaption)
            }
            .foregroundColor(.optaTextPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(Color.optaSurface)
                    .overlay(
                        Capsule()
                            .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 0.5)
                    )
            )
        }
    }

    private func onboardingField(_ placeholder: String, text: Binding<String>, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.optaPrimary)
                .frame(width: 20)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundColor(.optaTextPrimary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaElevated)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.optaBorder, lineWidth: 1))
        )
    }

    // MARK: - Helpers

    private var deviceEmoji: String {
        switch device.platform {
        case .iOS: return "📱"
        case .macOS: return "🖥️"
        }
    }

    private func botAngle(index: Int, count: Int) -> CGFloat {
        let offset: CGFloat = -.pi / 2  // Start from top
        return offset + CGFloat(index) * (2 * .pi / CGFloat(max(count, 1)))
    }

    private func stateColor(_ state: BotConnectionState) -> Color {
        switch state {
        case .connected: return .optaGreen
        case .connecting, .pairing: return .optaAmber
        case .disconnected, .error: return .optaRed
        case .discovered, .paired: return .optaPrimary
        }
    }

    private func generateStars() {
        starPositions = (0..<60).map { _ in
            StarPosition(
                x: CGFloat.random(in: 0...1),
                y: CGFloat.random(in: 0...1),
                size: CGFloat.random(in: 1...3),
                opacity: Double.random(in: 0.1...0.5)
            )
        }
    }

    private func reloadBotNodes() {
        botNodes = store.loadBotNodes()
    }

    private func reloadAfterScan() {
        let paired = store.loadBotNodes()
        let merged = BotScanner.merge(paired: paired, discovered: scanner.discoveredGateways)
        let deduplicated = BotScanner.deduplicate(merged)
        withAnimation(.optaSpring) {
            botNodes = deduplicated
        }
    }

    private var canAddManualBot: Bool {
        !botName.isEmpty && !botHost.isEmpty && (Int(botPort) ?? 0) > 0
    }

    private func addManualBot() {
        let port = Int(botPort) ?? 18793
        let bot = BotConfig(name: botName, host: botHost, port: port, token: botToken, emoji: "🤖")
        appState.addBot(bot)
        appState.selectBot(bot)
        HapticManager.shared.notification(.success)
        // Reset manual fields
        botName = ""
        botHost = ""
        botPort = "18793"
        botToken = ""
    }
}
