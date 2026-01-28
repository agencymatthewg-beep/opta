//! Optimization Capability
//!
//! Defines the interface for optimization operations.
//! Part of Crux State Management - Plan 65-01.

use serde::{Deserialize, Serialize};
use opta_shared::OptaResult;

/// Optimization operation types for the shell to execute
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OptimizationOp {
    /// Run optimization with specified profile
    Run(OptimizationProfile),
    /// Cancel any running optimization
    Cancel,
    /// Get current optimization status
    Status,
}

/// Optimization profile types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum OptimizationProfile {
    /// Quick optimization - minimal impact, fast
    Quick,
    /// Standard optimization (default)
    #[default]
    Standard,
    /// Deep optimization - thorough, may take longer
    Deep,
    /// Game-specific optimization
    Gaming,
    /// Productivity-focused optimization
    Productivity,
    /// Battery/power efficiency optimization
    PowerSave,
    /// Maximum performance optimization
    Performance,
    /// Custom profile with specific settings
    Custom,
}

impl OptimizationProfile {
    /// Get estimated duration in seconds
    pub fn estimated_duration_secs(&self) -> u32 {
        match self {
            OptimizationProfile::Quick => 5,
            OptimizationProfile::Standard => 15,
            OptimizationProfile::Deep => 45,
            OptimizationProfile::Gaming => 20,
            OptimizationProfile::Productivity => 15,
            OptimizationProfile::PowerSave => 10,
            OptimizationProfile::Performance => 25,
            OptimizationProfile::Custom => 30,
        }
    }

    /// Get the aggressiveness level (1-10)
    pub fn aggressiveness(&self) -> u8 {
        match self {
            OptimizationProfile::Quick => 3,
            OptimizationProfile::Standard => 5,
            OptimizationProfile::Deep => 8,
            OptimizationProfile::Gaming => 7,
            OptimizationProfile::Productivity => 4,
            OptimizationProfile::PowerSave => 6,
            OptimizationProfile::Performance => 9,
            OptimizationProfile::Custom => 5,
        }
    }
}

/// Optimization target categories
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OptimizationTarget {
    /// CPU optimization
    Cpu,
    /// Memory optimization
    Memory,
    /// GPU optimization
    Gpu,
    /// Disk/Storage optimization
    Storage,
    /// Network optimization
    Network,
    /// Process management
    Processes,
    /// System services
    Services,
    /// All targets
    All,
}

/// Optimization status
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum OptimizationStatus {
    /// No optimization running
    #[default]
    Idle,
    /// Optimization in progress
    Running {
        /// Current progress (0.0 - 1.0)
        progress: u8,
        /// Current operation description
        operation: String,
    },
    /// Optimization completed successfully
    Completed {
        /// Summary of improvements
        summary: String,
    },
    /// Optimization failed
    Failed {
        /// Error message
        error: String,
    },
    /// Optimization cancelled by user
    Cancelled,
}

/// Result of an optimization operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    /// Whether the optimization succeeded
    pub success: bool,
    /// Human-readable message
    pub message: String,
    /// Time taken in milliseconds
    pub duration_ms: u64,
    /// Number of improvements made
    pub improvements_count: u32,
    /// Memory freed in bytes (if applicable)
    pub memory_freed_bytes: Option<u64>,
    /// CPU usage reduction percentage (if applicable)
    pub cpu_reduction_percent: Option<f32>,
    /// Detailed improvements list
    pub improvements: Vec<OptimizationImprovement>,
}

/// Individual optimization improvement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationImprovement {
    /// Target that was optimized
    pub target: OptimizationTarget,
    /// Description of the improvement
    pub description: String,
    /// Impact level (1-10)
    pub impact: u8,
    /// Whether this change is reversible
    pub reversible: bool,
}

/// Capability trait for optimization operations
pub trait OptimizationCapability {
    /// Run optimization with the specified profile
    fn run(&self, profile: OptimizationProfile) -> OptaResult<OptimizationResult>;

    /// Cancel any running optimization
    fn cancel(&self) -> OptaResult<()>;

    /// Get current optimization status
    fn status(&self) -> OptimizationStatus;

    /// Check if optimization is currently running
    fn is_running(&self) -> bool {
        matches!(self.status(), OptimizationStatus::Running { .. })
    }

    /// Get available optimization profiles for this system
    fn available_profiles(&self) -> Vec<OptimizationProfile>;

    /// Preview what an optimization would do (without applying)
    fn preview(&self, profile: OptimizationProfile) -> OptaResult<Vec<OptimizationImprovement>>;
}

/// Optimization request for the shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRequest {
    /// The operation to perform
    pub op: OptimizationOp,
    /// Specific targets to optimize (empty = all)
    pub targets: Vec<OptimizationTarget>,
    /// Whether to run in preview/dry-run mode
    pub preview_only: bool,
}

impl OptimizationRequest {
    /// Create a new run request with standard profile
    pub fn run_standard() -> Self {
        Self {
            op: OptimizationOp::Run(OptimizationProfile::Standard),
            targets: vec![],
            preview_only: false,
        }
    }

    /// Create a new run request with specified profile
    pub fn run(profile: OptimizationProfile) -> Self {
        Self {
            op: OptimizationOp::Run(profile),
            targets: vec![],
            preview_only: false,
        }
    }

    /// Create a cancel request
    pub fn cancel() -> Self {
        Self {
            op: OptimizationOp::Cancel,
            targets: vec![],
            preview_only: false,
        }
    }

    /// Create a status request
    pub fn status() -> Self {
        Self {
            op: OptimizationOp::Status,
            targets: vec![],
            preview_only: false,
        }
    }

    /// Set specific targets
    pub fn with_targets(mut self, targets: Vec<OptimizationTarget>) -> Self {
        self.targets = targets;
        self
    }

    /// Set preview mode
    pub fn preview(mut self) -> Self {
        self.preview_only = true;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimization_profile_duration() {
        assert!(OptimizationProfile::Quick.estimated_duration_secs() < OptimizationProfile::Deep.estimated_duration_secs());
    }

    #[test]
    fn test_optimization_profile_aggressiveness() {
        assert!(OptimizationProfile::Quick.aggressiveness() < OptimizationProfile::Performance.aggressiveness());
    }

    #[test]
    fn test_optimization_request_builder() {
        let request = OptimizationRequest::run(OptimizationProfile::Gaming)
            .with_targets(vec![OptimizationTarget::Memory, OptimizationTarget::Processes])
            .preview();

        assert!(matches!(request.op, OptimizationOp::Run(OptimizationProfile::Gaming)));
        assert_eq!(request.targets.len(), 2);
        assert!(request.preview_only);
    }

    #[test]
    fn test_optimization_status() {
        let status = OptimizationStatus::Idle;
        assert!(matches!(status, OptimizationStatus::Idle));
    }
}
