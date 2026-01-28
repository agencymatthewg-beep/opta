//! Opta Shared Types
//!
//! Common types shared across all Opta crates.
//! These types form the foundation of the Crux-based architecture.

pub mod telemetry;
pub mod process;
pub mod game;
pub mod score;
pub mod error;

pub use telemetry::*;
pub use process::*;
pub use game::*;
pub use score::*;
pub use error::*;
