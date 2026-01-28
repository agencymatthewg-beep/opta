//! Windows-specific platform initialization and optimization features.
//!
//! Phase 45: Windows Optimization Core
//!
//! This module handles:
//! - Windows version detection
//! - Jump List setup
//! - Taskbar progress indicators
//! - System tray integration
//! - Toast notifications
//! - High-DPI configuration
//!
//! Phase 45 additions:
//! - Process priority management via SetPriorityClass API
//! - Memory working set optimization via SetProcessWorkingSetSize
//! - CPU affinity via SetProcessAffinityMask
//! - GPU DirectX/Vulkan power state detection
//! - Power plan switching for gaming mode
//! - Windows Game Mode integration

use super::{
    Architecture, LaunchOptimization, NativeFeature, OperatingSystem, PlatformCapabilities,
    PlatformContext,
};
use serde::{Deserialize, Serialize};
use std::process::Command;

// =============================================================================
// Platform Initialization (existing)
// =============================================================================

/// Initialize Windows-specific features and return platform context.
pub fn initialize_windows() -> PlatformContext {
    let os = detect_windows_version();
    let capabilities = detect_capabilities();
    let native_features = detect_native_features();
    let launch_optimizations = apply_launch_optimizations();

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "Windows".to_string(),
        icon: "monitor".to_string(), // Windows icon in Lucide
    }
}

/// Detect Windows version information.
fn detect_windows_version() -> OperatingSystem {
    // Get Windows version using PowerShell
    let version_info = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "[System.Environment]::OSVersion.Version.ToString()",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    // Get build number
    let build = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').CurrentBuild",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);

    // Get edition
    let edition = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').ProductName",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Windows".to_string());

    // Determine Windows version from build number
    let version = get_windows_version_name(build);

    OperatingSystem::Windows {
        version,
        build,
        edition,
    }
}

/// Get Windows version name from build number.
fn get_windows_version_name(build: u32) -> String {
    match build {
        b if b >= 22000 => "11".to_string(),
        b if b >= 19041 => "10".to_string(),
        b if b >= 10240 => "10 (Legacy)".to_string(),
        _ => "Unknown".to_string(),
    }
}

/// Detect platform capabilities on Windows.
fn detect_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        gpu_acceleration: true, // DirectX available on all Windows
        native_notifications: true, // Toast notifications available
        system_tray: true,      // System tray always available
        background_execution: true, // No restrictions like mobile
        power_management: true, // Power APIs available
        touch_support: check_touch_support(),
        high_dpi: true, // Per-monitor DPI available
    }
}

/// Check if touch input is available.
fn check_touch_support() -> bool {
    // On Windows, check for touch digitizer
    // For now, return false as gaming PCs rarely have touch
    // In production: use GetSystemMetrics(SM_DIGITIZER)
    false
}

/// Detect available native features on Windows.
fn detect_native_features() -> Vec<NativeFeature> {
    vec![
        NativeFeature::JumpList,
        NativeFeature::TaskbarProgress,
        NativeFeature::ToastNotifications,
        NativeFeature::SystemTray,
        NativeFeature::NativeNotifications,
        NativeFeature::StartupRegistration,
        NativeFeature::PowerManagement,
        NativeFeature::BackgroundExecution,
    ]
}

/// Apply Windows-specific launch optimizations.
fn apply_launch_optimizations() -> Vec<LaunchOptimization> {
    let mut optimizations = vec![];

    // High-DPI awareness
    optimizations.push(LaunchOptimization {
        name: "High-DPI Awareness".to_string(),
        description: "Configured Per-Monitor DPI awareness v2 for crisp rendering".to_string(),
        applied: true,
    });

    // Hardware acceleration
    optimizations.push(LaunchOptimization {
        name: "Hardware Acceleration".to_string(),
        description: "DirectX hardware acceleration enabled for WebView2".to_string(),
        applied: true,
    });

    // Console window hidden
    optimizations.push(LaunchOptimization {
        name: "Console Window Hidden".to_string(),
        description: "Windows subsystem configured to hide console window".to_string(),
        applied: true,
    });

    optimizations
}

// =============================================================================
// Phase 45: Windows Optimization Core
// =============================================================================

/// Complete Windows optimization status snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsOptimizationStatus {
    pub memory: MemoryInfo,
    pub gpu: GpuPerformanceState,
    pub power: PowerPlanConfig,
    pub game_mode: GameModeStatus,
    pub cpu_config: CpuConfiguration,
}

// -----------------------------------------------------------------------------
// Memory Working Set Management
// -----------------------------------------------------------------------------

/// Memory pressure levels for Windows.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryPressureLevel {
    Normal,
    Moderate,
    High,
    Critical,
    Unknown,
}

/// Memory information from Windows.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub level: MemoryPressureLevel,
    pub pressure_percent: u8,
    pub total_physical_bytes: u64,
    pub available_physical_bytes: u64,
    pub used_physical_bytes: u64,
    pub commit_total_bytes: u64,
    pub commit_limit_bytes: u64,
    pub pagefile_usage_bytes: u64,
    pub recommendation: MemoryRecommendation,
}

/// Memory recommendations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryRecommendation {
    Healthy,
    CloseBackgroundApps,
    CloseHeavyApps,
    IncreasePagefile,
    SystemRestart,
}

/// Get current memory information.
pub fn get_memory_info() -> MemoryInfo {
    let mem_stats = get_memory_stats();

    let used = mem_stats.total_physical.saturating_sub(mem_stats.available_physical);
    let pressure_percent = if mem_stats.total_physical > 0 {
        ((used as f64 / mem_stats.total_physical as f64) * 100.0) as u8
    } else {
        0
    };

    let level = match pressure_percent {
        0..=60 => MemoryPressureLevel::Normal,
        61..=75 => MemoryPressureLevel::Moderate,
        76..=90 => MemoryPressureLevel::High,
        _ => MemoryPressureLevel::Critical,
    };

    let recommendation = determine_memory_recommendation(&level, &mem_stats);

    MemoryInfo {
        level,
        pressure_percent,
        total_physical_bytes: mem_stats.total_physical,
        available_physical_bytes: mem_stats.available_physical,
        used_physical_bytes: used,
        commit_total_bytes: mem_stats.commit_total,
        commit_limit_bytes: mem_stats.commit_limit,
        pagefile_usage_bytes: mem_stats.pagefile_usage,
        recommendation,
    }
}

#[derive(Debug, Default)]
struct MemoryStats {
    total_physical: u64,
    available_physical: u64,
    commit_total: u64,
    commit_limit: u64,
    pagefile_usage: u64,
}

fn get_memory_stats() -> MemoryStats {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $os = Get-CimInstance Win32_OperatingSystem
            $pf = Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue
            $pfUsage = if ($pf) { ($pf | Measure-Object -Property CurrentUsage -Sum).Sum * 1MB } else { 0 }
            @{
                TotalPhysical = $os.TotalVisibleMemorySize * 1KB
                AvailablePhysical = $os.FreePhysicalMemory * 1KB
                CommitTotal = ($os.TotalVirtualMemorySize - $os.TotalVisibleMemorySize) * 1KB
                CommitLimit = $os.TotalVirtualMemorySize * 1KB
                PagefileUsage = $pfUsage
            } | ConvertTo-Json
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_memory_json(&stdout)
        }
        _ => MemoryStats::default(),
    }
}

fn parse_memory_json(json: &str) -> MemoryStats {
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct MemJson {
        total_physical: Option<u64>,
        available_physical: Option<u64>,
        commit_total: Option<u64>,
        commit_limit: Option<u64>,
        pagefile_usage: Option<u64>,
    }

    match serde_json::from_str::<MemJson>(json) {
        Ok(m) => MemoryStats {
            total_physical: m.total_physical.unwrap_or(0),
            available_physical: m.available_physical.unwrap_or(0),
            commit_total: m.commit_total.unwrap_or(0),
            commit_limit: m.commit_limit.unwrap_or(0),
            pagefile_usage: m.pagefile_usage.unwrap_or(0),
        },
        Err(_) => MemoryStats::default(),
    }
}

fn determine_memory_recommendation(level: &MemoryPressureLevel, stats: &MemoryStats) -> MemoryRecommendation {
    match level {
        MemoryPressureLevel::Normal => MemoryRecommendation::Healthy,
        MemoryPressureLevel::Moderate => MemoryRecommendation::CloseBackgroundApps,
        MemoryPressureLevel::High => {
            // Check if pagefile is heavily used
            if stats.pagefile_usage > 2 * 1024 * 1024 * 1024 {
                MemoryRecommendation::IncreasePagefile
            } else {
                MemoryRecommendation::CloseHeavyApps
            }
        }
        MemoryPressureLevel::Critical => MemoryRecommendation::SystemRestart,
        MemoryPressureLevel::Unknown => MemoryRecommendation::Healthy,
    }
}

/// Optimize memory working set for a process.
pub fn optimize_process_memory(pid: u32) -> Result<bool, String> {
    // Use EmptyWorkingSet via PowerShell/WMI
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $process = Get-Process -Id {} -ErrorAction Stop
                    [System.Runtime.InteropServices.Marshal]::SetProcessWorkingSetSize($process.Handle, -1, -1)
                    $true
                }} catch {{
                    $false
                }}
                "#,
                pid
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to optimize memory: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().to_lowercase() == "true" {
        Ok(true)
    } else {
        Err("Failed to optimize process memory".to_string())
    }
}

// -----------------------------------------------------------------------------
// Process Priority Management
// -----------------------------------------------------------------------------

/// Windows process priority classes.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProcessPriority {
    Realtime,
    High,
    AboveNormal,
    Normal,
    BelowNormal,
    Idle,
}

impl ProcessPriority {
    /// Get Windows priority class string for PowerShell.
    pub fn to_priority_class(&self) -> &'static str {
        match self {
            ProcessPriority::Realtime => "RealTime",
            ProcessPriority::High => "High",
            ProcessPriority::AboveNormal => "AboveNormal",
            ProcessPriority::Normal => "Normal",
            ProcessPriority::BelowNormal => "BelowNormal",
            ProcessPriority::Idle => "Idle",
        }
    }

    /// Convert from Windows priority class value.
    pub fn from_priority_value(value: i32) -> Self {
        match value {
            256 => ProcessPriority::Realtime,
            128 => ProcessPriority::High,
            32768 => ProcessPriority::AboveNormal,
            32 => ProcessPriority::Normal,
            16384 => ProcessPriority::BelowNormal,
            64 => ProcessPriority::Idle,
            _ => ProcessPriority::Normal,
        }
    }
}

/// Process priority information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessPriorityInfo {
    pub pid: u32,
    pub priority: ProcessPriority,
    pub priority_class: String,
    pub base_priority: i32,
    pub can_prioritize: bool,
}

/// Get current priority for a process.
pub fn get_process_priority(pid: u32) -> Result<ProcessPriorityInfo, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $p = Get-Process -Id {} -ErrorAction Stop
                    @{{
                        PriorityClass = $p.PriorityClass.ToString()
                        BasePriority = $p.BasePriority
                    }} | ConvertTo-Json
                }} catch {{
                    Write-Error $_.Exception.Message
                    exit 1
                }}
                "#,
                pid
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to get process priority: {}", e))?;

    if !output.status.success() {
        return Err(format!("Process {} not found", pid));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct PriorityJson {
        priority_class: Option<String>,
        base_priority: Option<i32>,
    }

    let parsed: PriorityJson = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse priority info: {}", e))?;

    let priority_class = parsed.priority_class.unwrap_or_else(|| "Normal".to_string());
    let base_priority = parsed.base_priority.unwrap_or(8);

    let priority = match priority_class.to_lowercase().as_str() {
        "realtime" => ProcessPriority::Realtime,
        "high" => ProcessPriority::High,
        "abovenormal" => ProcessPriority::AboveNormal,
        "normal" => ProcessPriority::Normal,
        "belownormal" => ProcessPriority::BelowNormal,
        "idle" => ProcessPriority::Idle,
        _ => ProcessPriority::Normal,
    };

    Ok(ProcessPriorityInfo {
        pid,
        priority,
        priority_class,
        base_priority,
        can_prioritize: check_can_prioritize(pid),
    })
}

fn check_can_prioritize(pid: u32) -> bool {
    // Check if we can set priority (usually requires admin for Realtime)
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $p = Get-Process -Id {} -ErrorAction Stop
                    $p.PriorityClass = $p.PriorityClass
                    $true
                }} catch {{
                    $false
                }}
                "#,
                pid
            ),
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => false,
    }
}

/// Set process priority.
pub fn set_process_priority(pid: u32, priority: ProcessPriority) -> Result<bool, String> {
    let priority_class = priority.to_priority_class();

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $p = Get-Process -Id {} -ErrorAction Stop
                    $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::{}
                    $true
                }} catch {{
                    Write-Error $_.Exception.Message
                    $false
                }}
                "#,
                pid, priority_class
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to set priority: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().to_lowercase() == "true" {
        Ok(true)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Access") || stderr.contains("denied") {
            Err(format!(
                "Access denied. Setting priority to {:?} may require administrator privileges.",
                priority
            ))
        } else {
            Err(format!("Failed to set priority: {}", stderr))
        }
    }
}

// -----------------------------------------------------------------------------
// CPU Affinity Management
// -----------------------------------------------------------------------------

/// CPU configuration information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuConfiguration {
    pub physical_cores: u32,
    pub logical_processors: u32,
    pub architecture: Architecture,
    pub processor_name: String,
    pub has_performance_cores: bool,
    pub has_efficiency_cores: bool,
}

/// Get CPU configuration.
pub fn get_cpu_configuration() -> CpuConfiguration {
    let (physical, logical, name) = get_cpu_info();
    let (has_p_cores, has_e_cores) = detect_hybrid_architecture(&name);

    CpuConfiguration {
        physical_cores: physical,
        logical_processors: logical,
        architecture: Architecture::current(),
        processor_name: name,
        has_performance_cores: has_p_cores,
        has_efficiency_cores: has_e_cores,
    }
}

fn get_cpu_info() -> (u32, u32, String) {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
            @{
                PhysicalCores = $cpu.NumberOfCores
                LogicalProcessors = $cpu.NumberOfLogicalProcessors
                Name = $cpu.Name
            } | ConvertTo-Json
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_cpu_json(&stdout)
        }
        _ => (0, 0, "Unknown".to_string()),
    }
}

fn parse_cpu_json(json: &str) -> (u32, u32, String) {
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct CpuJson {
        physical_cores: Option<u32>,
        logical_processors: Option<u32>,
        name: Option<String>,
    }

    match serde_json::from_str::<CpuJson>(json) {
        Ok(c) => (
            c.physical_cores.unwrap_or(0),
            c.logical_processors.unwrap_or(0),
            c.name.unwrap_or_else(|| "Unknown".to_string()),
        ),
        Err(_) => (0, 0, "Unknown".to_string()),
    }
}

fn detect_hybrid_architecture(processor_name: &str) -> (bool, bool) {
    let lower = processor_name.to_lowercase();

    // Intel 12th gen+ has P and E cores (Alder Lake, Raptor Lake, etc.)
    if lower.contains("12th gen") || lower.contains("13th gen") ||
       lower.contains("14th gen") || lower.contains("core ultra") {
        return (true, true);
    }

    // AMD Zen 4 Phoenix has hybrid cores
    if lower.contains("7x40") || lower.contains("8x40") {
        return (true, true);
    }

    // Standard symmetric architecture
    (true, false)
}

/// CPU affinity information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuAffinityInfo {
    pub pid: u32,
    pub affinity_mask: u64,
    pub active_cores: Vec<u32>,
}

/// Get CPU affinity for a process.
pub fn get_process_affinity(pid: u32) -> Result<CpuAffinityInfo, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $p = Get-Process -Id {} -ErrorAction Stop
                    $p.ProcessorAffinity.ToInt64()
                }} catch {{
                    Write-Error $_.Exception.Message
                    -1
                }}
                "#,
                pid
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to get affinity: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mask: i64 = stdout.trim().parse().unwrap_or(-1);

    if mask < 0 {
        return Err(format!("Failed to get affinity for process {}", pid));
    }

    let mask = mask as u64;
    let active_cores = (0..64)
        .filter(|i| (mask >> i) & 1 == 1)
        .collect();

    Ok(CpuAffinityInfo {
        pid,
        affinity_mask: mask,
        active_cores,
    })
}

/// Set CPU affinity for a process.
pub fn set_process_affinity(pid: u32, affinity_mask: u64) -> Result<bool, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                try {{
                    $p = Get-Process -Id {} -ErrorAction Stop
                    $p.ProcessorAffinity = [IntPtr]{}
                    $true
                }} catch {{
                    Write-Error $_.Exception.Message
                    $false
                }}
                "#,
                pid, affinity_mask
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to set affinity: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().to_lowercase() == "true" {
        Ok(true)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to set affinity: {}", stderr))
    }
}

// -----------------------------------------------------------------------------
// GPU DirectX/Vulkan Performance State
// -----------------------------------------------------------------------------

/// GPU vendor identification.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Unknown,
}

/// GPU performance levels.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuPerformanceLevel {
    Maximum,
    Balanced,
    PowerSaver,
    Auto,
    Unknown,
}

/// GPU performance state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuPerformanceState {
    pub name: String,
    pub vendor: GpuVendor,
    pub driver_version: String,
    pub vram_bytes: Option<u64>,
    pub directx_version: String,
    pub vulkan_supported: bool,
    pub performance_level: GpuPerformanceLevel,
    pub has_discrete_gpu: bool,
    pub recommendation: GpuRecommendation,
}

/// GPU recommendations for gaming.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuRecommendation {
    Optimal,
    UpdateDrivers,
    UseDiscreteGpu,
    EnableHighPerformance,
    IntegratedOnly,
}

/// Get GPU performance state.
pub fn get_gpu_performance_state() -> GpuPerformanceState {
    let gpu_info = get_gpu_info_internal();
    let has_discrete = check_discrete_gpu();
    let performance_level = detect_gpu_performance_level();

    let recommendation = if gpu_info.vendor == GpuVendor::Intel && has_discrete {
        GpuRecommendation::UseDiscreteGpu
    } else if performance_level == GpuPerformanceLevel::PowerSaver {
        GpuRecommendation::EnableHighPerformance
    } else if !has_discrete && gpu_info.vendor == GpuVendor::Intel {
        GpuRecommendation::IntegratedOnly
    } else {
        GpuRecommendation::Optimal
    };

    GpuPerformanceState {
        name: gpu_info.name,
        vendor: gpu_info.vendor,
        driver_version: gpu_info.driver_version,
        vram_bytes: gpu_info.vram,
        directx_version: detect_directx_version(),
        vulkan_supported: check_vulkan_support(),
        performance_level,
        has_discrete_gpu: has_discrete,
        recommendation,
    }
}

#[derive(Debug, Default)]
struct GpuInfo {
    name: String,
    vendor: GpuVendor,
    driver_version: String,
    vram: Option<u64>,
}

impl Default for GpuVendor {
    fn default() -> Self {
        GpuVendor::Unknown
    }
}

fn get_gpu_info_internal() -> GpuInfo {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1
            if (-not $gpu) { $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1 }
            @{
                Name = $gpu.Name
                DriverVersion = $gpu.DriverVersion
                AdapterRAM = $gpu.AdapterRAM
            } | ConvertTo-Json
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_gpu_json(&stdout)
        }
        _ => GpuInfo::default(),
    }
}

fn parse_gpu_json(json: &str) -> GpuInfo {
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct GpuJson {
        name: Option<String>,
        driver_version: Option<String>,
        adapter_r_a_m: Option<u64>,
    }

    match serde_json::from_str::<GpuJson>(json) {
        Ok(g) => {
            let name = g.name.unwrap_or_else(|| "Unknown GPU".to_string());
            let vendor = detect_gpu_vendor(&name);
            GpuInfo {
                name,
                vendor,
                driver_version: g.driver_version.unwrap_or_else(|| "Unknown".to_string()),
                vram: g.adapter_r_a_m,
            }
        }
        Err(_) => GpuInfo::default(),
    }
}

fn detect_gpu_vendor(name: &str) -> GpuVendor {
    let lower = name.to_lowercase();
    if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("rtx") || lower.contains("gtx") {
        GpuVendor::Nvidia
    } else if lower.contains("amd") || lower.contains("radeon") || lower.contains("rx ") {
        GpuVendor::Amd
    } else if lower.contains("intel") || lower.contains("iris") || lower.contains("uhd") || lower.contains("hd graphics") {
        GpuVendor::Intel
    } else {
        GpuVendor::Unknown
    }
}

fn check_discrete_gpu() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $gpus = Get-CimInstance Win32_VideoController
            ($gpus | Where-Object { $_.AdapterRAM -gt 1GB }).Count -gt 0
            "#,
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => false,
    }
}

fn detect_gpu_performance_level() -> GpuPerformanceLevel {
    // Check current power plan for GPU hints
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $scheme = powercfg /getactivescheme
            if ($scheme -match 'High performance') { 'Maximum' }
            elseif ($scheme -match 'Balanced') { 'Balanced' }
            elseif ($scheme -match 'Power saver') { 'PowerSaver' }
            else { 'Auto' }
            "#,
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            match stdout.as_str() {
                "Maximum" => GpuPerformanceLevel::Maximum,
                "Balanced" => GpuPerformanceLevel::Balanced,
                "PowerSaver" => GpuPerformanceLevel::PowerSaver,
                _ => GpuPerformanceLevel::Auto,
            }
        }
        Err(_) => GpuPerformanceLevel::Unknown,
    }
}

fn detect_directx_version() -> String {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $dxdiag = dxdiag /t $env:TEMP\dxdiag.txt
            Start-Sleep -Seconds 2
            $content = Get-Content $env:TEMP\dxdiag.txt -Raw
            if ($content -match 'DirectX Version:\s*(.+)') { $Matches[1].Trim() }
            else { 'DirectX 12' }
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "DirectX 12".to_string(),
    }
}

fn check_vulkan_support() -> bool {
    // Check for vulkan-1.dll
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Test-Path $env:SystemRoot\\System32\\vulkan-1.dll",
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => false,
    }
}

// -----------------------------------------------------------------------------
// Power Plan Management
// -----------------------------------------------------------------------------

/// Power plan types.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PowerPlan {
    HighPerformance,
    Balanced,
    PowerSaver,
    UltimatePerformance,
    Custom,
    Unknown,
}

/// Power source type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PowerSource {
    Ac,
    Battery,
    Unknown,
}

/// Power plan configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlanConfig {
    pub active_plan: PowerPlan,
    pub active_plan_name: String,
    pub power_source: PowerSource,
    pub battery_percent: Option<u8>,
    pub is_charging: bool,
    pub available_plans: Vec<String>,
    pub recommendation: PowerRecommendation,
}

/// Power recommendations for gaming.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PowerRecommendation {
    Optimal,
    SwitchToHighPerformance,
    PlugIn,
    LowBattery,
}

/// Get current power plan configuration.
pub fn get_power_config() -> PowerPlanConfig {
    let (active_plan, plan_name) = get_active_power_plan();
    let (power_source, battery_percent, is_charging) = get_power_status();
    let available_plans = get_available_power_plans();

    let recommendation = determine_power_recommendation(&active_plan, &power_source, battery_percent);

    PowerPlanConfig {
        active_plan,
        active_plan_name: plan_name,
        power_source,
        battery_percent,
        is_charging,
        available_plans,
        recommendation,
    }
}

fn get_active_power_plan() -> (PowerPlan, String) {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $scheme = powercfg /getactivescheme
            if ($scheme -match '([0-9a-f-]+)\s+\((.+)\)') {
                $Matches[2]
            } else {
                'Unknown'
            }
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let plan = match name.to_lowercase().as_str() {
                n if n.contains("high performance") => PowerPlan::HighPerformance,
                n if n.contains("balanced") => PowerPlan::Balanced,
                n if n.contains("power saver") => PowerPlan::PowerSaver,
                n if n.contains("ultimate") => PowerPlan::UltimatePerformance,
                _ => PowerPlan::Custom,
            };
            (plan, name)
        }
        _ => (PowerPlan::Unknown, "Unknown".to_string()),
    }
}

fn get_power_status() -> (PowerSource, Option<u8>, bool) {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $battery = Get-CimInstance Win32_Battery
            $ps = (Get-CimInstance Win32_ComputerSystem).PCSystemType
            if ($battery) {
                @{
                    Source = if ($battery.BatteryStatus -eq 2) { 'AC' } else { 'Battery' }
                    Percent = $battery.EstimatedChargeRemaining
                    Charging = $battery.BatteryStatus -eq 2
                }
            } else {
                @{
                    Source = 'AC'
                    Percent = $null
                    Charging = $false
                }
            } | ConvertTo-Json
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_power_json(&stdout)
        }
        _ => (PowerSource::Unknown, None, false),
    }
}

fn parse_power_json(json: &str) -> (PowerSource, Option<u8>, bool) {
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct PowerJson {
        source: Option<String>,
        percent: Option<u8>,
        charging: Option<bool>,
    }

    match serde_json::from_str::<PowerJson>(json) {
        Ok(p) => {
            let source = match p.source.as_deref() {
                Some("AC") => PowerSource::Ac,
                Some("Battery") => PowerSource::Battery,
                _ => PowerSource::Unknown,
            };
            (source, p.percent, p.charging.unwrap_or(false))
        }
        Err(_) => (PowerSource::Unknown, None, false),
    }
}

fn get_available_power_plans() -> Vec<String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            powercfg /list | ForEach-Object {
                if ($_ -match '\((.+)\)') { $Matches[1] }
            }
            "#,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
        }
        _ => vec![],
    }
}

fn determine_power_recommendation(
    plan: &PowerPlan,
    source: &PowerSource,
    battery_percent: Option<u8>,
) -> PowerRecommendation {
    // Check for low battery first
    if let Some(pct) = battery_percent {
        if pct < 20 {
            return PowerRecommendation::LowBattery;
        }
    }

    // Check power source
    if *source == PowerSource::Battery {
        return PowerRecommendation::PlugIn;
    }

    // Check power plan
    match plan {
        PowerPlan::HighPerformance | PowerPlan::UltimatePerformance => PowerRecommendation::Optimal,
        _ => PowerRecommendation::SwitchToHighPerformance,
    }
}

/// Switch to a specific power plan for gaming.
pub fn switch_power_plan(plan: PowerPlan) -> Result<PowerPlanConfig, String> {
    let guid = match plan {
        PowerPlan::HighPerformance => "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
        PowerPlan::Balanced => "381b4222-f694-41f0-9685-ff5bb260df2e",
        PowerPlan::PowerSaver => "a1841308-3541-4fab-bc81-f71556f20b4a",
        PowerPlan::UltimatePerformance => "e9a42b02-d5df-448d-aa00-03f14749eb61",
        _ => return Err("Cannot switch to custom/unknown plan".to_string()),
    };

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("powercfg /setactive {}", guid),
        ])
        .output()
        .map_err(|e| format!("Failed to switch power plan: {}", e))?;

    if output.status.success() {
        Ok(get_power_config())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to switch power plan: {}", stderr))
    }
}

// -----------------------------------------------------------------------------
// Windows Game Mode Integration
// -----------------------------------------------------------------------------

/// Game Mode status.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameModeStatus {
    pub enabled: bool,
    pub game_bar_enabled: bool,
    pub game_dvr_enabled: bool,
    pub recommendation: GameModeRecommendation,
}

/// Game Mode recommendations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GameModeRecommendation {
    Optimal,
    EnableGameMode,
    DisableGameDvr,
    DisableGameBar,
}

/// Get Windows Game Mode status.
pub fn get_game_mode_status() -> GameModeStatus {
    let game_mode = check_game_mode_enabled();
    let game_bar = check_game_bar_enabled();
    let game_dvr = check_game_dvr_enabled();

    let recommendation = if !game_mode {
        GameModeRecommendation::EnableGameMode
    } else if game_dvr {
        GameModeRecommendation::DisableGameDvr
    } else if game_bar {
        GameModeRecommendation::DisableGameBar
    } else {
        GameModeRecommendation::Optimal
    };

    GameModeStatus {
        enabled: game_mode,
        game_bar_enabled: game_bar,
        game_dvr_enabled: game_dvr,
        recommendation,
    }
}

fn check_game_mode_enabled() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            try {
                $val = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -ErrorAction Stop
                $val.AutoGameModeEnabled -eq 1
            } catch {
                $true  # Default is enabled on modern Windows
            }
            "#,
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => true, // Assume enabled by default
    }
}

fn check_game_bar_enabled() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            try {
                $val = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -ErrorAction Stop
                $val.AppCaptureEnabled -eq 1
            } catch {
                $false
            }
            "#,
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => false,
    }
}

fn check_game_dvr_enabled() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            try {
                $val = Get-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -ErrorAction Stop
                $val.GameDVR_Enabled -eq 1
            } catch {
                $false
            }
            "#,
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.trim().to_lowercase() == "true"
        }
        Err(_) => false,
    }
}

/// Configure gaming mode (enable high performance settings).
pub fn configure_gaming_mode(enable: bool) -> Result<WindowsOptimizationStatus, String> {
    if enable {
        // Switch to high performance power plan
        let _ = switch_power_plan(PowerPlan::HighPerformance);

        // Disable unnecessary background services via PowerShell
        // Note: This is non-destructive and temporary
        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                # Temporarily reduce background activity
                Stop-Service -Name 'SysMain' -Force -ErrorAction SilentlyContinue
                Stop-Service -Name 'DiagTrack' -Force -ErrorAction SilentlyContinue
                "#,
            ])
            .output();
    } else {
        // Restore balanced power plan
        let _ = switch_power_plan(PowerPlan::Balanced);

        // Restart services
        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                Start-Service -Name 'SysMain' -ErrorAction SilentlyContinue
                Start-Service -Name 'DiagTrack' -ErrorAction SilentlyContinue
                "#,
            ])
            .output();
    }

    Ok(get_optimization_status())
}

// -----------------------------------------------------------------------------
// Combined Optimization Status
// -----------------------------------------------------------------------------

/// Get comprehensive Windows optimization status.
pub fn get_optimization_status() -> WindowsOptimizationStatus {
    WindowsOptimizationStatus {
        memory: get_memory_info(),
        gpu: get_gpu_performance_state(),
        power: get_power_config(),
        game_mode: get_game_mode_status(),
        cpu_config: get_cpu_configuration(),
    }
}

// -----------------------------------------------------------------------------
// Tauri Commands
// -----------------------------------------------------------------------------

/// Tauri command to get Windows optimization status.
#[tauri::command]
pub fn windows_get_optimization_status() -> Result<WindowsOptimizationStatus, String> {
    Ok(get_optimization_status())
}

/// Tauri command to set process priority.
#[tauri::command]
pub fn windows_set_process_priority(pid: u32, priority: ProcessPriority) -> Result<bool, String> {
    set_process_priority(pid, priority)
}

/// Tauri command to get memory info.
#[tauri::command]
pub fn windows_get_memory_info() -> Result<MemoryInfo, String> {
    Ok(get_memory_info())
}

/// Tauri command to optimize process memory.
#[tauri::command]
pub fn windows_optimize_process_memory(pid: u32) -> Result<bool, String> {
    optimize_process_memory(pid)
}

/// Tauri command to get GPU performance state.
#[tauri::command]
pub fn windows_get_gpu_state() -> Result<GpuPerformanceState, String> {
    Ok(get_gpu_performance_state())
}

/// Tauri command to get power configuration.
#[tauri::command]
pub fn windows_get_power_config() -> Result<PowerPlanConfig, String> {
    Ok(get_power_config())
}

/// Tauri command to switch power plan.
#[tauri::command]
pub fn windows_switch_power_plan(plan: PowerPlan) -> Result<PowerPlanConfig, String> {
    switch_power_plan(plan)
}

/// Tauri command to get game mode status.
#[tauri::command]
pub fn windows_get_game_mode_status() -> Result<GameModeStatus, String> {
    Ok(get_game_mode_status())
}

/// Tauri command to configure gaming mode.
#[tauri::command]
pub fn windows_configure_gaming_mode(enable: bool) -> Result<WindowsOptimizationStatus, String> {
    configure_gaming_mode(enable)
}

/// Tauri command to set CPU affinity.
#[tauri::command]
pub fn windows_set_process_affinity(pid: u32, affinity_mask: u64) -> Result<bool, String> {
    set_process_affinity(pid, affinity_mask)
}

// =============================================================================
// Existing Features (unchanged)
// =============================================================================

/// Check if running on Windows 11.
pub fn is_windows_11() -> bool {
    let build = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').CurrentBuild",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(0);

    build >= 22000
}

/// Set up Jump List for taskbar right-click menu.
#[allow(dead_code)]
pub fn setup_jump_list() {
    // TODO: Implement using windows-rs crate
    // ICustomDestinationList for recent games and quick actions
}

/// Set taskbar progress indicator.
#[allow(dead_code)]
pub fn set_taskbar_progress(progress: f32, state: TaskbarProgressState) {
    // TODO: Implement using windows-rs crate
    // ITaskbarList3::SetProgressValue and SetProgressState
    let _ = (progress, state);
}

/// Taskbar progress states.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy)]
pub enum TaskbarProgressState {
    NoProgress,
    Indeterminate,
    Normal,
    Error,
    Paused,
}

/// Set up system tray icon and menu.
#[allow(dead_code)]
pub fn setup_system_tray() {
    // TODO: Implement using windows-rs crate
    // Shell_NotifyIcon for tray icon
    // Create context menu for right-click
}

/// Send Windows Toast notification.
#[allow(dead_code)]
pub fn send_toast_notification(title: &str, body: &str) {
    // TODO: Implement using windows-rs crate
    // ToastNotificationManager
    let _ = (title, body);
}

/// Register app in startup (Run registry key).
#[allow(dead_code)]
pub fn register_startup(enable: bool) {
    // TODO: Implement using windows-rs crate
    // HKCU\Software\Microsoft\Windows\CurrentVersion\Run
    let _ = enable;
}

/// Check if WebView2 runtime is available.
#[allow(dead_code)]
pub fn check_webview2_available() -> bool {
    // Check if WebView2 runtime is installed
    // Tauri handles this automatically with embedded bootstrapper
    true
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_priority_conversion() {
        assert_eq!(ProcessPriority::High.to_priority_class(), "High");
        assert_eq!(ProcessPriority::Normal.to_priority_class(), "Normal");
        assert_eq!(ProcessPriority::Idle.to_priority_class(), "Idle");
    }

    #[test]
    fn test_gpu_vendor_detection() {
        assert_eq!(detect_gpu_vendor("NVIDIA GeForce RTX 4090"), GpuVendor::Nvidia);
        assert_eq!(detect_gpu_vendor("AMD Radeon RX 7900 XTX"), GpuVendor::Amd);
        assert_eq!(detect_gpu_vendor("Intel UHD Graphics 770"), GpuVendor::Intel);
        assert_eq!(detect_gpu_vendor("Unknown GPU"), GpuVendor::Unknown);
    }

    #[test]
    fn test_windows_version_name() {
        assert_eq!(get_windows_version_name(22621), "11");
        assert_eq!(get_windows_version_name(22000), "11");
        assert_eq!(get_windows_version_name(19045), "10");
        assert_eq!(get_windows_version_name(19041), "10");
        assert_eq!(get_windows_version_name(10240), "10 (Legacy)");
    }

    #[test]
    fn test_hybrid_architecture_detection() {
        let (p, e) = detect_hybrid_architecture("12th Gen Intel Core i9-12900K");
        assert!(p && e);

        let (p, e) = detect_hybrid_architecture("AMD Ryzen 9 7950X");
        assert!(p && !e);
    }

    #[test]
    fn test_power_recommendation() {
        assert_eq!(
            determine_power_recommendation(&PowerPlan::HighPerformance, &PowerSource::Ac, Some(100)),
            PowerRecommendation::Optimal
        );

        assert_eq!(
            determine_power_recommendation(&PowerPlan::Balanced, &PowerSource::Ac, Some(100)),
            PowerRecommendation::SwitchToHighPerformance
        );

        assert_eq!(
            determine_power_recommendation(&PowerPlan::HighPerformance, &PowerSource::Battery, Some(50)),
            PowerRecommendation::PlugIn
        );

        assert_eq!(
            determine_power_recommendation(&PowerPlan::HighPerformance, &PowerSource::Battery, Some(15)),
            PowerRecommendation::LowBattery
        );
    }

    #[test]
    fn test_memory_recommendation() {
        let healthy_stats = MemoryStats {
            total_physical: 32 * 1024 * 1024 * 1024,
            available_physical: 20 * 1024 * 1024 * 1024,
            pagefile_usage: 0,
            ..Default::default()
        };
        assert_eq!(
            determine_memory_recommendation(&MemoryPressureLevel::Normal, &healthy_stats),
            MemoryRecommendation::Healthy
        );

        let high_pagefile_stats = MemoryStats {
            pagefile_usage: 4 * 1024 * 1024 * 1024,
            ..Default::default()
        };
        assert_eq!(
            determine_memory_recommendation(&MemoryPressureLevel::High, &high_pagefile_stats),
            MemoryRecommendation::IncreasePagefile
        );
    }
}
