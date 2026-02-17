//
//  BotWebView.swift
//  OptaPlusMacOS
//
//  Radial network topology visualization showing the bot fleet.
//  User's device at center, devices arranged radially, bots as bubbles
//  with real-time connection state, animated status indicators.
//  Ported from iOS BotWebView with macOS adaptations.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Data Models

struct DeviceNode: Identifiable {
    let id: String // host IP
    let displayName: String
    let host: String
    let deviceType: DeviceType
    let os: String?
    var bots: [BotConfig]

    enum DeviceType: String {
        case desktop, laptop, mobile, selfDevice

        var icon: String {
            switch self {
            case .desktop: return "desktopcomputer"
            case .laptop: return "laptopcomputer"
            case .mobile: return "iphone"
            case .selfDevice: return "laptopcomputer"
            }
        }
    }
}

struct DeviceConnection: Identifiable {
    let id: String
    let fromHost: String
    let toHost: String
    let isActive: Bool
}

// MARK: - Bot Web View

struct BotWebView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @State private var deviceNodes: [DeviceNode] = []
    @State private var connections: [DeviceConnection] = []
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Bot Web")
                        .font(.sora(20, weight: .bold))
                        .foregroundColor(.optaTextPrimary)
                    Text("\(deviceNodes.count) device\(deviceNodes.count == 1 ? "" : "s") • \(appState.bots.count) bot\(appState.bots.count == 1 ? "" : "s")")
                        .font(.sora(12))
                        .foregroundColor(.optaTextMuted)
                }

                Spacer()

                Button {
                    Task { await loadTopology() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.sora(13, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                        .frame(width: 28, height: 28)
                        .background(Color.optaSurface.opacity(0.6))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .help("Refresh topology")
                .disabled(isLoading)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            Divider().opacity(0.2)

            // Topology canvas
            GeometryReader { geometry in
                let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
                let maxRadius = min(geometry.size.width, geometry.size.height) * 0.35

                ZStack {
                    Color.optaVoid.ignoresSafeArea()

                    if isLoading && deviceNodes.isEmpty {
                        VStack(spacing: 12) {
                            OptaLoader(size: 28)
                            Text("Mapping network...")
                                .font(.sora(13))
                                .foregroundColor(.optaTextMuted)
                        }
                    } else if deviceNodes.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "globe.americas")
                                .font(.system(size: 40))
                                .foregroundColor(.optaTextMuted.opacity(0.5))
                            Text("No devices found")
                                .font(.sora(14, weight: .medium))
                                .foregroundColor(.optaTextSecondary)
                            Text("Configure bots to see network topology")
                                .font(.sora(12))
                                .foregroundColor(.optaTextMuted)
                        }
                    } else {
                        // Connection lines (Canvas for performance)
                        ConnectionLinesCanvas(
                            center: center,
                            devicePositions: devicePositions(center: center, radius: maxRadius),
                            connections: connections,
                            deviceNodes: deviceNodes
                        )
                        .drawingGroup()

                        // Self-device at center
                        SelfDeviceNode()
                            .position(center)

                        // Device clusters
                        ForEach(Array(deviceNodes.enumerated()), id: \.element.id) { index, device in
                            let pos = devicePosition(index: index, total: deviceNodes.count, center: center, radius: maxRadius)
                            DeviceClusterView(
                                device: device,
                                appState: appState,
                                onBotTap: { bot in selectBot(bot) }
                            )
                            .position(pos)
                            .optaEntrance(delay: Double(index) * 0.08)
                        }
                    }
                }
            }
        }
        .background(Color.optaVoid)
        .task {
            await loadTopology()
        }
    }

    // MARK: - Bot Selection

    private func selectBot(_ bot: BotConfig) {
        windowState.selectedBotId = bot.id
        // Post notification to switch to chat mode
        NotificationCenter.default.post(name: .switchToChat, object: nil)
    }

    // MARK: - Layout

    private func devicePosition(index: Int, total: Int, center: CGPoint, radius: CGFloat) -> CGPoint {
        guard total > 0 else { return center }
        let effectiveRadius = min(radius, 280)

        if total == 1 {
            return CGPoint(x: center.x, y: center.y - effectiveRadius)
        }
        if total == 2 {
            let positions = [
                CGPoint(x: center.x, y: center.y - effectiveRadius),
                CGPoint(x: center.x, y: center.y + effectiveRadius)
            ]
            return positions[index]
        }

        let angle = -(.pi / 2) + (2 * .pi / CGFloat(total)) * CGFloat(index)
        return CGPoint(
            x: center.x + effectiveRadius * cos(angle),
            y: center.y + effectiveRadius * sin(angle)
        )
    }

    private func devicePositions(center: CGPoint, radius: CGFloat) -> [String: CGPoint] {
        var positions: [String: CGPoint] = [:]
        for (index, device) in deviceNodes.enumerated() {
            positions[device.id] = devicePosition(index: index, total: deviceNodes.count, center: center, radius: radius)
        }
        return positions
    }

    // MARK: - Topology Loading

    private func loadTopology() async {
        isLoading = true
        defer { isLoading = false }

        // Group bots by host IP
        var hostMap: [String: [BotConfig]] = [:]
        for bot in appState.bots {
            hostMap[bot.host, default: []].append(bot)
        }

        var nodes: [DeviceNode] = []
        var allConnections: [DeviceConnection] = []

        for (host, bots) in hostMap {
            var deviceType: DeviceNode.DeviceType = .desktop
            var displayName = host
            var os: String?

            // Try to get node info from any connected bot
            for bot in bots {
                let vm = appState.viewModel(for: bot)
                guard vm.isGatewayReady else { continue }
                do {
                    let result = try await vm.call("node.list")
                    if let nodeList = result?.dict?["nodes"] as? [[String: Any]] {
                        if let gatewayNode = nodeList.first(where: { ($0["type"] as? String) == "gateway" }) {
                            displayName = gatewayNode["name"] as? String ?? host
                            os = gatewayNode["os"] as? String
                            let typeStr = gatewayNode["type"] as? String ?? ""
                            switch typeStr {
                            case "laptop": deviceType = .laptop
                            case "mobile": deviceType = .mobile
                            default: deviceType = .desktop
                            }
                        } else if let firstNode = nodeList.first {
                            displayName = firstNode["name"] as? String ?? host
                            os = firstNode["os"] as? String
                        }

                        for node in nodeList {
                            if let nodeIP = node["ip"] as? String ?? node["address"] as? String,
                               nodeIP != host {
                                let connId = [host, nodeIP].sorted().joined(separator: "-")
                                if !allConnections.contains(where: { $0.id == connId }) {
                                    let connected = node["connected"] as? Bool ?? (node["status"] as? String == "connected")
                                    allConnections.append(DeviceConnection(
                                        id: connId,
                                        fromHost: host,
                                        toHost: nodeIP,
                                        isActive: connected
                                    ))
                                }
                            }
                        }
                    }
                } catch {
                    // Use defaults
                }
                break
            }

            nodes.append(DeviceNode(
                id: host,
                displayName: displayName,
                host: host,
                deviceType: deviceType,
                os: os,
                bots: bots
            ))
        }

        deviceNodes = nodes
        connections = allConnections
    }
}

// MARK: - Self Device Node (Center)

private struct SelfDeviceNode: View {
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // Pulse ring
            Circle()
                .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 2)
                .frame(width: 64, height: 64)
                .scaleEffect(isPulsing ? 1.3 : 1.0)
                .opacity(isPulsing ? 0.0 : 0.6)

            // Device circle
            Circle()
                .fill(Color.optaElevated)
                .frame(width: 56, height: 56)
                .overlay(
                    Circle()
                        .stroke(Color.optaPrimary.opacity(0.5), lineWidth: 2)
                )
                .shadow(color: .optaPrimary.opacity(0.3), radius: 10)

            Image(systemName: "laptopcomputer")
                .font(.system(size: 22))
                .foregroundColor(.optaPrimary)
        }
        .onAppear {
            withAnimation(.spring(response: 2, dampingFraction: 1.0).repeatForever(autoreverses: false)) {
                isPulsing = true
            }
        }
    }
}

// MARK: - Device Cluster View

private struct DeviceClusterView: View {
    let device: DeviceNode
    let appState: AppState
    let onBotTap: (BotConfig) -> Void
    @State private var isExpanded = true
    @State private var isHovered = false

    var body: some View {
        VStack(spacing: 8) {
            // Device header
            Button {
                withAnimation(.optaSpring) { isExpanded.toggle() }
            } label: {
                DeviceHeaderView(device: device)
            }
            .buttonStyle(.plain)

            // Bot bubbles
            if isExpanded {
                let rows = device.bots.chunked(into: 3)
                VStack(spacing: 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 10) {
                            ForEach(row) { bot in
                                BotBubbleView(
                                    bot: bot,
                                    viewModel: appState.viewModel(for: bot),
                                    onTap: { onBotTap(bot) }
                                )
                            }
                        }
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(width: 180)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaSurface.opacity(isHovered ? 0.4 : 0.15))
        )
        .onHover { hovering in
            withAnimation(.optaSnap) { isHovered = hovering }
        }
    }
}

// MARK: - Device Header

private struct DeviceHeaderView: View {
    let device: DeviceNode

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: device.deviceType.icon)
                .font(.system(size: 18))
                .foregroundColor(.optaTextSecondary)

            Text(device.displayName)
                .font(.sora(12, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            HStack(spacing: 4) {
                Text(device.host)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                if let os = device.os {
                    Text(os)
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.optaSurface))
                }
            }
        }
    }
}

// MARK: - Bot Bubble View

private struct BotBubbleView: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    let onTap: () -> Void
    @State private var isHovered = false

    private var accentColor: Color {
        switch bot.emoji {
        case "🥷🏿": return .optaRed
        case "🟢": return .optaGreen
        case "🟣": return .optaPrimary
        case "🧪": return .optaAmber
        case "🔵": return .optaBlue
        case "⚡": return .optaAmber
        default: return .optaPrimary
        }
    }

    private var statusLabel: String {
        switch viewModel.botState {
        case .idle:
            return viewModel.connectionState == .connected ? "Idle" : "Offline"
        case .thinking:
            return "Thinking..."
        case .typing:
            return "Typing..."
        }
    }

    private var isConnected: Bool {
        viewModel.connectionState == .connected
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 5) {
                ZStack {
                    // Status ring
                    Circle()
                        .stroke(
                            isConnected
                                ? (viewModel.botState == .idle ? Color.optaGreen : accentColor)
                                : Color.optaTextMuted.opacity(0.4),
                            lineWidth: isConnected ? 2.5 : 1
                        )
                        .frame(width: 44, height: 44)

                    // Thinking arc
                    if viewModel.botState == .thinking {
                        ThinkingArc(color: accentColor)
                            .frame(width: 44, height: 44)
                    }

                    // Bot emoji
                    Text(bot.emoji)
                        .font(.system(size: 20))

                    // Typing pulse
                    if viewModel.botState == .typing {
                        Circle()
                            .stroke(accentColor.opacity(0.4), lineWidth: 1.5)
                            .frame(width: 50, height: 50)
                            .modifier(PulseModifier())
                    }
                }

                // Activity chip
                Text(statusLabel)
                    .font(.sora(9, weight: .medium))
                    .foregroundColor(isConnected ? accentColor : .optaTextMuted)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(
                        Capsule().fill(
                            (isConnected ? accentColor : Color.optaTextMuted).opacity(0.1)
                        )
                    )
            }
            .scaleEffect(isHovered ? 1.08 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.optaSnap) { isHovered = hovering }
        }
        .help("\(bot.name) — \(statusLabel)")
        .contextMenu {
            Button {
                onTap()
            } label: {
                Label("Open Chat", systemImage: "bubble.left.fill")
            }

            Divider()

            if isConnected {
                Button {
                    viewModel.disconnect()
                } label: {
                    Label("Disconnect", systemImage: "bolt.slash")
                }
            } else {
                Button {
                    viewModel.connect()
                } label: {
                    Label("Connect", systemImage: "bolt.fill")
                }
            }
        }
    }
}

// MARK: - Thinking Arc

private struct ThinkingArc: View {
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
                withAnimation(.spring(response: 1.2, dampingFraction: 1.0).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
    }
}

// MARK: - Pulse Modifier

private struct PulseModifier: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.15 : 1.0)
            .opacity(isPulsing ? 0.3 : 0.8)
            .onAppear {
                withAnimation(.optaPulse) {
                    isPulsing = true
                }
            }
    }
}

// MARK: - Connection Lines Canvas

private struct ConnectionLinesCanvas: View {
    let center: CGPoint
    let devicePositions: [String: CGPoint]
    let connections: [DeviceConnection]
    let deviceNodes: [DeviceNode]

    var body: some View {
        Canvas { context, size in
            // Draw lines from center (self-device) to each device
            for device in deviceNodes {
                guard let pos = devicePositions[device.id] else { continue }
                drawLine(context: &context, from: center, to: pos, active: true)
            }

            // Draw inter-device connections
            for conn in connections {
                guard let fromPos = devicePositions[conn.fromHost],
                      let toPos = devicePositions[conn.toHost] else { continue }
                drawLine(context: &context, from: fromPos, to: toPos, active: conn.isActive)
            }
        }
    }

    private func drawLine(context: inout GraphicsContext, from: CGPoint, to: CGPoint, active: Bool) {
        var path = Path()

        let mid = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2)
        let dx = to.x - from.x
        let dy = to.y - from.y
        let dist = hypot(dx, dy)
        guard dist > 0 else { return }
        let perpOffset: CGFloat = 15
        let control = CGPoint(x: mid.x - dy * perpOffset / dist,
                              y: mid.y + dx * perpOffset / dist)

        path.move(to: from)
        path.addQuadCurve(to: to, control: control)

        if active {
            // Glow halo
            context.stroke(path, with: .color(.optaPrimary.opacity(0.15)), lineWidth: 6)
            // Solid line
            context.stroke(path, with: .color(.optaPrimary.opacity(0.6)), lineWidth: 1.5)
        } else {
            // Dashed inactive line
            context.stroke(
                path,
                with: .color(.optaTextMuted.opacity(0.15)),
                style: StrokeStyle(lineWidth: 0.8, dash: [4, 4])
            )
        }
    }
}

// MARK: - Notification Extension

extension Notification.Name {
    static let switchToChat = Notification.Name("switchToChat")
}

// MARK: - Array Chunking Helper

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
