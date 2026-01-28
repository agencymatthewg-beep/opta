//! Domain Logic
//!
//! Pure business logic modules that don't depend on platform capabilities.
//! These modules implement the core algorithms and rules of Opta.

pub mod optimizer;
pub mod scoring;
pub mod hardware_tier;

pub use optimizer::Optimizer;
pub use scoring::ScoreCalculator;
pub use hardware_tier::HardwareTierDetector;
