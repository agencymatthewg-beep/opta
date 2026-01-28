//! Process Capability
//!
//! Defines the interface for process management operations.

use opta_shared::{ProcessInfo, ProcessFilter, TerminateResult, StealthModeResult, OptaResult};

/// Capability for process management
pub trait ProcessCapability {
    /// Get list of running processes
    fn get_processes(&self, filter: Option<&ProcessFilter>) -> OptaResult<Vec<ProcessInfo>>;

    /// Get info for a specific process
    fn get_process(&self, pid: u32) -> OptaResult<Option<ProcessInfo>>;

    /// Terminate a process by PID
    fn terminate(&self, pid: u32) -> OptaResult<TerminateResult>;

    /// Terminate multiple processes
    fn terminate_batch(&self, pids: &[u32]) -> OptaResult<Vec<TerminateResult>>;

    /// Execute stealth mode (terminate safe-to-kill processes)
    fn stealth_mode(&self) -> OptaResult<StealthModeResult>;

    /// Check if a process is safe to kill
    fn is_safe_to_kill(&self, pid: u32) -> OptaResult<bool>;

    /// Get process category
    fn categorize_process(&self, process: &ProcessInfo) -> opta_shared::ProcessCategory;
}

/// Process management configuration
#[derive(Debug, Clone)]
pub struct ProcessConfig {
    /// Maximum processes to return in list
    pub max_processes: usize,
    /// Grace period before force kill (ms)
    pub terminate_grace_ms: u64,
    /// Categories to include in stealth mode
    pub stealth_categories: Vec<opta_shared::ProcessCategory>,
}

impl Default for ProcessConfig {
    fn default() -> Self {
        Self {
            max_processes: 100,
            terminate_grace_ms: 5000,
            stealth_categories: vec![opta_shared::ProcessCategory::SafeToKill],
        }
    }
}
