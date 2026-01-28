//
//  CircularMenuAccessibility.swift
//  OptaApp
//
//  Accessibility support for the circular menu.
//  Provides VoiceOver, keyboard navigation, and reduced motion support.
//

import SwiftUI
import Accessibility

// MARK: - Accessibility Element

/// Accessibility representation of a menu sector
struct CircularMenuAccessibilityElement {
    let sector: CircularMenuSector
    let index: Int
    let totalCount: Int
    let isHighlighted: Bool

    /// Accessibility label for VoiceOver
    var accessibilityLabel: String {
        "\(sector.label), sector \(index + 1) of \(totalCount)"
    }

    /// Accessibility hint for VoiceOver
    var accessibilityHint: String {
        isHighlighted
            ? "Press Return or Space to select"
            : "Press arrow keys to navigate"
    }

    /// Accessibility value (for state)
    var accessibilityValue: String {
        isHighlighted ? "Selected" : ""
    }
}

// MARK: - Keyboard Navigation Handler

/// Handles keyboard navigation for the circular menu
final class CircularMenuKeyboardHandler: ObservableObject {

    // MARK: - Published Properties

    /// Currently focused sector index
    @Published var focusedIndex: Int = 0

    /// Whether keyboard navigation is active
    @Published var isKeyboardActive: Bool = false

    // MARK: - Properties

    /// Total number of sectors
    private(set) var sectorCount: Int = 4

    /// Callback when selection is made
    var onSelect: ((Int) -> Void)?

    /// Callback when navigation changes
    var onNavigate: ((Int) -> Void)?

    /// Callback to dismiss menu
    var onDismiss: (() -> Void)?

    // MARK: - Configuration

    /// Configure the handler with sector count
    func configure(sectorCount: Int) {
        self.sectorCount = sectorCount
        focusedIndex = 0
    }

    // MARK: - Navigation

    /// Navigate to the next sector
    func navigateNext() {
        focusedIndex = (focusedIndex + 1) % sectorCount
        isKeyboardActive = true
        onNavigate?(focusedIndex)
        announceCurrentSector()
    }

    /// Navigate to the previous sector
    func navigatePrevious() {
        focusedIndex = (focusedIndex - 1 + sectorCount) % sectorCount
        isKeyboardActive = true
        onNavigate?(focusedIndex)
        announceCurrentSector()
    }

    /// Navigate by direction (clockwise/counter-clockwise)
    func navigate(direction: Int) {
        if direction > 0 {
            navigateNext()
        } else {
            navigatePrevious()
        }
    }

    /// Navigate to a specific sector by number key
    func navigateToSector(_ index: Int) {
        guard index >= 0 && index < sectorCount else { return }
        focusedIndex = index
        isKeyboardActive = true
        onNavigate?(focusedIndex)
        announceCurrentSector()
    }

    /// Select the currently focused sector
    func selectCurrent() {
        isKeyboardActive = true
        onSelect?(focusedIndex)
    }

    /// Dismiss the menu
    func dismiss() {
        onDismiss?()
    }

    /// Reset keyboard state
    func reset() {
        focusedIndex = 0
        isKeyboardActive = false
    }

    // MARK: - VoiceOver

    /// Announce the current sector for VoiceOver
    private func announceCurrentSector() {
        // Post accessibility announcement
        let announcement = "Sector \(focusedIndex + 1) of \(sectorCount)"
        NSAccessibility.post(
            element: NSApp.mainWindow as Any,
            notification: .announcementRequested,
            userInfo: [.announcement: announcement, .priority: NSAccessibilityPriorityLevel.high]
        )
    }
}

// MARK: - Key Press Handler View Modifier

/// View modifier for handling keyboard input in the circular menu
struct CircularMenuKeyboardModifier: ViewModifier {

    @ObservedObject var handler: CircularMenuKeyboardHandler

    func body(content: Content) -> some View {
        content
            .focusable(true)
            .focused($isFocused)
            .onKeyPress(phases: .down) { keyPress in
                handleKeyPress(keyPress)
            }
            .onAppear {
                // Request focus when menu appears
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isFocused = true
                }
            }
    }

    @FocusState private var isFocused: Bool

    private func handleKeyPress(_ keyPress: KeyPress) -> KeyPress.Result {
        switch keyPress.key {
        case .leftArrow:
            handler.navigatePrevious()
            return .handled
        case .rightArrow:
            handler.navigateNext()
            return .handled
        case .upArrow:
            handler.navigatePrevious()
            return .handled
        case .downArrow:
            handler.navigateNext()
            return .handled
        case .return, .space:
            handler.selectCurrent()
            return .handled
        case .escape:
            handler.dismiss()
            return .handled
        case .tab:
            if keyPress.modifiers.contains(.shift) {
                handler.navigatePrevious()
            } else {
                handler.navigateNext()
            }
            return .handled
        default:
            // Check for number keys 1-9 for direct sector access
            if let number = numberFromKey(keyPress.key), number > 0, number <= handler.sectorCount {
                handler.navigateToSector(number - 1)
                return .handled
            }
            return .ignored
        }
    }

    private func numberFromKey(_ key: KeyEquivalent) -> Int? {
        switch key {
        case "1": return 1
        case "2": return 2
        case "3": return 3
        case "4": return 4
        case "5": return 5
        case "6": return 6
        case "7": return 7
        case "8": return 8
        case "9": return 9
        default: return nil
        }
    }
}

extension View {
    /// Add keyboard navigation handling to the view
    func circularMenuKeyboard(handler: CircularMenuKeyboardHandler) -> some View {
        modifier(CircularMenuKeyboardModifier(handler: handler))
    }
}

// MARK: - Accessible Circular Menu View

/// Wrapper that adds full accessibility support to CircularMenuView
struct AccessibleCircularMenuView: View {

    // MARK: - Properties

    @Binding var isPresented: Bool
    let sectors: [CircularMenuSector]
    var onSelect: ((CircularMenuSector) -> Void)?
    var onDismiss: (() -> Void)?

    // MARK: - State

    @StateObject private var keyboardHandler = CircularMenuKeyboardHandler()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled

    // MARK: - Body

    var body: some View {
        CircularMenuView(
            isPresented: $isPresented,
            sectors: sectors,
            onSelect: { sector in
                onSelect?(sector)
            },
            onDismiss: {
                onDismiss?()
            }
        )
        .circularMenuKeyboard(handler: keyboardHandler)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Circular navigation menu")
        .accessibilityHint("Use arrow keys to navigate, Return to select, Escape to dismiss")
        .accessibilityAddTraits(.isModal)
        .onAppear {
            keyboardHandler.configure(sectorCount: sectors.count)
            keyboardHandler.onSelect = { index in
                if index >= 0 && index < sectors.count {
                    onSelect?(sectors[index])
                }
            }
            keyboardHandler.onDismiss = {
                isPresented = false
                onDismiss?()
            }

            // Announce menu opening for VoiceOver
            if voiceOverEnabled {
                announceMenuOpen()
            }
        }
        .onDisappear {
            keyboardHandler.reset()

            // Announce menu closing for VoiceOver
            if voiceOverEnabled {
                announceMenuClose()
            }
        }
    }

    // MARK: - VoiceOver Announcements

    private func announceMenuOpen() {
        let announcement = "Circular menu opened. \(sectors.count) items available. Use arrow keys to navigate."
        postAnnouncement(announcement)
    }

    private func announceMenuClose() {
        let announcement = "Circular menu closed."
        postAnnouncement(announcement)
    }

    private func postAnnouncement(_ text: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            NSAccessibility.post(
                element: NSApp.mainWindow as Any,
                notification: .announcementRequested,
                userInfo: [.announcement: text, .priority: NSAccessibilityPriorityLevel.high]
            )
        }
    }
}

// MARK: - Accessible Sector View

/// Individual sector with full accessibility support
struct AccessibleSectorView: View {

    let sector: CircularMenuSector
    let index: Int
    let totalCount: Int
    let isHighlighted: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: 4) {
                Image(systemName: sector.icon)
                    .font(.system(size: isHighlighted ? 24 : 20))
                    .foregroundStyle(isHighlighted ? sector.color : .white.opacity(0.8))

                Text(sector.label)
                    .font(.system(size: isHighlighted ? 12 : 10, weight: .medium))
                    .foregroundStyle(isHighlighted ? .white : .white.opacity(0.6))
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(sector.label)
        .accessibilityHint("Double tap to select")
        .accessibilityValue(isHighlighted ? "Selected" : "")
        .accessibilityAddTraits(isHighlighted ? [.isSelected] : [])
        .accessibilityIdentifier("sector-\(sector.id)")
    }
}

// MARK: - Reduced Motion Support

/// Alternative linear menu for users who prefer reduced motion
struct ReducedMotionMenuView: View {

    @Binding var isPresented: Bool
    let sectors: [CircularMenuSector]
    var onSelect: ((CircularMenuSector) -> Void)?

    @State private var selectedIndex: Int = 0

    var body: some View {
        if isPresented {
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Quick Navigation")
                        .font(.headline)
                        .foregroundStyle(.white)

                    Spacer()

                    Button {
                        isPresented = false
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
                .padding()

                Divider()
                    .background(Color.white.opacity(0.1))

                // Sector list
                ForEach(Array(sectors.enumerated()), id: \.element.id) { index, sector in
                    Button {
                        onSelect?(sector)
                        isPresented = false
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: sector.icon)
                                .font(.system(size: 18))
                                .foregroundStyle(sector.color)
                                .frame(width: 24)

                            Text(sector.label)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(.white)

                            Spacer()

                            // Number key hint
                            Text("\(index + 1)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.4))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.white.opacity(0.1))
                                )
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(selectedIndex == index ? Color.white.opacity(0.1) : Color.clear)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(sector.label)
                    .accessibilityHint("Press \(index + 1) for quick access")
                }
            }
            .frame(width: 240)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
            .transition(.opacity.combined(with: .scale(scale: 0.95)))
        }
    }
}

// MARK: - Accessibility-Aware Menu

/// Menu that automatically switches based on accessibility preferences
struct AccessibilityAwareMenuView: View {

    @Binding var isPresented: Bool
    let sectors: [CircularMenuSector]
    var onSelect: ((CircularMenuSector) -> Void)?
    var onDismiss: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if reduceMotion {
            ReducedMotionMenuView(
                isPresented: $isPresented,
                sectors: sectors,
                onSelect: onSelect
            )
        } else {
            AccessibleCircularMenuView(
                isPresented: $isPresented,
                sectors: sectors,
                onSelect: onSelect,
                onDismiss: onDismiss
            )
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CircularMenuAccessibility_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Standard circular menu
            AccessibilityPreviewWrapper(reduceMotion: false)
                .previewDisplayName("Standard")

            // Reduced motion menu
            AccessibilityPreviewWrapper(reduceMotion: true)
                .previewDisplayName("Reduced Motion")
        }
        .frame(width: 500, height: 500)
        .preferredColorScheme(.dark)
    }
}

struct AccessibilityPreviewWrapper: View {
    let reduceMotion: Bool
    @State private var isPresented = true

    var body: some View {
        ZStack {
            Color(hex: "09090B").ignoresSafeArea()

            if reduceMotion {
                ReducedMotionMenuView(
                    isPresented: $isPresented,
                    sectors: CircularMenuSector.defaultSectors
                ) { sector in
                    print("Selected: \(sector.label)")
                }
            } else {
                AccessibleCircularMenuView(
                    isPresented: $isPresented,
                    sectors: CircularMenuSector.defaultSectors
                ) { sector in
                    print("Selected: \(sector.label)")
                }
            }
        }
    }
}
#endif
