//! Telemetry Capability
//!
//! Defines the interface for collecting hardware telemetry.

use opta_shared::{SystemTelemetry, OptaResult};

/// Capability for collecting system telemetry
pub trait TelemetryCapability {
    /// Collect a complete system telemetry snapshot
    fn collect(&self) -> OptaResult<SystemTelemetry>;

    /// Get CPU information and usage
    fn get_cpu_info(&self) -> OptaResult<opta_shared::CpuInfo>;

    /// Get memory information
    fn get_memory_info(&self) -> OptaResult<opta_shared::MemoryInfo>;

    /// Get GPU information (if available)
    fn get_gpu_info(&self) -> OptaResult<Option<opta_shared::GpuInfo>>;

    /// Get disk information
    fn get_disk_info(&self) -> OptaResult<opta_shared::DiskInfo>;

    /// Get thermal information
    fn get_thermal_info(&self) -> OptaResult<opta_shared::ThermalInfo>;
}

/// Telemetry collection configuration
#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    /// Polling interval in milliseconds
    pub interval_ms: u64,
    /// Include per-core CPU usage
    pub per_core_usage: bool,
    /// Include fan speeds
    pub include_fans: bool,
    /// Include temperature sensors
    pub include_temperature: bool,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            interval_ms: 1000,
            per_core_usage: true,
            include_fans: true,
            include_temperature: true,
        }
    }
}
