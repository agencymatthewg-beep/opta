//
//  RenderCoordinator.swift
//  OptaApp
//
//  Coordinates rendering between SwiftUI, Metal, and the Rust render engine
//

import Foundation
import MetalKit
import QuartzCore
import Combine

// MARK: - Render Coordinator

/// Coordinates the render loop between SwiftUI, Metal, and Rust
final class RenderCoordinator: NSObject, ObservableObject {

    // MARK: - Published Properties

    /// Current frames per second
    @Published private(set) var currentFPS: Float = 0.0

    /// Current frame time in milliseconds
    @Published private(set) var frameTimeMs: Float = 0.0

    /// Total frames rendered
    @Published private(set) var totalFrames: UInt64 = 0

    /// Dropped frames count
    @Published private(set) var droppedFrames: UInt64 = 0

    /// Whether rendering is currently paused
    @Published var isPaused: Bool = false {
        didSet {
            handlePausedStateChange()
        }
    }

    /// Current quality level
    @Published var qualityLevel: QualityLevel = .high {
        didSet {
            applyQualityLevel()
        }
    }

    /// GPU device name
    @Published private(set) var gpuName: String = "Unknown"

    /// Target refresh rate
    @Published private(set) var targetRefreshRate: UInt32 = 60

    // MARK: - Private Properties

    /// The Rust render bridge
    private var renderBridge: OptaRenderBridge?

    /// Display link controller for frame timing
    private var displayLinkController: DisplayLinkController?

    /// The Metal layer being rendered to
    private weak var metalLayer: CAMetalLayer?

    /// The Metal device
    private var device: MTLDevice?

    /// Current surface dimensions
    private var surfaceWidth: UInt32 = 0
    private var surfaceHeight: UInt32 = 0
    private var surfaceScale: Float = 2.0

    /// Frame timing
    private var lastFrameTime: CFTimeInterval = 0
    private var frameCount: UInt64 = 0
    private var fpsAccumulator: Float = 0
    private var fpsFrameCount: Int = 0
    private let fpsUpdateInterval: Int = 30  // Update FPS display every N frames

    /// Thread safety
    private let renderLock = NSLock()

    /// Whether the coordinator has been configured
    private var isConfigured = false

    // MARK: - Initialization

    override init() {
        super.init()
    }

    deinit {
        shutdown()
    }

    // MARK: - Configuration

    /// Configure the coordinator with Metal layer and device
    /// - Parameters:
    ///   - metalLayer: The CAMetalLayer to render to
    ///   - device: The Metal device
    func configure(with metalLayer: CAMetalLayer, device: MTLDevice) {
        renderLock.lock()
        defer { renderLock.unlock() }

        guard !isConfigured else {
            print("[RenderCoordinator] Already configured")
            return
        }

        self.metalLayer = metalLayer
        self.device = device
        self.gpuName = device.name

        // Create the Rust render bridge
        guard let bridge = OptaRenderBridge() else {
            print("[RenderCoordinator] Failed to create render bridge")
            return
        }
        self.renderBridge = bridge

        // Initialize the bridge with the Metal layer
        do {
            try bridge.initialize(with: metalLayer)
            print("[RenderCoordinator] Rust render bridge initialized")
        } catch {
            print("[RenderCoordinator] Failed to initialize bridge: \(error)")
            return
        }

        // Get GPU capabilities
        do {
            let capabilities = try bridge.getCapabilities()
            self.targetRefreshRate = capabilities.preferredFrameRate
            self.gpuName = capabilities.deviceName
            print("[RenderCoordinator] GPU: \(capabilities.deviceName)")
            print("[RenderCoordinator] Preferred refresh rate: \(capabilities.preferredFrameRate) Hz")
        } catch {
            print("[RenderCoordinator] Failed to get capabilities: \(error)")
        }

        // Configure initial surface
        let bounds = metalLayer.bounds
        let scale = Float(metalLayer.contentsScale)
        surfaceWidth = UInt32(bounds.width * CGFloat(scale))
        surfaceHeight = UInt32(bounds.height * CGFloat(scale))
        surfaceScale = scale

        do {
            try bridge.configureSurface(
                width: surfaceWidth,
                height: surfaceHeight,
                scale: surfaceScale
            )
            print("[RenderCoordinator] Surface configured: \(surfaceWidth)x\(surfaceHeight) @\(surfaceScale)x")
        } catch {
            print("[RenderCoordinator] Failed to configure surface: \(error)")
        }

        // Create display link controller
        displayLinkController = DisplayLinkController { [weak self] timestamp in
            self?.displayLinkCallback(timestamp: timestamp)
        }

        // Start the display link
        displayLinkController?.start()

        isConfigured = true
        print("[RenderCoordinator] Configuration complete")
    }

    /// Shutdown the coordinator and release resources
    func shutdown() {
        renderLock.lock()
        defer { renderLock.unlock() }

        displayLinkController?.stop()
        displayLinkController = nil

        renderBridge?.destroy()
        renderBridge = nil

        metalLayer = nil
        device = nil

        isConfigured = false
        print("[RenderCoordinator] Shutdown complete")
    }

    // MARK: - Resize Handling

    /// Handle surface resize
    /// - Parameters:
    ///   - width: New width in pixels
    ///   - height: New height in pixels
    ///   - scale: New backing scale factor
    func handleResize(width: UInt32, height: UInt32, scale: Float) {
        renderLock.lock()
        defer { renderLock.unlock() }

        guard isConfigured, let bridge = renderBridge else { return }

        // Skip if dimensions haven't changed
        guard width != surfaceWidth || height != surfaceHeight || scale != surfaceScale else {
            return
        }

        surfaceWidth = width
        surfaceHeight = height
        surfaceScale = scale

        do {
            try bridge.resize(width: width, height: height, scale: scale)
            print("[RenderCoordinator] Resized to: \(width)x\(height) @\(scale)x")
        } catch {
            print("[RenderCoordinator] Resize failed: \(error)")
        }
    }

    // MARK: - Frame Rendering

    /// Render a frame (called from display link)
    func renderFrame() {
        autoreleasepool {
            renderLock.lock()
            defer { renderLock.unlock() }

            guard isConfigured, !isPaused, let bridge = renderBridge else { return }

            let timestamp = CACurrentMediaTime()

            // Track frame timing
            if lastFrameTime > 0 {
                let deltaTime = Float(timestamp - lastFrameTime) * 1000.0  // ms
                updateFrameStatistics(deltaTime: deltaTime)
            }
            lastFrameTime = timestamp

            do {
                // Begin frame
                let shouldRender = try bridge.frameBegin(timestamp: timestamp)

                guard shouldRender else {
                    // Frame was skipped (e.g., surface not ready)
                    return
                }

                // End frame (presents)
                try bridge.frameEnd()

                frameCount += 1
                totalFrames = frameCount

            } catch OptaRenderError.frameAcquisition {
                // Frame skip, not an error
                droppedFrames += 1
            } catch {
                print("[RenderCoordinator] Frame error: \(error)")
                droppedFrames += 1
            }
        }
    }

    // MARK: - Display Link Callback

    private func displayLinkCallback(timestamp: CFTimeInterval) {
        renderFrame()
    }

    // MARK: - Frame Statistics

    private func updateFrameStatistics(deltaTime: Float) {
        fpsAccumulator += deltaTime
        fpsFrameCount += 1

        if fpsFrameCount >= fpsUpdateInterval {
            let avgFrameTime = fpsAccumulator / Float(fpsFrameCount)

            // Update on main thread for SwiftUI
            DispatchQueue.main.async { [weak self] in
                self?.frameTimeMs = avgFrameTime
                self?.currentFPS = avgFrameTime > 0 ? 1000.0 / avgFrameTime : 0
            }

            fpsAccumulator = 0
            fpsFrameCount = 0
        }
    }

    // MARK: - State Management

    private func handlePausedStateChange() {
        renderLock.lock()
        defer { renderLock.unlock() }

        if isPaused {
            displayLinkController?.stop()
            try? renderBridge?.pause()
        } else {
            try? renderBridge?.resume()
            displayLinkController?.start()
        }
    }

    private func applyQualityLevel() {
        renderLock.lock()
        defer { renderLock.unlock() }

        guard let bridge = renderBridge else { return }

        do {
            try bridge.setQuality(qualityLevel)
            print("[RenderCoordinator] Quality set to: \(qualityLevel)")
        } catch {
            print("[RenderCoordinator] Failed to set quality: \(error)")
        }
    }

    // MARK: - Public Methods

    /// Get current render status
    /// - Returns: RenderStatus or nil if not available
    func getStatus() -> RenderStatus? {
        renderLock.lock()
        defer { renderLock.unlock() }

        guard let bridge = renderBridge else { return nil }

        do {
            return try bridge.getStatus()
        } catch {
            print("[RenderCoordinator] Failed to get status: \(error)")
            return nil
        }
    }

    /// Set target frame rate
    /// - Parameter fps: Target FPS (e.g., 60, 120)
    func setTargetFPS(_ fps: UInt32) {
        renderLock.lock()
        defer { renderLock.unlock() }

        guard let bridge = renderBridge else { return }

        do {
            try bridge.setTargetFPS(fps)
            DispatchQueue.main.async {
                self.targetRefreshRate = fps
            }
        } catch {
            print("[RenderCoordinator] Failed to set target FPS: \(error)")
        }
    }
}
