//
//  BotDetailSheet.swift
//  OptaMolt
//
//  Detail sheet presented when tapping a bot node in the constellation map.
//  Shows bot identity, connection status, gateway info, and management actions.
//

import SwiftUI

// MARK: - Bot Detail Sheet

public struct BotDetailSheet: View {
    let node: BotNode
    var onConnect: () -> Void = {}
    var onDisconnect: () -> Void = {}
    var onForget: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @State private var showForgetConfirmation = false

    public init(
        node: BotNode,
        onConnect: @escaping () -> Void = {},
        onDisconnect: @escaping () -> Void = {},
        onForget: @escaping () -> Void = {}
    ) {
        self.node = node
        self.onConnect = onConnect
        self.onDisconnect = onDisconnect
        self.onForget = onForget
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Drag indicator
            RoundedRectangle(cornerRadius: 2.5)
                .fill(Color.optaTextMuted.opacity(0.4))
                .frame(width: 36, height: 5)
                .padding(.top, 10)
                .padding(.bottom, 16)

            ScrollView {
                VStack(spacing: 20) {
                    // Bot identity header
                    identitySection

                    // Connection status badge
                    statusBadge

                    // Gateway info card
                    gatewayCard

                    // Last seen
                    lastSeenRow

                    // Action buttons
                    actionButtons
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .background(Color.optaElevated)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .ignition()
        .alert("Forget Bot", isPresented: $showForgetConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Forget", role: .destructive) {
                onForget()
                dismiss()
            }
        } message: {
            Text("This will remove \(node.name) from your paired bots. You can re-pair later via scan or deep link.")
        }
    }

    // MARK: - Identity Section

    private var identitySection: some View {
        VStack(spacing: 8) {
            Text(node.emoji)
                .font(.system(size: 48))

            Text(node.name)
                .font(.soraTitle2)
                .foregroundColor(.optaTextPrimary)

            Text(node.botId)
                .font(.soraCaption)
                .foregroundColor(.optaTextMuted)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
                .modifier(StatusPulseModifier(isActive: node.state == .connecting || node.state == .pairing))

            Text(statusLabel)
                .font(.sora(13, weight: .medium))
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(
            Capsule()
                .fill(statusColor.opacity(0.12))
        )
        .overlay(
            Capsule()
                .stroke(statusColor.opacity(0.2), lineWidth: 0.5)
        )
    }

    // MARK: - Gateway Card

    private var gatewayCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "network")
                    .font(.soraCaption)
                    .foregroundColor(.optaTextMuted)

                Text("Gateway")
                    .font(.sora(11, weight: .semibold))
                    .foregroundColor(.optaTextMuted)
                    .textCase(.uppercase)
            }

            if let host = node.gatewayHost {
                HStack(spacing: 0) {
                    Text(host)
                        .font(.sora(14, weight: .medium))
                        .foregroundColor(.optaTextPrimary)

                    if let port = node.gatewayPort {
                        Text(":\(port)")
                            .font(.sora(14, weight: .medium))
                            .foregroundColor(.optaTextSecondary)
                    }
                }
            } else if let remote = node.remoteURL {
                Text(remote)
                    .font(.sora(13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(2)
                    .truncationMode(.middle)
            } else {
                Text("No gateway info")
                    .font(.soraBody)
                    .foregroundColor(.optaTextMuted)
            }

            // Fingerprint
            HStack(spacing: 4) {
                Image(systemName: "key.fill")
                    .font(.system(size: 9))
                    .foregroundColor(.optaTextMuted)

                Text(node.gatewayFingerprint)
                    .font(.sora(10, weight: .regular))
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.optaSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.optaGlassBorder, lineWidth: 0.5)
        )
    }

    // MARK: - Last Seen

    private var lastSeenRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.soraCaption)
                .foregroundColor(.optaTextMuted)

            Text("Last seen")
                .font(.soraCaption)
                .foregroundColor(.optaTextMuted)

            Spacer()

            Text(relativeTime(from: node.lastSeen))
                .font(.sora(12, weight: .medium))
                .foregroundColor(.optaTextSecondary)
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 12) {
            switch node.state {
            case .connected, .connecting:
                // Disconnect button (outlined, red)
                Button {
                    onDisconnect()
                    dismiss()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "bolt.slash.fill")
                        Text("Disconnect")
                            .font(.soraHeadline)
                    }
                    .foregroundColor(.optaRed)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.optaRed.opacity(0.5), lineWidth: 1.5)
                    )
                }

            case .disconnected, .paired, .discovered, .error:
                // Connect button (filled, primary)
                Button {
                    onConnect()
                    dismiss()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "bolt.fill")
                        Text("Connect")
                            .font(.soraHeadline)
                    }
                    .foregroundColor(.optaVoid)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.optaPrimary)
                    )
                }

            case .pairing:
                // Pairing in progress — disabled
                HStack(spacing: 8) {
                    ProgressView()
                        .tint(.optaTextMuted)
                    Text("Pairing...")
                        .font(.soraHeadline)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.optaSurface)
                )
            }

            // Forget bot button (text style, red)
            Button {
                showForgetConfirmation = true
            } label: {
                Text("Forget Bot")
                    .font(.sora(13, weight: .medium))
                    .foregroundColor(.optaRed.opacity(0.8))
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Helpers

    private var statusColor: Color {
        switch node.state {
        case .connected: return .optaGreen
        case .connecting, .pairing: return .optaAmber
        case .disconnected, .error: return .optaRed
        case .discovered, .paired: return .optaPrimary
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

    private func relativeTime(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)

        if interval < 5 {
            return "Just now"
        } else if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes) minute\(minutes == 1 ? "" : "s") ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours) hour\(hours == 1 ? "" : "s") ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days) day\(days == 1 ? "" : "s") ago"
        }
    }
}

// MARK: - Status Pulse Modifier

private struct StatusPulseModifier: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        if isActive {
            content
                .optaBreathing(minOpacity: 0.4, maxOpacity: 1.0)
        } else {
            content
        }
    }
}
