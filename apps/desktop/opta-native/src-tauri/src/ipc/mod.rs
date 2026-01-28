//! High-Performance IPC Module for Opta
//!
//! Phase 20-10: State Synchronization
//!
//! This module provides high-performance Inter-Process Communication
//! between the Rust backend and the Swift Menu Bar using FlatBuffers
//! binary serialization over Unix sockets.
//!
//! ## Architecture
//!
//! ```text
//! ┌────────────────┐    FlatBuffers    ┌─────────────────┐
//! │  Rust Backend  │ ──────────────────▶ │  Swift MenuBar  │
//! │  (Telemetry)   │    Unix Socket    │  (UI Updates)   │
//! └────────────────┘     25Hz+         └─────────────────┘
//! ```
//!
//! ## Performance Targets
//!
//! - IPC latency: <1ms (vs ~5ms for JSON)
//! - CPU usage: <2% during 25Hz streaming
//! - Zero-copy access where possible
//!
//! ## Modules
//!
//! - `metrics_types`: Core types for system metrics
//! - `serializer`: FlatBuffers serialization
//! - `socket_server`: Unix socket server for streaming
//! - `broadcaster`: Rate-limited broadcast channel

pub mod metrics_types;
pub mod serializer;
pub mod socket_server;
pub mod broadcaster;

// Re-export main types
pub use metrics_types::{
    SystemMetricsData,
    ProcessInfoData,
    MomentumStateData,
    MomentumColor,
    SystemState,
};
pub use serializer::MetricsSerializer;
pub use socket_server::MetricsSocketServer;
pub use broadcaster::MetricsBroadcaster;
