//
//  CircularMenuNavigation.swift
//  OptaApp
//
//  Navigation integration for the circular menu.
//  Connects sector selections to app-wide navigation.
//

import SwiftUI

// MARK: - Navigation Destination

/// Navigation destinations available through the circular menu
enum CircularMenuDestination: String, CaseIterable, Identifiable {
    case dashboard
    case games
    case profiles
    case settings
    case optimize
    case aiChat

    var id: String { rawValue }

    /// Convert to PageViewModel for Crux navigation
    var pageViewModel: PageViewModel {
        switch self {
        case .dashboard: return .dashboard
        case .games: return .games
        case .profiles: return .settings  // Profiles is in settings for now
        case .settings: return .settings
        case .optimize: return .optimize
        case .aiChat: return .aiChat
        }
    }

    /// Display name for the destination
    var displayName: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .games: return "Games"
        case .profiles: return "Profiles"
        case .settings: return "Settings"
        case .optimize: return "Optimize"
        case .aiChat: return "AI Chat"
        }
    }

    /// SF Symbol icon name
    var iconName: String {
        switch self {
        case .dashboard: return "house.fill"
        case .games: return "gamecontroller.fill"
        case .profiles: return "chart.bar.fill"
        case .settings: return "gearshape.fill"
        case .optimize: return "bolt.fill"
        case .aiChat: return "message.fill"
        }
    }

    /// Accent color for the destination — unified Electric Violet (branch-energy)
    var color: Color {
        ColorTemperatureState.active.violetColor
    }

    /// Convert to CircularMenuSector
    func toSector(index: Int) -> CircularMenuSector {
        CircularMenuSector(
            id: index,
            icon: iconName,
            label: displayName,
            color: color
        )
    }
}

// MARK: - Navigation Configuration

/// Configuration for circular menu navigation
struct CircularMenuNavigationConfig {
    /// Destinations to include in the menu (max 8)
    var destinations: [CircularMenuDestination]

    /// Default 4-sector configuration
    static let defaultFourSector = CircularMenuNavigationConfig(
        destinations: [.dashboard, .games, .profiles, .settings]
    )

    /// Extended 6-sector configuration
    static let extendedSixSector = CircularMenuNavigationConfig(
        destinations: [.dashboard, .games, .profiles, .settings, .optimize, .aiChat]
    )

    /// Generate sectors from destinations
    var sectors: [CircularMenuSector] {
        destinations.enumerated().map { index, destination in
            destination.toSector(index: index)
        }
    }

    /// Find destination for a sector index
    func destination(for sectorIndex: Int) -> CircularMenuDestination? {
        guard sectorIndex >= 0 && sectorIndex < destinations.count else {
            return nil
        }
        return destinations[sectorIndex]
    }

    /// Find destination for a sector
    func destination(for sector: CircularMenuSector) -> CircularMenuDestination? {
        destination(for: sector.id)
    }
}

// MARK: - Navigation Manager

/// Manages navigation through the circular menu
@MainActor
final class CircularMenuNavigationManager: ObservableObject {

    // MARK: - Singleton

    static let shared = CircularMenuNavigationManager()

    // MARK: - Properties

    /// Navigation configuration
    @Published var config: CircularMenuNavigationConfig = .defaultFourSector

    /// Current navigation destination (for visual feedback)
    @Published private(set) var currentDestination: CircularMenuDestination = .dashboard

    /// Callback for navigation events
    var onNavigate: ((CircularMenuDestination) -> Void)?

    /// Reference to core manager (set at app startup)
    weak var coreManager: OptaCoreManager?

    // MARK: - Private

    private init() {}

    // MARK: - Navigation

    /// Navigate to a destination via the circular menu
    func navigate(to destination: CircularMenuDestination) {
        currentDestination = destination

        // Play haptic feedback
        SensoryManager.shared.playHaptic(.tap)

        // Navigate via Crux
        if let coreManager = coreManager {
            coreManager.navigate(to: destination.pageViewModel)
        }

        // Call external handler
        onNavigate?(destination)

        print("[CircularMenuNav] Navigated to: \(destination.displayName)")
    }

    /// Navigate using a sector selection
    func navigate(sector: CircularMenuSector) {
        guard let destination = config.destination(for: sector) else {
            print("[CircularMenuNav] No destination for sector \(sector.id)")
            return
        }
        navigate(to: destination)
    }

    /// Navigate using a sector index
    func navigate(sectorIndex: Int) {
        guard let destination = config.destination(for: sectorIndex) else {
            print("[CircularMenuNav] No destination for sector index \(sectorIndex)")
            return
        }
        navigate(to: destination)
    }

    /// Update current destination from external navigation
    func syncFromPage(_ page: PageViewModel) {
        switch page {
        case .dashboard:
            currentDestination = .dashboard
        case .games, .gameDetail:
            currentDestination = .games
        case .settings:
            currentDestination = .settings
        case .optimize:
            currentDestination = .optimize
        case .aiChat:
            currentDestination = .aiChat
        case .processes, .chess:
            // No direct mapping, keep current
            break
        }
    }
}

// MARK: - View Extension

extension View {
    /// Add circular menu navigation to a view
    /// - Parameters:
    ///   - isPresented: Binding to control menu visibility
    ///   - config: Navigation configuration (defaults to 4-sector)
    func circularMenuNavigation(
        isPresented: Binding<Bool>,
        config: CircularMenuNavigationConfig = .defaultFourSector
    ) -> some View {
        modifier(CircularMenuNavigationModifier(
            isPresented: isPresented,
            config: config
        ))
    }
}

// MARK: - Navigation Modifier

/// View modifier for circular menu navigation
struct CircularMenuNavigationModifier: ViewModifier {

    @Binding var isPresented: Bool
    let config: CircularMenuNavigationConfig

    @Environment(\.optaCoreManager) private var coreManager

    func body(content: Content) -> some View {
        content
            .overlay(
                AccessibilityAwareMenuView(
                    isPresented: $isPresented,
                    sectors: config.sectors,
                    onSelect: { sector in
                        handleSelection(sector)
                    },
                    onDismiss: {
                        isPresented = false
                    }
                )
            )
            .onAppear {
                // Connect navigation manager to core manager
                CircularMenuNavigationManager.shared.coreManager = coreManager
                CircularMenuNavigationManager.shared.config = config
            }
    }

    private func handleSelection(_ sector: CircularMenuSector) {
        CircularMenuNavigationManager.shared.navigate(sector: sector)
    }
}

// MARK: - Environment Key
// OptaCoreManagerKey and EnvironmentValues.optaCoreManager
// are defined in ColorTemperatureEnvironment.swift

// MARK: - Integrated Menu View

/// Complete circular menu with navigation integration
struct NavigableCircularMenuView: View {

    @Binding var isPresented: Bool

    @Environment(\.optaCoreManager) private var coreManager

    var config: CircularMenuNavigationConfig = .defaultFourSector

    var body: some View {
        AccessibilityAwareMenuView(
            isPresented: $isPresented,
            sectors: config.sectors,
            onSelect: { sector in
                handleSelection(sector)
            },
            onDismiss: {
                isPresented = false
            }
        )
        .onAppear {
            CircularMenuNavigationManager.shared.coreManager = coreManager
        }
    }

    private func handleSelection(_ sector: CircularMenuSector) {
        guard let destination = config.destination(for: sector) else { return }

        withAnimation(.easeOut(duration: 0.2)) {
            isPresented = false
        }

        // Small delay for animation to complete
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            CircularMenuNavigationManager.shared.navigate(to: destination)
        }
    }
}

// MARK: - Keyboard Shortcut Integration

/// Add global keyboard shortcut for circular menu
struct CircularMenuShortcutModifier: ViewModifier {

    @Binding var isPresented: Bool

    func body(content: Content) -> some View {
        content
            .keyboardShortcut("n", modifiers: [.command, .option])
            .onReceive(NotificationCenter.default.publisher(for: .toggleCircularMenu)) { _ in
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isPresented.toggle()
                }
            }
    }
}

extension View {
    /// Add keyboard shortcut for circular menu toggle
    func circularMenuShortcut(isPresented: Binding<Bool>) -> some View {
        modifier(CircularMenuShortcutModifier(isPresented: isPresented))
    }
}

// MARK: - Notifications

extension Notification.Name {
    /// Notification to toggle the circular menu
    static let toggleCircularMenu = Notification.Name("toggleCircularMenu")
}

// MARK: - Preview

#if DEBUG
struct CircularMenuNavigation_Previews: PreviewProvider {
    static var previews: some View {
        NavigationPreviewWrapper()
            .frame(width: 500, height: 500)
            .preferredColorScheme(.dark)
    }
}

struct NavigationPreviewWrapper: View {
    @State private var isPresented = true

    var body: some View {
        ZStack {
            Color(hex: "09090B").ignoresSafeArea()

            VStack {
                Text("Navigation Preview")
                    .foregroundStyle(.white)

                Button("Toggle Menu") {
                    withAnimation {
                        isPresented.toggle()
                    }
                }
            }

            NavigableCircularMenuView(
                isPresented: $isPresented,
                config: .defaultFourSector
            )
        }
    }
}
#endif
