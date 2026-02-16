//
//  BotMapView.swift
//  OptaPlusIOS
//
//  Constellation view — device at center, paired bots arranged radially
//  with tether lines showing connection state.
//

import SwiftUI
import VisionKit
import OptaMolt

// MARK: - Bot Map View

struct BotMapView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var pairingCoordinator: PairingCoordinator
    @StateObject private var scanner = BotScanner()
    @StateObject private var clipboardMonitor = ClipboardMonitor()
    @Environment(\.scenePhase) private var scenePhase
    @State private var botNodes: [BotNode] = []
    @State private var selectedBot: BotNode?
    @State private var selectedBotForChat: BotConfig?
    @State private var appeared = false
    @State private var starPositions: [StarPosition] = []
    @State private var showQRScanner = false

    private let store = BotPairingStore()
    private let device = DeviceIdentity.current

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid.ignoresSafeArea()

                // Star field background
                StarFieldView(stars: starPositions)

                if botNodes.isEmpty {
                    emptyState
                } else {
                    constellationView
                }

                // Radar sweep overlay (renders above constellation, below toolbar)
                RadarScanView(isScanning: $scanner.isScanning)

                // Clipboard pairing banner (slides in from top)
                VStack {
                    if let info = clipboardMonitor.detectedPairing {
                        ClipboardPairingBanner(
                            pairingInfo: info,
                            onPair: {
                                pairingCoordinator.pendingPairingInfo = info
                                clipboardMonitor.dismiss()
                                loadBots()
                            },
                            onDismiss: {
                                withAnimation(.optaSpring) {
                                    clipboardMonitor.dismiss()
                                }
                            }
                        )
                        .padding(.top, 8)
                    }
                    Spacer()
                }
                .animation(.optaSpring, value: clipboardMonitor.detectedPairing != nil)
            }
            .navigationTitle("Bot Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Menu {
                        Button {
                            for node in botNodes {
                                if let vm = viewModelForNode(node), vm.connectionState == .disconnected {
                                    vm.connect()
                                }
                            }
                        } label: {
                            Label("Connect All", systemImage: "bolt.fill")
                        }
                        Button {
                            for node in botNodes {
                                viewModelForNode(node)?.disconnect()
                            }
                        } label: {
                            Label("Disconnect All", systemImage: "bolt.slash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .accessibilityLabel("Connection options")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // QR code scanner button
                        if DataScannerViewController.isSupported {
                            Button {
                                showQRScanner = true
                            } label: {
                                Image(systemName: "qrcode.viewfinder")
                                    .foregroundColor(.optaTextSecondary)
                            }
                            .accessibilityLabel("Scan QR code")
                        }

                        // Bonjour scan button
                        Button {
                            scanner.startActiveScan()
                        } label: {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                                .foregroundColor(scanner.isScanning ? .optaPrimaryGlow : .optaTextSecondary)
                                .symbolEffect(.variableColor.iterative, isActive: scanner.isScanning)
                        }
                        .disabled(scanner.isScanning)
                        .accessibilityLabel(scanner.isScanning ? "Scanning for bots" : "Scan for bots")
                    }
                }
            }
            .onAppear {
                loadBots()
                generateStars()
                clipboardMonitor.checkClipboard()
                withAnimation(.optaGentle.delay(0.1)) {
                    appeared = true
                }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    clipboardMonitor.checkClipboard()
                }
            }
            .onChange(of: scanner.isScanning) { _, scanning in
                if !scanning {
                    // Scan finished — merge discovered gateways into bot nodes
                    reloadAfterScan()
                }
            }
            .sheet(item: $selectedBot) { node in
                BotDetailSheet(
                    node: node,
                    onConnect: {
                        print("[BotMap] Connect requested for \(node.name) (\(node.id))")
                    },
                    onDisconnect: {
                        print("[BotMap] Disconnect requested for \(node.name) (\(node.id))")
                    },
                    onForget: {
                        store.removeBotNode(id: node.id)
                        loadBots()
                    }
                )
                .presentationDetents([.medium])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color.optaElevated)
            }
            .sheet(isPresented: $showQRScanner) {
                QRScannerSheet(
                    onPairingDetected: { info in
                        pairingCoordinator.pendingPairingInfo = info
                        loadBots()
                    },
                    onDismiss: {
                        showQRScanner = false
                    }
                )
                .interactiveDismissDisabled()
            }
            .navigationDestination(item: $selectedBotForChat) { bot in
                let vm = appState.viewModel(for: bot)
                ChatView(viewModel: vm, botConfig: bot)
                    .navigationTitle(bot.name)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
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

            Text("No bots paired yet")
                .font(.soraTitle2)
                .foregroundColor(.optaTextPrimary)

            Text("Scan for nearby bots or pair via deep link")
                .font(.soraBody)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                scanner.startActiveScan()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                    Text("Scan for Bots")
                        .font(.soraHeadline)
                }
                .foregroundColor(.optaVoid)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(
                    Capsule().fill(Color.optaPrimary)
                )
            }
            .padding(.top, 8)

            if DataScannerViewController.isSupported {
                Button {
                    showQRScanner = true
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "qrcode.viewfinder")
                        Text("Scan QR Code")
                            .font(.soraHeadline)
                    }
                    .foregroundColor(.optaTextPrimary)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(
                        Capsule()
                            .stroke(Color.optaPrimary.opacity(0.5), lineWidth: 1)
                    )
                }
            }
        }
        .ignition(delay: 0.2)
    }

    // MARK: - Constellation View

    private var constellationView: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let radius = min(geo.size.width, geo.size.height) * 0.35

            ZStack {
                // Tether lines (drawn behind nodes)
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
                        appeared: appeared
                    )
                }

                // Center device node
                ConstellationDeviceNode(
                    emoji: deviceEmoji,
                    name: device.deviceName,
                    appeared: appeared
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
                        isSelected: selectedBot?.id == node.id,
                        index: index,
                        appeared: appeared,
                        viewModel: viewModelForNode(node)
                    )
                    .position(position)
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            selectedBot = node
                        }
                    }
                    .contextMenu {
                        // Open Chat
                        Button {
                            if let bot = appState.bots.first(where: { $0.id == node.botId }) {
                                appState.selectBot(bot)
                                selectedBotForChat = bot
                            }
                        } label: {
                            Label("Open Chat", systemImage: "bubble.left.fill")
                        }

                        Divider()

                        // Connect / Disconnect
                        if let vm = viewModelForNode(node) {
                            if vm.connectionState == .connected {
                                Button {
                                    vm.disconnect()
                                } label: {
                                    Label("Disconnect", systemImage: "bolt.slash")
                                }
                            } else {
                                Button {
                                    vm.connect()
                                } label: {
                                    Label("Connect", systemImage: "bolt.fill")
                                }
                            }
                        }

                        Divider()

                        // Forget
                        Button(role: .destructive) {
                            store.removeBotNode(id: node.id)
                            loadBots()
                        } label: {
                            Label("Forget Bot", systemImage: "trash")
                        }
                    }
                    .accessibilityLabel("\(node.name), \(node.state.rawValue)")
                    .accessibilityHint("Tap to select, long press for options")
                }
            }
        }
    }

    // MARK: - Helpers

    private func botAngle(index: Int, count: Int) -> CGFloat {
        let offset: CGFloat = -.pi / 2  // Start from top
        return offset + CGFloat(index) * (2 * .pi / CGFloat(count))
    }

    private var deviceEmoji: String {
        switch device.platform {
        case .iOS: return "📱"
        case .macOS: return "🖥️"
        }
    }

    private func loadBots() {
        botNodes = store.loadBotNodes()
    }

    /// Merges newly discovered gateways into the bot node list after a scan completes.
    private func reloadAfterScan() {
        let merged = BotScanner.merge(paired: botNodes, discovered: scanner.discoveredGateways)
        let deduplicated = BotScanner.deduplicate(merged)
        withAnimation(.optaSpring) {
            botNodes = deduplicated
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

    private func viewModelForNode(_ node: BotNode) -> ChatViewModel? {
        guard appState.bots.contains(where: { $0.id == node.botId }) else { return nil }
        return appState.viewModel(forNode: node)
    }
}

// MARK: - Star Field

struct StarPosition: Identifiable {
    let id = UUID()
    let x: CGFloat
    let y: CGFloat
    let size: CGFloat
    let opacity: Double
}

struct StarFieldView: View {
    let stars: [StarPosition]

    var body: some View {
        GeometryReader { geo in
            ForEach(stars) { star in
                Circle()
                    .fill(Color.white)
                    .frame(width: star.size, height: star.size)
                    .opacity(star.opacity)
                    .position(
                        x: star.x * geo.size.width,
                        y: star.y * geo.size.height
                    )
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Device Node (Center)

struct ConstellationDeviceNode: View {
    let emoji: String
    let name: String
    let appeared: Bool

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                // Outer glow ring
                Circle()
                    .fill(Color.optaPrimary.opacity(0.08))
                    .frame(width: 80, height: 80)

                Circle()
                    .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1.5)
                    .frame(width: 72, height: 72)

                Text(emoji)
                    .font(.system(size: 32))
            }

            Text(name)
                .font(.sora(11, weight: .medium))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(1)

            Text("This device")
                .font(.soraCaption)
                .foregroundColor(.optaTextMuted)
        }
        .scaleEffect(appeared ? 1.0 : 0.3)
        .opacity(appeared ? 1.0 : 0)
        .animation(.optaSpring.delay(0.05), value: appeared)
    }
}

// MARK: - Bot Constellation Node

struct BotConstellationNode: View {
    let node: BotNode
    let isSelected: Bool
    let index: Int
    let appeared: Bool
    var viewModel: ChatViewModel? = nil

    private var isConnected: Bool {
        viewModel?.connectionState == .connected
    }

    private var glowColor: Color {
        if let vm = viewModel {
            switch vm.connectionState {
            case .connected: return .optaGreen
            case .connecting, .reconnecting: return .optaAmber
            case .disconnected: return node.state == .paired ? .optaPrimary : .optaRed
            }
        }
        switch node.state {
        case .connected: return .optaGreen
        case .connecting, .pairing: return .optaAmber
        case .disconnected, .error: return .optaRed
        case .discovered, .paired: return .optaPrimary
        }
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                // Outer glow
                Circle()
                    .fill(glowColor.opacity(isSelected ? 0.2 : 0.1))
                    .frame(width: 66, height: 66)

                // Glow ring
                Circle()
                    .stroke(glowColor.opacity(isSelected ? 0.6 : 0.3), lineWidth: isSelected ? 2 : 1)
                    .frame(width: 58, height: 58)

                // Thinking arc
                if viewModel?.botState == .thinking {
                    ConstellationThinkingArc(color: glowColor)
                        .frame(width: 62, height: 62)
                }

                // Connected idle breathing
                if isConnected && viewModel?.botState == .idle {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 58, height: 58)
                        .optaBreathing(minOpacity: 0.05, maxOpacity: 0.15)
                }

                // Typing pulse ring
                if viewModel?.botState == .typing {
                    Circle()
                        .stroke(glowColor.opacity(0.4), lineWidth: 1.5)
                        .frame(width: 66, height: 66)
                        .optaBreathing(minOpacity: 0.2, maxOpacity: 0.8, minScale: 0.95, maxScale: 1.1)
                }

                // Connecting amber pulse (fallback when no viewModel)
                if node.state == .connecting && viewModel == nil {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 58, height: 58)
                        .optaBreathing(minOpacity: 0.1, maxOpacity: 0.3, minScale: 0.95, maxScale: 1.1)
                }

                // Emoji
                Text(node.emoji)
                    .font(.system(size: 28))

                // Selection indicator
                if isSelected {
                    Circle()
                        .stroke(Color.optaPrimary, lineWidth: 2)
                        .frame(width: 66, height: 66)
                }
            }

            Text(node.name)
                .font(.sora(12, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            // Status badge
            HStack(spacing: 3) {
                Circle()
                    .fill(glowColor)
                    .frame(width: 5, height: 5)

                Text(liveStatusLabel)
                    .font(.soraCaption)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .scaleEffect(appeared ? 1.0 : 0.1)
        .opacity(appeared ? 1.0 : 0)
        .animation(.optaSpring.delay(0.15 + Double(index) * 0.08), value: appeared)
        .scaleEffect(isSelected ? 1.1 : 1.0)
        .animation(.optaSpring, value: isSelected)
    }

    private var liveStatusLabel: String {
        if let vm = viewModel {
            switch vm.botState {
            case .thinking: return "Thinking..."
            case .typing: return "Responding..."
            case .idle:
                return vm.connectionState == .connected ? "Connected" :
                       vm.connectionState == .connecting ? "Connecting..." : "Offline"
            }
        }
        return statusLabel
    }

    private var statusLabel: String {
        switch node.state {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .disconnected: return "Offline"
        case .discovered: return "Discovered"
        case .pairing: return "Pairing"
        case .paired: return "Paired"
        case .error: return "Error"
        }
    }
}

// MARK: - Constellation Thinking Arc

struct ConstellationThinkingArc: View {
    let color: Color
    @State private var rotation: Double = 0

    var body: some View {
        Circle()
            .trim(from: 0, to: 0.28)
            .stroke(
                AngularGradient(
                    gradient: Gradient(colors: [color.opacity(0), color]),
                    center: .center
                ),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )
            .rotationEffect(.degrees(rotation))
            .onAppear {
                withAnimation(.optaSpin) {
                    rotation = 360
                }
            }
    }
}

// MARK: - Tether Line

struct TetherLine: View {
    let from: CGPoint
    let to: CGPoint
    let state: BotConnectionState
    let appeared: Bool

    private var lineColor: Color {
        switch state {
        case .connected: return .optaGreen
        case .connecting, .pairing: return .optaAmber
        case .disconnected, .error: return .optaRed
        default: return .optaPrimary
        }
    }

    var body: some View {
        Canvas { context, _ in
            var path = Path()
            path.move(to: from)
            path.addLine(to: to)

            switch state {
            case .connected:
                // Solid gradient tether
                let gradient = Gradient(colors: [
                    lineColor.opacity(0.6),
                    lineColor.opacity(0.2)
                ])
                context.stroke(
                    path,
                    with: .linearGradient(
                        gradient,
                        startPoint: from,
                        endPoint: to
                    ),
                    style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
                )

            case .disconnected, .error:
                // Dashed red tether
                context.stroke(
                    path,
                    with: .color(lineColor.opacity(0.4)),
                    style: StrokeStyle(
                        lineWidth: 1,
                        lineCap: .round,
                        dash: [6, 4]
                    )
                )

            case .connecting, .pairing:
                // Solid amber (pulse handled by parent)
                context.stroke(
                    path,
                    with: .color(lineColor.opacity(0.5)),
                    style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
                )

            default:
                // Subtle line for discovered/paired
                context.stroke(
                    path,
                    with: .color(lineColor.opacity(0.2)),
                    style: StrokeStyle(
                        lineWidth: 1,
                        lineCap: .round,
                        dash: [4, 6]
                    )
                )
            }
        }
        .opacity(appeared ? 1 : 0)
        .animation(.optaGentle.delay(0.1), value: appeared)
        .allowsHitTesting(false)
        // Amber pulse for connecting state
        .modifier(TetherPulseModifier(isActive: state == .connecting))
    }
}

// MARK: - Tether Pulse Modifier

struct TetherPulseModifier: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        if isActive {
            content
                .optaBreathing(minOpacity: 0.3, maxOpacity: 1.0)
        } else {
            content
        }
    }
}
