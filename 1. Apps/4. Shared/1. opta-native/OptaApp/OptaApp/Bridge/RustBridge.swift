//
//  RustBridge.swift
//  OptaApp
//
//  Swift wrapper for Rust render engine FFI
//

import Foundation
import Metal
import QuartzCore

// MARK: - Swift Error Type

/// Errors that can occur during render operations
enum OptaRenderError: Error, LocalizedError {
    case nullContext
    case surfaceConfiguration
    case frameAcquisition
    case renderPass
    case queueSubmission
    case presentation
    case invalidParameters
    case deviceLost
    case outOfMemory
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .nullContext:
            return "Render context is null or invalid"
        case .surfaceConfiguration:
            return "Failed to configure render surface"
        case .frameAcquisition:
            return "Failed to acquire frame"
        case .renderPass:
            return "Render pass failed"
        case .queueSubmission:
            return "Queue submission failed"
        case .presentation:
            return "Surface presentation failed"
        case .invalidParameters:
            return "Invalid parameters provided"
        case .deviceLost:
            return "GPU device lost"
        case .outOfMemory:
            return "Out of GPU memory"
        case .unknown(let message):
            return "Unknown error: \(message)"
        }
    }

    init(from result: OptaRenderResult, context: OpaquePointer?) {
        switch result {
        case OPTA_RENDER_OK:
            self = .unknown("Attempted to create error from success result")
        case OPTA_RENDER_ERROR_NULL_CONTEXT:
            self = .nullContext
        case OPTA_RENDER_ERROR_SURFACE_CONFIG:
            self = .surfaceConfiguration
        case OPTA_RENDER_ERROR_FRAME_ACQUIRE:
            self = .frameAcquisition
        case OPTA_RENDER_ERROR_RENDER_PASS:
            self = .renderPass
        case OPTA_RENDER_ERROR_QUEUE_SUBMIT:
            self = .queueSubmission
        case OPTA_RENDER_ERROR_PRESENT:
            self = .presentation
        case OPTA_RENDER_ERROR_INVALID_PARAMS:
            self = .invalidParameters
        case OPTA_RENDER_ERROR_DEVICE_LOST:
            self = .deviceLost
        case OPTA_RENDER_ERROR_OUT_OF_MEMORY:
            self = .outOfMemory
        default:
            if let context = context,
               let errorMsg = opta_render_get_last_error(context) {
                self = .unknown(String(cString: errorMsg))
            } else {
                self = .unknown("Unknown error code: \(result.rawValue)")
            }
        }
    }
}

// MARK: - Swift Structs

/// GPU capability information
struct GpuCapabilities {
    let maxTextureDimension: UInt32
    let maxBufferSize: UInt64
    let supportsCompute: Bool
    let supportsRaytracing: Bool
    let vendor: String
    let deviceName: String
    let preferredFrameRate: UInt32

    init(from capabilities: OptaGpuCapabilities) {
        self.maxTextureDimension = capabilities.max_texture_dimension
        self.maxBufferSize = capabilities.max_buffer_size
        self.supportsCompute = capabilities.supports_compute
        self.supportsRaytracing = capabilities.supports_raytracing
        self.preferredFrameRate = capabilities.preferred_frame_rate

        // Convert C char arrays to Swift Strings
        var vendor = capabilities.vendor
        self.vendor = withUnsafePointer(to: &vendor) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: 64) { charPtr in
                String(cString: charPtr)
            }
        }

        var deviceName = capabilities.device_name
        self.deviceName = withUnsafePointer(to: &deviceName) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: 128) { charPtr in
                String(cString: charPtr)
            }
        }
    }
}

/// Render engine status
struct RenderStatus {
    let isActive: Bool
    let isPaused: Bool
    let currentFPS: Float
    let targetFPS: Float
    let frameTimeMs: Float
    let totalFrames: UInt64
    let droppedFrames: UInt64
    let qualityLevel: Float
    let gpuMemoryUsage: UInt64

    init(from status: OptaRenderStatus) {
        self.isActive = status.is_active
        self.isPaused = status.is_paused
        self.currentFPS = status.current_fps
        self.targetFPS = status.target_fps
        self.frameTimeMs = status.frame_time_ms
        self.totalFrames = status.total_frames
        self.droppedFrames = status.dropped_frames
        self.qualityLevel = status.quality_level
        self.gpuMemoryUsage = status.gpu_memory_usage
    }
}

/// Quality level presets
enum QualityLevel: Int {
    case low = 0
    case medium = 1
    case high = 2
    case ultra = 3
    case adaptive = 4

    var ffiValue: OptaQualityLevel {
        OptaQualityLevel(rawValue: UInt32(self.rawValue))
    }
}

// MARK: - Rust Bridge Class

/// Main bridge class for interacting with the Rust render engine
final class OptaRenderBridge {

    // MARK: - Properties

    /// Opaque pointer to the Rust render context
    private var context: OpaquePointer?

    /// Whether the bridge has been initialized with a Metal layer
    private(set) var isInitialized = false

    /// Thread-safe access to context
    private let contextLock = NSLock()

    // MARK: - Initialization

    /// Create a new render bridge
    init?() {
        guard let ctx = opta_render_create() else {
            print("[OptaRenderBridge] Failed to create render context")
            return nil
        }
        self.context = ctx
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Initialize the render engine with a Metal layer
    /// - Parameter metalLayer: The CAMetalLayer to render to
    /// - Throws: OptaRenderError if initialization fails
    func initialize(with metalLayer: CAMetalLayer) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let layerPtr = Unmanaged.passUnretained(metalLayer).toOpaque()
        let result = opta_render_init(context, layerPtr)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }

        isInitialized = true
    }

    /// Destroy the render context and free resources
    func destroy() {
        contextLock.lock()
        defer { contextLock.unlock() }

        if let context = context {
            opta_render_destroy(context)
            self.context = nil
        }
        isInitialized = false
    }

    // MARK: - Surface Configuration

    /// Configure the render surface with dimensions
    /// - Parameters:
    ///   - width: Surface width in pixels
    ///   - height: Surface height in pixels
    ///   - scale: Backing scale factor (e.g., 2.0 for Retina)
    /// - Throws: OptaRenderError if configuration fails
    func configureSurface(width: UInt32, height: UInt32, scale: Float) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_configure_surface(context, width, height, scale)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    /// Handle surface resize
    /// - Parameters:
    ///   - width: New width in pixels
    ///   - height: New height in pixels
    ///   - scale: New backing scale factor
    /// - Throws: OptaRenderError if resize fails
    func resize(width: UInt32, height: UInt32, scale: Float) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_resize(context, width, height, scale)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    // MARK: - Frame Loop

    /// Begin a new frame
    /// - Parameter timestamp: Current timestamp in seconds
    /// - Returns: true if the frame should be rendered, false to skip
    /// - Throws: OptaRenderError if frame begin fails
    func frameBegin(timestamp: Double) throws -> Bool {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_frame_begin(context, timestamp)

        // OK means render, other results mean skip or error
        if result == OPTA_RENDER_OK {
            return true
        } else if result == OPTA_RENDER_ERROR_FRAME_ACQUIRE {
            // Frame skip is not an error, just return false
            return false
        } else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    /// End the current frame and present
    /// - Throws: OptaRenderError if frame end fails
    func frameEnd() throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_frame_end(context)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    // MARK: - Quality Control

    /// Set the render quality level
    /// - Parameter quality: Quality level preset
    /// - Throws: OptaRenderError if setting fails
    func setQuality(_ quality: QualityLevel) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_set_quality(context, quality.ffiValue)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    /// Set custom quality value
    /// - Parameter value: Quality value from 0.0 (lowest) to 1.0 (highest)
    /// - Throws: OptaRenderError if setting fails
    func setQualityValue(_ value: Float) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let clampedValue = max(0.0, min(1.0, value))
        let result = opta_render_set_quality_value(context, clampedValue)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    /// Set target frame rate
    /// - Parameter fps: Target frames per second
    /// - Throws: OptaRenderError if setting fails
    func setTargetFPS(_ fps: UInt32) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_set_target_fps(context, fps)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    // MARK: - Pause Control

    /// Set the paused state
    /// - Parameter paused: Whether rendering should be paused
    /// - Throws: OptaRenderError if setting fails
    func setPaused(_ paused: Bool) throws {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        let result = opta_render_set_paused(context, paused)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }
    }

    /// Pause rendering
    /// - Throws: OptaRenderError if pausing fails
    func pause() throws {
        try setPaused(true)
    }

    /// Resume rendering
    /// - Throws: OptaRenderError if resuming fails
    func resume() throws {
        try setPaused(false)
    }

    // MARK: - Status Queries

    /// Get current render status
    /// - Returns: Current render status
    /// - Throws: OptaRenderError if query fails
    func getStatus() throws -> RenderStatus {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        var status = OptaRenderStatus()
        let result = opta_render_get_status(context, &status)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }

        return RenderStatus(from: status)
    }

    /// Get GPU capabilities
    /// - Returns: GPU capability information
    /// - Throws: OptaRenderError if query fails
    func getCapabilities() throws -> GpuCapabilities {
        contextLock.lock()
        defer { contextLock.unlock() }

        guard let context = context else {
            throw OptaRenderError.nullContext
        }

        var capabilities = OptaGpuCapabilities()
        let result = opta_render_get_capabilities(context, &capabilities)

        guard result == OPTA_RENDER_OK else {
            throw OptaRenderError(from: result, context: context)
        }

        return GpuCapabilities(from: capabilities)
    }
}
