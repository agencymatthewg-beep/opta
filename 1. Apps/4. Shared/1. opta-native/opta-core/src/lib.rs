//! Opta Core
//!
//! Pure Rust business logic for Opta using Crux architecture (Elm Architecture).

// Allow clippy warnings for auto-generated UniFFI code
#![allow(clippy::empty_line_after_doc_comments)]
//!
//! # Architecture
//!
//! This crate follows the Crux pattern:
//! - **Model**: Complete application state
//! - **Event**: All possible user/system events
//! - **Update**: Pure function `(&mut Model, Event) → Vec<Effect>`
//! - **Effect**: Side effects to be executed by the shell
//! - **ViewModel**: Serializable UI state derived from Model
//!
//! The shell (SwiftUI on macOS) executes effects and sends results back as events.
//!
//! # FFI Interface
//!
//! This crate exposes a UniFFI interface for Swift and Kotlin:
//! - `OptaCore` - Main interface for event processing
//! - `init()` - Initialize the core library
//! - `version()` - Get library version

pub mod app;
pub mod model;
pub mod event;
pub mod effect;
pub mod view_model;
pub mod capabilities;
pub mod domain;

#[cfg(target_os = "macos")]
pub mod platform;

// Re-export main types
pub use app::{OptaApp, Capabilities};
pub use model::Model;
pub use event::Event;
pub use effect::Effect;
pub use view_model::ViewModel;

// Re-export shared types
pub use opta_shared::*;

// Include UniFFI scaffolding (minimal, since we use proc-macros for exports)
uniffi::include_scaffolding!("opta");

use std::sync::Mutex;

/// Initialize the Opta core library.
/// Called once at app startup by the shell.
#[uniffi::export]
pub fn init() {
    // Initialize tracing subscriber for logging
    #[cfg(debug_assertions)]
    {
        use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
        let _ = tracing_subscriber::registry()
            .with(tracing_subscriber::fmt::layer())
            .with(tracing_subscriber::EnvFilter::from_default_env())
            .try_init();
    }

    tracing::info!("Opta Core initialized");
}

/// Get the version of the core library.
#[uniffi::export]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// FFI-safe wrapper around the Crux OptaApp.
///
/// This provides a JSON-based interface for cross-language communication,
/// making it easy to use from Swift and Kotlin without complex type mappings.
///
/// # Thread Safety
///
/// OptaCore is thread-safe and can be called from any thread. The internal
/// model is protected by a mutex.
///
/// # Example (Swift)
///
/// ```swift
/// let core = OptaCore()
/// let effects = core.processEvent("{\"AppStarted\":null}")
/// for effectJson in effects {
///     // Execute each effect...
/// }
/// ```
#[derive(uniffi::Object)]
pub struct OptaCore {
    app: OptaApp,
    model: Mutex<Model>,
    capabilities: Capabilities,
    ready: Mutex<bool>,
}

#[uniffi::export]
impl OptaCore {
    /// Create a new OptaCore instance with initial model state.
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self {
            app: OptaApp,
            model: Mutex::new(Model::default()),
            capabilities: Capabilities,
            ready: Mutex::new(true),
        }
    }

    /// Process an event and return the resulting effects.
    ///
    /// The event should be a JSON-serialized Event enum variant.
    /// Returns a list of JSON-serialized Effect objects that the shell must execute.
    ///
    /// # Arguments
    ///
    /// * `event_json` - JSON string representing an Event
    ///
    /// # Returns
    ///
    /// A vector of JSON strings, each representing an Effect to execute.
    ///
    /// # Errors
    ///
    /// If the event JSON is invalid, returns an empty vector and logs the error.
    pub fn process_event(&self, event_json: String) -> Vec<String> {
        // Parse the event from JSON
        let event: Event = match serde_json::from_str(&event_json) {
            Ok(e) => e,
            Err(e) => {
                tracing::error!("Failed to parse event JSON: {} - Input: {}", e, event_json);
                return Vec::new();
            }
        };

        // Get current model
        let mut model_guard = self.model.lock().unwrap();

        // Process the event using the Crux App trait
        let effects = self.app.update(event, &mut model_guard, &self.capabilities);

        // Serialize effects to JSON
        effects
            .into_iter()
            .filter_map(|effect| {
                serde_json::to_string(&effect)
                    .map_err(|e| {
                        tracing::error!("Failed to serialize effect: {}", e);
                        e
                    })
                    .ok()
            })
            .collect()
    }

    /// Get the current view model as JSON.
    ///
    /// Returns the ViewModel derived from the current application state.
    /// This is the preferred method for the UI layer.
    pub fn get_view_model_json(&self) -> String {
        let model_guard = self.model.lock().unwrap();
        let view_model = self.app.view(&model_guard);
        serde_json::to_string(&view_model).unwrap_or_else(|e| {
            tracing::error!("Failed to serialize view model: {}", e);
            "{}".to_string()
        })
    }

    /// Get the current model state as JSON.
    ///
    /// Returns the complete application state for the view layer.
    /// Consider using get_view_model_json() instead for UI rendering.
    pub fn get_model_json(&self) -> String {
        let model_guard = self.model.lock().unwrap();
        serde_json::to_string(&model_guard as &Model).unwrap_or_else(|e| {
            tracing::error!("Failed to serialize model: {}", e);
            "{}".to_string()
        })
    }

    /// Get a specific slice of the model for efficient updates.
    ///
    /// This is more efficient than getting the entire model when you only
    /// need a specific part of the state.
    ///
    /// # Arguments
    ///
    /// * `slice_name` - One of: "navigation", "telemetry", "processes",
    ///   "games", "scoring", "settings", "ui", "loading", "error"
    ///
    /// # Returns
    ///
    /// JSON string of the requested slice, or "{}" if the slice name is invalid.
    pub fn get_model_slice(&self, slice_name: String) -> String {
        let model_guard = self.model.lock().unwrap();

        let result = match slice_name.as_str() {
            "navigation" => serde_json::to_string(&model_guard.navigation),
            "telemetry" => serde_json::to_string(&model_guard.telemetry),
            "processes" => serde_json::to_string(&model_guard.processes),
            "games" => serde_json::to_string(&model_guard.games),
            "scoring" => serde_json::to_string(&model_guard.scoring),
            "settings" => serde_json::to_string(&model_guard.settings),
            "ui" => serde_json::to_string(&model_guard.ui),
            "loading" => serde_json::to_string(&model_guard.loading),
            "error" => serde_json::to_string(&model_guard.error),
            _ => {
                tracing::warn!("Unknown model slice requested: {}", slice_name);
                return "{}".to_string();
            }
        };

        result.unwrap_or_else(|e| {
            tracing::error!("Failed to serialize model slice '{}': {}", slice_name, e);
            "{}".to_string()
        })
    }

    /// Process a batch of events in order.
    ///
    /// More efficient than calling process_event multiple times when you
    /// have multiple events to process.
    ///
    /// # Arguments
    ///
    /// * `events_json` - Vector of JSON strings, each representing an Event
    ///
    /// # Returns
    ///
    /// A vector of JSON strings representing all Effects from all events.
    pub fn process_events_batch(&self, events_json: Vec<String>) -> Vec<String> {
        let mut all_effects = Vec::new();

        for event_json in events_json {
            let effects = self.process_event(event_json);
            all_effects.extend(effects);
        }

        all_effects
    }

    /// Check if the core is initialized and ready.
    ///
    /// This can be used by the shell to verify the core is ready before
    /// sending events.
    pub fn is_ready(&self) -> bool {
        *self.ready.lock().unwrap()
    }
}

impl Default for OptaCore {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================
// FFI Enums (exported via proc-macros)
// ============================================

/// Haptic feedback patterns for the shell to implement.
///
/// These patterns map to platform-specific haptic feedback:
/// - macOS: NSHapticFeedbackManager
/// - iOS: UIImpactFeedbackGenerator / UINotificationFeedbackGenerator
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum FfiHapticPattern {
    /// Light tap - for selection, toggle
    Light,
    /// Medium tap - for action confirmed
    Medium,
    /// Heavy tap - for important actions
    Heavy,
    /// Success feedback
    Success,
    /// Warning feedback
    Warning,
    /// Error feedback
    Error,
    /// Pulsing feedback during optimization
    OptimizingPulse,
    /// Celebration feedback for score increases
    ScoreCelebration,
}

/// Sound effects for spatial audio.
///
/// The shell should implement these with appropriate audio files
/// and optional 3D positioning.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum FfiSoundEffect {
    /// Button click
    Click,
    /// Navigation transition
    Transition,
    /// Optimization started
    OptimizeStart,
    /// Optimization complete
    OptimizeComplete,
    /// Score increase
    ScoreUp,
    /// Alert/warning
    Alert,
    /// Ring wake animation
    RingWake,
    /// Ring sleep animation
    RingSleep,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_opta_core_creation() {
        let core = OptaCore::new();
        assert!(core.is_ready());
    }

    #[test]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
    }

    #[test]
    fn test_process_event() {
        let core = OptaCore::new();
        let effects = core.process_event(r#""AppStarted""#.to_string());
        // AppStarted should return multiple effects (LoadSettings, CollectTelemetry, etc.)
        assert!(!effects.is_empty());
    }

    #[test]
    fn test_get_model_json() {
        let core = OptaCore::new();
        let model_json = core.get_model_json();
        assert!(model_json.starts_with('{'));
        assert!(model_json.ends_with('}'));
    }

    #[test]
    fn test_get_view_model_json() {
        let core = OptaCore::new();
        let view_model_json = core.get_view_model_json();
        assert!(view_model_json.starts_with('{'));
        assert!(view_model_json.ends_with('}'));
        assert!(view_model_json.contains("current_page"));
    }

    #[test]
    fn test_get_model_slice() {
        let core = OptaCore::new();
        let nav_json = core.get_model_slice("navigation".to_string());
        assert!(nav_json.starts_with('{'));

        let invalid = core.get_model_slice("invalid".to_string());
        assert_eq!(invalid, "{}");
    }

    #[test]
    fn test_invalid_event_json() {
        let core = OptaCore::new();
        let effects = core.process_event("not valid json".to_string());
        assert!(effects.is_empty());
    }
}
