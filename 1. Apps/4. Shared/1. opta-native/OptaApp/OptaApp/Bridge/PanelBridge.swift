//
//  PanelBridge.swift
//  OptaApp
//
//  Swift wrappers for Rust obsidian panel and branch energy FFI components.
//  Provides ObsidianPanel, BranchMeterView, BranchIndicatorView, BranchBorderView.
//

import Foundation

// MARK: - ObsidianPanel

/// Swift bridge for the Rust obsidian glass panel with Cook-Torrance specular and edge branches.
///
/// # Usage
///
/// ```swift
/// let panel = ObsidianPanel(
///     renderContext: bridge.context,
///     position: (100, 50),
///     size: (300, 200),
///     cornerRadius: 16,
///     energy: 0.5
/// )
/// panel?.update(deltaTime: 0.016)
/// panel?.render(context: bridge.context)
/// ```
final class ObsidianPanel {

    // MARK: - Properties

    /// Opaque pointer to the Rust panel
    private var panel: OpaquePointer?

    /// Thread-safe access to panel
    private let panelLock = NSLock()

    /// Current energy level (cached)
    private(set) var energy: Float = 0.3

    /// Current depth layer (cached)
    private(set) var depth: Float = 0.0

    // MARK: - Initialization

    /// Create a new obsidian panel.
    /// - Parameters:
    ///   - renderContext: Pointer to the OptaRenderContext
    ///   - position: Position (x, y) in pixels
    ///   - size: Size (width, height) in pixels
    ///   - cornerRadius: Corner radius in pixels
    ///   - borderWidth: Border width in pixels
    ///   - energy: Initial branch energy [0, 1]
    ///   - depthLayer: Depth hierarchy [0, 1]
    ///   - quality: Quality level (0-3)
    /// - Returns: nil if FFI creation fails
    init?(
        renderContext: OpaquePointer,
        position: (x: Float, y: Float) = (0, 0),
        size: (width: Float, height: Float) = (200, 150),
        cornerRadius: Float = 16,
        borderWidth: Float = 1,
        energy: Float = 0.3,
        depthLayer: Float = 0.0,
        quality: UInt32 = 2
    ) {
        self.energy = energy
        self.depth = depthLayer

        var config = OptaPanelConfig(
            position_x: position.x,
            position_y: position.y,
            width: size.width,
            height: size.height,
            corner_radius: cornerRadius,
            border_width: borderWidth,
            energy: energy,
            depth_layer: depthLayer,
            quality_level: quality
        )

        guard let ptr = opta_panel_create(renderContext, &config) else {
            return nil
        }

        self.panel = ptr
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Destroy the panel and free GPU resources.
    func destroy() {
        panelLock.lock()
        defer { panelLock.unlock() }

        if let panel = panel {
            opta_panel_destroy(panel)
            self.panel = nil
        }
    }

    // MARK: - Properties

    /// Set the panel position.
    /// - Parameters:
    ///   - x: X position in pixels
    ///   - y: Y position in pixels
    func setPosition(x: Float, y: Float) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        _ = opta_panel_set_position(panel, x, y)
    }

    /// Set the panel size.
    /// - Parameters:
    ///   - width: Width in pixels
    ///   - height: Height in pixels
    func setSize(width: Float, height: Float) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        _ = opta_panel_set_size(panel, width, height)
    }

    /// Set the branch energy level.
    /// - Parameter energy: Energy level [0.0, 1.0]
    func setEnergy(_ energy: Float) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        let clamped = max(0.0, min(1.0, energy))
        _ = opta_panel_set_energy(panel, clamped)
        self.energy = clamped
    }

    /// Set the depth layer.
    /// - Parameter depth: Depth [0.0 = foreground, 1.0 = background]
    func setDepth(_ depth: Float) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        let clamped = max(0.0, min(1.0, depth))
        _ = opta_panel_set_depth(panel, clamped)
        self.depth = clamped
    }

    /// Set the quality level.
    /// - Parameter level: Quality (0=Low, 1=Medium, 2=High, 3=Ultra)
    func setQuality(_ level: UInt32) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel, level <= 3 else { return }
        _ = opta_panel_set_quality(panel, level)
    }

    // MARK: - Frame Loop

    /// Update panel animation.
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    func update(deltaTime: Float) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        _ = opta_panel_update(panel, deltaTime)
    }

    /// Render the panel to the current surface.
    /// - Parameter context: Pointer to the OptaRenderContext
    func render(context: OpaquePointer) {
        panelLock.lock()
        defer { panelLock.unlock() }

        guard let panel = panel else { return }
        _ = opta_panel_render(panel, context)
    }
}

// MARK: - BranchMeterView

/// Swift bridge for the Rust horizontal branch meter with branch energy veins.
/// Replaces standard progress bars with obsidian-aesthetic meters.
///
/// # Usage
///
/// ```swift
/// let meter = BranchMeterView(
///     renderContext: bridge.context,
///     position: (50, 100),
///     size: (200, 24),
///     fillLevel: 0.65,
///     energy: 0.5
/// )
/// meter?.setFill(0.8)
/// meter?.update(deltaTime: 0.016)
/// meter?.render(context: bridge.context)
/// ```
final class BranchMeterView {

    // MARK: - Properties

    /// Opaque pointer to the Rust branch meter
    private var meter: OpaquePointer?

    /// Thread-safe access to meter
    private let meterLock = NSLock()

    /// Current fill level (cached)
    private(set) var fillLevel: Float = 0.5

    /// Current energy level (cached)
    private(set) var energy: Float = 0.5

    // MARK: - Initialization

    /// Create a new branch meter.
    /// - Parameters:
    ///   - renderContext: Pointer to the OptaRenderContext
    ///   - position: Position (x, y) in pixels
    ///   - size: Size (width, height) in pixels
    ///   - cornerRadius: Corner radius in pixels
    ///   - fillLevel: Initial fill level [0, 1]
    ///   - energy: Initial branch energy [0, 1]
    ///   - quality: Quality level (0-3)
    /// - Returns: nil if FFI creation fails
    init?(
        renderContext: OpaquePointer,
        position: (x: Float, y: Float) = (50, 50),
        size: (width: Float, height: Float) = (200, 24),
        cornerRadius: Float = 8,
        fillLevel: Float = 0.5,
        energy: Float = 0.5,
        quality: UInt32 = 2
    ) {
        self.fillLevel = fillLevel
        self.energy = energy

        var config = OptaBranchMeterConfig(
            position_x: position.x,
            position_y: position.y,
            width: size.width,
            height: size.height,
            corner_radius: cornerRadius,
            fill_level: fillLevel,
            energy: energy,
            quality_level: quality,
            resolution_width: 800,
            resolution_height: 600
        )

        guard let ptr = opta_branch_meter_create(renderContext, &config) else {
            return nil
        }

        self.meter = ptr
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Destroy the meter and free GPU resources.
    func destroy() {
        meterLock.lock()
        defer { meterLock.unlock() }

        if let meter = meter {
            opta_branch_meter_destroy(meter)
            self.meter = nil
        }
    }

    // MARK: - Properties

    /// Set the fill level.
    /// - Parameter level: Fill level [0.0, 1.0]
    func setFill(_ level: Float) {
        meterLock.lock()
        defer { meterLock.unlock() }

        guard let meter = meter else { return }
        let clamped = max(0.0, min(1.0, level))
        _ = opta_branch_meter_set_fill(meter, clamped)
        self.fillLevel = clamped
    }

    /// Set the branch energy level.
    /// - Parameter energy: Energy [0.0, 1.0]
    func setEnergy(_ energy: Float) {
        meterLock.lock()
        defer { meterLock.unlock() }

        guard let meter = meter else { return }
        let clamped = max(0.0, min(1.0, energy))
        _ = opta_branch_meter_set_energy(meter, clamped)
        self.energy = clamped
    }

    // MARK: - Frame Loop

    /// Update meter animation.
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    func update(deltaTime: Float) {
        meterLock.lock()
        defer { meterLock.unlock() }

        guard let meter = meter else { return }
        _ = opta_branch_meter_update(meter, deltaTime)
    }

    /// Render the meter to the current surface.
    /// - Parameter context: Pointer to the OptaRenderContext
    func render(context: OpaquePointer) {
        meterLock.lock()
        defer { meterLock.unlock() }

        guard let meter = meter else { return }
        _ = opta_branch_meter_render(meter, context)
    }
}

// MARK: - BranchIndicatorView

/// Swift bridge for the Rust circular branch indicator with radial branch veins.
/// Replaces standard status dots with pulsing obsidian indicators.
///
/// # Usage
///
/// ```swift
/// let indicator = BranchIndicatorView(
///     renderContext: bridge.context,
///     center: (200, 200),
///     innerRadius: 6,
///     outerRadius: 16,
///     energy: 0.7
/// )
/// indicator?.update(deltaTime: 0.016)
/// indicator?.render(context: bridge.context)
/// ```
final class BranchIndicatorView {

    // MARK: - Properties

    /// Opaque pointer to the Rust branch indicator
    private var indicator: OpaquePointer?

    /// Thread-safe access to indicator
    private let indicatorLock = NSLock()

    /// Current energy level (cached)
    private(set) var energy: Float = 0.5

    // MARK: - Initialization

    /// Create a new branch indicator.
    /// - Parameters:
    ///   - renderContext: Pointer to the OptaRenderContext
    ///   - center: Center position (x, y) in pixels
    ///   - innerRadius: Inner core radius in pixels
    ///   - outerRadius: Outer branch reach in pixels
    ///   - energy: Initial energy [0, 1]
    ///   - branchCount: Number of radial branches
    ///   - quality: Quality level (0-3)
    /// - Returns: nil if FFI creation fails
    init?(
        renderContext: OpaquePointer,
        center: (x: Float, y: Float) = (100, 100),
        innerRadius: Float = 6,
        outerRadius: Float = 16,
        energy: Float = 0.5,
        branchCount: UInt32 = 6,
        quality: UInt32 = 2
    ) {
        self.energy = energy

        var config = OptaBranchIndicatorConfig(
            center_x: center.x,
            center_y: center.y,
            inner_radius: innerRadius,
            outer_radius: outerRadius,
            energy: energy,
            branch_count: branchCount,
            quality_level: quality,
            resolution_width: 800,
            resolution_height: 600
        )

        guard let ptr = opta_branch_indicator_create(renderContext, &config) else {
            return nil
        }

        self.indicator = ptr
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Destroy the indicator and free GPU resources.
    func destroy() {
        indicatorLock.lock()
        defer { indicatorLock.unlock() }

        if let indicator = indicator {
            opta_branch_indicator_destroy(indicator)
            self.indicator = nil
        }
    }

    // MARK: - Properties

    /// Set the energy level.
    /// - Parameter energy: Energy [0.0, 1.0]
    func setEnergy(_ energy: Float) {
        indicatorLock.lock()
        defer { indicatorLock.unlock() }

        guard let indicator = indicator else { return }
        let clamped = max(0.0, min(1.0, energy))
        _ = opta_branch_indicator_set_energy(indicator, clamped)
        self.energy = clamped
    }

    // MARK: - Frame Loop

    /// Update indicator animation.
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    func update(deltaTime: Float) {
        indicatorLock.lock()
        defer { indicatorLock.unlock() }

        guard let indicator = indicator else { return }
        _ = opta_branch_indicator_update(indicator, deltaTime)
    }

    /// Render the indicator to the current surface.
    /// - Parameter context: Pointer to the OptaRenderContext
    func render(context: OpaquePointer) {
        indicatorLock.lock()
        defer { indicatorLock.unlock() }

        guard let indicator = indicator else { return }
        _ = opta_branch_indicator_render(indicator, context)
    }
}

// MARK: - BranchBorderView

/// Swift bridge for the Rust panel border with perimeter-flowing branch veins.
/// Provides animated GPU-rendered borders for obsidian panels.
///
/// # Usage
///
/// ```swift
/// let border = BranchBorderView(
///     renderContext: bridge.context,
///     position: (50, 50),
///     size: (300, 200),
///     cornerRadius: 12,
///     borderWidth: 3,
///     energy: 0.6
/// )
/// border?.update(deltaTime: 0.016)
/// border?.render(context: bridge.context)
/// ```
final class BranchBorderView {

    // MARK: - Properties

    /// Opaque pointer to the Rust branch border
    private var border: OpaquePointer?

    /// Thread-safe access to border
    private let borderLock = NSLock()

    /// Current energy level (cached)
    private(set) var energy: Float = 0.5

    // MARK: - Initialization

    /// Create a new branch border.
    /// - Parameters:
    ///   - renderContext: Pointer to the OptaRenderContext
    ///   - position: Position (x, y) in pixels
    ///   - size: Size (width, height) in pixels
    ///   - cornerRadius: Corner radius in pixels
    ///   - borderWidth: Border band thickness in pixels
    ///   - energy: Initial energy [0, 1]
    ///   - quality: Quality level (0-3)
    /// - Returns: nil if FFI creation fails
    init?(
        renderContext: OpaquePointer,
        position: (x: Float, y: Float) = (50, 50),
        size: (width: Float, height: Float) = (300, 200),
        cornerRadius: Float = 12,
        borderWidth: Float = 3,
        energy: Float = 0.5,
        quality: UInt32 = 2
    ) {
        self.energy = energy

        var config = OptaBranchBorderConfig(
            position_x: position.x,
            position_y: position.y,
            width: size.width,
            height: size.height,
            corner_radius: cornerRadius,
            border_width: borderWidth,
            energy: energy,
            quality_level: quality,
            resolution_width: 800,
            resolution_height: 600
        )

        guard let ptr = opta_branch_border_create(renderContext, &config) else {
            return nil
        }

        self.border = ptr
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Destroy the border and free GPU resources.
    func destroy() {
        borderLock.lock()
        defer { borderLock.unlock() }

        if let border = border {
            opta_branch_border_destroy(border)
            self.border = nil
        }
    }

    // MARK: - Properties

    /// Set the energy level.
    /// - Parameter energy: Energy [0.0, 1.0]
    func setEnergy(_ energy: Float) {
        borderLock.lock()
        defer { borderLock.unlock() }

        guard let border = border else { return }
        let clamped = max(0.0, min(1.0, energy))
        _ = opta_branch_border_set_energy(border, clamped)
        self.energy = clamped
    }

    // MARK: - Frame Loop

    /// Update border animation.
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    func update(deltaTime: Float) {
        borderLock.lock()
        defer { borderLock.unlock() }

        guard let border = border else { return }
        _ = opta_branch_border_update(border, deltaTime)
    }

    /// Render the border to the current surface.
    /// - Parameter context: Pointer to the OptaRenderContext
    func render(context: OpaquePointer) {
        borderLock.lock()
        defer { borderLock.unlock() }

        guard let border = border else { return }
        _ = opta_branch_border_render(border, context)
    }
}
