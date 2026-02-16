//
//  BotMapView.swift
//  OptaPlusIOS
//
//  Constellation view — device at center, paired bots arranged radially
//  with tether lines showing connection state.
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
    @State private var starPositions: [StarPosition] = []

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
            }
            .navigationTitle("Bot Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
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
            .onAppear {
                loadBots()
                generateStars()
                withAnimation(.optaGentle.delay(0.1)) {
                    appeared = true
                }
            }
            .onChange(of: scanner.isScanning) { _, scanning in
                if !scanning {
                    // Scan finished — merge discovered gateways into bot nodes
                    reloadAfterScan()
                }
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
                DeviceNode(
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
                        appeared: appeared
                    )
                    .position(position)
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            selectedBot = node
                        }
                    }
                    .accessibilityLabel("\(node.name), \(node.state.rawValue)")
                    .accessibilityHint("Tap to select \(node.name)")
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

struct DeviceNode: View {
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
                    .fill(glowColor.opacity(isSelected ? 0.2 : 0.1))
                    .frame(width: 66, height: 66)

                // Glow ring
                Circle()
                    .stroke(glowColor.opacity(isSelected ? 0.6 : 0.3), lineWidth: isSelected ? 2 : 1)
                    .frame(width: 58, height: 58)

                // Connected breathing glow
                if node.state == .connected {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 58, height: 58)
                        .optaBreathing(minOpacity: 0.05, maxOpacity: 0.15)
                }

                // Connecting amber pulse
                if node.state == .connecting {
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

                Text(statusLabel)
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
