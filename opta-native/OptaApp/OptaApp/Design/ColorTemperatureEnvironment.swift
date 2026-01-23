//
//  ColorTemperatureEnvironment.swift
//  OptaApp
//
//  SwiftUI Environment integration for the ColorTemperature system.
//  Provides an EnvironmentKey, provider view modifier, and convenience accessors
//  so all views can read the current color temperature state.
//

import SwiftUI

// MARK: - EnvironmentKey

/// Environment key for the current color temperature state.
///
/// Default value is `.idle` — a safe neutral state that provides
/// subtle violet without being visually dormant.
private struct ColorTemperatureKey: EnvironmentKey {
    static let defaultValue: ColorTemperatureState = .idle
}

// MARK: - EnvironmentValues Extension

extension EnvironmentValues {
    /// The current color temperature state, resolved from ring phase + energy + system state.
    ///
    /// Read this in any view to access temperature-driven color properties:
    /// ```swift
    /// @Environment(\.colorTemperature) private var temperature
    ///
    /// var body: some View {
    ///     Circle()
    ///         .fill(temperature.violetColor)
    ///         .opacity(temperature.glowOpacity)
    /// }
    /// ```
    var colorTemperature: ColorTemperatureState {
        get { self[ColorTemperatureKey.self] }
        set { self[ColorTemperatureKey.self] = newValue }
    }
}

// MARK: - View Modifier (Setter)

extension View {
    /// Sets the color temperature state in the environment for child views.
    ///
    /// Typically not used directly — use `.withColorTemperature()` instead
    /// for automatic resolution from ring state.
    ///
    /// - Parameter state: The color temperature state to publish
    /// - Returns: A view with the color temperature environment value set
    func colorTemperature(_ state: ColorTemperatureState) -> some View {
        environment(\.colorTemperature, state)
    }
}

// MARK: - ColorTemperatureProvider

/// View modifier that resolves and publishes color temperature to the environment.
///
/// Reads the ring phase + energy from OptaCoreManager and thermal state from
/// ThermalStateManager, resolves the appropriate `ColorTemperatureState`,
/// and publishes it via the SwiftUI environment with organic spring transitions.
///
/// Apply once at the app root to make temperature available everywhere:
/// ```swift
/// ContentView()
///     .withColorTemperature()
/// ```
struct ColorTemperatureProvider: ViewModifier {

    /// Core manager providing ring state
    @State private var coreManager = OptaCoreManager()

    /// Current resolved temperature state
    @State private var currentState: ColorTemperatureState = .idle

    /// Previous state for transition spring calculation
    @State private var previousState: ColorTemperatureState = .idle

    /// Whether accessibility reduce-motion is enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .environment(\.colorTemperature, currentState)
            .onAppear {
                resolveTemperature()
            }
            .onChange(of: coreManager.viewModel.ring.phase) { _, _ in
                resolveTemperature()
            }
            .onChange(of: coreManager.viewModel.ring.energy) { _, _ in
                resolveTemperature()
            }
            .onChange(of: coreManager.viewModel.thermalState) { _, _ in
                resolveTemperature()
            }
            .onChange(of: coreManager.viewModel.memoryPressure) { _, _ in
                resolveTemperature()
            }
    }

    // MARK: - Resolution

    /// Resolves the current temperature state and applies transition animation.
    private func resolveTemperature() {
        let ringPhase = coreManager.viewModel.ring.phase
        let energy = coreManager.viewModel.ring.energy
        let thermalState = mapThermalState(coreManager.viewModel.thermalState)
        let memoryPressure = coreManager.viewModel.memoryPressure == .critical
            || coreManager.viewModel.memoryPressure == .warning

        let newState = ColorTemperature.resolve(
            ringPhase: ringPhase,
            energy: energy,
            thermalState: thermalState,
            memoryPressure: memoryPressure
        )

        guard newState != currentState else { return }

        previousState = currentState

        // Apply transition with organic spring (or instant for reduce-motion)
        if let spring = ColorTemperature.transitionSpring(
            from: previousState,
            to: newState,
            reduceMotion: reduceMotion
        ) {
            withAnimation(spring) {
                currentState = newState
            }
        } else {
            currentState = newState
        }
    }

    /// Maps the ViewModel thermal state enum to ProcessInfo.ThermalState.
    private func mapThermalState(_ viewModelState: ThermalStateViewModel) -> ProcessInfo.ThermalState {
        switch viewModelState {
        case .nominal: return .nominal
        case .fair: return .fair
        case .serious: return .serious
        case .critical: return .critical
        }
    }
}

// MARK: - View Extension (Provider)

extension View {
    /// Wraps content with a ColorTemperatureProvider that automatically resolves
    /// and publishes the current temperature state to all child views.
    ///
    /// Apply once at the app root level:
    /// ```swift
    /// @main
    /// struct OptaAppApp: App {
    ///     var body: some Scene {
    ///         WindowGroup {
    ///             ContentView()
    ///                 .withColorTemperature()
    ///         }
    ///     }
    /// }
    /// ```
    ///
    /// Then read from any descendant view:
    /// ```swift
    /// @Environment(\.colorTemperature) private var temperature
    /// ```
    func withColorTemperature() -> some View {
        modifier(ColorTemperatureProvider())
    }
}
