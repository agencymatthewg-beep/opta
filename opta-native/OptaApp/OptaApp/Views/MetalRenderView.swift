//
//  MetalRenderView.swift
//  OptaApp
//
//  NSViewRepresentable wrapper for MTKView with wgpu-compatible CAMetalLayer
//

import SwiftUI
import MetalKit
import QuartzCore

// MARK: - Metal Render View (SwiftUI)

/// SwiftUI wrapper for the Metal rendering view
struct MetalRenderView: NSViewRepresentable {

    /// The render coordinator managing the render loop
    @ObservedObject var coordinator: RenderCoordinator

    func makeNSView(context: Context) -> MTKView {
        let mtkView = MTKView()

        // Get the default Metal device
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is not supported on this device")
        }

        mtkView.device = device
        mtkView.delegate = coordinator

        // Configure the Metal layer for wgpu compatibility
        configureMetalLayer(mtkView)

        // Configure the view
        configureView(mtkView)

        // Initialize the coordinator with the Metal layer
        if let metalLayer = mtkView.layer as? CAMetalLayer {
            coordinator.configure(with: metalLayer, device: device)
        }

        return mtkView
    }

    func updateNSView(_ nsView: MTKView, context: Context) {
        // Handle view updates if needed
    }

    // MARK: - Configuration

    private func configureMetalLayer(_ mtkView: MTKView) {
        guard let metalLayer = mtkView.layer as? CAMetalLayer else {
            return
        }

        // Essential settings for wgpu surface creation
        metalLayer.framebufferOnly = true          // Performance optimization
        metalLayer.displaySyncEnabled = true       // VSync for smooth rendering
        metalLayer.allowsNextDrawableTimeout = true
        metalLayer.pixelFormat = .bgra8Unorm       // Standard format for wgpu

        // Configure for EDR (Extended Dynamic Range) if available
        if metalLayer.responds(to: #selector(setter: CAMetalLayer.wantsExtendedDynamicRangeContent)) {
            metalLayer.wantsExtendedDynamicRangeContent = true
        }

        // Set the backing scale for Retina displays
        if let screen = NSScreen.main {
            metalLayer.contentsScale = screen.backingScaleFactor
        }
    }

    private func configureView(_ mtkView: MTKView) {
        // Disable built-in render loop - we use CVDisplayLink
        mtkView.isPaused = true
        mtkView.enableSetNeedsDisplay = false

        // Color configuration
        mtkView.colorPixelFormat = .bgra8Unorm
        mtkView.depthStencilPixelFormat = .depth32Float_stencil8
        mtkView.clearColor = MTLClearColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 1.0)

        // Sample count for MSAA (1 = no MSAA)
        mtkView.sampleCount = 1

        // Frame rate configuration - defer to CVDisplayLink
        mtkView.preferredFramesPerSecond = 120  // ProMotion max

        // Allow resizing
        mtkView.autoresizingMask = [.width, .height]
    }
}

// MARK: - Metal View Coordinator

/// Coordinator for handling MTKView delegate callbacks
extension RenderCoordinator: MTKViewDelegate {

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle resize
        let scale: Float
        if let screen = view.window?.screen {
            scale = Float(screen.backingScaleFactor)
        } else {
            scale = Float(NSScreen.main?.backingScaleFactor ?? 2.0)
        }

        handleResize(
            width: UInt32(size.width),
            height: UInt32(size.height),
            scale: scale
        )
    }

    func draw(in view: MTKView) {
        // This is called by CVDisplayLink, not MTKView's internal loop
        // We handle rendering in the display link callback
        renderFrame()
    }
}

// MARK: - Preview

#if DEBUG
struct MetalRenderView_Previews: PreviewProvider {
    static var previews: some View {
        MetalRenderView(coordinator: RenderCoordinator())
            .frame(width: 800, height: 600)
    }
}
#endif
