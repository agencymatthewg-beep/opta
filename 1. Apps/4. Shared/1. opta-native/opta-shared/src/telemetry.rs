//! Hardware telemetry types
//!
//! Represents system hardware state including CPU, RAM, GPU, and disk metrics.

use serde::{Deserialize, Serialize};

/// Complete system telemetry snapshot
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemTelemetry {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub gpu: Option<GpuInfo>,
    pub disk: DiskInfo,
    pub thermal: ThermalInfo,
    pub timestamp_ms: u64,
}

/// CPU information and metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CpuInfo {
    /// CPU model name (e.g., "Apple M3 Pro")
    pub name: String,
    /// Number of physical cores
    pub physical_cores: u32,
    /// Number of logical cores (threads)
    pub logical_cores: u32,
    /// Overall CPU usage percentage (0-100)
    pub usage_percent: f32,
    /// Per-core usage percentages
    pub per_core_usage: Vec<f32>,
    /// Current frequency in MHz (if available)
    pub frequency_mhz: Option<u32>,
    /// Performance cores count (Apple Silicon)
    pub p_cores: Option<u32>,
    /// Efficiency cores count (Apple Silicon)
    pub e_cores: Option<u32>,
}

/// Memory (RAM) information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryInfo {
    /// Total physical memory in bytes
    pub total_bytes: u64,
    /// Used memory in bytes
    pub used_bytes: u64,
    /// Available memory in bytes
    pub available_bytes: u64,
    /// Memory pressure level (macOS specific)
    pub pressure: MemoryPressure,
    /// Swap used in bytes
    pub swap_used_bytes: u64,
    /// Swap total in bytes
    pub swap_total_bytes: u64,
}

/// Memory pressure levels (macOS)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum MemoryPressure {
    #[default]
    Normal,
    Warning,
    Critical,
}

/// GPU information and metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GpuInfo {
    /// GPU name (e.g., "Apple M3 Pro GPU")
    pub name: String,
    /// GPU vendor
    pub vendor: GpuVendor,
    /// Total VRAM in bytes (dedicated GPU) or shared memory limit
    pub vram_total_bytes: u64,
    /// Used VRAM in bytes
    pub vram_used_bytes: u64,
    /// GPU utilization percentage (0-100)
    pub utilization_percent: f32,
    /// GPU temperature in Celsius (if available)
    pub temperature_celsius: Option<f32>,
    /// Current power state
    pub power_state: GpuPowerState,
    /// Metal feature set (macOS)
    pub metal_family: Option<String>,
}

/// GPU vendor identification
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum GpuVendor {
    #[default]
    Unknown,
    Apple,
    Nvidia,
    Amd,
    Intel,
}

/// GPU power state
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum GpuPowerState {
    #[default]
    Unknown,
    Idle,
    Low,
    Medium,
    High,
    Maximum,
}

/// Disk information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiskInfo {
    /// Primary disk name
    pub name: String,
    /// Total disk space in bytes
    pub total_bytes: u64,
    /// Used disk space in bytes
    pub used_bytes: u64,
    /// Free disk space in bytes
    pub free_bytes: u64,
    /// Disk type (SSD, HDD, etc.)
    pub disk_type: DiskType,
}

/// Disk type classification
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum DiskType {
    #[default]
    Unknown,
    Ssd,
    Hdd,
    NvMe,
    Fusion,
}

/// Thermal state information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ThermalInfo {
    /// Overall thermal state
    pub state: ThermalState,
    /// CPU temperature in Celsius (if available via IOKit/SMC)
    pub cpu_temperature_celsius: Option<f32>,
    /// GPU temperature in Celsius (if available)
    pub gpu_temperature_celsius: Option<f32>,
    /// Fan speeds in RPM (if available)
    pub fan_speeds_rpm: Vec<u32>,
    /// Whether system is being throttled
    pub is_throttling: bool,
}

/// Thermal state levels (matches ProcessInfo.ThermalState on iOS/macOS)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ThermalState {
    #[default]
    Nominal,
    Fair,
    Serious,
    Critical,
}

impl ThermalState {
    /// Convert from ProcessInfo.ThermalState raw value
    pub fn from_raw(value: i32) -> Self {
        match value {
            0 => Self::Nominal,
            1 => Self::Fair,
            2 => Self::Serious,
            3 => Self::Critical,
            _ => Self::Nominal,
        }
    }
}
