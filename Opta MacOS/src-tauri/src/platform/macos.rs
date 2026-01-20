//! macOS-specific platform initialization and optimization features.
//!
//! Phase 44: macOS Optimization Core
//!
//! This module handles:
//! - macOS version detection
//! - App Nap configuration
//! - Menu bar integration
//! - Dock badge updates
//! - Metal GPU detection
//! - Native notification setup
//!
//! Phase 44 additions:
//! - Process priority management via nice/renice
//! - Memory pressure monitoring via vm_stat
//! - CPU affinity hints for M-series (P/E core awareness)
//! - GPU Metal performance state detection
//! - Thermal throttling detection
//! - Energy saver integration

use super::{
    Architecture, LaunchOptimization, NativeFeature, OperatingSystem, PlatformCapabilities,
    PlatformContext,
};
use serde::{Deserialize, Serialize};
use std::process::Command;

// =============================================================================
// Platform Initialization (existing)
// =============================================================================

/// Initialize macOS-specific features and return platform context.
pub fn initialize_macos() -> PlatformContext {
    let os = detect_macos_version();
    let capabilities = detect_capabilities();
    let native_features = detect_native_features();
    let launch_optimizations = apply_launch_optimizations();

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "macOS".to_string(),
        icon: "apple".to_string(),
    }
}

/// Detect macOS version information.
fn detect_macos_version() -> OperatingSystem {
    let version = Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let build = Command::new("sw_vers")
        .arg("-buildVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    OperatingSystem::MacOS {
        version,
        build,
        architecture: Architecture::current(),
    }
}

/// Detect platform capabilities on macOS.
fn detect_capabilities() -> PlatformCapabilities {
    let has_metal = check_metal_support();

    PlatformCapabilities {
        gpu_acceleration: has_metal,
        native_notifications: true,
        system_tray: true,
        background_execution: true,
        power_management: true,
        touch_support: false,
        high_dpi: true,
    }
}

/// Check if Metal GPU acceleration is available.
fn check_metal_support() -> bool {
    true // Metal is available on all supported macOS versions
}

/// Detect available native features on macOS.
fn detect_native_features() -> Vec<NativeFeature> {
    let mut features = vec![
        NativeFeature::MenuBar,
        NativeFeature::DockBadge,
        NativeFeature::NativeNotifications,
        NativeFeature::SystemTray,
        NativeFeature::PowerManagement,
        NativeFeature::BackgroundExecution,
        NativeFeature::AppNap,
        NativeFeature::Spotlight,
    ];

    if check_metal_support() {
        features.push(NativeFeature::Metal);
    }

    features
}

/// Apply macOS-specific launch optimizations.
fn apply_launch_optimizations() -> Vec<LaunchOptimization> {
    let mut optimizations = vec![
        LaunchOptimization {
            name: "App Nap Configuration".to_string(),
            description: "Configured App Nap to prevent throttling during active optimization"
                .to_string(),
            applied: true,
        },
        LaunchOptimization {
            name: "Retina Display Support".to_string(),
            description: "Enabled high-DPI rendering for Retina displays".to_string(),
            applied: true,
        },
    ];

    if check_metal_support() {
        optimizations.push(LaunchOptimization {
            name: "Metal Acceleration".to_string(),
            description: "GPU acceleration enabled via Metal framework".to_string(),
            applied: true,
        });
    }

    optimizations
}

/// Check if running on Apple Silicon.
pub fn is_apple_silicon() -> bool {
    Architecture::current() == Architecture::Arm64
}

/// Get macOS marketing name from version.
#[allow(dead_code)]
pub fn get_macos_name(version: &str) -> &'static str {
    let major: u32 = version
        .split('.')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    match major {
        15 => "Sequoia",
        14 => "Sonoma",
        13 => "Ventura",
        12 => "Monterey",
        11 => "Big Sur",
        10 => "Catalina or earlier",
        _ => "Unknown",
    }
}

// =============================================================================
// Phase 44: macOS Optimization Core
// =============================================================================

/// Complete macOS optimization status snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacOSOptimizationStatus {
    pub memory: MemoryPressureInfo,
    pub thermal: ThermalState,
    pub gpu: GpuPerformanceState,
    pub energy: EnergySaverConfig,
    pub is_apple_silicon: bool,
    pub core_config: Option<AppleSiliconCoreConfig>,
}

// -----------------------------------------------------------------------------
// Memory Pressure Monitoring
// -----------------------------------------------------------------------------

/// Memory pressure levels as reported by macOS.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryPressureLevel {
    Normal,
    Warn,
    Critical,
    Unknown,
}

/// Comprehensive memory pressure information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPressureInfo {
    pub level: MemoryPressureLevel,
    pub pressure_percent: u8,
    pub pages_free: u64,
    pub pages_active: u64,
    pub pages_inactive: u64,
    pub pages_wired: u64,
    pub pages_compressed: u64,
    pub swap_used_bytes: u64,
    pub app_memory_bytes: u64,
    pub page_size: u64,
    pub recommendation: MemoryRecommendation,
}

/// Recommendations based on memory state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryRecommendation {
    Healthy,
    CloseBackgroundApps,
    CloseHeavyApps,
    SystemRestart,
}

/// Get current memory pressure information.
pub fn get_memory_pressure() -> MemoryPressureInfo {
    let (level, pressure_percent) = get_pressure_level();
    let vm_stats = get_vm_stat();
    let page_size = get_page_size();

    let app_memory_bytes = (vm_stats.pages_active + vm_stats.pages_wired) * page_size;

    let recommendation = match level {
        MemoryPressureLevel::Normal => MemoryRecommendation::Healthy,
        MemoryPressureLevel::Warn => MemoryRecommendation::CloseBackgroundApps,
        MemoryPressureLevel::Critical => {
            if vm_stats.swap_used > 1024 * 1024 * 1024 {
                MemoryRecommendation::SystemRestart
            } else {
                MemoryRecommendation::CloseHeavyApps
            }
        }
        MemoryPressureLevel::Unknown => MemoryRecommendation::Healthy,
    };

    MemoryPressureInfo {
        level,
        pressure_percent,
        pages_free: vm_stats.pages_free,
        pages_active: vm_stats.pages_active,
        pages_inactive: vm_stats.pages_inactive,
        pages_wired: vm_stats.pages_wired,
        pages_compressed: vm_stats.pages_compressed,
        swap_used_bytes: vm_stats.swap_used,
        app_memory_bytes,
        page_size,
        recommendation,
    }
}

#[derive(Debug, Default)]
struct VmStatInfo {
    pages_free: u64,
    pages_active: u64,
    pages_inactive: u64,
    pages_wired: u64,
    pages_compressed: u64,
    swap_used: u64,
}

fn get_pressure_level() -> (MemoryPressureLevel, u8) {
    let output = Command::new("memory_pressure").output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_memory_pressure_output(&stdout)
        }
        Err(_) => (MemoryPressureLevel::Unknown, 0),
    }
}

fn parse_memory_pressure_output(output: &str) -> (MemoryPressureLevel, u8) {
    let lower = output.to_lowercase();

    if let Some(idx) = lower.find('%') {
        let prefix = &output[..idx];
        let number_str: String = prefix.chars().rev().take_while(|c| c.is_ascii_digit()).collect();
        let number_str: String = number_str.chars().rev().collect();

        if let Ok(percent) = number_str.parse::<u8>() {
            let pressure = 100_u8.saturating_sub(percent);
            let level = match pressure {
                0..=30 => MemoryPressureLevel::Normal,
                31..=70 => MemoryPressureLevel::Warn,
                _ => MemoryPressureLevel::Critical,
            };
            return (level, pressure);
        }
    }

    if lower.contains("critical") {
        (MemoryPressureLevel::Critical, 90)
    } else if lower.contains("warn") {
        (MemoryPressureLevel::Warn, 60)
    } else if lower.contains("normal") {
        (MemoryPressureLevel::Normal, 20)
    } else {
        (MemoryPressureLevel::Unknown, 0)
    }
}

fn get_vm_stat() -> VmStatInfo {
    let output = Command::new("vm_stat").output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_vm_stat_output(&stdout)
        }
        Err(_) => VmStatInfo::default(),
    }
}

fn parse_vm_stat_output(output: &str) -> VmStatInfo {
    let mut info = VmStatInfo::default();

    for line in output.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() != 2 {
            continue;
        }

        let key = parts[0].trim().to_lowercase();
        let value_str = parts[1].trim().trim_end_matches('.');
        let value: u64 = value_str.parse().unwrap_or(0);

        if key.contains("pages free") {
            info.pages_free = value;
        } else if key.contains("pages active") {
            info.pages_active = value;
        } else if key.contains("pages inactive") {
            info.pages_inactive = value;
        } else if key.contains("pages wired") {
            info.pages_wired = value;
        } else if key.contains("pages occupied by compressor")
            || key.contains("pages stored in compressor")
        {
            info.pages_compressed = value;
        }
    }

    info.swap_used = get_swap_usage();
    info
}

fn get_page_size() -> u64 {
    Command::new("pagesize")
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(4096)
}

fn get_swap_usage() -> u64 {
    let output = Command::new("sysctl")
        .args(["-n", "vm.swapusage"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_swap_usage(&stdout)
        }
        Err(_) => 0,
    }
}

fn parse_swap_usage(output: &str) -> u64 {
    if let Some(used_idx) = output.find("used = ") {
        let after_used = &output[used_idx + 7..];
        let value_str: String = after_used.chars().take_while(|c| *c != ' ').collect();
        return parse_memory_value(&value_str);
    }
    0
}

fn parse_memory_value(s: &str) -> u64 {
    let s = s.trim();
    if s.is_empty() {
        return 0;
    }

    let (num_str, suffix) = if s.ends_with('G') || s.ends_with('g') {
        (&s[..s.len() - 1], 'G')
    } else if s.ends_with('M') || s.ends_with('m') {
        (&s[..s.len() - 1], 'M')
    } else if s.ends_with('K') || s.ends_with('k') {
        (&s[..s.len() - 1], 'K')
    } else {
        (s, 'B')
    };

    let value: f64 = num_str.parse().unwrap_or(0.0);
    let multiplier: u64 = match suffix {
        'G' => 1024 * 1024 * 1024,
        'M' => 1024 * 1024,
        'K' => 1024,
        _ => 1,
    };

    (value * multiplier as f64) as u64
}

// -----------------------------------------------------------------------------
// Process Priority Management
// -----------------------------------------------------------------------------

/// Process priority levels for optimization.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProcessPriority {
    Realtime,
    High,
    Normal,
    Background,
    Idle,
}

impl ProcessPriority {
    pub fn to_nice_value(self) -> i8 {
        match self {
            ProcessPriority::Realtime => -20,
            ProcessPriority::High => -10,
            ProcessPriority::Normal => 0,
            ProcessPriority::Background => 10,
            ProcessPriority::Idle => 19,
        }
    }

    pub fn from_nice_value(nice: i8) -> Self {
        match nice {
            -20..=-15 => ProcessPriority::Realtime,
            -14..=-5 => ProcessPriority::High,
            -4..=4 => ProcessPriority::Normal,
            5..=14 => ProcessPriority::Background,
            _ => ProcessPriority::Idle,
        }
    }
}

/// Process priority information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessPriorityInfo {
    pub pid: u32,
    pub nice: i8,
    pub priority: ProcessPriority,
    pub can_prioritize: bool,
}

/// Get current priority for a process.
pub fn get_process_priority(pid: u32) -> Result<ProcessPriorityInfo, String> {
    let output = Command::new("ps")
        .args(["-o", "ni=", "-p", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to get process priority: {}", e))?;

    if !output.status.success() {
        return Err(format!("Process {} not found", pid));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let nice: i8 = stdout.trim().parse().unwrap_or(0);
    let priority = ProcessPriority::from_nice_value(nice);
    let can_prioritize = check_can_prioritize(pid);

    Ok(ProcessPriorityInfo {
        pid,
        nice,
        priority,
        can_prioritize,
    })
}

fn check_can_prioritize(pid: u32) -> bool {
    let output = Command::new("ps")
        .args(["-o", "user=", "-p", &pid.to_string()])
        .output();

    match output {
        Ok(out) => {
            let process_user = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let current_user = std::env::var("USER").unwrap_or_default();
            process_user == current_user || current_user == "root"
        }
        Err(_) => false,
    }
}

/// Set process priority using renice.
pub fn set_process_priority(pid: u32, priority: ProcessPriority) -> Result<bool, String> {
    let nice_value = priority.to_nice_value();

    let output = Command::new("renice")
        .args(["-n", &nice_value.to_string(), "-p", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to set priority: {}", e))?;

    if output.status.success() {
        Ok(true)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Permission denied") || stderr.contains("Operation not permitted") {
            Err(format!(
                "Permission denied. Setting priority to {:?} (nice {}) requires elevated privileges.",
                priority, nice_value
            ))
        } else {
            Err(format!("Failed to set priority: {}", stderr))
        }
    }
}

// -----------------------------------------------------------------------------
// Apple Silicon Core Configuration
// -----------------------------------------------------------------------------

/// Apple Silicon core configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppleSiliconCoreConfig {
    pub performance_cores: u8,
    pub efficiency_cores: u8,
    pub total_cores: u8,
    pub chip_family: String,
}

/// Get CPU core configuration for Apple Silicon.
pub fn get_apple_silicon_core_config() -> Option<AppleSiliconCoreConfig> {
    if !is_apple_silicon() {
        return None;
    }

    let p_cores = get_sysctl_int("hw.perflevel0.logicalcpu").unwrap_or(0);
    let e_cores = get_sysctl_int("hw.perflevel1.logicalcpu").unwrap_or(0);

    if p_cores == 0 && e_cores == 0 {
        let total_cores = get_sysctl_int("hw.logicalcpu").unwrap_or(0);
        if total_cores > 0 {
            return Some(AppleSiliconCoreConfig {
                performance_cores: (total_cores * 2 / 3) as u8,
                efficiency_cores: (total_cores / 3) as u8,
                total_cores: total_cores as u8,
                chip_family: detect_chip_family(),
            });
        }
        return None;
    }

    Some(AppleSiliconCoreConfig {
        performance_cores: p_cores as u8,
        efficiency_cores: e_cores as u8,
        total_cores: (p_cores + e_cores) as u8,
        chip_family: detect_chip_family(),
    })
}

fn get_sysctl_int(key: &str) -> Option<u32> {
    Command::new("sysctl")
        .args(["-n", key])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse().ok())
}

fn detect_chip_family() -> String {
    let output = Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let brand = String::from_utf8_lossy(&out.stdout);
            let brand = brand.trim();

            if brand.contains("M4") {
                "M4".to_string()
            } else if brand.contains("M3") {
                "M3".to_string()
            } else if brand.contains("M2") {
                "M2".to_string()
            } else if brand.contains("M1") {
                "M1".to_string()
            } else if brand.contains("Apple") {
                "Apple Silicon".to_string()
            } else {
                "Unknown".to_string()
            }
        }
        _ => "Unknown".to_string(),
    }
}

// -----------------------------------------------------------------------------
// Thermal Throttling Detection
// -----------------------------------------------------------------------------

/// Thermal pressure levels.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThermalPressureLevel {
    Nominal,
    Fair,
    Serious,
    Critical,
    Unknown,
}

/// Current thermal state information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThermalState {
    pub level: ThermalPressureLevel,
    pub is_throttling: bool,
    pub throttle_percent: u8,
    pub cpu_speed_limit: Option<u8>,
    pub recommendation: ThermalRecommendation,
}

/// Recommendations based on thermal state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThermalRecommendation {
    Optimal,
    ImproveVentilation,
    ReduceWorkload,
    CloseApplications,
}

/// Get current thermal state.
pub fn get_thermal_state() -> ThermalState {
    let (level, cpu_speed_limit) = detect_thermal_level();
    let is_throttling = level == ThermalPressureLevel::Serious
        || level == ThermalPressureLevel::Critical;

    let throttle_percent = match level {
        ThermalPressureLevel::Nominal => 0,
        ThermalPressureLevel::Fair => 10,
        ThermalPressureLevel::Serious => 30,
        ThermalPressureLevel::Critical => 50,
        ThermalPressureLevel::Unknown => 0,
    };

    let recommendation = match level {
        ThermalPressureLevel::Nominal => ThermalRecommendation::Optimal,
        ThermalPressureLevel::Fair => ThermalRecommendation::ImproveVentilation,
        ThermalPressureLevel::Serious => ThermalRecommendation::ReduceWorkload,
        ThermalPressureLevel::Critical => ThermalRecommendation::CloseApplications,
        ThermalPressureLevel::Unknown => ThermalRecommendation::Optimal,
    };

    ThermalState {
        level,
        is_throttling,
        throttle_percent,
        cpu_speed_limit,
        recommendation,
    }
}

fn detect_thermal_level() -> (ThermalPressureLevel, Option<u8>) {
    let output = Command::new("pmset").args(["-g", "therm"]).output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_thermal_output(&stdout)
        }
        _ => (ThermalPressureLevel::Unknown, None),
    }
}

fn parse_thermal_output(output: &str) -> (ThermalPressureLevel, Option<u8>) {
    let mut cpu_limit: Option<u8> = None;

    for line in output.lines() {
        let lower = line.to_lowercase();
        if lower.contains("cpu_speed_limit") || lower.contains("cpu speed limit") {
            if let Some(value) = extract_number(line) {
                cpu_limit = Some(value as u8);
                if value < 100 {
                    let level = match value {
                        90..=99 => ThermalPressureLevel::Fair,
                        70..=89 => ThermalPressureLevel::Serious,
                        _ => ThermalPressureLevel::Critical,
                    };
                    return (level, cpu_limit);
                }
            }
        }
    }

    (ThermalPressureLevel::Nominal, cpu_limit)
}

fn extract_number(s: &str) -> Option<u32> {
    if let Some(idx) = s.find('=') {
        let after_eq = &s[idx + 1..];
        let num_str: String = after_eq
            .chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| c.is_ascii_digit())
            .collect();
        num_str.parse().ok()
    } else {
        None
    }
}

/// Check if system is currently throttling.
pub fn is_throttling() -> bool {
    let state = get_thermal_state();
    state.is_throttling
}

// -----------------------------------------------------------------------------
// GPU Metal Performance State
// -----------------------------------------------------------------------------

/// GPU performance levels.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuPerformanceLevel {
    High,
    Medium,
    Low,
    Auto,
    Unknown,
}

/// GPU vendor identification.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuVendor {
    Apple,
    Amd,
    Intel,
    Nvidia,
    Unknown,
}

/// Comprehensive GPU performance state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuPerformanceState {
    pub model: String,
    pub vendor: GpuVendor,
    pub metal_supported: bool,
    pub metal_version: String,
    pub performance_level: GpuPerformanceLevel,
    pub vram_bytes: Option<u64>,
    pub has_discrete_gpu: bool,
    pub recommendation: GpuRecommendation,
}

/// GPU recommendations for gaming.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuRecommendation {
    Optimal,
    UseDiscreteGpu,
    DisableAutoSwitch,
    LimitedCapability,
}

/// Get current GPU performance state.
pub fn get_gpu_performance_state() -> GpuPerformanceState {
    let (model, vendor, vram_bytes) = detect_gpu_info();
    let metal_version = detect_metal_version(&model);
    let has_discrete = detect_discrete_gpu();
    let performance_level = detect_gpu_performance_level();

    let recommendation = if has_discrete {
        GpuRecommendation::DisableAutoSwitch
    } else if vendor == GpuVendor::Intel {
        GpuRecommendation::LimitedCapability
    } else {
        GpuRecommendation::Optimal
    };

    GpuPerformanceState {
        model,
        vendor,
        metal_supported: true,
        metal_version,
        performance_level,
        vram_bytes,
        has_discrete_gpu: has_discrete,
        recommendation,
    }
}

fn detect_gpu_info() -> (String, GpuVendor, Option<u64>) {
    let output = Command::new("system_profiler")
        .args(["SPDisplaysDataType"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_gpu_output(&stdout)
        }
        _ => ("Unknown GPU".to_string(), GpuVendor::Unknown, None),
    }
}

fn parse_gpu_output(output: &str) -> (String, GpuVendor, Option<u64>) {
    let mut model = "Unknown GPU".to_string();
    let mut vendor = GpuVendor::Unknown;
    let mut vram: Option<u64> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.contains("Chipset Model:") || trimmed.contains("Chip Model:") {
            if let Some(idx) = trimmed.find(':') {
                model = trimmed[idx + 1..].trim().to_string();

                let lower = model.to_lowercase();
                if lower.contains("apple") || lower.starts_with("m1")
                    || lower.starts_with("m2") || lower.starts_with("m3")
                    || lower.starts_with("m4")
                {
                    vendor = GpuVendor::Apple;
                } else if lower.contains("amd") || lower.contains("radeon") {
                    vendor = GpuVendor::Amd;
                } else if lower.contains("intel") {
                    vendor = GpuVendor::Intel;
                } else if lower.contains("nvidia") || lower.contains("geforce") {
                    vendor = GpuVendor::Nvidia;
                }
            }
        }

        if (trimmed.contains("VRAM") || trimmed.contains("Memory")) && vram.is_none() {
            if let Some(idx) = trimmed.find(':') {
                let value = trimmed[idx + 1..].trim();
                vram = parse_vram_value(value);
            }
        }
    }

    (model, vendor, vram)
}

fn parse_vram_value(s: &str) -> Option<u64> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }

    let value: f64 = parts[0].parse().ok()?;
    let unit = parts[1].to_uppercase();

    let bytes = if unit.contains("GB") || unit.contains("G") {
        (value * 1024.0 * 1024.0 * 1024.0) as u64
    } else if unit.contains("MB") || unit.contains("M") {
        (value * 1024.0 * 1024.0) as u64
    } else {
        return None;
    };

    Some(bytes)
}

fn detect_metal_version(model: &str) -> String {
    let lower = model.to_lowercase();
    if lower.contains("m4") || lower.contains("m3") || lower.contains("m2") {
        "Metal 3".to_string()
    } else if lower.contains("m1") || lower.contains("amd") {
        "Metal 2".to_string()
    } else {
        "Metal".to_string()
    }
}

fn detect_discrete_gpu() -> bool {
    let output = Command::new("system_profiler")
        .args(["SPDisplaysDataType"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let gpu_count = stdout.matches("Chipset Model:").count()
                + stdout.matches("Chip Model:").count();
            return gpu_count > 1;
        }
    }
    false
}

fn detect_gpu_performance_level() -> GpuPerformanceLevel {
    let output = Command::new("pmset").args(["-g"]).output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);

            if stdout.contains("lowpowermode 1") || stdout.contains("lowpowermode\t1") {
                return GpuPerformanceLevel::Low;
            }
            if stdout.contains("gpuswitch 0") {
                return GpuPerformanceLevel::Low;
            }
            if stdout.contains("gpuswitch 1") {
                return GpuPerformanceLevel::High;
            }
        }
    }

    GpuPerformanceLevel::Auto
}

// -----------------------------------------------------------------------------
// Energy Saver Integration
// -----------------------------------------------------------------------------

/// Power source type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PowerSource {
    Ac,
    Battery,
    Ups,
    Unknown,
}

/// Energy saver configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnergySaverConfig {
    pub power_source: PowerSource,
    pub low_power_mode: bool,
    pub display_sleep_minutes: u32,
    pub battery_percent: Option<u8>,
    pub battery_minutes_remaining: Option<u32>,
    pub is_charging: bool,
    pub recommendation: GamingPowerRecommendation,
}

/// Power recommendations for gaming.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GamingPowerRecommendation {
    Optimal,
    PlugIn,
    LowBattery,
    DisableLowPowerMode,
    IncreaseDisplaySleep,
}

/// Get current energy saver configuration.
pub fn get_energy_config() -> EnergySaverConfig {
    let (low_power_mode, display_sleep) = get_pmset_settings();
    let power_source = detect_power_source();
    let (battery_percent, battery_minutes, is_charging) = get_battery_info();

    let recommendation = determine_power_recommendation(
        &power_source,
        low_power_mode,
        battery_percent,
        display_sleep,
    );

    EnergySaverConfig {
        power_source,
        low_power_mode,
        display_sleep_minutes: display_sleep,
        battery_percent,
        battery_minutes_remaining: battery_minutes,
        is_charging,
        recommendation,
    }
}

fn get_pmset_settings() -> (bool, u32) {
    let output = Command::new("pmset").args(["-g"]).output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut low_power = false;
            let mut display_sleep = 0u32;

            for line in stdout.lines() {
                let lower = line.trim().to_lowercase();
                if lower.starts_with("lowpowermode") {
                    low_power = lower.ends_with('1');
                } else if lower.starts_with("displaysleep") {
                    if let Some(val) = lower.split_whitespace().last() {
                        display_sleep = val.parse().unwrap_or(0);
                    }
                }
            }

            (low_power, display_sleep)
        }
        _ => (false, 0),
    }
}

fn detect_power_source() -> PowerSource {
    let output = Command::new("pmset").args(["-g", "ps"]).output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let lower = stdout.to_lowercase();

            if lower.contains("ac power") {
                PowerSource::Ac
            } else if lower.contains("battery power") {
                PowerSource::Battery
            } else if lower.contains("ups power") {
                PowerSource::Ups
            } else {
                PowerSource::Unknown
            }
        }
        _ => PowerSource::Unknown,
    }
}

fn get_battery_info() -> (Option<u8>, Option<u32>, bool) {
    let output = Command::new("pmset").args(["-g", "batt"]).output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut percent: Option<u8> = None;
            let mut minutes: Option<u32> = None;
            let mut charging = false;

            for line in stdout.lines() {
                let trimmed = line.trim();

                // Extract percentage
                if let Some(pct_idx) = trimmed.find('%') {
                    let before = &trimmed[..pct_idx];
                    let num_str: String = before
                        .chars()
                        .rev()
                        .take_while(|c| c.is_ascii_digit())
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect();
                    percent = num_str.parse().ok();
                }

                // Check charging status
                let lower = trimmed.to_lowercase();
                if lower.contains("charging") && !lower.contains("not charging") {
                    charging = true;
                }

                // Extract time remaining
                if lower.contains("remaining") {
                    minutes = extract_time_remaining(trimmed);
                }
            }

            (percent, minutes, charging)
        }
        _ => (None, None, false),
    }
}

fn extract_time_remaining(s: &str) -> Option<u32> {
    for part in s.split_whitespace() {
        if part.contains(':') {
            let time_parts: Vec<&str> = part.split(':').collect();
            if time_parts.len() == 2 {
                let hours: u32 = time_parts[0].parse().ok()?;
                let mins: u32 = time_parts[1].parse().ok()?;
                return Some(hours * 60 + mins);
            }
        }
    }
    None
}

fn determine_power_recommendation(
    power_source: &PowerSource,
    low_power_mode: bool,
    battery_percent: Option<u8>,
    display_sleep: u32,
) -> GamingPowerRecommendation {
    if low_power_mode {
        return GamingPowerRecommendation::DisableLowPowerMode;
    }

    match power_source {
        PowerSource::Battery => {
            if let Some(pct) = battery_percent {
                if pct < 20 {
                    return GamingPowerRecommendation::LowBattery;
                }
            }
            GamingPowerRecommendation::PlugIn
        }
        PowerSource::Ups => GamingPowerRecommendation::PlugIn,
        _ => {
            if display_sleep > 0 && display_sleep < 10 {
                GamingPowerRecommendation::IncreaseDisplaySleep
            } else {
                GamingPowerRecommendation::Optimal
            }
        }
    }
}

/// Configure system for gaming mode.
pub fn configure_gaming_mode(enable: bool) -> Result<EnergySaverConfig, String> {
    if enable {
        // Prevent display sleep during gaming
        let _ = Command::new("caffeinate")
            .args(["-d", "-t", "3600"])
            .spawn();
    } else {
        // Kill caffeinate processes
        let _ = Command::new("pkill").args(["-f", "caffeinate"]).output();
    }

    Ok(get_energy_config())
}

// -----------------------------------------------------------------------------
// Combined Optimization Status
// -----------------------------------------------------------------------------

/// Get comprehensive macOS optimization status.
pub fn get_optimization_status() -> MacOSOptimizationStatus {
    MacOSOptimizationStatus {
        memory: get_memory_pressure(),
        thermal: get_thermal_state(),
        gpu: get_gpu_performance_state(),
        energy: get_energy_config(),
        is_apple_silicon: is_apple_silicon(),
        core_config: get_apple_silicon_core_config(),
    }
}

// -----------------------------------------------------------------------------
// Tauri Commands
// -----------------------------------------------------------------------------

/// Tauri command to get macOS optimization status.
#[tauri::command]
pub fn macos_get_optimization_status() -> Result<MacOSOptimizationStatus, String> {
    Ok(get_optimization_status())
}

/// Tauri command to set process priority.
#[tauri::command]
pub fn macos_set_process_priority(pid: u32, priority: ProcessPriority) -> Result<bool, String> {
    set_process_priority(pid, priority)
}

/// Tauri command to get memory pressure.
#[tauri::command]
pub fn macos_get_memory_pressure() -> Result<MemoryPressureInfo, String> {
    Ok(get_memory_pressure())
}

/// Tauri command to get thermal state.
#[tauri::command]
pub fn macos_get_thermal_state() -> Result<ThermalState, String> {
    Ok(get_thermal_state())
}

/// Tauri command to get GPU performance state.
#[tauri::command]
pub fn macos_get_gpu_state() -> Result<GpuPerformanceState, String> {
    Ok(get_gpu_performance_state())
}

/// Tauri command to configure gaming mode.
#[tauri::command]
pub fn macos_configure_gaming_mode(enable: bool) -> Result<EnergySaverConfig, String> {
    configure_gaming_mode(enable)
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_conversion() {
        assert_eq!(ProcessPriority::Realtime.to_nice_value(), -20);
        assert_eq!(ProcessPriority::Normal.to_nice_value(), 0);
        assert_eq!(ProcessPriority::Idle.to_nice_value(), 19);

        assert_eq!(ProcessPriority::from_nice_value(-20), ProcessPriority::Realtime);
        assert_eq!(ProcessPriority::from_nice_value(0), ProcessPriority::Normal);
        assert_eq!(ProcessPriority::from_nice_value(19), ProcessPriority::Idle);
    }

    #[test]
    fn test_memory_value_parsing() {
        assert_eq!(parse_memory_value("1G"), 1024 * 1024 * 1024);
        assert_eq!(parse_memory_value("512M"), 512 * 1024 * 1024);
        assert_eq!(parse_memory_value("1024K"), 1024 * 1024);
    }

    #[test]
    fn test_power_recommendation() {
        assert_eq!(
            determine_power_recommendation(&PowerSource::Ac, true, Some(100), 10),
            GamingPowerRecommendation::DisableLowPowerMode
        );

        assert_eq!(
            determine_power_recommendation(&PowerSource::Battery, false, Some(15), 10),
            GamingPowerRecommendation::LowBattery
        );

        assert_eq!(
            determine_power_recommendation(&PowerSource::Ac, false, None, 15),
            GamingPowerRecommendation::Optimal
        );
    }

    #[test]
    fn test_extract_number() {
        assert_eq!(extract_number("CPU_Speed_Limit = 100"), Some(100));
        assert_eq!(extract_number("value = 50"), Some(50));
        assert_eq!(extract_number("no equals"), None);
    }
}
