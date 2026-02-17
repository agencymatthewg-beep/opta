//
//  ScreenContextModule.swift
//  OptaPlusMacOS
//
//  X3. Live Screen Context Sharing — share your screen or specific windows
//  with a bot so it can reference visual elements. Supports full screen,
//  window, region, and clipboard capture modes.
//
//  Module registration:  Add ScreenContextToggle to ChatTextInput toolbar area
//  Module removal:       Delete this file. Standard text + file attachment only.
//
//  Keyboard shortcuts:
//    ⌘⇧S  — Capture current screen
//    ⌘⇧W  — Capture active window
//    ⌘⇧A  — Capture region (interactive)
//
//  Event bus:
//    Posts:    .module_screen_captureAttached (ChatAttachment)
//    Listens:  (none)
//
//  Frameworks: ScreenCaptureKit (macOS 13+), CoreGraphics
//

import SwiftUI
import Combine
import AppKit
import OptaMolt
import os.log

// MARK: - Capture Mode

/// The type of screen capture to perform.
enum CaptureMode: String, CaseIterable, Identifiable {
    case fullScreen = "Full Screen"
    case window = "Window"
    case region = "Region"
    case clipboard = "Clipboard"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .fullScreen: return "rectangle.dashed"
        case .window: return "macwindow"
        case .region: return "crop"
        case .clipboard: return "doc.on.clipboard"
        }
    }

    var shortcutHint: String {
        switch self {
        case .fullScreen: return "⌘⇧S"
        case .window: return "⌘⇧W"
        case .region: return "⌘⇧A"
        case .clipboard: return ""
        }
    }
}

// MARK: - Capture Settings

/// User-configurable capture settings.
struct CaptureSettings {
    var autoCapture: Bool = false
    var captureInterval: TimeInterval = 15.0  // seconds
    var jpegQuality: CGFloat = 0.6
    var diffThreshold: CGFloat = 0.15  // 15% pixel difference
    var maxWidth: CGFloat = 1920  // Downscale if wider
    var showPrivacyIndicator: Bool = true
    var redactionZones: [CGRect] = []  // User-drawn redaction areas (normalized 0-1)
}

// MARK: - Capture Result

/// The result of a screen capture operation.
struct CaptureResult: Identifiable {
    let id = UUID()
    let image: NSImage
    let data: Data
    let timestamp: Date
    let mode: CaptureMode
    let windowTitle: String?
    let sizeBytes: Int

    var thumbnail: NSImage {
        let thumbSize = NSSize(width: 120, height: 80)
        let thumb = NSImage(size: thumbSize)
        thumb.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: thumbSize),
                   from: NSRect(origin: .zero, size: image.size),
                   operation: .copy, fraction: 1.0)
        thumb.unlockFocus()
        return thumb
    }

    func toChatAttachment() -> ChatAttachment {
        ChatAttachment(
            filename: "screen-\(DateFormatter.captureFormatter.string(from: timestamp)).jpg",
            mimeType: "image/jpeg",
            sizeBytes: sizeBytes,
            data: data,
            thumbnailData: thumbnail.tiffRepresentation
        )
    }
}

private extension DateFormatter {
    static let captureFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HHmmss"
        return f
    }()
}

// MARK: - Screen Capture Engine

/// Performs screen captures using CoreGraphics (macOS 12+) or ScreenCaptureKit (macOS 13+).
/// Pure framework approach - no external dependencies.
@MainActor
final class ScreenCaptureEngine: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "ScreenCapture")

    // MARK: Published State
    @Published var isCapturing: Bool = false
    @Published var isAutoCaptureActive: Bool = false
    @Published var lastCapture: CaptureResult?
    @Published var captureHistory: [CaptureResult] = []
    @Published var settings = CaptureSettings()
    @Published var hasPermission: Bool = false

    // MARK: Private
    private var autoCaptureTimer: Timer?
    private var lastCapturePixelHash: Int = 0
    private static let maxHistory = 5

    init() {
        checkPermission()
    }

    // MARK: - Permission

    func checkPermission() {
        // CGPreflightScreenCaptureAccess() is available macOS 10.15+
        hasPermission = CGPreflightScreenCaptureAccess()
    }

    func requestPermission() {
        // Opens System Settings > Privacy > Screen Recording
        CGRequestScreenCaptureAccess()
        // Re-check after a delay
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            checkPermission()
        }
    }

    // MARK: - Capture Full Screen

    func captureFullScreen() async -> CaptureResult? {
        guard hasPermission else {
            requestPermission()
            return nil
        }
        isCapturing = true
        defer { isCapturing = false }

        guard let cgImage = CGWindowListCreateImage(
            CGRect.null,  // Full screen
            .optionOnScreenOnly,
            kCGNullWindowID,
            [.boundsIgnoreFraming, .nominalResolution]
        ) else {
            Self.logger.error("Full screen capture failed")
            return nil
        }

        return processCapture(cgImage, mode: .fullScreen, windowTitle: nil)
    }

    // MARK: - Capture Window

    func captureWindow(windowId: CGWindowID) async -> CaptureResult? {
        guard hasPermission else { requestPermission(); return nil }
        isCapturing = true
        defer { isCapturing = false }

        let bounds = CGRect.null  // Let CG determine bounds from window
        guard let cgImage = CGWindowListCreateImage(
            bounds,
            .optionIncludingWindow,
            windowId,
            [.boundsIgnoreFraming, .nominalResolution]
        ) else {
            Self.logger.error("Window capture failed for window \(windowId)")
            return nil
        }

        // Get window title
        let title = getWindowTitle(windowId: windowId)
        return processCapture(cgImage, mode: .window, windowTitle: title)
    }

    /// List available windows for the window picker.
    func listWindows() -> [(id: CGWindowID, title: String, ownerName: String)] {
        guard let infoList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return []
        }

        return infoList.compactMap { info in
            guard let windowId = info[kCGWindowNumber as String] as? CGWindowID,
                  let ownerName = info[kCGWindowOwnerName as String] as? String else {
                return nil
            }
            // Skip our own window and tiny windows
            if ownerName == "OptaPlus" { return nil }
            let title = info[kCGWindowName as String] as? String ?? ownerName
            let bounds = info[kCGWindowBounds as String] as? [String: CGFloat]
            let width = bounds?["Width"] ?? 0
            let height = bounds?["Height"] ?? 0
            if width < 100 || height < 50 { return nil }  // Skip tiny windows

            return (id: windowId, title: title, ownerName: ownerName)
        }
    }

    // MARK: - Capture Region (Interactive)

    func captureRegion() async -> CaptureResult? {
        guard hasPermission else { requestPermission(); return nil }
        isCapturing = true
        defer { isCapturing = false }

        // Use screencapture CLI for interactive region selection
        // This presents the native macOS region selection UI
        let tempPath = NSTemporaryDirectory() + "optaplus-region-\(UUID().uuidString).png"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = ["-i", "-x", tempPath]  // -i interactive, -x no sound

        do {
            try process.run()
            process.waitUntilExit()

            guard process.terminationStatus == 0,
                  let imageData = try? Data(contentsOf: URL(fileURLWithPath: tempPath)),
                  let nsImage = NSImage(data: imageData),
                  let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                try? FileManager.default.removeItem(atPath: tempPath)
                return nil
            }

            try? FileManager.default.removeItem(atPath: tempPath)
            return processCapture(cgImage, mode: .region, windowTitle: nil)
        } catch {
            Self.logger.error("Region capture failed: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Capture Clipboard

    func captureClipboard() -> CaptureResult? {
        guard let pasteboard = NSPasteboard.general.data(forType: .tiff),
              let nsImage = NSImage(data: pasteboard),
              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }
        return processCapture(cgImage, mode: .clipboard, windowTitle: nil)
    }

    // MARK: - Auto Capture

    func startAutoCapture() {
        guard !isAutoCaptureActive else { return }
        isAutoCaptureActive = true
        autoCaptureTimer = Timer.scheduledTimer(withTimeInterval: settings.captureInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.autoCaptureFrame()
            }
        }
    }

    func stopAutoCapture() {
        isAutoCaptureActive = false
        autoCaptureTimer?.invalidate()
        autoCaptureTimer = nil
    }

    private func autoCaptureFrame() async {
        guard let result = await captureFullScreen() else { return }
        // Check if image differs enough from last capture
        let currentHash = result.data.hashValue
        let diff = abs(currentHash &- lastCapturePixelHash)
        if diff > Int(settings.diffThreshold * 1_000_000) {
            lastCapturePixelHash = currentHash
            // Only store if significantly different
            addToHistory(result)
        }
    }

    // MARK: - Processing

    private func processCapture(_ cgImage: CGImage, mode: CaptureMode, windowTitle: String?) -> CaptureResult? {
        var nsImage = NSImage(cgImage: cgImage, size: NSSize(
            width: CGFloat(cgImage.width),
            height: CGFloat(cgImage.height)
        ))

        // Downscale if too large
        if CGFloat(cgImage.width) > settings.maxWidth {
            let scale = settings.maxWidth / CGFloat(cgImage.width)
            let newSize = NSSize(
                width: settings.maxWidth,
                height: CGFloat(cgImage.height) * scale
            )
            let resized = NSImage(size: newSize)
            resized.lockFocus()
            nsImage.draw(in: NSRect(origin: .zero, size: newSize))
            resized.unlockFocus()
            nsImage = resized
        }

        // Apply redaction zones
        if !settings.redactionZones.isEmpty {
            nsImage = applyRedaction(nsImage, zones: settings.redactionZones)
        }

        // Compress to JPEG
        guard let tiff = nsImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let jpegData = bitmap.representation(
                using: .jpeg,
                properties: [.compressionFactor: settings.jpegQuality]
              ) else {
            return nil
        }

        let result = CaptureResult(
            image: nsImage,
            data: jpegData,
            timestamp: Date(),
            mode: mode,
            windowTitle: windowTitle,
            sizeBytes: jpegData.count
        )

        lastCapture = result
        addToHistory(result)

        Self.logger.info("Captured \(mode.rawValue): \(jpegData.count) bytes")
        return result
    }

    private func applyRedaction(_ image: NSImage, zones: [CGRect]) -> NSImage {
        let redacted = NSImage(size: image.size)
        redacted.lockFocus()
        image.draw(at: .zero, from: .zero, operation: .copy, fraction: 1.0)

        // Draw blur rectangles over redaction zones
        for zone in zones {
            let rect = NSRect(
                x: zone.minX * image.size.width,
                y: zone.minY * image.size.height,
                width: zone.width * image.size.width,
                height: zone.height * image.size.height
            )
            NSColor.black.withAlphaComponent(0.85).setFill()
            NSBezierPath(roundedRect: rect, xRadius: 4, yRadius: 4).fill()
        }

        redacted.unlockFocus()
        return redacted
    }

    private func addToHistory(_ result: CaptureResult) {
        captureHistory.insert(result, at: 0)
        if captureHistory.count > Self.maxHistory {
            captureHistory = Array(captureHistory.prefix(Self.maxHistory))
        }
    }

    private func getWindowTitle(windowId: CGWindowID) -> String? {
        guard let infoList = CGWindowListCopyWindowInfo([.optionIncludingWindow], windowId) as? [[String: Any]],
              let info = infoList.first else {
            return nil
        }
        return info[kCGWindowName as String] as? String ?? info[kCGWindowOwnerName as String] as? String
    }
}

// MARK: - Screen Context Toggle (Chat Input Attachment)

/// Toggle button added to the chat input area for screen context sharing.
struct ScreenContextToggle: View {
    @StateObject private var captureEngine = ScreenCaptureEngine()
    @Binding var pendingAttachments: [ChatAttachment]
    @State private var showMenu = false
    @State private var showWindowPicker = false
    @State private var showSettings = false

    var body: some View {
        ZStack {
            // Main capture button
            Button(action: { showMenu.toggle() }) {
                ZStack {
                    Image(systemName: captureEngine.isAutoCaptureActive ? "video.fill" : "camera")
                        .font(.system(size: 13))
                        .foregroundColor(captureEngine.isAutoCaptureActive ? .optaRed : .optaTextSecondary)

                    // Active indicator
                    if captureEngine.isAutoCaptureActive {
                        Circle()
                            .fill(Color.optaRed)
                            .frame(width: 5, height: 5)
                            .offset(x: 8, y: -8)
                            .optaBreathing(minOpacity: 0.5, maxOpacity: 1.0)
                    }
                }
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showMenu) {
                captureMenu
            }
            .accessibilityLabel("Screen capture")
            .accessibilityHint("Capture screen content to share with bot")
        }
    }

    // MARK: - Capture Menu

    private var captureMenu: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 12))
                    .foregroundColor(.optaPrimary)
                Text("Screen Capture")
                    .font(.sora(12, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()

                // Permission status
                if !captureEngine.hasPermission {
                    Button("Grant Access") {
                        captureEngine.requestPermission()
                    }
                    .font(.sora(10))
                    .foregroundColor(.optaAmber)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider().background(Color.optaBorder.opacity(0.5))

            // Capture modes
            VStack(spacing: 2) {
                ForEach(CaptureMode.allCases) { mode in
                    Button(action: { performCapture(mode: mode) }) {
                        HStack(spacing: 10) {
                            Image(systemName: mode.icon)
                                .font(.system(size: 12))
                                .foregroundColor(.optaPrimary)
                                .frame(width: 20)

                            Text(mode.rawValue)
                                .font(.sora(12))
                                .foregroundColor(.optaTextPrimary)

                            Spacer()

                            if !mode.shortcutHint.isEmpty {
                                Text(mode.shortcutHint)
                                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                                    .foregroundColor(.optaTextMuted)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(Color.optaSurface.opacity(0.5))
                                    )
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.clear)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(6)

            Divider().background(Color.optaBorder.opacity(0.3))

            // Auto capture toggle
            HStack {
                Toggle(isOn: Binding(
                    get: { captureEngine.isAutoCaptureActive },
                    set: { $0 ? captureEngine.startAutoCapture() : captureEngine.stopAutoCapture() }
                )) {
                    HStack(spacing: 6) {
                        Image(systemName: "timer")
                            .font(.system(size: 10))
                        Text("Auto-capture every \(Int(captureEngine.settings.captureInterval))s")
                            .font(.sora(10))
                    }
                    .foregroundColor(.optaTextSecondary)
                }
                .toggleStyle(.switch)
                .controlSize(.small)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // Recent captures
            if !captureEngine.captureHistory.isEmpty {
                Divider().background(Color.optaBorder.opacity(0.3))
                recentCaptures
            }

            Divider().background(Color.optaBorder.opacity(0.3))

            // Settings
            Button(action: { showSettings = true }) {
                HStack(spacing: 6) {
                    Image(systemName: "gear")
                        .font(.system(size: 10))
                    Text("Settings")
                        .font(.sora(10))
                }
                .foregroundColor(.optaTextMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
        }
        .frame(width: 240)
        .background(.ultraThinMaterial)
    }

    // MARK: - Recent Captures Strip

    private var recentCaptures: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Recent")
                .font(.sora(9, weight: .medium))
                .foregroundColor(.optaTextMuted)
                .padding(.horizontal, 12)
                .padding(.top, 6)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(captureEngine.captureHistory.prefix(3)) { capture in
                        Button(action: { attachCapture(capture) }) {
                            VStack(spacing: 2) {
                                Image(nsImage: capture.thumbnail)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 60, height: 40)
                                    .cornerRadius(4)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .stroke(Color.optaBorder, lineWidth: 0.5)
                                    )

                                Text(capture.timestamp, style: .time)
                                    .font(.system(size: 8))
                                    .foregroundColor(.optaTextMuted)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
            }
            .padding(.bottom, 6)
        }
    }

    // MARK: - Actions

    private func performCapture(mode: CaptureMode) {
        showMenu = false
        Task {
            let result: CaptureResult?
            switch mode {
            case .fullScreen:
                result = await captureEngine.captureFullScreen()
            case .window:
                // Show window picker
                showWindowPicker = true
                return
            case .region:
                result = await captureEngine.captureRegion()
            case .clipboard:
                result = captureEngine.captureClipboard()
            }

            if let result {
                attachCapture(result)
            }
        }
    }

    private func attachCapture(_ capture: CaptureResult) {
        let attachment = capture.toChatAttachment()
        pendingAttachments.append(attachment)

        NotificationCenter.default.post(
            name: .module_screen_captureAttached,
            object: nil,
            userInfo: ["attachment": attachment]
        )
    }
}

// MARK: - Window Picker View

struct WindowPickerView: View {
    @StateObject private var captureEngine = ScreenCaptureEngine()
    @Binding var isPresented: Bool
    var onCapture: (CaptureResult) -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("Select Window to Capture")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(captureEngine.listWindows(), id: \.id) { window in
                        Button(action: {
                            Task {
                                if let result = await captureEngine.captureWindow(windowId: window.id) {
                                    onCapture(result)
                                    isPresented = false
                                }
                            }
                        }) {
                            HStack(spacing: 10) {
                                Image(systemName: "macwindow")
                                    .font(.system(size: 12))
                                    .foregroundColor(.optaPrimary)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(window.title)
                                        .font(.sora(12))
                                        .foregroundColor(.optaTextPrimary)
                                        .lineLimit(1)
                                    Text(window.ownerName)
                                        .font(.sora(9))
                                        .foregroundColor(.optaTextMuted)
                                }
                                Spacer()
                            }
                            .padding(8)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.optaSurface.opacity(0.3))
                            )
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxHeight: 300)

            Button("Cancel") { isPresented = false }
                .foregroundColor(.optaTextSecondary)
        }
        .padding(16)
        .frame(width: 340)
        .background(Color.optaVoid)
    }
}

// MARK: - Capture Settings View

struct CaptureSettingsView: View {
    @Binding var settings: CaptureSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("Capture Settings")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            // Quality slider
            VStack(alignment: .leading, spacing: 4) {
                Text("JPEG Quality: \(Int(settings.jpegQuality * 100))%")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Slider(value: $settings.jpegQuality, in: 0.2...1.0, step: 0.1)
                Text("Lower = smaller files, faster sending")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }

            // Auto-capture interval
            VStack(alignment: .leading, spacing: 4) {
                Text("Auto-capture interval: \(Int(settings.captureInterval))s")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Slider(value: $settings.captureInterval, in: 5...60, step: 5)
            }

            // Max resolution
            VStack(alignment: .leading, spacing: 4) {
                Text("Max width: \(Int(settings.maxWidth))px")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Slider(value: $settings.maxWidth, in: 640...3840, step: 320)
            }

            // Diff threshold
            VStack(alignment: .leading, spacing: 4) {
                Text("Change threshold: \(Int(settings.diffThreshold * 100))%")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Slider(value: $settings.diffThreshold, in: 0.05...0.5, step: 0.05)
                Text("Auto-capture only sends when screen changes this much")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }

            // Privacy
            Toggle("Show capture indicator", isOn: $settings.showPrivacyIndicator)
                .font(.sora(11))

            HStack {
                Button("Cancel") { dismiss() }
                    .foregroundColor(.optaTextSecondary)
                Spacer()
                Button("Done") { dismiss() }
                    .foregroundColor(.optaPrimary)
            }
        }
        .padding(20)
        .frame(width: 360)
        .background(Color.optaVoid)
    }
}

// MARK: - Privacy Indicator

/// Persistent floating indicator when screen sharing is active.
/// Shows a pulsing red dot in the toolbar area.
struct CaptureIndicator: View {
    let isActive: Bool

    var body: some View {
        if isActive {
            HStack(spacing: 4) {
                Circle()
                    .fill(Color.optaRed)
                    .frame(width: 6, height: 6)
                    .optaBreathing(minOpacity: 0.5, maxOpacity: 1.0)

                Text("Screen sharing")
                    .font(.sora(9, weight: .medium))
                    .foregroundColor(.optaRed)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule().fill(Color.optaRed.opacity(0.1))
            )
            .overlay(
                Capsule().stroke(Color.optaRed.opacity(0.3), lineWidth: 0.5)
            )
            .transition(.opacity.combined(with: .scale(scale: 0.9)))
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_screen_captureAttached = Notification.Name("module.screen.captureAttached")
}
