//! Storage Capability
//!
//! Defines the interface for persistent storage operations.

use opta_shared::OptaResult;
use serde::{de::DeserializeOwned, Serialize};

/// Capability for persistent storage
pub trait StorageCapability {
    /// Store a value with a key
    fn set<T: Serialize>(&self, key: &str, value: &T) -> OptaResult<()>;

    /// Get a value by key
    fn get<T: DeserializeOwned>(&self, key: &str) -> OptaResult<Option<T>>;

    /// Delete a value by key
    fn delete(&self, key: &str) -> OptaResult<()>;

    /// Check if a key exists
    fn exists(&self, key: &str) -> OptaResult<bool>;

    /// List all keys with a prefix
    fn list_keys(&self, prefix: &str) -> OptaResult<Vec<String>>;

    /// Clear all data
    fn clear(&self) -> OptaResult<()>;
}

/// Well-known storage keys
pub mod keys {
    /// User settings
    pub const SETTINGS: &str = "settings";
    /// Score history prefix
    pub const SCORE_HISTORY: &str = "score_history";
    /// Game optimization cache prefix
    pub const OPTIMIZATION_CACHE: &str = "optimization";
    /// Onboarding state
    pub const ONBOARDING: &str = "onboarding";
    /// Last telemetry snapshot
    pub const LAST_TELEMETRY: &str = "telemetry_last";
}
