//! Platform-specific Implementations
//!
//! This module contains platform-specific code that implements the
//! capability traits defined in `capabilities/`.

#[cfg(target_os = "macos")]
pub mod macos;
