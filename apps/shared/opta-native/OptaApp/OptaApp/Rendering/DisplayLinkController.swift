//
//  DisplayLinkController.swift
//  OptaApp
//
//  CVDisplayLink controller for ProMotion-aware frame timing on macOS
//

import Foundation
import CoreVideo
import QuartzCore
import AppKit

// MARK: - Display Link Controller

/// Controls CVDisplayLink for synchronized frame rendering
/// Supports ProMotion displays (120Hz) on Apple Silicon Macs
final class DisplayLinkController {

    // MARK: - Types

    /// Callback invoked on each display refresh
    typealias FrameCallback = (CFTimeInterval) -> Void

    // MARK: - Properties

    /// The CVDisplayLink instance
    private var displayLink: CVDisplayLink?

    /// Callback for frame updates
    private let frameCallback: FrameCallback

    /// Whether the display link is running
    private(set) var isRunning: Bool = false

    /// Detected refresh rate of the display
    private(set) var refreshRate: Double = 60.0

    /// Last frame timestamp
    private var lastTimestamp: CVTimeStamp = CVTimeStamp()

    /// Thread safety
    private let lock = NSLock()

    // MARK: - Initialization

    /// Create a display link controller
    /// - Parameter callback: Callback invoked on each frame
    init(callback: @escaping FrameCallback) {
        self.frameCallback = callback
        setupDisplayLink()
    }

    deinit {
        stop()
        // Note: CVDisplayLink is automatically released by ARC on modern macOS
        displayLink = nil
    }

    // MARK: - Setup

    private func setupDisplayLink() {
        // Create display link for the main display
        var displayLinkOut: CVDisplayLink?
        let status = CVDisplayLinkCreateWithActiveCGDisplays(&displayLinkOut)

        guard status == kCVReturnSuccess, let link = displayLinkOut else {
            print("[DisplayLinkController] Failed to create display link: \(status)")
            return
        }

        displayLink = link

        // Set up the callback
        let opaquePtr = Unmanaged.passUnretained(self).toOpaque()

        CVDisplayLinkSetOutputCallback(link, { (
            displayLink: CVDisplayLink,
            inNow: UnsafePointer<CVTimeStamp>,
            inOutputTime: UnsafePointer<CVTimeStamp>,
            flagsIn: CVOptionFlags,
            flagsOut: UnsafeMutablePointer<CVOptionFlags>,
            displayLinkContext: UnsafeMutableRawPointer?
        ) -> CVReturn in

            guard let context = displayLinkContext else {
                return kCVReturnError
            }

            let controller = Unmanaged<DisplayLinkController>.fromOpaque(context).takeUnretainedValue()
            controller.handleDisplayLinkCallback(
                now: inNow.pointee,
                outputTime: inOutputTime.pointee
            )

            return kCVReturnSuccess

        }, opaquePtr)

        // Detect refresh rate
        detectRefreshRate(link)

        print("[DisplayLinkController] Display link created with refresh rate: \(refreshRate) Hz")
    }

    private func detectRefreshRate(_ displayLink: CVDisplayLink) {
        var nominalRefreshRate: CVTime = CVDisplayLinkGetNominalOutputVideoRefreshPeriod(displayLink)

        if nominalRefreshRate.flags & Int32(CVTimeFlags.isIndefinite.rawValue) == 0 {
            let rate = Double(nominalRefreshRate.timeScale) / Double(nominalRefreshRate.timeValue)
            refreshRate = rate
        } else {
            // Fallback: try to get from main display
            if let screen = NSScreen.main {
                if let displayID = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID {
                    if let mode = CGDisplayCopyDisplayMode(displayID) {
                        refreshRate = mode.refreshRate
                        if refreshRate == 0 {
                            refreshRate = 60.0  // Default fallback
                        }
                    }
                }
            }
        }

        // Check for ProMotion support
        if refreshRate >= 119 {
            print("[DisplayLinkController] ProMotion display detected: \(refreshRate) Hz")
        }
    }

    // MARK: - Display Link Callback

    private func handleDisplayLinkCallback(now: CVTimeStamp, outputTime: CVTimeStamp) {
        // Convert timestamp to seconds
        let timestamp = CFTimeInterval(outputTime.videoTime) / CFTimeInterval(outputTime.videoTimeScale)

        // Use autoreleasepool for memory management in high-frequency callback
        autoreleasepool {
            frameCallback(timestamp)
        }

        lastTimestamp = outputTime
    }

    // MARK: - Control

    /// Start the display link
    func start() {
        lock.lock()
        defer { lock.unlock() }

        guard let displayLink = displayLink, !isRunning else { return }

        let status = CVDisplayLinkStart(displayLink)
        if status == kCVReturnSuccess {
            isRunning = true
            print("[DisplayLinkController] Started")
        } else {
            print("[DisplayLinkController] Failed to start: \(status)")
        }
    }

    /// Stop the display link
    func stop() {
        lock.lock()
        defer { lock.unlock() }

        guard let displayLink = displayLink, isRunning else { return }

        CVDisplayLinkStop(displayLink)
        isRunning = false
        print("[DisplayLinkController] Stopped")
    }

    /// Set the display link to target a specific display
    /// - Parameter displayID: The CGDirectDisplayID to target
    func setDisplay(_ displayID: CGDirectDisplayID) {
        lock.lock()
        defer { lock.unlock() }

        guard let displayLink = displayLink else { return }

        let status = CVDisplayLinkSetCurrentCGDisplay(displayLink, displayID)
        if status == kCVReturnSuccess {
            detectRefreshRate(displayLink)
            print("[DisplayLinkController] Display set to: \(displayID)")
        } else {
            print("[DisplayLinkController] Failed to set display: \(status)")
        }
    }

    /// Update the display link when window moves to a different screen
    /// - Parameter window: The window to track
    func trackWindow(_ window: NSWindow?) {
        guard let window = window,
              let screen = window.screen,
              let displayID = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID else {
            return
        }

        setDisplay(displayID)
    }

    // MARK: - Utility

    /// Get the actual frame duration based on refresh rate
    var frameDuration: CFTimeInterval {
        return 1.0 / refreshRate
    }

    /// Check if the display supports ProMotion (120Hz+)
    var isProMotionSupported: Bool {
        return refreshRate >= 119
    }
}

// MARK: - Display Notifications

extension DisplayLinkController {

    /// Start observing display configuration changes
    func observeDisplayChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(displayConfigurationChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    /// Stop observing display configuration changes
    func stopObservingDisplayChanges() {
        NotificationCenter.default.removeObserver(
            self,
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    @objc private func displayConfigurationChanged(_ notification: Notification) {
        lock.lock()
        defer { lock.unlock() }

        guard let displayLink = displayLink else { return }

        // Re-detect refresh rate after display configuration change
        detectRefreshRate(displayLink)
        print("[DisplayLinkController] Display configuration changed, new rate: \(refreshRate) Hz")
    }
}
