//
//  BotWebView.swift
//  OptaPlusIOS
//
//  Radial network topology visualization showing the bot fleet.
//  User's device at center, devices arranged radially, bots as bubbles
//  with real-time connection state, animated status indicators.
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
            case .selfDevice: return "iphone.gen3"
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
    @State private var deviceNodes: [DeviceNode] = []
    @State private var connections: [DeviceConnection] = []
    @State private var isLoading = false
    @State private var selectedBotForChat: BotConfig?

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
                let maxRadius = min(geometry.size.width, geometry.size.height) * 0.35

                ZStack {
                    Color.optaVoid.ignoresSafeArea()

                    if isLoading && deviceNodes.isEmpty {
                        VStack(spacing: 12) {
                            OptaLoader(size: 28)
                            Text("Mapping network...")
                                .font(.sora(13, weight: .regular))
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
                                onBotTap: { bot in selectedBotForChat = bot }
                            )
                            .position(pos)
                            .optaEntrance(delay: Double(index) * 0.08)
                        }
                    }
                }
            }
            .navigationTitle("Bot Web")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                await loadTopology()
            }
            .task {
                await loadTopology()
            }
            .navigationDestination(item: $selectedBotForChat) { bot in
                let vm = appState.viewModel(for: bot)
                ChatView(viewModel: vm, botConfig: bot)
                    .navigationTitle(bot.name)
            }
        }
    }

    // MARK: - Layout

    private func devicePosition(index: Int, total: Int, center: CGPoint, radius: CGFloat) -> CGPoint {
        guard total > 0 else { return center }
        let effectiveRadius = min(radius, 180)

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
            // Determine device type from node.list if available
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
                        // Find the gateway node
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

                        // Build connections from nodes that reference different hosts
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
                break // Only need info from one connected bot per host
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
                .frame(width: 56, height: 56)
                .scaleEffect(isPulsing ? 1.3 : 1.0)
                .opacity(isPulsing ? 0.0 : 0.6)

            // Device circle
            Circle()
                .fill(Color.optaElevated)
                .frame(width: 48, height: 48)
                .overlay(
                    Circle()
                        .stroke(Color.optaPrimary.opacity(0.5), lineWidth: 2)
                )
                .shadow(color: .optaPrimary.opacity(0.3), radius: 8)

            Image(systemName: "iphone.gen3")
                .font(.sora(20, weight: .regular))
                .foregroundColor(.optaPrimary)
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
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

    var body: some View {
        VStack(spacing: 6) {
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
                VStack(spacing: 6) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 8) {
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
        .frame(width: 140)
    }
}

// MARK: - Device Header

private struct DeviceHeaderView: View {
    let device: DeviceNode

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: device.deviceType.icon)
                .font(.sora(16, weight: .regular))
                .foregroundColor(.optaTextSecondary)

            Text(device.displayName)
                .font(.sora(11, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            HStack(spacing: 4) {
                Text(device.host)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                if let os = device.os {
                    Text(os)
                        .font(.sora(8, weight: .regular))
                        .foregroundColor(.optaTextMuted)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
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

    private var accentColor: Color {
        // Per-bot themed color based on emoji/name
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
            VStack(spacing: 4) {
                ZStack {
                    // Status ring
                    Circle()
                        .stroke(
                            isConnected
                                ? (viewModel.botState == .idle ? Color.optaGreen : accentColor)
                                : Color.optaTextMuted.opacity(0.4),
                            lineWidth: isConnected ? 2 : 1
                        )
                        .frame(width: 38, height: 38)

                    // Thinking arc
                    if viewModel.botState == .thinking {
                        ThinkingArc(color: accentColor)
                            .frame(width: 38, height: 38)
                    }

                    // Bot emoji
                    Text(bot.emoji)
                        .font(.sora(18, weight: .regular))

                    // Typing pulse
                    if viewModel.botState == .typing {
                        Circle()
                            .stroke(accentColor.opacity(0.4), lineWidth: 1.5)
                            .frame(width: 42, height: 42)
                            .modifier(PulseModifier())
                    }
                }

                // Activity chip
                Text(statusLabel)
                    .font(.sora(8, weight: .medium))
                    .foregroundColor(isConnected ? accentColor : .optaTextMuted)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule().fill(
                            (isConnected ? accentColor : Color.optaTextMuted).opacity(0.1)
                        )
                    )
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                onTap()
            } label: {
                Label("Open Chat", systemImage: "bubble.left.fill")
            }

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
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
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
            // Draw lines from center (self-device) to each device with any connected bot
            for device in deviceNodes {
                guard let pos = devicePositions[device.id] else { continue }
                let hasConnectedBot = device.bots.contains { _ in true } // All devices get a line
                let isActive = device.bots.contains { bot in
                    // Check if any bot on this device is connected (we can't access viewModel here,
                    // so we draw all as potentially active and the bubble colors indicate state)
                    true
                }

                drawLine(context: &context, from: center, to: pos, active: hasConnectedBot && isActive)
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

        // Quadratic curve with perpendicular offset for smooth arcs
        let mid = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2)
        let dx = to.x - from.x
        let dy = to.y - from.y
        let perpOffset: CGFloat = 15
        let control = CGPoint(x: mid.x - dy * perpOffset / hypot(dx, dy),
                              y: mid.y + dx * perpOffset / hypot(dx, dy))

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

// MARK: - Array Chunking Helper

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
