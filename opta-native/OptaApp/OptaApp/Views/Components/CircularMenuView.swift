//
//  CircularMenuView.swift
//  OptaApp
//
//  SwiftUI wrapper for the Rust circular menu component.
//  Provides gesture handling, animation sync, and sector selection.
//

import SwiftUI
import Combine

// MARK: - Sector Model

/// Represents a sector in the circular menu
struct CircularMenuSector: Identifiable, Equatable {
    let id: Int
    let icon: String
    let label: String
    let color: Color

    /// Default sectors for Opta navigation
    static let defaultSectors: [CircularMenuSector] = [
        CircularMenuSector(id: 0, icon: "house.fill", label: "Dashboard", color: Color(hex: "3B82F6")),
        CircularMenuSector(id: 1, icon: "gamecontroller.fill", label: "Games", color: Color(hex: "10B981")),
        CircularMenuSector(id: 2, icon: "chart.bar.fill", label: "Profiles", color: Color(hex: "F59E0B")),
        CircularMenuSector(id: 3, icon: "gearshape.fill", label: "Settings", color: Color(hex: "8B5CF6"))
    ]
}

// MARK: - CircularMenuView

/// SwiftUI view wrapping the Rust circular menu component.
///
/// Features:
/// - GPU-accelerated rendering via Rust/wgpu
/// - Smooth 120Hz animation sync via display link
/// - Mouse/trackpad tracking for sector highlighting
/// - Keyboard navigation support
/// - Haptic and audio feedback integration
///
/// # Usage
///
/// ```swift
/// CircularMenuView(
///     isPresented: $showMenu,
///     sectors: CircularMenuSector.defaultSectors,
///     onSelect: { sector in
///         navigate(to: sector)
///     }
/// )
/// ```
struct CircularMenuView: View {

    // MARK: - Properties

    /// Binding to control menu visibility
    @Binding var isPresented: Bool

    /// Sectors to display in the menu
    let sectors: [CircularMenuSector]

    /// Callback when a sector is selected
    var onSelect: ((CircularMenuSector) -> Void)?

    /// Callback when menu is dismissed without selection
    var onDismiss: (() -> Void)?

    /// Optional center position (defaults to view center)
    var centerPosition: CGPoint?

    /// Outer radius of the menu
    var radius: CGFloat = 150

    /// Inner radius of the menu
    var innerRadius: CGFloat = 50

    /// Glow color for highlighted sectors
    var glowColor: Color = Color(hex: "8B5CF6")

    // MARK: - State

    /// The Rust bridge for the circular menu
    @StateObject private var menuState = CircularMenuState()

    /// Currently highlighted sector index
    @State private var highlightedSector: Int = -1

    /// Mouse position in view coordinates
    @State private var mousePosition: CGPoint = .zero

    /// Whether mouse is being tracked
    @State private var isTrackingMouse: Bool = false

    /// Keyboard navigation index
    @State private var keyboardIndex: Int = 0

    /// Display link for animation sync
    @State private var displayLink: CVDisplayLink?

    /// Last frame timestamp
    @State private var lastFrameTime: Double = 0

    /// Animation cancellable
    @State private var animationCancellable: AnyCancellable?

    // MARK: - Environment

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Constants

    private let animationDuration: Double = 0.3

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background dimming
                if isPresented {
                    Color.black
                        .opacity(0.3 * Double(menuState.openProgress))
                        .ignoresSafeArea()
                        .onTapGesture {
                            dismiss()
                        }
                }

                // Menu content
                if menuState.openProgress > 0 {
                    circularMenuContent(in: geometry)
                        .position(menuCenter(in: geometry))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onAppear {
                setupDisplayLink()
                configureMenu(in: geometry)
            }
            .onDisappear {
                cleanupDisplayLink()
            }
            .onChange(of: isPresented) { _, newValue in
                if newValue {
                    openMenu()
                } else {
                    closeMenu()
                }
            }
        }
        .focusable()
        .onKeyPress(.escape) {
            dismiss()
            return .handled
        }
        .onKeyPress(.leftArrow) {
            navigateKeyboard(direction: -1)
            return .handled
        }
        .onKeyPress(.rightArrow) {
            navigateKeyboard(direction: 1)
            return .handled
        }
        .onKeyPress(.return) {
            selectCurrentSector()
            return .handled
        }
        .onKeyPress(.space) {
            selectCurrentSector()
            return .handled
        }
    }

    // MARK: - Menu Content

    private func circularMenuContent(in geometry: GeometryProxy) -> some View {
        ZStack {
            // Render sectors
            ForEach(sectors) { sector in
                sectorView(sector, in: geometry)
            }

            // Center ring indicator
            centerIndicator
        }
        .frame(width: radius * 2, height: radius * 2)
        .scaleEffect(menuState.openProgress)
        .opacity(Double(menuState.openProgress))
        .trackingArea { event, phase in
            handleMouseEvent(event, phase: phase, in: geometry)
        }
    }

    // MARK: - Sector View

    private func sectorView(_ sector: CircularMenuSector, in geometry: GeometryProxy) -> some View {
        let angle = sectorAngle(for: sector.id)
        let isHighlighted = highlightedSector == sector.id
        let sectorCenter = sectorCenterPosition(for: sector.id)

        return ZStack {
            // Sector arc background
            SectorArc(
                startAngle: angle - sectorSpan / 2,
                endAngle: angle + sectorSpan / 2,
                innerRadius: innerRadius,
                outerRadius: radius
            )
            .fill(
                isHighlighted
                    ? sector.color.opacity(0.3)
                    : Color.white.opacity(0.05)
            )

            // Sector arc border
            SectorArc(
                startAngle: angle - sectorSpan / 2,
                endAngle: angle + sectorSpan / 2,
                innerRadius: innerRadius,
                outerRadius: radius
            )
            .stroke(
                isHighlighted
                    ? sector.color.opacity(0.6)
                    : Color.white.opacity(0.15),
                lineWidth: isHighlighted ? 2 : 1
            )

            // Glow effect for highlighted sector
            if isHighlighted && !reduceMotion {
                SectorArc(
                    startAngle: angle - sectorSpan / 2,
                    endAngle: angle + sectorSpan / 2,
                    innerRadius: innerRadius,
                    outerRadius: radius
                )
                .stroke(sector.color, lineWidth: 4)
                .blur(radius: 8)
                .opacity(Double(menuState.highlightProgress) * 0.5)
            }

            // Icon and label
            VStack(spacing: 4) {
                Image(systemName: sector.icon)
                    .font(.system(size: isHighlighted ? 24 : 20, weight: .semibold))
                    .foregroundStyle(isHighlighted ? sector.color : .white.opacity(0.8))

                Text(sector.label)
                    .font(.system(size: isHighlighted ? 12 : 10, weight: .medium))
                    .foregroundStyle(isHighlighted ? .white : .white.opacity(0.6))
            }
            .position(sectorCenter)
        }
        .contentShape(
            SectorArc(
                startAngle: angle - sectorSpan / 2,
                endAngle: angle + sectorSpan / 2,
                innerRadius: innerRadius,
                outerRadius: radius
            )
        )
        .onTapGesture {
            selectSector(sector)
        }
    }

    // MARK: - Center Indicator

    private var centerIndicator: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color(hex: "1E1E2E").opacity(0.9),
                        Color(hex: "09090B")
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: innerRadius
                )
            )
            .frame(width: innerRadius * 2, height: innerRadius * 2)
            .overlay(
                Circle()
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.2),
                                Color.white.opacity(0.05)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .overlay(
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
    }

    // MARK: - Geometry Helpers

    private func menuCenter(in geometry: GeometryProxy) -> CGPoint {
        centerPosition ?? CGPoint(
            x: geometry.size.width / 2,
            y: geometry.size.height / 2
        )
    }

    private var sectorSpan: Angle {
        .degrees(360.0 / Double(sectors.count))
    }

    private func sectorAngle(for index: Int) -> Angle {
        // Start from top (-90 degrees) and go clockwise
        let baseAngle = -90.0
        let sectorAngle = 360.0 / Double(sectors.count)
        return .degrees(baseAngle + sectorAngle * Double(index))
    }

    private func sectorCenterPosition(for index: Int) -> CGPoint {
        let angle = sectorAngle(for: index)
        let centerRadius = (innerRadius + radius) / 2
        let x = radius + centerRadius * CGFloat(cos(angle.radians))
        let y = radius + centerRadius * CGFloat(sin(angle.radians))
        return CGPoint(x: x, y: y)
    }

    // MARK: - Mouse Tracking

    private func handleMouseEvent(_ event: NSEvent, phase: TrackingPhase, in geometry: GeometryProxy) {
        switch phase {
        case .entered:
            isTrackingMouse = true
        case .exited:
            isTrackingMouse = false
            updateHighlightedSector(-1)
        case .moved:
            let location = event.locationInWindow
            let viewLocation = geometry.frame(in: .global)
            let relativePoint = CGPoint(
                x: location.x - viewLocation.minX,
                y: viewLocation.maxY - location.y  // Flip Y for SwiftUI coordinates
            )

            mousePosition = relativePoint
            updateSectorFromMouse(relativePoint, in: geometry)
        }
    }

    private func updateSectorFromMouse(_ point: CGPoint, in geometry: GeometryProxy) {
        let center = menuCenter(in: geometry)

        // Convert to relative coordinates from center
        let relativeX = point.x - center.x
        let relativeY = point.y - center.y
        let distance = sqrt(relativeX * relativeX + relativeY * relativeY)

        // Check if within ring bounds
        guard distance >= innerRadius && distance <= radius else {
            updateHighlightedSector(-1)
            return
        }

        // Calculate angle and determine sector
        var angle = atan2(relativeY, relativeX)
        angle = angle + .pi / 2  // Adjust for top-centered start
        if angle < 0 { angle += .pi * 2 }

        let sectorIndex = Int(angle / (.pi * 2 / Double(sectors.count)))
        let clampedIndex = sectorIndex % sectors.count

        updateHighlightedSector(clampedIndex)
    }

    private func updateHighlightedSector(_ index: Int) {
        guard highlightedSector != index else { return }

        withAnimation(.easeOut(duration: 0.15)) {
            highlightedSector = index
        }

        menuState.bridge?.highlightedSector = Int32(index)

        // Trigger haptic feedback on sector change
        if index >= 0 {
            SensoryManager.shared.playInteraction(.sectorHighlight)
        }
    }

    // MARK: - Keyboard Navigation

    private func navigateKeyboard(direction: Int) {
        let newIndex = (keyboardIndex + direction + sectors.count) % sectors.count
        keyboardIndex = newIndex
        updateHighlightedSector(newIndex)

        SensoryManager.shared.playInteraction(.navigation)
    }

    private func selectCurrentSector() {
        if highlightedSector >= 0 && highlightedSector < sectors.count {
            selectSector(sectors[highlightedSector])
        }
    }

    // MARK: - Selection

    private func selectSector(_ sector: CircularMenuSector) {
        SensoryManager.shared.playInteraction(.sectorSelect)

        // Brief delay for feedback
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: animationDuration)) {
                isPresented = false
            }
            onSelect?(sector)
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: animationDuration)) {
            isPresented = false
        }
        onDismiss?()
    }

    // MARK: - Menu State

    private func configureMenu(in geometry: GeometryProxy) {
        let center = menuCenter(in: geometry)

        // Safely extract RGB components (handle grayscale and other color spaces)
        let glowR: Float
        let glowG: Float
        let glowB: Float
        if let cgColor = glowColor.cgColor,
           let components = cgColor.components,
           components.count >= 3 {
            glowR = Float(components[0])
            glowG = Float(components[1])
            glowB = Float(components[2])
        } else if let cgColor = glowColor.cgColor,
                  let components = cgColor.components,
                  components.count >= 1 {
            // Grayscale color space - use luminance for all channels
            let gray = Float(components[0])
            glowR = gray
            glowG = gray
            glowB = gray
        } else {
            // Fallback blue-purple glow
            glowR = 0.545
            glowG = 0.361
            glowB = 0.965
        }

        var config = CircularMenuConfig()
        config.centerX = Float(center.x)
        config.centerY = Float(center.y)
        config.radius = Float(radius)
        config.innerRadius = Float(innerRadius)
        config.sectorCount = UInt32(max(1, sectors.count))
        config.glowColor = (glowR, glowG, glowB)

        menuState.configure(config)
    }

    private func openMenu() {
        menuState.open()
        keyboardIndex = 0
        startDisplayLinkIfNeeded()

        if !reduceMotion {
            SensoryManager.shared.playInteraction(.menuOpen)
        }
    }

    private func closeMenu() {
        menuState.close()
        highlightedSector = -1

        if !reduceMotion {
            SensoryManager.shared.playInteraction(.menuClose)
        }

        // Stop display link after close animation completes
        DispatchQueue.main.asyncAfter(deadline: .now() + animationDuration + 0.1) { [self] in
            if !isPresented && menuState.openProgress < 0.01 {
                stopDisplayLinkIfRunning()
            }
        }
    }

    // MARK: - Display Link

    private func setupDisplayLink() {
        guard !reduceMotion else { return }
        cleanupDisplayLink()

        var link: CVDisplayLink?
        CVDisplayLinkCreateWithActiveCGDisplays(&link)

        guard let displayLink = link else { return }

        // Configure for main display (supports ProMotion 120Hz)
        CVDisplayLinkSetCurrentCGDisplay(displayLink, CGMainDisplayID())

        let callback: CVDisplayLinkOutputCallback = { _, _, _, _, _, userInfo -> CVReturn in
            guard let userInfo = userInfo else { return kCVReturnSuccess }

            // Use passRetained/takeRetainedValue pattern for safety
            let state = Unmanaged<CircularMenuState>.fromOpaque(userInfo).takeUnretainedValue()

            DispatchQueue.main.async {
                state.update()
            }

            return kCVReturnSuccess
        }

        // Retain the state object to prevent deallocation while display link is active
        let userInfo = Unmanaged.passRetained(menuState).toOpaque()
        CVDisplayLinkSetOutputCallback(displayLink, callback, userInfo)
        CVDisplayLinkStart(displayLink)

        self.displayLink = displayLink
    }

    private func cleanupDisplayLink() {
        if let displayLink = displayLink {
            CVDisplayLinkStop(displayLink)
            // Balance the passRetained call
            Unmanaged.passUnretained(menuState).release()
        }
        displayLink = nil
    }

    private func startDisplayLinkIfNeeded() {
        guard !reduceMotion else { return }
        if let displayLink = displayLink, !CVDisplayLinkIsRunning(displayLink) {
            CVDisplayLinkStart(displayLink)
        } else if displayLink == nil {
            setupDisplayLink()
        }
    }

    private func stopDisplayLinkIfRunning() {
        if let displayLink = displayLink, CVDisplayLinkIsRunning(displayLink) {
            CVDisplayLinkStop(displayLink)
        }
    }
}

// MARK: - Circular Menu State

/// Observable state object for the circular menu
final class CircularMenuState: ObservableObject {

    /// The Rust bridge
    private(set) var bridge: CircularMenuBridge?

    /// Current open progress (0.0-1.0)
    @Published var openProgress: Float = 0

    /// Current highlight progress (0.0-1.0)
    @Published var highlightProgress: Float = 0

    /// Last update timestamp
    private var lastUpdateTime: CFAbsoluteTime = 0

    /// Configure the menu with settings
    func configure(_ config: CircularMenuConfig) {
        bridge = CircularMenuBridge(config: config)
    }

    /// Open the menu
    func open() {
        bridge?.open()
    }

    /// Close the menu
    func close() {
        bridge?.close()
    }

    /// Update animation state (called from display link)
    func update() {
        let now = CFAbsoluteTimeGetCurrent()
        let dt = Float(now - lastUpdateTime)
        lastUpdateTime = now

        guard dt > 0 && dt < 0.1 else { return }  // Skip unreasonable deltas

        // Single lock acquisition for update + state read
        guard let bridge = bridge else { return }
        let snapshot = bridge.updateAndGetState(deltaTime: dt)

        if abs(openProgress - snapshot.openProgress) > 0.001 {
            openProgress = snapshot.openProgress
        }
        if abs(highlightProgress - snapshot.highlightProgress) > 0.001 {
            highlightProgress = snapshot.highlightProgress
        }
    }
}

// MARK: - Sector Arc Shape

/// Shape for drawing a sector arc
struct SectorArc: Shape {
    let startAngle: Angle
    let endAngle: Angle
    let innerRadius: CGFloat
    let outerRadius: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let center = CGPoint(x: rect.midX, y: rect.midY)

        // Start at outer arc
        let startOuter = CGPoint(
            x: center.x + outerRadius * CGFloat(cos(startAngle.radians)),
            y: center.y + outerRadius * CGFloat(sin(startAngle.radians))
        )

        path.move(to: startOuter)

        // Outer arc
        path.addArc(
            center: center,
            radius: outerRadius,
            startAngle: startAngle,
            endAngle: endAngle,
            clockwise: false
        )

        // Line to inner arc
        path.addLine(to: CGPoint(
            x: center.x + innerRadius * CGFloat(cos(endAngle.radians)),
            y: center.y + innerRadius * CGFloat(sin(endAngle.radians))
        ))

        // Inner arc (reverse direction)
        path.addArc(
            center: center,
            radius: innerRadius,
            startAngle: endAngle,
            endAngle: startAngle,
            clockwise: true
        )

        path.closeSubpath()

        return path
    }
}

// MARK: - Tracking Area

/// Tracking phase for mouse events
enum TrackingPhase {
    case entered
    case exited
    case moved
}

/// View modifier for tracking mouse events
struct TrackingAreaModifier: ViewModifier {
    let handler: (NSEvent, TrackingPhase) -> Void

    func body(content: Content) -> some View {
        content.overlay(
            TrackingAreaView(handler: handler)
        )
    }
}

/// NSView wrapper for mouse tracking
struct TrackingAreaView: NSViewRepresentable {
    let handler: (NSEvent, TrackingPhase) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = TrackingNSView()
        view.handler = handler
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        (nsView as? TrackingNSView)?.handler = handler
    }

    class TrackingNSView: NSView {
        var handler: ((NSEvent, TrackingPhase) -> Void)?
        var trackingArea: NSTrackingArea?

        override func updateTrackingAreas() {
            super.updateTrackingAreas()

            if let trackingArea = trackingArea {
                removeTrackingArea(trackingArea)
            }

            let area = NSTrackingArea(
                rect: bounds,
                options: [.mouseEnteredAndExited, .mouseMoved, .activeInKeyWindow],
                owner: self,
                userInfo: nil
            )
            addTrackingArea(area)
            trackingArea = area
        }

        override func mouseEntered(with event: NSEvent) {
            handler?(event, .entered)
        }

        override func mouseExited(with event: NSEvent) {
            handler?(event, .exited)
        }

        override func mouseMoved(with event: NSEvent) {
            handler?(event, .moved)
        }
    }
}

extension View {
    func trackingArea(handler: @escaping (NSEvent, TrackingPhase) -> Void) -> some View {
        modifier(TrackingAreaModifier(handler: handler))
    }
}

// MARK: - Preview

#if DEBUG
struct CircularMenuView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color(hex: "09090B").ignoresSafeArea()

            CircularMenuPreviewWrapper()
        }
        .frame(width: 500, height: 500)
        .preferredColorScheme(.dark)
    }
}

struct CircularMenuPreviewWrapper: View {
    @State private var isPresented = true

    var body: some View {
        VStack {
            Button("Toggle Menu") {
                withAnimation {
                    isPresented.toggle()
                }
            }
            .padding()

            Spacer()
        }
        .overlay(
            CircularMenuView(
                isPresented: $isPresented,
                sectors: CircularMenuSector.defaultSectors,
                onSelect: { sector in
                    print("Selected: \(sector.label)")
                }
            )
        )
    }
}
#endif
