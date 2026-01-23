//
//  CircularMenuBridge.swift
//  OptaApp
//
//  Swift wrapper for Rust circular menu FFI
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
    /// Glow color
    var glowColor: (r: Float, g: Float, b: Float) = (0.4, 0.6, 1.0)
    /// Glow intensity (0.0-2.0+)
    var glowIntensity: Float = 1.5
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
            glow_color_r: glowColor.r,
            glow_color_g: glowColor.g,
            glow_color_b: glowColor.b,
            glow_intensity: glowIntensity,
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

/// Swift bridge for the Rust circular menu component
final class CircularMenuBridge {

    // MARK: - Properties

    /// Opaque pointer to the Rust circular menu
    private var menu: OpaquePointer?

    /// Thread-safe access to menu
    private let menuLock = NSLock()

    /// Whether the bridge has been initialized
    private(set) var isInitialized = false

    /// Configuration used to create the menu
    private(set) var config: CircularMenuConfig

    // MARK: - Initialization

    /// Create a new circular menu bridge
    /// - Parameter config: Configuration for the menu (defaults used if not specified)
    init(config: CircularMenuConfig = CircularMenuConfig()) {
        self.config = config

        var ffiConfig = config.ffiConfig
        guard let menuPtr = opta_circular_menu_create(&ffiConfig) else {
            print("[CircularMenuBridge] Failed to create circular menu")
            return
        }

        self.menu = menuPtr
        self.isInitialized = true
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
        isInitialized = false
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

    /// Set the glow color for highlighted sectors
    /// - Parameters:
    ///   - r: Red component (0.0-1.0)
    ///   - g: Green component (0.0-1.0)
    ///   - b: Blue component (0.0-1.0)
    func setGlowColor(r: Float, g: Float, b: Float) {
        menuLock.lock()
        defer { menuLock.unlock() }

        guard let menu = menu else { return }
        _ = opta_circular_menu_set_glow_color(menu, r, g, b)
        config.glowColor = (r, g, b)
    }

    /// Set the glow color from an NSColor
    /// - Parameter color: The color to use for glow
    func setGlowColor(_ color: NSColor) {
        guard let rgbColor = color.usingColorSpace(.sRGB) else { return }
        setGlowColor(
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
