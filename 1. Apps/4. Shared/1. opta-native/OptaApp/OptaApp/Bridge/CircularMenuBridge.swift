//
//  CircularMenuBridge.swift
//  OptaApp
//
//  Swift wrapper for Rust circular menu FFI.
//  Uses branch-energy terminology aligned with the Rust layer.
//

import Foundation

// MARK: - Configuration

/// Configuration for creating a circular menu
struct CircularMenuConfig {
    /// Center X position in pixels
    var centerX: Float = 0
    /// Center Y position in pixels
    var centerY: Float = 0
    /// Outer radius in pixels
    var radius: Float = 150
    /// Inner radius in pixels
    var innerRadius: Float = 50
    /// Number of sectors in the menu
    var sectorCount: UInt32 = 4
    /// Branch energy color (Electric Violet default)
    var branchEnergyColor: (r: Float, g: Float, b: Float) = (0.545, 0.361, 0.965)
    /// Branch energy intensity (0.0-2.0+)
    var branchEnergyIntensity: Float = 1.5
    /// Rotation offset in radians (default: top-centered)
    var rotationOffset: Float = -.pi / 2

    /// Convert to C struct for FFI
    var ffiConfig: OptaCircularMenuConfig {
        OptaCircularMenuConfig(
            center_x: centerX,
            center_y: centerY,
            radius: radius,
            inner_radius: innerRadius,
            sector_count: sectorCount,
            branch_energy_r: branchEnergyColor.r,
            branch_energy_g: branchEnergyColor.g,
            branch_energy_b: branchEnergyColor.b,
            branch_energy_intensity: branchEnergyIntensity,
            rotation_offset: rotationOffset
        )
    }
}

// MARK: - Hit Test Result

/// Result of a hit test on the circular menu
struct CircularMenuHitTestResult {
    /// Sector index (-1 if not in menu)
    let sectorIndex: Int32
    /// Whether the point is within the menu ring
    let isInMenu: Bool
    /// Center position of the hit sector (valid if sectorIndex >= 0)
    let sectorCenter: CGPoint?

    init(from ffiResult: OptaCircularMenuHitTest) {
        self.sectorIndex = ffiResult.sector_index
        self.isInMenu = ffiResult.is_in_menu

        if ffiResult.sector_index >= 0 {
            self.sectorCenter = CGPoint(
                x: CGFloat(ffiResult.sector_center_x),
                y: CGFloat(ffiResult.sector_center_y)
            )
        } else {
            self.sectorCenter = nil
        }
    }
}

// MARK: - Circular Menu Bridge

/// Snapshot of animation state from a single lock acquisition
struct CircularMenuAnimationSnapshot {
    let openProgress: Float
    let highlightProgress: Float
    let isAnimating: Bool
}

/// Swift bridge for the Rust circular menu component
final class CircularMenuBridge {

    // MARK: - Properties

    /// Opaque pointer to the Rust circular menu
    private var menu: OpaquePointer?

    /// Thread-safe access to menu
    private let menuLock = NSLock()

    /// Configuration used to create the menu
    private(set) var config: CircularMenuConfig

    // MARK: - Initialization

    /// Create a new circular menu bridge
    /// - Parameter config: Configuration for the menu (defaults used if not specified)
    /// - Returns: nil if Rust FFI creation fails
    init?(config: CircularMenuConfig = CircularMenuConfig()) {
        self.config = config

        var ffiConfig = config.ffiConfig
        guard let menuPtr = opta_circular_menu_create(&ffiConfig) else {
            return nil
        }

        self.menu = menuPtr
    }

    deinit {
        destroy()
    }

    // MARK: - Lifecycle

    /// Destroy the circular menu and free resources
    func destroy() {
        menuLock.lock()
        defer { menuLock.unlock() }

        if let menu = menu {
            opta_circular_menu_destroy(menu)
            self.menu = nil
        }
    }

    // MARK: - State Control

    /// Open the menu with animation
    func open() {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_open(menu)
    }

    /// Close the menu with animation
    func close() {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_close(menu)
    }

    /// Toggle the menu open/closed state
    func toggle() {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_toggle(menu)
    }

    /// Check if the menu is open
    var isOpen: Bool {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return false }
        return opta_circular_menu_is_open(menu)
    }

    /// Check if the menu is currently animating
    var isAnimating: Bool {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return false }
        return opta_circular_menu_is_animating(menu)
    }

    /// Immediately set the open state without animation
    /// - Parameter open: Whether to open (true) or close (false)
    func setOpenImmediate(_ open: Bool) {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_set_open_immediate(menu, open)
    }

    // MARK: - Animation

    /// Update the menu animation
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    func update(deltaTime: Float) {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_update(menu, deltaTime)
    }

    /// Update animation and return state snapshot in a single lock acquisition.
    /// Reduces per-frame lock overhead from 3 acquisitions to 1.
    /// - Parameter deltaTime: Time elapsed since last update in seconds
    /// - Returns: Snapshot of animation state after update
    func updateAndGetState(deltaTime: Float) -> CircularMenuAnimationSnapshot {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else {
            return CircularMenuAnimationSnapshot(openProgress: 0, highlightProgress: 0, isAnimating: false)
        }

        _ = opta_circular_menu_update(menu, deltaTime)

        return CircularMenuAnimationSnapshot(
            openProgress: opta_circular_menu_get_open_progress(menu),
            highlightProgress: opta_circular_menu_get_highlight_progress(menu),
            isAnimating: opta_circular_menu_is_animating(menu)
        )
    }

    /// Current open progress (0.0 = closed, 1.0 = fully open)
    var openProgress: Float {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return 0 }
        return opta_circular_menu_get_open_progress(menu)
    }

    /// Current highlight progress (0.0 = none, 1.0 = full)
    var highlightProgress: Float {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return 0 }
        return opta_circular_menu_get_highlight_progress(menu)
    }

    // MARK: - Sectors

    /// The currently highlighted sector index (-1 for none)
    var highlightedSector: Int32 {
        get {
            menuLock.lock()
            defer { menuLock.unlock() }

            guard let menu = menu else { return -1 }
            return opta_circular_menu_get_highlighted_sector(menu)
        }
        set {
            menuLock.lock()
            defer { menuLock.unlock() }

            guard let menu = menu else { return }
            _ = opta_circular_menu_set_highlighted_sector(menu, newValue)
        }
    }

    /// The number of sectors in the menu
    var sectorCount: UInt32 {
        get {
            menuLock.lock()
            defer { menuLock.unlock() }

            guard let menu = menu else { return 0 }
            return opta_circular_menu_get_sector_count(menu)
        }
        set {
            menuLock.lock()
            defer { menuLock.unlock() }

            guard let menu = menu, newValue >= 1, newValue <= 12 else { return }
            _ = opta_circular_menu_set_sector_count(menu, newValue)
            config.sectorCount = newValue
        }
    }

    // MARK: - Position

    /// Set the center position of the menu
    /// - Parameters:
    ///   - x: X coordinate
    ///   - y: Y coordinate
    func setPosition(x: Float, y: Float) {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_set_position(menu, x, y)
        config.centerX = x
        config.centerY = y
    }

    /// Set the center position of the menu
    /// - Parameter point: Center point
    func setPosition(_ point: CGPoint) {
        setPosition(x: Float(point.x), y: Float(point.y))
    }

    // MARK: - Appearance

    /// Set the branch energy color for highlighted sectors
    /// - Parameters:
    ///   - r: Red component (0.0-1.0)
    ///   - g: Green component (0.0-1.0)
    ///   - b: Blue component (0.0-1.0)
    func setBranchEnergyColor(r: Float, g: Float, b: Float) {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_set_branch_energy_color(menu, r, g, b)
        config.branchEnergyColor = (r, g, b)
    }

    /// Set the branch energy color from an NSColor
    /// - Parameter color: The color to use for branch energy highlights
    func setBranchEnergyColor(_ color: NSColor) {
        guard let rgbColor = color.usingColorSpace(.sRGB) else { return }
        setBranchEnergyColor(
            r: Float(rgbColor.redComponent),
            g: Float(rgbColor.greenComponent),
            b: Float(rgbColor.blueComponent)
        )
    }

    // MARK: - Hit Testing

    /// Test if a point is within the menu and which sector
    /// - Parameters:
    ///   - x: X coordinate to test
    ///   - y: Y coordinate to test
    /// - Returns: Hit test result with sector information
    func hitTest(x: Float, y: Float) -> CircularMenuHitTestResult {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else {
            return CircularMenuHitTestResult(from: OptaCircularMenuHitTest(
                sector_index: -1,
                is_in_menu: false,
                sector_center_x: 0,
                sector_center_y: 0
            ))
        }

        var result = OptaCircularMenuHitTest()
        _ = opta_circular_menu_hit_test(menu, x, y, &result)
        return CircularMenuHitTestResult(from: result)
    }

    /// Test if a point is within the menu and which sector
    /// - Parameter point: Point to test
    /// - Returns: Hit test result with sector information
    func hitTest(at point: CGPoint) -> CircularMenuHitTestResult {
        hitTest(x: Float(point.x), y: Float(point.y))
    }

    // MARK: - Convenience

    /// Get the sector index at a given point, or nil if not in menu
    /// - Parameter point: Point to test
    /// - Returns: Sector index or nil
    func sector(at point: CGPoint) -> Int? {
        let result = hitTest(at: point)
        return result.sectorIndex >= 0 ? Int(result.sectorIndex) : nil
    }
}
