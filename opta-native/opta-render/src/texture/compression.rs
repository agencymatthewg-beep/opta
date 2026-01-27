//! Texture compression utilities for GPU memory optimization.
//!
//! Provides texture format handling with platform-specific compression selection:
//! - ASTC (Adaptive Scalable Texture Compression) for Apple platforms
//! - BC7 for Windows/Linux
//!
//! ## Usage
//!
//! ```ignore
//! use opta_render::texture::{TextureFormat, TextureLoader};
//!
//! // Get the best format for the current platform
//! let format = TextureFormat::best_for_platform();
//!
//! // Load a texture
//! let loader = TextureLoader::new(format);
//! let texture_data = loader.load("assets/texture.png")?;
//! ```

use std::path::Path;

/// Texture formats supported by the renderer.
///
/// The renderer supports both compressed (ASTC, BC7) and uncompressed (RGBA8)
/// formats, with automatic platform detection for optimal performance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TextureFormat {
    /// Uncompressed RGBA with 8 bits per channel.
    /// Universal compatibility but highest memory usage.
    Rgba8,

    /// ASTC 4x4 block compression.
    /// Best quality ASTC format, 8 bits per pixel.
    /// Supported on Apple Silicon and modern GPUs.
    Astc4x4,

    /// ASTC 8x8 block compression.
    /// Higher compression ratio, 2 bits per pixel.
    /// Good for lower quality requirements.
    Astc8x8,

    /// BC7 block compression.
    /// High quality format for Windows/Linux.
    /// 8 bits per pixel, excellent quality.
    Bc7,
}

impl TextureFormat {
    /// Converts to the corresponding wgpu texture format.
    ///
    /// All compressed formats use sRGB color space for correct gamma handling.
    #[must_use]
    pub fn to_wgpu(self) -> wgpu::TextureFormat {
        match self {
            TextureFormat::Rgba8 => wgpu::TextureFormat::Rgba8UnormSrgb,
            TextureFormat::Astc4x4 => wgpu::TextureFormat::Astc {
                block: wgpu::AstcBlock::B4x4,
                channel: wgpu::AstcChannel::UnormSrgb,
            },
            TextureFormat::Astc8x8 => wgpu::TextureFormat::Astc {
                block: wgpu::AstcBlock::B8x8,
                channel: wgpu::AstcChannel::UnormSrgb,
            },
            TextureFormat::Bc7 => wgpu::TextureFormat::Bc7RgbaUnormSrgb,
        }
    }

    /// Returns the number of bytes per compressed block.
    ///
    /// For RGBA8, this is the bytes per pixel (4).
    /// For compressed formats, this is the bytes per block (16 for ASTC/BC7).
    #[must_use]
    pub const fn bytes_per_block(self) -> usize {
        match self {
            TextureFormat::Rgba8 => 4,    // 4 bytes per pixel
            TextureFormat::Astc4x4 => 16, // 128 bits = 16 bytes per 4x4 block
            TextureFormat::Astc8x8 => 16, // 128 bits = 16 bytes per 8x8 block
            TextureFormat::Bc7 => 16,     // 128 bits = 16 bytes per 4x4 block
        }
    }

    /// Returns the block dimensions (width, height) in pixels.
    ///
    /// For RGBA8, returns (1, 1) since it's not block-compressed.
    #[must_use]
    pub const fn block_size(self) -> (u32, u32) {
        match self {
            TextureFormat::Rgba8 => (1, 1),
            TextureFormat::Astc4x4 => (4, 4),
            TextureFormat::Astc8x8 => (8, 8),
            TextureFormat::Bc7 => (4, 4),
        }
    }

    /// Calculates the storage size in bytes for a texture of the given dimensions.
    ///
    /// For block-compressed formats, dimensions are rounded up to block boundaries.
    #[must_use]
    pub const fn storage_size(self, width: u32, height: u32) -> usize {
        let (block_width, block_height) = self.block_size();

        // Round up to block boundaries
        let blocks_x = (width + block_width - 1) / block_width;
        let blocks_y = (height + block_height - 1) / block_height;

        (blocks_x as usize) * (blocks_y as usize) * self.bytes_per_block()
    }

    /// Returns the best texture format for the current platform.
    ///
    /// - macOS/iOS: ASTC 4x4 (Apple Silicon native support)
    /// - Windows/Linux: BC7 (widely supported)
    #[must_use]
    pub fn best_for_platform() -> Self {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        {
            TextureFormat::Astc4x4
        }
        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            TextureFormat::Bc7
        }
    }

    /// Returns true if this format is block-compressed.
    #[must_use]
    pub const fn is_compressed(self) -> bool {
        !matches!(self, TextureFormat::Rgba8)
    }

    /// Returns the compression ratio compared to RGBA8.
    ///
    /// For example, ASTC 8x8 has a ratio of 32 (32:1 compression).
    #[must_use]
    pub const fn compression_ratio(self) -> u32 {
        match self {
            TextureFormat::Rgba8 => 1,
            TextureFormat::Astc4x4 => 4,  // 4 bytes/pixel -> 1 byte/pixel effective
            TextureFormat::Astc8x8 => 32, // 4 bytes/pixel -> 0.125 bytes/pixel effective
            TextureFormat::Bc7 => 4,      // 4 bytes/pixel -> 1 byte/pixel effective
        }
    }
}

impl Default for TextureFormat {
    fn default() -> Self {
        Self::best_for_platform()
    }
}

/// Errors that can occur during texture operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextureError {
    /// Failed to load the texture file.
    LoadFailed(String),
    /// Texture compression failed.
    CompressionFailed(String),
    /// The texture format is not supported.
    UnsupportedFormat(String),
}

impl std::fmt::Display for TextureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TextureError::LoadFailed(msg) => write!(f, "Failed to load texture: {msg}"),
            TextureError::CompressionFailed(msg) => write!(f, "Compression failed: {msg}"),
            TextureError::UnsupportedFormat(msg) => write!(f, "Unsupported format: {msg}"),
        }
    }
}

impl std::error::Error for TextureError {}

/// Raw texture data with format information.
#[derive(Debug, Clone)]
pub struct TextureData {
    /// Width in pixels.
    pub width: u32,
    /// Height in pixels.
    pub height: u32,
    /// Texture format.
    pub format: TextureFormat,
    /// Raw pixel/block data.
    pub data: Vec<u8>,
}

impl TextureData {
    /// Creates new texture data with validation.
    ///
    /// # Errors
    ///
    /// Returns an error if the data size doesn't match the expected size
    /// for the given dimensions and format.
    pub fn new(
        width: u32,
        height: u32,
        format: TextureFormat,
        data: Vec<u8>,
    ) -> Result<Self, TextureError> {
        let expected_size = format.storage_size(width, height);
        if data.len() != expected_size {
            return Err(TextureError::LoadFailed(format!(
                "Data size mismatch: expected {expected_size} bytes, got {}",
                data.len()
            )));
        }

        Ok(Self {
            width,
            height,
            format,
            data,
        })
    }

    /// Creates texture data without validation.
    ///
    /// Use when you're sure the data is correctly sized.
    #[must_use]
    pub fn new_unchecked(width: u32, height: u32, format: TextureFormat, data: Vec<u8>) -> Self {
        Self {
            width,
            height,
            format,
            data,
        }
    }

    /// Returns the storage size in bytes.
    #[must_use]
    pub fn storage_size(&self) -> usize {
        self.format.storage_size(self.width, self.height)
    }

    /// Returns true if the texture is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

/// Texture loader with format-specific loading strategies.
pub struct TextureLoader {
    format: TextureFormat,
}

impl TextureLoader {
    /// Creates a new texture loader for the specified format.
    #[must_use]
    pub fn new(format: TextureFormat) -> Self {
        Self { format }
    }

    /// Creates a texture loader with the best format for the current platform.
    #[must_use]
    pub fn default_for_platform() -> Self {
        Self::new(TextureFormat::best_for_platform())
    }

    /// Returns the texture format this loader uses.
    #[must_use]
    pub fn format(&self) -> TextureFormat {
        self.format
    }

    /// Loads a texture from a file path.
    ///
    /// Supported formats:
    /// - PNG, JPG (when image crate is available)
    /// - ASTC (native .astc files)
    /// - KTX (Khronos texture container)
    ///
    /// # Errors
    ///
    /// Returns an error if the file cannot be loaded or the format is unsupported.
    pub fn load<P: AsRef<Path>>(&self, path: P) -> Result<TextureData, TextureError> {
        let path = path.as_ref();
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .map(str::to_lowercase);

        match extension.as_deref() {
            Some("png") | Some("jpg") | Some("jpeg") => self.load_image(path),
            Some("astc") => self.load_astc(path),
            Some("ktx") | Some("ktx2") => self.load_ktx(path),
            Some(ext) => Err(TextureError::UnsupportedFormat(format!(
                "Unknown texture extension: .{ext}"
            ))),
            None => Err(TextureError::UnsupportedFormat(
                "File has no extension".to_string(),
            )),
        }
    }

    /// Loads a PNG or JPEG image.
    ///
    /// Note: This is a stub implementation. Enable the `image` crate feature
    /// for full image loading support.
    fn load_image<P: AsRef<Path>>(&self, path: P) -> Result<TextureData, TextureError> {
        let path = path.as_ref();

        // Stub: In a real implementation, use the `image` crate
        // For now, return an error indicating image loading is not implemented
        Err(TextureError::LoadFailed(format!(
            "Image loading not implemented for: {}. \
             Add the `image` crate to Cargo.toml and implement load_image().",
            path.display()
        )))
    }

    /// Loads a native ASTC texture file.
    ///
    /// Note: This is a stub implementation for the ASTC file format.
    fn load_astc<P: AsRef<Path>>(&self, path: P) -> Result<TextureData, TextureError> {
        let path = path.as_ref();

        // Stub: ASTC loading requires parsing the ASTC header format
        // Header is 16 bytes: magic (4), block dims (3), texture size (3x3=9 bytes)
        todo!(
            "ASTC texture loading not yet implemented for: {}",
            path.display()
        )
    }

    /// Loads a KTX/KTX2 texture container.
    ///
    /// Note: This is a stub implementation for the KTX format.
    fn load_ktx<P: AsRef<Path>>(&self, path: P) -> Result<TextureData, TextureError> {
        let path = path.as_ref();

        // Stub: KTX loading requires parsing the KTX2 container format
        // Consider using the `ktx2` crate for implementation
        todo!(
            "KTX texture loading not yet implemented for: {}",
            path.display()
        )
    }
}

impl Default for TextureLoader {
    fn default() -> Self {
        Self::default_for_platform()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_texture_format_to_wgpu() {
        assert_eq!(
            TextureFormat::Rgba8.to_wgpu(),
            wgpu::TextureFormat::Rgba8UnormSrgb
        );
        assert!(matches!(
            TextureFormat::Astc4x4.to_wgpu(),
            wgpu::TextureFormat::Astc { .. }
        ));
        assert!(matches!(
            TextureFormat::Astc8x8.to_wgpu(),
            wgpu::TextureFormat::Astc { .. }
        ));
        assert_eq!(
            TextureFormat::Bc7.to_wgpu(),
            wgpu::TextureFormat::Bc7RgbaUnormSrgb
        );
    }

    #[test]
    fn test_texture_format_bytes_per_block() {
        assert_eq!(TextureFormat::Rgba8.bytes_per_block(), 4);
        assert_eq!(TextureFormat::Astc4x4.bytes_per_block(), 16);
        assert_eq!(TextureFormat::Astc8x8.bytes_per_block(), 16);
        assert_eq!(TextureFormat::Bc7.bytes_per_block(), 16);
    }

    #[test]
    fn test_texture_format_block_size() {
        assert_eq!(TextureFormat::Rgba8.block_size(), (1, 1));
        assert_eq!(TextureFormat::Astc4x4.block_size(), (4, 4));
        assert_eq!(TextureFormat::Astc8x8.block_size(), (8, 8));
        assert_eq!(TextureFormat::Bc7.block_size(), (4, 4));
    }

    #[test]
    fn test_texture_format_storage_size_rgba8() {
        // RGBA8: 4 bytes per pixel
        assert_eq!(TextureFormat::Rgba8.storage_size(1, 1), 4);
        assert_eq!(TextureFormat::Rgba8.storage_size(10, 10), 400);
        assert_eq!(TextureFormat::Rgba8.storage_size(256, 256), 256 * 256 * 4);
    }

    #[test]
    fn test_texture_format_storage_size_astc4x4() {
        // ASTC 4x4: 16 bytes per 4x4 block
        // 4x4 texture = 1 block = 16 bytes
        assert_eq!(TextureFormat::Astc4x4.storage_size(4, 4), 16);
        // 8x8 texture = 4 blocks = 64 bytes
        assert_eq!(TextureFormat::Astc4x4.storage_size(8, 8), 64);
        // 5x5 texture rounds up to 2x2 blocks = 64 bytes
        assert_eq!(TextureFormat::Astc4x4.storage_size(5, 5), 64);
        // 256x256 = 64x64 blocks = 4096 blocks * 16 bytes = 65536 bytes
        assert_eq!(TextureFormat::Astc4x4.storage_size(256, 256), 64 * 64 * 16);
    }

    #[test]
    fn test_texture_format_storage_size_astc8x8() {
        // ASTC 8x8: 16 bytes per 8x8 block
        assert_eq!(TextureFormat::Astc8x8.storage_size(8, 8), 16);
        assert_eq!(TextureFormat::Astc8x8.storage_size(16, 16), 64);
        // 256x256 = 32x32 blocks = 1024 blocks * 16 bytes
        assert_eq!(TextureFormat::Astc8x8.storage_size(256, 256), 32 * 32 * 16);
    }

    #[test]
    fn test_texture_format_best_for_platform() {
        let best = TextureFormat::best_for_platform();
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        assert_eq!(best, TextureFormat::Astc4x4);
        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        assert_eq!(best, TextureFormat::Bc7);
    }

    #[test]
    fn test_texture_format_is_compressed() {
        assert!(!TextureFormat::Rgba8.is_compressed());
        assert!(TextureFormat::Astc4x4.is_compressed());
        assert!(TextureFormat::Astc8x8.is_compressed());
        assert!(TextureFormat::Bc7.is_compressed());
    }

    #[test]
    fn test_texture_format_compression_ratio() {
        assert_eq!(TextureFormat::Rgba8.compression_ratio(), 1);
        assert_eq!(TextureFormat::Astc4x4.compression_ratio(), 4);
        assert_eq!(TextureFormat::Astc8x8.compression_ratio(), 32);
        assert_eq!(TextureFormat::Bc7.compression_ratio(), 4);
    }

    #[test]
    fn test_texture_data_new() {
        // Create valid texture data
        let data = vec![0u8; 400]; // 10x10 RGBA8
        let result = TextureData::new(10, 10, TextureFormat::Rgba8, data);
        assert!(result.is_ok());

        let texture = result.unwrap();
        assert_eq!(texture.width, 10);
        assert_eq!(texture.height, 10);
        assert_eq!(texture.format, TextureFormat::Rgba8);
        assert_eq!(texture.storage_size(), 400);
    }

    #[test]
    fn test_texture_data_new_invalid_size() {
        // Wrong size data
        let data = vec![0u8; 100]; // Should be 400 for 10x10 RGBA8
        let result = TextureData::new(10, 10, TextureFormat::Rgba8, data);
        assert!(result.is_err());
    }

    #[test]
    fn test_texture_error_display() {
        let err = TextureError::LoadFailed("test error".to_string());
        assert_eq!(format!("{err}"), "Failed to load texture: test error");

        let err = TextureError::CompressionFailed("test error".to_string());
        assert_eq!(format!("{err}"), "Compression failed: test error");

        let err = TextureError::UnsupportedFormat("test error".to_string());
        assert_eq!(format!("{err}"), "Unsupported format: test error");
    }

    #[test]
    fn test_texture_loader_new() {
        let loader = TextureLoader::new(TextureFormat::Astc4x4);
        assert_eq!(loader.format(), TextureFormat::Astc4x4);
    }

    #[test]
    fn test_texture_loader_unsupported_format() {
        let loader = TextureLoader::new(TextureFormat::Rgba8);
        let result = loader.load("test.xyz");
        assert!(matches!(result, Err(TextureError::UnsupportedFormat(_))));
    }

    #[test]
    fn test_texture_loader_no_extension() {
        let loader = TextureLoader::new(TextureFormat::Rgba8);
        let result = loader.load("test");
        assert!(matches!(result, Err(TextureError::UnsupportedFormat(_))));
    }
}
