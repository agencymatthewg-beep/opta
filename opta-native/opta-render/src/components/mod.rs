//! Visual components module for Opta.
//!
//! This module provides GPU-accelerated 3D components including:
//! - OptaRing: The central glass torus ring component
//! - GlassPanel: Frosted glass UI panels with blur effects
//! - CpuMeter: Energy core visualization for CPU telemetry
//! - MemoryMeter: Liquid fill visualization for memory telemetry
//! - Telemetry: Data structures for system monitoring
//!
//! # Example
//!
//! ```ignore
//! use opta_render::components::{OptaRing, RingConfig, RingState};
//!
//! // Create ring with default config
//! let mut ring = OptaRing::new(&device, &queue, surface_format, RingConfig::default());
//!
//! // Transition to active state
//! ring.set_state(RingState::Active);
//!
//! // Update animation
//! ring.update(delta_time);
//!
//! // Render
//! ring.render(&queue, &mut encoder, &color_view, &depth_view, view_proj_matrix);
//! ```
//!
//! # Telemetry Example
//!
//! ```ignore
//! use opta_render::components::{CpuMeter, CpuTelemetry, MemoryMeter, MemoryTelemetry};
//!
//! // Create meters
//! let cpu_meter = CpuMeter::new(&device, surface_format, width, height);
//! let memory_meter = MemoryMeter::new(&device, surface_format, width, height);
//!
//! // Update telemetry
//! let mut cpu_telemetry = CpuTelemetry::new(8);
//! cpu_telemetry.set_usage(0.75);
//! cpu_telemetry.set_temperature(65.0);
//!
//! // Render
//! cpu_meter.render(&queue, &mut encoder, &output_view, &cpu_telemetry);
//! ```

mod cpu_meter;
mod glass_panel;
mod memory_meter;
mod ring;
mod telemetry;

pub use cpu_meter::{CpuMeter, CpuMeterConfig, CpuMeterUniforms, MeterVertex};
pub use glass_panel::{GlassPanel, GlassPanelConfig, GlassPanelUniforms, PanelVertex};
pub use memory_meter::{MemoryMeter, MemoryMeterConfig, MemoryMeterUniforms, MemoryMeterVertex};
pub use ring::{
    generate_torus_geometry, OptaRing, RingConfig, RingQualityLevel, RingSpringState, RingState,
    RingUniforms, RingVertex, SpringConfig, SpringValue, SpringVec3,
};
pub use telemetry::{
    CpuTelemetry, GpuTelemetry, MemoryTelemetry, SystemTelemetry, MAX_CPU_CORES,
};
