//! Process management types
//!
//! Types for representing running processes and their resource usage.

use serde::{Deserialize, Serialize};

/// Process information with resource usage and categorization.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessInfo {
    /// Process ID
    pub pid: u32,
    /// Process name
    pub name: String,
    /// CPU usage percentage (0-100)
    pub cpu_percent: f32,
    /// Memory usage percentage (0-100)
    pub memory_percent: f32,
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Process status
    pub status: ProcessStatus,
    /// Category for optimization purposes
    pub category: ProcessCategory,
    /// Username running the process (may be null)
    pub username: Option<String>,
    /// Parent process ID
    pub parent_pid: Option<u32>,
    /// Path to executable
    pub executable_path: Option<String>,
    /// Command line arguments
    pub command_line: Option<String>,
}

/// Process execution status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ProcessStatus {
    #[default]
    Unknown,
    Running,
    Sleeping,
    Idle,
    Stopped,
    Zombie,
}

impl std::str::FromStr for ProcessStatus {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            "running" => Self::Running,
            "sleeping" | "sleep" => Self::Sleeping,
            "idle" => Self::Idle,
            "stopped" | "stop" => Self::Stopped,
            "zombie" => Self::Zombie,
            _ => Self::Unknown,
        })
    }
}

/// Process category for optimization decisions
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ProcessCategory {
    /// Critical system process - never terminate
    System,
    /// User-facing application
    User,
    /// Background service safe to optimize
    Background,
    /// Process safe to terminate during optimization
    SafeToKill,
    #[default]
    Unknown,
}

impl std::str::FromStr for ProcessCategory {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            "system" => Self::System,
            "user" => Self::User,
            "background" => Self::Background,
            "safe-to-kill" | "safetokill" => Self::SafeToKill,
            _ => Self::Unknown,
        })
    }
}

/// Result of terminating a single process.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminateResult {
    /// Whether termination was successful
    pub success: bool,
    /// Process ID
    pub pid: u32,
    /// Process name (if available)
    pub name: Option<String>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// Memory freed in bytes (estimated)
    pub memory_freed_bytes: Option<u64>,
}

/// Result of Stealth Mode execution.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StealthModeResult {
    /// Successfully terminated processes
    pub terminated: Vec<TerminateResult>,
    /// Failed termination attempts
    pub failed: Vec<TerminateResult>,
    /// Total memory freed in bytes
    pub total_memory_freed_bytes: u64,
    /// Time taken in milliseconds
    pub duration_ms: u64,
}

/// Process list filter options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessFilter {
    /// Minimum CPU usage to include
    pub min_cpu_percent: Option<f32>,
    /// Minimum memory usage to include
    pub min_memory_percent: Option<f32>,
    /// Filter by category
    pub category: Option<ProcessCategory>,
    /// Filter by status
    pub status: Option<ProcessStatus>,
    /// Maximum number of results
    pub limit: Option<usize>,
    /// Sort order
    pub sort_by: ProcessSortOrder,
}

/// Sort order for process list
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ProcessSortOrder {
    #[default]
    CpuDescending,
    CpuAscending,
    MemoryDescending,
    MemoryAscending,
    NameAscending,
    NameDescending,
    PidAscending,
    PidDescending,
}
