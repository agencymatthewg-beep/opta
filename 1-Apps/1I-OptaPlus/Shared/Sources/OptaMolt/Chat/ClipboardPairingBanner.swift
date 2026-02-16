//
//  ClipboardPairingBanner.swift
//  OptaMolt
//
//  Compact inline banner shown at the top of the Bot Map when a
//  pairing URL is detected on the clipboard. Slides in from the top
//  with spring physics and uses glass surface styling.
//

import SwiftUI

/// A compact banner that notifies the user when a pairing link is detected
/// on the clipboard. Displays the gateway fingerprint preview and offers
/// "Pair" and dismiss actions.
///
/// Usage:
/// ```swift
/// ClipboardPairingBanner(
///     pairingInfo: info,
///     onPair: { pairingCoordinator.pendingPairingInfo = info },
///     onDismiss: { clipboardMonitor.dismiss() }
/// )
/// ```
public struct ClipboardPairingBanner: View {
    public let pairingInfo: PairingInfo
    public let onPair: () -> Void
    public let onDismiss: () -> Void

    public init(
        pairingInfo: PairingInfo,
        onPair: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.pairingInfo = pairingInfo
        self.onPair = onPair
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: 12) {
            // Link icon
            Image(systemName: "link.badge.plus")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.optaPrimary)

            // Text content
            VStack(alignment: .leading, spacing: 2) {
                Text("Pairing link detected")
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                Text(fingerprintPreview)
                    .font(.sora(11, weight: .regular))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(1)
            }

            Spacer()

            // Pair button
            Button(action: onPair) {
                Text("Pair")
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaVoid)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color.optaPrimary))
            }
            #if os(macOS)
            .buttonStyle(.plain)
            #endif
            .accessibilityLabel("Pair with detected gateway")

            // Dismiss button
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.optaTextSecondary)
                    .frame(width: 28, height: 28)
                    .background(
                        Circle()
                            .fill(Color.white.opacity(0.06))
                    )
            }
            #if os(macOS)
            .buttonStyle(.plain)
            #endif
            .accessibilityLabel("Dismiss pairing banner")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.optaPrimary.opacity(0.2), lineWidth: 0.5)
        )
        .shadow(color: Color.optaPrimary.opacity(0.08), radius: 12, y: 4)
        .padding(.horizontal, 16)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Helpers

    /// Shows a truncated fingerprint for quick visual confirmation.
    private var fingerprintPreview: String {
        let fp = pairingInfo.fingerprint
        if fp.count > 16 {
            return "\(fp.prefix(8))...\(fp.suffix(8))"
        }
        return fp
    }
}
