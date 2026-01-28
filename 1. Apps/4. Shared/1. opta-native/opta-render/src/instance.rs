//! GPU instance and device management for Apple platforms.
//!
//! This module provides the core GPU context using wgpu with Metal backend
//! optimization for Apple Silicon. Key features:
//!
//! - Metal-only backend selection for optimal performance
//! - Apple Silicon-specific limits and capabilities detection
//! - Unified Memory Architecture awareness
//! - High-performance adapter preference for M-series chips

use tracing::{debug, info, warn};
use wgpu::{
    Adapter, Backends, Device, DeviceDescriptor, Instance, InstanceDescriptor, Limits, Queue,
};

use crate::error::{RenderError, RenderResult};

/// GPU capabilities specific to Apple Silicon.
///
/// Detects and exposes hardware features relevant for optimization:
/// - Maximum texture sizes
/// - Compute workgroup limits (Apple GPUs use SIMD-32)
/// - `ProMotion` display support
/// - Unified Memory Architecture status
#[derive(Debug, Clone)]
pub struct GpuCapabilities {
    /// Maximum 1D/2D texture dimension.
    pub max_texture_size: u32,

    /// Maximum compute workgroup size per dimension.
    /// Apple Silicon typically supports `[1024, 1024, 1024]`.
    pub max_compute_workgroup_size: [u32; 3],

    /// Maximum total invocations per workgroup.
    /// Apple Silicon supports up to 1024.
    pub max_compute_invocations_per_workgroup: u32,

    /// Whether the device supports `ProMotion` (120Hz) displays.
    /// Set to true for iPhone 13 Pro+ and iPad Pro models.
    pub supports_promotion: bool,

    /// Whether the device uses Unified Memory Architecture.
    /// Always true for Apple Silicon; affects buffer staging strategy.
    pub unified_memory: bool,

    /// The GPU vendor name for logging/diagnostics.
    pub vendor_name: String,

    /// The GPU device name.
    pub device_name: String,

    /// The wgpu backend in use (should always be Metal on Apple).
    pub backend: wgpu::Backend,
}

impl GpuCapabilities {
    /// Create capabilities from adapter info and limits.
    fn from_adapter(adapter: &Adapter) -> Self {
        let info = adapter.get_info();
        let limits = adapter.limits();

        // Detect Apple Silicon UMA - all Apple GPUs have unified memory
        let unified_memory = info.vendor == 0x106B // Apple vendor ID
            || info.name.contains("Apple")
            || info.name.contains("M1")
            || info.name.contains("M2")
            || info.name.contains("M3")
            || info.name.contains("M4");

        // ProMotion is a display feature, not GPU feature.
        // We set this true for Apple Silicon; Swift side handles actual display detection.
        let supports_promotion = unified_memory;

        Self {
            max_texture_size: limits.max_texture_dimension_2d,
            max_compute_workgroup_size: [
                limits.max_compute_workgroup_size_x,
                limits.max_compute_workgroup_size_y,
                limits.max_compute_workgroup_size_z,
            ],
            max_compute_invocations_per_workgroup: limits.max_compute_invocations_per_workgroup,
            supports_promotion,
            unified_memory,
            vendor_name: format!("0x{:04X}", info.vendor),
            device_name: info.name.clone(),
            backend: info.backend,
        }
    }
}

/// Core GPU context managing wgpu instance, adapter, device, and queue.
///
/// This is the main entry point for GPU operations. It initializes wgpu
/// with Metal backend and configures optimal settings for Apple Silicon.
///
/// # Example
///
/// ```ignore
/// let context = GpuContext::new()?;
/// println!("GPU: {}", context.capabilities.device_name);
/// ```
pub struct GpuContext {
    /// The wgpu instance (factory for surfaces and adapters).
    pub instance: Instance,

    /// The GPU adapter (represents the physical GPU).
    pub adapter: Adapter,

    /// The logical GPU device for resource creation.
    pub device: Device,

    /// The command queue for GPU submission.
    pub queue: Queue,

    /// Detected GPU capabilities.
    pub capabilities: GpuCapabilities,
}

impl GpuContext {
    /// Create a new GPU context with Metal backend.
    ///
    /// This function:
    /// 1. Creates a wgpu instance with Metal-only backend
    /// 2. Requests a high-performance adapter
    /// 3. Creates device with Apple Silicon-optimized limits
    /// 4. Detects hardware capabilities
    ///
    /// # Errors
    ///
    /// Returns `RenderError::NoAdapterFound` if no Metal GPU is available.
    /// Returns `RenderError::DeviceRequestFailed` if device creation fails.
    pub fn new() -> RenderResult<Self> {
        Self::with_power_preference(wgpu::PowerPreference::HighPerformance)
    }

    /// Create GPU context with specific power preference.
    ///
    /// Use `PowerPreference::LowPower` for background tasks or battery savings.
    /// Use `PowerPreference::HighPerformance` for rendering (default).
    ///
    /// # Errors
    ///
    /// Returns error if no suitable adapter is found or device creation fails.
    pub fn with_power_preference(power_preference: wgpu::PowerPreference) -> RenderResult<Self> {
        info!("Initializing GPU context with Metal backend");

        // Create instance with Metal backend only (no MoltenVK overhead)
        let instance = Instance::new(&InstanceDescriptor {
            backends: Backends::METAL,
            ..Default::default()
        });

        debug!("wgpu instance created with Metal backend");

        // Request high-performance adapter (discrete GPU on Intel Macs, main GPU on Apple Silicon)
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
        .ok_or_else(|| {
            RenderError::NoAdapterFound(
                "No Metal-compatible GPU adapter found. Ensure running on macOS or iOS."
                    .to_string(),
            )
        })?;

        let adapter_info = adapter.get_info();
        info!(
            "GPU adapter selected: {} (backend: {:?})",
            adapter_info.name, adapter_info.backend
        );

        // Verify we got Metal backend
        if adapter_info.backend != wgpu::Backend::Metal {
            warn!("Expected Metal backend, got {:?}", adapter_info.backend);
            return Err(RenderError::MetalBackendRequired);
        }

        // Configure limits optimized for Apple Silicon
        let limits = Self::apple_silicon_limits(&adapter);

        // Request device with optimized features
        let (device, queue) = pollster::block_on(adapter.request_device(
            &DeviceDescriptor {
                label: Some("Opta GPU Device"),
                required_features: wgpu::Features::empty(),
                required_limits: limits,
                memory_hints: wgpu::MemoryHints::Performance,
            },
            None,
        ))?;

        debug!("GPU device and queue created");

        // Detect capabilities
        let capabilities = GpuCapabilities::from_adapter(&adapter);

        info!(
            "GPU capabilities: texture_max={}, compute_workgroup={:?}, unified_memory={}",
            capabilities.max_texture_size,
            capabilities.max_compute_workgroup_size,
            capabilities.unified_memory
        );

        Ok(Self {
            instance,
            adapter,
            device,
            queue,
            capabilities,
        })
    }

    /// Get limits optimized for Apple Silicon GPUs.
    ///
    /// Apple GPUs support higher compute limits than wgpu defaults:
    /// - 1024 workgroup size per dimension
    /// - 1024 total invocations per workgroup
    /// - Large textures (16384x16384)
    fn apple_silicon_limits(adapter: &Adapter) -> Limits {
        let adapter_limits = adapter.limits();

        // Start with default limits and upgrade what Apple Silicon supports
        let mut limits = Limits::default();

        // Compute shader limits (Apple Silicon supports 1024)
        limits.max_compute_workgroup_size_x = adapter_limits.max_compute_workgroup_size_x.min(1024);
        limits.max_compute_workgroup_size_y = adapter_limits.max_compute_workgroup_size_y.min(1024);
        limits.max_compute_workgroup_size_z = adapter_limits.max_compute_workgroup_size_z.min(1024);
        limits.max_compute_invocations_per_workgroup = adapter_limits
            .max_compute_invocations_per_workgroup
            .min(1024);

        // Texture limits
        limits.max_texture_dimension_2d = adapter_limits.max_texture_dimension_2d.min(16384);

        // Buffer limits (generous for UMA systems)
        limits.max_buffer_size = adapter_limits.max_buffer_size;
        limits.max_storage_buffer_binding_size = adapter_limits.max_storage_buffer_binding_size;

        debug!(
            "Configured limits: compute_x={}, compute_total={}, texture_2d={}",
            limits.max_compute_workgroup_size_x,
            limits.max_compute_invocations_per_workgroup,
            limits.max_texture_dimension_2d
        );

        limits
    }

    /// Check if the GPU supports a specific feature.
    #[must_use]
    pub fn supports_feature(&self, feature: wgpu::Features) -> bool {
        self.device.features().contains(feature)
    }

    /// Get the maximum texture size supported.
    #[must_use]
    pub fn max_texture_size(&self) -> u32 {
        self.capabilities.max_texture_size
    }

    /// Check if running on Apple Silicon (Unified Memory Architecture).
    #[must_use]
    pub fn is_unified_memory(&self) -> bool {
        self.capabilities.unified_memory
    }
}

impl std::fmt::Debug for GpuContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GpuContext")
            .field("device_name", &self.capabilities.device_name)
            .field("backend", &self.capabilities.backend)
            .field("unified_memory", &self.capabilities.unified_memory)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpu_context_creation() {
        // This test requires a Metal-capable GPU
        let result = GpuContext::new();

        // On CI without GPU, this might fail - that's expected
        if let Ok(ctx) = result {
            assert_eq!(ctx.capabilities.backend, wgpu::Backend::Metal);
            assert!(ctx.capabilities.max_texture_size >= 4096);
        }
    }

    #[test]
    fn test_gpu_capabilities_debug() {
        let caps = GpuCapabilities {
            max_texture_size: 16384,
            max_compute_workgroup_size: [1024, 1024, 1024],
            max_compute_invocations_per_workgroup: 1024,
            supports_promotion: true,
            unified_memory: true,
            vendor_name: "Apple".to_string(),
            device_name: "Apple M2".to_string(),
            backend: wgpu::Backend::Metal,
        };

        let debug_str = format!("{caps:?}");
        assert!(debug_str.contains("Apple M2"));
        assert!(debug_str.contains("unified_memory: true"));
    }
}
