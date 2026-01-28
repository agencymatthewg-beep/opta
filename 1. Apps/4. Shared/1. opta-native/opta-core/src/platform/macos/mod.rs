//! macOS Platform Implementation
//!
//! Native macOS implementations using IOKit and other system frameworks.

pub mod iokit;
// TODO: Implement in Phase 60+
// pub mod smc;
// pub mod process;

pub use iokit::IOKitTelemetry;
// pub use smc::SmcReader;
// pub use process::ProcessManager;
