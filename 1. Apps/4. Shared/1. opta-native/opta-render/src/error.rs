//! Error types for the opta-render crate.

use thiserror::Error;

/// Errors that can occur during GPU initialization and rendering.
#[derive(Error, Debug, Clone)]
pub enum RenderError {
    /// Failed to create wgpu instance.
    #[error("Failed to create wgpu instance")]
    InstanceCreationFailed,

    /// No suitable GPU adapter was found.
    #[error("No suitable GPU adapter found: {0}")]
    NoAdapterFound(String),

    /// Failed to request a GPU device.
    #[error("Failed to request GPU device: {0}")]
    DeviceRequestFailed(String),

    /// Surface creation failed.
    #[error("Failed to create surface: {0}")]
    SurfaceCreationFailed(String),

    /// Surface configuration failed.
    #[error("Surface configuration failed: no compatible format found")]
    SurfaceConfigurationFailed,

    /// Surface texture acquisition failed.
    #[error("Failed to get surface texture: {0}")]
    SurfaceTextureFailed(String),

    /// Invalid view pointer provided to FFI.
    #[error("Invalid view pointer: null or invalid")]
    InvalidViewPointer,

    /// Metal backend is required but not available.
    #[error("Metal backend is required on Apple platforms")]
    MetalBackendRequired,

    /// Invalid surface dimensions.
    #[error("Invalid surface dimensions: width={0}, height={1}")]
    InvalidDimensions(u32, u32),

    /// Render was skipped (paused or already rendering).
    #[error("Render skipped: paused or already rendering")]
    RenderSkipped,

    /// Lock was poisoned (thread panic while holding lock).
    #[error("Lock poisoned: concurrent access error")]
    LockPoisoned,

    /// No surface configured for rendering.
    #[error("No surface configured")]
    NoSurface,

    /// Quality level is invalid.
    #[error("Invalid quality level: {0}")]
    InvalidQualityLevel(u32),
}

impl From<wgpu::RequestDeviceError> for RenderError {
    fn from(err: wgpu::RequestDeviceError) -> Self {
        RenderError::DeviceRequestFailed(err.to_string())
    }
}

impl From<wgpu::CreateSurfaceError> for RenderError {
    fn from(err: wgpu::CreateSurfaceError) -> Self {
        RenderError::SurfaceCreationFailed(err.to_string())
    }
}

impl From<wgpu::SurfaceError> for RenderError {
    fn from(err: wgpu::SurfaceError) -> Self {
        RenderError::SurfaceTextureFailed(err.to_string())
    }
}

/// Result type alias for render operations.
pub type RenderResult<T> = Result<T, RenderError>;
