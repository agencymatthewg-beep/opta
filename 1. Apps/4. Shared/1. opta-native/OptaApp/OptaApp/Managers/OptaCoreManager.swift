//
//  OptaCoreManager.swift
//  OptaApp
//
//  SwiftUI integration layer for the Crux OptaCore.
//  Provides reactive state management via the Crux architecture.
//

import Foundation
import Observation

// MARK: - OptaCoreManager

/// Main SwiftUI integration manager for the Crux OptaCore.
///
/// This class wraps the UniFFI-generated OptaCore and provides:
/// - @Observable pattern for modern SwiftUI reactivity
/// - Event dispatch from SwiftUI to Crux
/// - ViewModel subscription for view updates
/// - Effect execution bridging (haptics, sound, navigation)
///
/// # Thread Safety
///
/// All public methods dispatch to the main actor to ensure
/// SwiftUI updates happen on the main thread.
///
/// # Usage
///
/// ```swift
/// @State private var coreManager = OptaCoreManager()
///
/// var body: some View {
///     Text("Score: \(coreManager.viewModel.optaScore)")
///         .onAppear {
///             coreManager.appStarted()
///         }
/// }
/// ```
@MainActor
@Observable
final class OptaCoreManager {

    // MARK: - Properties

    /// The underlying Rust OptaCore instance
    private let core: OptaCore

    /// Current view model (updated after each event)
    private(set) var viewModel: OptaViewModel = OptaViewModel()

    /// Whether the core is ready
    var isReady: Bool {
        core.isReady()
    }

    /// Effect executor for bridging Crux effects to native platform
    private let effectExecutor: EffectExecutor

    /// Pending timers (effect_id -> Timer)
    private var activeTimers: [String: Timer] = [:]

    /// Pending intervals (effect_id -> Timer)
    private var activeIntervals: [String: Timer] = [:]

    // MARK: - Initialization

    init() {
        // Initialize Rust core
        `init`()
        self.core = OptaCore()
        self.effectExecutor = EffectExecutor()

        // Fetch initial view model
        refreshViewModel()

        print("[OptaCoreManager] Initialized with core version: \(version())")
    }

    // MARK: - Event Dispatch

    /// Send an event to Crux and process resulting effects.
    ///
    /// This is the primary method for all user interactions.
    /// The Crux pattern is: dispatch event -> get effects -> execute effects -> effect results become events
    ///
    /// - Parameter event: The event to dispatch
    func dispatch(_ event: OptaEvent) {
        let eventJson = event.toJson()

        #if DEBUG
        print("[OptaCoreManager] Dispatching event: \(eventJson)")
        #endif

        let effectsJson = core.processEvent(eventJson: eventJson)

        // Refresh view model after state change
        refreshViewModel()

        // Execute all effects
        for effectJson in effectsJson {
            executeEffect(json: effectJson)
        }
    }

    /// Dispatch multiple events in a batch (more efficient).
    ///
    /// - Parameter events: Array of events to dispatch
    func dispatchBatch(_ events: [OptaEvent]) {
        let eventsJson = events.map { $0.toJson() }
        let effectsJson = core.processEventsBatch(eventsJson: eventsJson)

        // Refresh view model after state changes
        refreshViewModel()

        // Execute all effects
        for effectJson in effectsJson {
            executeEffect(json: effectJson)
        }
    }

    // MARK: - Convenience Event Methods

    /// Dispatch app started event - call this in onAppear
    func appStarted() {
        dispatch(.appStarted)
    }

    /// Dispatch app backgrounded event
    func appBackgrounded() {
        dispatch(.appBackgrounded)
    }

    /// Dispatch app foregrounded event
    func appForegrounded() {
        dispatch(.appForegrounded)
    }

    /// Navigate to a page
    func navigate(to page: PageViewModel) {
        dispatch(.navigateTo(page: page))
    }

    /// Go back in navigation
    func navigateBack() {
        dispatch(.navigateBack)
    }

    /// Toggle haptics setting
    func toggleHaptics() {
        dispatch(.toggleHaptics)
    }

    /// Toggle spatial audio setting
    func toggleSpatialAudio() {
        dispatch(.toggleSpatialAudio)
    }

    /// Refresh telemetry data
    func refreshTelemetry() {
        dispatch(.telemetryTick)
    }

    /// Select a game by ID
    func selectGame(id: String) {
        dispatch(.selectGame(gameId: id))
    }

    /// Execute stealth mode
    func executeStealthMode() {
        dispatch(.executeStealthMode)
    }

    // MARK: - View Model

    /// Refresh the view model from the core
    private func refreshViewModel() {
        let json = core.getViewModelJson()
        if let vm = OptaViewModel.from(json: json) {
            self.viewModel = vm
        } else {
            print("[OptaCoreManager] Failed to decode view model from JSON")
        }
    }

    /// Get a specific model slice for efficient updates.
    ///
    /// Use this when you only need part of the model state.
    ///
    /// - Parameter slice: The slice to retrieve
    /// - Returns: JSON string of the requested slice
    func getModelSlice(_ slice: ModelSlice) -> String {
        core.getModelSlice(sliceName: slice.rawValue)
    }

    /// Get the full model JSON (use sparingly - prefer view model)
    func getModelJson() -> String {
        core.getModelJson()
    }

    // MARK: - Effect Execution

    /// Execute an effect from JSON
    private func executeEffect(json: String) {
        effectExecutor.execute(effectJson: json) { [weak self] resultEvent in
            // Effect results become new events
            self?.dispatch(resultEvent)
        }
    }

    // MARK: - Timer Management

    /// Cancel a timer by effect ID
    func cancelTimer(id: String) {
        if let timer = activeTimers.removeValue(forKey: id) {
            timer.invalidate()
        }
        if let interval = activeIntervals.removeValue(forKey: id) {
            interval.invalidate()
        }
    }

    /// Cancel all active timers
    func cancelAllTimers() {
        activeTimers.values.forEach { $0.invalidate() }
        activeTimers.removeAll()
        activeIntervals.values.forEach { $0.invalidate() }
        activeIntervals.removeAll()
    }

    deinit {
        // Clean up timers
        Task { @MainActor in
            cancelAllTimers()
        }
    }
}

// MARK: - Environment Key

/// Environment key for accessing OptaCoreManager
private struct OptaCoreManagerKey: EnvironmentKey {
    static let defaultValue: OptaCoreManager? = nil
}

import SwiftUI

extension EnvironmentValues {
    /// The OptaCoreManager instance for this view hierarchy
    var optaCoreManager: OptaCoreManager? {
        get { self[OptaCoreManagerKey.self] }
        set { self[OptaCoreManagerKey.self] = newValue }
    }
}
