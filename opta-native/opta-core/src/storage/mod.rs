//! Storage Module
//!
//! SQLite-based persistent storage for Opta.
//! Provides database operations for settings, telemetry, and optimization history.

mod database;

pub use database::{Database, TelemetryRecord, OptimizationRecord};
