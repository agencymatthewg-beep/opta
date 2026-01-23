//
//  CircularMenuGestures.swift
//  OptaApp
//
//  Gesture recognition system for activating the circular menu.
//  Supports Force Touch, two-finger tap, and keyboard shortcuts.
//

import SwiftUI
import Combine

// MARK: - Gesture Trigger Type

/// Types of gestures that can trigger the circular menu
enum CircularMenuTrigger: String, CaseIterable, Identifiable {
    /// Force Touch/deep press (trackpad)
    case forceTouch = "Force Touch"
    /// Two-finger tap
    case twoFingerTap = "Two-Finger Tap"
    /// Three-finger tap
    case threeFingerTap = "Three-Finger Tap"
    /// Right-click/control-click
    case rightClick = "Right Click"
    /// Custom keyboard shortcut
    case keyboardShortcut = "Keyboard Shortcut"

    var id: String { rawValue }

    /// System name for the trigger icon
    var iconName: String {
        switch self {
        case .forceTouch: return "hand.tap.fill"
        case .twoFingerTap: return "hand.point.up.braille.fill"
        case .threeFingerTap: return "hand.raised.fingers.spread.fill"
        case .rightClick: return "cursorarrow.click.2"
        case .keyboardShortcut: return "command"
        }
    }

    /// Description of the gesture
    var description: String {
        switch self {
        case .forceTouch:
            return "Press firmly on the trackpad"
        case .twoFingerTap:
            return "Tap with two fingers"
        case .threeFingerTap:
            return "Tap with three fingers"
        case .rightClick:
            return "Right-click or Control-click"
        case .keyboardShortcut:
            return "Press keyboard shortcut"
        }
    }
}

// MARK: - Gesture Settings

/// User preferences for circular menu gestures
struct CircularMenuGestureSettings: Codable {
    /// Primary trigger for opening the menu
    var primaryTrigger: CircularMenuTrigger = .forceTouch

    /// Whether Force Touch is enabled
    var forceTouchEnabled: Bool = true

    /// Force Touch pressure threshold (0.0-1.0)
    var forceTouchThreshold: Float = 0.5

    /// Whether two-finger tap is enabled
    var twoFingerTapEnabled: Bool = true

    /// Whether right-click trigger is enabled
    var rightClickEnabled: Bool = false

    /// Keyboard shortcut modifiers
    var keyboardModifiers: NSEvent.ModifierFlags = [.option, .command]

    /// Keyboard shortcut key
    var keyboardKey: String = "o"

    /// Whether the menu opens at cursor position
    var openAtCursor: Bool = true

    /// Delay before menu opens (seconds)
    var openDelay: TimeInterval = 0.0
}

// MARK: - Gesture Recognizer

/// Centralized gesture recognizer for the circular menu
final class CircularMenuGestureRecognizer: ObservableObject {

    // MARK: - Singleton

    static let shared = CircularMenuGestureRecognizer()

    // MARK: - Published Properties

    /// Whether the circular menu should be shown
    @Published var isMenuPresented: Bool = false

    /// Position where the menu should appear
    @Published var menuPosition: CGPoint = .zero

    /// Currently active trigger
    @Published private(set) var activeTrigger: CircularMenuTrigger?

    /// Current gesture settings
    @Published var settings: CircularMenuGestureSettings {
        didSet { saveSettings() }
    }

    // MARK: - Private Properties

    /// Global event monitor for keyboard shortcuts
    private var keyboardMonitor: Any?

    /// Global event monitor for mouse events
    private var mouseMonitor: Any?

    /// Local event monitor for gesture events
    private var gestureMonitor: Any?

    /// Pressure event tracking
    private var lastPressure: Float = 0
    private var pressureAccumulator: Float = 0
    private var isTrackingPressure: Bool = false

    /// Two-finger tap tracking
    private var touchCount: Int = 0
    private var lastTouchTime: Date?

    /// Cancellables
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Constants

    private let settingsKey = "CircularMenuGestureSettings"
    private let pressureThreshold: Float = 0.6
    private let tapTimeout: TimeInterval = 0.3

    // MARK: - Initialization

    private init() {
        settings = loadSettings()
        setupMonitors()
    }

    deinit {
        removeMonitors()
    }

    // MARK: - Setup

    /// Set up event monitors
    func setupMonitors() {
        removeMonitors()

        // Global keyboard shortcut monitor
        keyboardMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.handleKeyboardEvent(event)
        }

        // Local keyboard monitor (for when app is active)
        let localKeyboard = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if self?.handleKeyboardEvent(event) == true {
                return nil  // Consume event
            }
            return event
        }

        // Mouse event monitors
        mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.rightMouseDown]) { [weak self] event in
            self?.handleMouseEvent(event)
        }

        // Pressure/Force Touch monitor
        gestureMonitor = NSEvent.addLocalMonitorForEvents(matching: [.pressure, .gesture]) { [weak self] event in
            self?.handleGestureEvent(event)
            return event
        }
    }

    /// Remove all event monitors
    func removeMonitors() {
        if let monitor = keyboardMonitor {
            NSEvent.removeMonitor(monitor)
        }
        if let monitor = mouseMonitor {
            NSEvent.removeMonitor(monitor)
        }
        if let monitor = gestureMonitor {
            NSEvent.removeMonitor(monitor)
        }

        keyboardMonitor = nil
        mouseMonitor = nil
        gestureMonitor = nil
    }

    // MARK: - Event Handlers

    /// Handle keyboard events
    @discardableResult
    private func handleKeyboardEvent(_ event: NSEvent) -> Bool {
        // Check if keyboard shortcut matches
        let modifiersMatch = event.modifierFlags.intersection(.deviceIndependentFlagsMask) == settings.keyboardModifiers

        guard modifiersMatch,
              let characters = event.charactersIgnoringModifiers?.lowercased(),
              characters == settings.keyboardKey.lowercased() else {
            return false
        }

        toggleMenu(trigger: .keyboardShortcut, at: NSEvent.mouseLocation)
        return true
    }

    /// Handle mouse events
    private func handleMouseEvent(_ event: NSEvent) {
        guard settings.rightClickEnabled else { return }

        if event.type == .rightMouseDown {
            triggerMenu(trigger: .rightClick, at: event.locationInWindow)
        }
    }

    /// Handle gesture events (pressure, multi-touch)
    private func handleGestureEvent(_ event: NSEvent) {
        switch event.type {
        case .pressure:
            handlePressureEvent(event)
        case .gesture:
            handleMultiTouchEvent(event)
        default:
            break
        }
    }

    /// Handle Force Touch/pressure events
    private func handlePressureEvent(_ event: NSEvent) {
        guard settings.forceTouchEnabled else { return }

        let pressure = event.pressure

        // Track pressure changes
        if pressure > lastPressure && pressure > settings.forceTouchThreshold {
            // Force Touch detected
            if !isMenuPresented {
                triggerMenu(trigger: .forceTouch, at: event.locationInWindow)
            }
        }

        lastPressure = pressure

        // Stage 2 Force Touch (deep press)
        if event.stage == 2 && !isMenuPresented {
            triggerMenu(trigger: .forceTouch, at: event.locationInWindow)
        }
    }

    /// Handle multi-touch tap events
    private func handleMultiTouchEvent(_ event: NSEvent) {
        // Note: This requires System Preferences > Trackpad settings
        // and appropriate entitlements for multi-touch access

        // For now, we detect multi-touch through magnification/rotation gestures
        // which can indicate finger presence

        // Full multi-touch support would require using the private
        // MultitouchSupport framework or accessibility APIs
    }

    // MARK: - Menu Control

    /// Trigger the menu to open
    func triggerMenu(trigger: CircularMenuTrigger, at point: CGPoint) {
        guard !isMenuPresented else { return }

        activeTrigger = trigger

        // Determine menu position
        if settings.openAtCursor {
            menuPosition = NSEvent.mouseLocation
        } else {
            // Center of main screen
            if let screen = NSScreen.main {
                menuPosition = CGPoint(
                    x: screen.frame.midX,
                    y: screen.frame.midY
                )
            }
        }

        // Apply open delay if configured
        if settings.openDelay > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + settings.openDelay) { [weak self] in
                self?.isMenuPresented = true
            }
        } else {
            isMenuPresented = true
        }

        // Play haptic feedback
        SensoryManager.shared.playHaptic(.generic)
    }

    /// Toggle the menu state
    func toggleMenu(trigger: CircularMenuTrigger, at point: CGPoint) {
        if isMenuPresented {
            dismissMenu()
        } else {
            triggerMenu(trigger: trigger, at: point)
        }
    }

    /// Dismiss the menu
    func dismissMenu() {
        isMenuPresented = false
        activeTrigger = nil
    }

    // MARK: - Settings Persistence

    private func loadSettings() -> CircularMenuGestureSettings {
        guard let data = UserDefaults.standard.data(forKey: settingsKey),
              let settings = try? JSONDecoder().decode(CircularMenuGestureSettings.self, from: data) else {
            return CircularMenuGestureSettings()
        }
        return settings
    }

    private func saveSettings() {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        UserDefaults.standard.set(data, forKey: settingsKey)
    }

    // MARK: - Public API

    /// Check if Force Touch is available on this device
    var isForceTouchAvailable: Bool {
        // Check if any connected trackpad supports Force Touch
        // This is a simplified check - full implementation would query IOKit
        return true  // Assume available on modern Macs
    }

    /// Reset settings to defaults
    func resetToDefaults() {
        settings = CircularMenuGestureSettings()
    }
}

// MARK: - Gesture Modifier

/// View modifier for attaching circular menu gesture recognition
struct CircularMenuGestureModifier: ViewModifier {

    @ObservedObject var recognizer = CircularMenuGestureRecognizer.shared

    /// Sectors to show in the menu
    let sectors: [CircularMenuSector]

    /// Callback when a sector is selected
    let onSelect: (CircularMenuSector) -> Void

    func body(content: Content) -> some View {
        content
            .overlay(
                CircularMenuView(
                    isPresented: $recognizer.isMenuPresented,
                    sectors: sectors,
                    centerPosition: recognizer.menuPosition,
                    onSelect: onSelect,
                    onDismiss: {
                        recognizer.dismissMenu()
                    }
                )
            )
    }
}

extension View {
    /// Attach circular menu gesture recognition to this view
    /// - Parameters:
    ///   - sectors: Sectors to display in the menu
    ///   - onSelect: Callback when a sector is selected
    func circularMenuGesture(
        sectors: [CircularMenuSector] = CircularMenuSector.defaultSectors,
        onSelect: @escaping (CircularMenuSector) -> Void
    ) -> some View {
        modifier(CircularMenuGestureModifier(sectors: sectors, onSelect: onSelect))
    }
}

// MARK: - Force Touch Gesture

/// Custom gesture for detecting Force Touch
struct ForceTouchGesture: Gesture {
    typealias Value = Float

    let threshold: Float

    init(threshold: Float = 0.5) {
        self.threshold = threshold
    }

    var body: some Gesture {
        // SwiftUI doesn't have built-in Force Touch gesture
        // This is a placeholder that uses long press as fallback
        LongPressGesture(minimumDuration: 0.3)
            .map { _ in threshold }
    }
}

// MARK: - Two-Finger Tap View

/// NSView wrapper for detecting two-finger taps
struct TwoFingerTapView: NSViewRepresentable {
    let onTap: (CGPoint) -> Void

    func makeNSView(context: Context) -> TwoFingerTapNSView {
        let view = TwoFingerTapNSView()
        view.onTap = onTap
        return view
    }

    func updateNSView(_ nsView: TwoFingerTapNSView, context: Context) {
        nsView.onTap = onTap
    }

    class TwoFingerTapNSView: NSView {
        var onTap: ((CGPoint) -> Void)?

        override var acceptsTouchEvents: Bool {
            get { true }
            set { }
        }

        override func touchesBegan(with event: NSEvent) {
            let touches = event.touches(matching: .began, in: self)
            if touches.count == 2 {
                let location = event.locationInWindow
                onTap?(location)
            }
        }
    }
}

// MARK: - Codable Extension for NSEvent.ModifierFlags

extension NSEvent.ModifierFlags: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(UInt.self)
        self.init(rawValue: rawValue)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

// MARK: - Codable Extension for CircularMenuTrigger

extension CircularMenuTrigger: Codable {}
