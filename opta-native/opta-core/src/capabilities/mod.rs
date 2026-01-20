//! Platform Capabilities
//!
//! Capability traits define the interface between the pure Rust core
//! and platform-specific implementations (shell side effects).

pub mod telemetry;
pub mod process;
pub mod game;
pub mod storage;

pub use telemetry::TelemetryCapability;
pub use process::ProcessCapability;
pub use game::GameCapability;
pub use storage::StorageCapability;
