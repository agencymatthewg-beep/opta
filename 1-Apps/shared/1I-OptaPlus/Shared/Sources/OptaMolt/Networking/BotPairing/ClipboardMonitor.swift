//
//  ClipboardMonitor.swift
//  OptaMolt
//
//  Monitors the system pasteboard for optaplus://pair URLs.
//  Checks clipboard when the app becomes active and publishes any
//  detected PairingInfo for the UI to present an inline banner.
//

import Foundation
import os.log
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Monitors the system pasteboard for `optaplus://pair` deep links.
///
/// When the app comes to the foreground, call `checkClipboard()` to read
/// the current pasteboard contents. If a valid pairing URL is found
/// (and it differs from the last detected URL), the parsed `PairingInfo`
/// is published via `detectedPairing`.
///
/// Usage:
/// ```swift
/// @StateObject private var clipboardMonitor = ClipboardMonitor()
///
/// .onChange(of: scenePhase) { _, phase in
///     if phase == .active {
///         clipboardMonitor.checkClipboard()
///     }
/// }
/// ```
@MainActor
public final class ClipboardMonitor: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "ClipboardMonitor")

    /// The most recently detected pairing info from the clipboard.
    /// Set to `nil` when the user dismisses or acts on the banner.
    @Published public var detectedPairing: PairingInfo?

    /// Tracks the last raw URL string we surfaced to avoid re-showing
    /// the same pairing offer after the user dismisses it.
    private var lastDetectedURL: String?

    public init() {}

    // MARK: - Public API

    /// Reads the current pasteboard and checks for an `optaplus://pair` URL.
    ///
    /// If a new, valid pairing URL is found (different from the last one we
    /// detected), it is parsed and published to `detectedPairing`.
    public func checkClipboard() {
        guard let text = readPasteboard() else { return }

        // Quick guard — skip parsing unless the clipboard plausibly contains a link.
        guard text.contains("optaplus://pair") else { return }

        // Avoid re-detecting the same URL the user already dismissed.
        guard text != lastDetectedURL else { return }

        guard let info = PairingCoordinator.parseClipboardText(text) else { return }

        Self.logger.info("Pairing URL detected on clipboard (fingerprint: \(info.fingerprint.prefix(8))...)")
        lastDetectedURL = text
        detectedPairing = info
    }

    /// Dismiss the current detection — hides the banner without pairing.
    public func dismiss() {
        detectedPairing = nil
    }

    /// Reset tracking so the same URL can be detected again (e.g. after unpairing).
    public func reset() {
        lastDetectedURL = nil
        detectedPairing = nil
    }

    // MARK: - Private

    /// Platform-specific pasteboard read.
    private func readPasteboard() -> String? {
        #if os(iOS)
        return UIPasteboard.general.string
        #elseif os(macOS)
        return NSPasteboard.general.string(forType: .string)
        #else
        return nil
        #endif
    }
}
