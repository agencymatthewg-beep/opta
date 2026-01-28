//! Texture compression and loading utilities.
//!
//! This module provides:
//! - Platform-optimized texture formats (ASTC for Apple, BC7 for others)
//! - Texture loading from various file formats
//! - Compression utilities for memory optimization
//!
//! ## Example
//!
//! ```ignore
//! use opta_render::texture::{TextureFormat, TextureLoader, TextureData};
//!
//! // Get optimal format for this platform
//! let format = TextureFormat::best_for_platform();
//!
//! // Calculate memory savings
//! let uncompressed = TextureFormat::Rgba8.storage_size(1024, 1024);
//! let compressed = format.storage_size(1024, 1024);
//! println!("Compression saves {} bytes", uncompressed - compressed);
//! ```

mod compression;

pub use compression::{TextureData, TextureError, TextureFormat, TextureLoader};
