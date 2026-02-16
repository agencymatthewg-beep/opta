//
//  BotMapView.swift
//  OptaPlusMacOS
//
//  Constellation view — device at center, paired bots arranged radially
//  with tether lines showing connection state. macOS port of the iOS
//  Bot Map with right-click context menus and larger canvas.
//

import SwiftUI
import OptaMolt

// MARK: - Bot Map View

struct BotMapView: View {
    @EnvironmentObject var pairingCoordinator: PairingCoordinator
    @StateObject private var scanner = BotScanner()
    @State private var botNodes: [BotNode] = []
    @State private var selectedBot: BotNode?
    @State private var appeared = false
    @State private var starPositions: [MacStarPosition] = []

    private let store = BotPairingStore()
    private let device = DeviceIdentity.current

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            // Star field background
            MacStarFieldView(stars: starPositions)

            if botNodes.isEmpty {
                emptyState
            } else {
                constellationView
            }

            // Radar sweep overlay (renders above constellation)
            RadarScanView(isScanning: $scanner.isScanning)

            // Toolbar overlay (top-right)
            VStack {
                HStack {
                    Text("Bot Map")
                        .font(.soraTitle2)
                        .foregroundColor(.optaTextPrimary)

                    Spacer()

                    Button {
                        scanner.startActiveScan()
                    } label: {
                        Image(systemName: "antenna.radiowaves.left.and.right")
                            .font(.system(size: 14))
                            .foregroundColor(scanner.isScanning ? .optaPrimaryGlow : .optaTextSecondary)
                            .symbolEffect(.variableColor.iterative, isActive: scanner.isScanning)
                    }
                    .buttonStyle(.plain)
                    .disabled(scanner.isScanning)
                    .accessibilityLabel(scanner.isScanning ? "Scanning for bots" : "Scan for bots")
                    .help("Scan for nearby bots")
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer()
            }
        }
        .onAppear {
            loadBots()
            generateStars()
            withAnimation(.optaGentle.delay(0.1)) {
                appeared = true
            }
        }
        .onChange(of: scanner.isScanning) { _, scanning in
            if !scanning {
                reloadAfterScan()
            }
        }
        .sheet(item: $selectedBot) { node in
            BotDetailSheet(
                node: node,
                onConnect: {
                    print("[BotMap macOS] Connect requested for \(node.name) (\(node.id))")
                },
                onDisconnect: {
                    print("[BotMap macOS] Disconnect requested for \(node.name) (\(node.id))")
                },
                onForget: {
                    store.removeBotNode(id: node.id)
                    loadBots()
                }
            )
            .frame(width: 400, height: 500)
            .background(Color.optaElevated)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 56))
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
                .padding(.horizontal, 60)

            Button {
                scanner.startActiveScan()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                    Text("Scan for Bots")
                        .font(.soraHeadline)
                }
                .foregroundColor(.optaVoid)
                .padding(.horizontal, 28)
                .padding(.vertical, 14)
                .background(
                    Capsule().fill(Color.optaPrimary)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
        }
        .ignition(delay: 0.2)
    }

    // MARK: - Constellation View

    private var constellationView: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            // Larger radius for macOS — more screen space
            let radius = min(geo.size.width, geo.size.height) * 0.35

            ZStack {
                // Tether lines (drawn behind nodes)
                ForEach(Array(botNodes.enumerated()), id: \.element.id) { index, node in
                    let angle = botAngle(index: index, count: botNodes.count)
                    let nodePosition = CGPoint(
                        x: center.x + radius * cos(angle),
                        y: center.y + radius * sin(angle)
                    )
                    MacTetherLine(
                        from: center,
                        to: nodePosition,
                        state: node.state,
                        appeared: appeared
                    )
                }

                // Center device node
                MacDeviceNode(
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

                    MacBotConstellationNode(
                        node: node,
                        isSelected: selectedBot?.id == node.id,
                        index: index,
                        appeared: appeared
                    )
                    .position(position)
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            selectedBot = node
                        }
                    }
                    .contextMenu {
                        contextMenuItems(for: node)
                    }
                    .accessibilityLabel("\(node.name), \(node.state.rawValue)")
                    .accessibilityHint("Click to select \(node.name). Right-click for options.")
                }
            }
        }
    }

    // MARK: - Context Menu

    @ViewBuilder
    private func contextMenuItems(for node: BotNode) -> some View {
        switch node.state {
        case .connected, .connecting:
            Button {
                print("[BotMap macOS] Disconnect requested for \(node.name)")
            } label: {
                Label("Disconnect", systemImage: "bolt.slash.fill")
            }

        case .disconnected, .paired, .discovered, .error:
            Button {
                print("[BotMap macOS] Connect requested for \(node.name)")
            } label: {
                Label("Connect", systemImage: "bolt.fill")
            }

        case .pairing:
            EmptyView()
        }

        Divider()

        Button {
            #if os(macOS)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(node.gatewayFingerprint, forType: .string)
            #endif
        } label: {
            Label("Copy Fingerprint", systemImage: "doc.on.doc")
        }

        if let host = node.gatewayHost {
            Button {
                #if os(macOS)
                let address = node.gatewayPort.map { "\(host):\($0)" } ?? host
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(address, forType: .string)
                #endif
            } label: {
                Label("Copy Address", systemImage: "link")
            }
        }

        Divider()

        Button {
            withAnimation(.optaSpring) {
                selectedBot = node
            }
        } label: {
            Label("Details", systemImage: "info.circle")
        }

        Button(role: .destructive) {
            store.removeBotNode(id: node.id)
            loadBots()
        } label: {
            Label("Forget Bot", systemImage: "trash")
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
        // More stars for the larger macOS canvas
        starPositions = (0..<90).map { _ in
            MacStarPosition(
                x: CGFloat.random(in: 0...1),
                y: CGFloat.random(in: 0...1),
                size: CGFloat.random(in: 1...3),
                opacity: Double.random(in: 0.1...0.5)
            )
        }
    }
}

// MARK: - Star Field

struct MacStarPosition: Identifiable {
    let id = UUID()
    let x: CGFloat
    let y: CGFloat
    let size: CGFloat
    let opacity: Double
}

struct MacStarFieldView: View {
    let stars: [MacStarPosition]

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

struct MacDeviceNode: View {
    let emoji: String
    let name: String
    let appeared: Bool

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                // Outer glow ring
                Circle()
                    .fill(Color.optaPrimary.opacity(0.08))
                    .frame(width: 90, height: 90)

                Circle()
                    .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1.5)
                    .frame(width: 80, height: 80)

                Text(emoji)
                    .font(.system(size: 36))
            }

            Text(name)
                .font(.sora(12, weight: .medium))
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

struct MacBotConstellationNode: View {
    let node: BotNode
    let isSelected: Bool
    let index: Int
    let appeared: Bool
    @State private var isHovered = false

    private var glowColor: Color {
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
                    .fill(glowColor.opacity(isSelected ? 0.2 : (isHovered ? 0.15 : 0.1)))
                    .frame(width: 72, height: 72)

                // Glow ring
                Circle()
                    .stroke(glowColor.opacity(isSelected ? 0.6 : (isHovered ? 0.45 : 0.3)), lineWidth: isSelected ? 2 : 1)
                    .frame(width: 64, height: 64)

                // Connected breathing glow
                if node.state == .connected {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 64, height: 64)
                        .optaBreathing(minOpacity: 0.05, maxOpacity: 0.15)
                }

                // Connecting amber pulse
                if node.state == .connecting {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 64, height: 64)
                        .optaBreathing(minOpacity: 0.1, maxOpacity: 0.3, minScale: 0.95, maxScale: 1.1)
                }

                // Emoji
                Text(node.emoji)
                    .font(.system(size: 30))

                // Selection indicator
                if isSelected {
                    Circle()
                        .stroke(Color.optaPrimary, lineWidth: 2)
                        .frame(width: 72, height: 72)
                }
            }

            Text(node.name)
                .font(.sora(13, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            // Status badge
            HStack(spacing: 3) {
                Circle()
                    .fill(glowColor)
                    .frame(width: 5, height: 5)

                Text(statusLabel)
                    .font(.soraCaption)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .scaleEffect(appeared ? 1.0 : 0.1)
        .opacity(appeared ? 1.0 : 0)
        .animation(.optaSpring.delay(0.15 + Double(index) * 0.08), value: appeared)
        .scaleEffect(isSelected ? 1.1 : (isHovered ? 1.05 : 1.0))
        .animation(.optaSpring, value: isSelected)
        .animation(.optaSpring, value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
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

// MARK: - Tether Line

struct MacTetherLine: View {
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
        .modifier(MacTetherPulseModifier(isActive: state == .connecting))
    }
}

// MARK: - Tether Pulse Modifier

struct MacTetherPulseModifier: ViewModifier {
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
