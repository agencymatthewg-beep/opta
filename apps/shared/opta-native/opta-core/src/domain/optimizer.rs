//! Optimizer Logic
//!
//! Pure business logic for optimization decisions.

use opta_shared::{
    SystemTelemetry, ProcessInfo, ProcessCategory, ThermalState, MemoryPressure,
};

/// Optimizer for making optimization decisions
pub struct Optimizer {
    /// Configuration
    config: OptimizerConfig,
}

/// Optimizer configuration
#[derive(Debug, Clone)]
pub struct OptimizerConfig {
    /// CPU usage threshold for recommendations (0-100)
    pub cpu_threshold: f32,
    /// Memory usage threshold for recommendations (0-100)
    pub memory_threshold: f32,
    /// Thermal state threshold for action
    pub thermal_threshold: ThermalState,
    /// Minimum process CPU to consider for optimization
    pub min_process_cpu: f32,
}

impl Default for OptimizerConfig {
    fn default() -> Self {
        Self {
            cpu_threshold: 80.0,
            memory_threshold: 85.0,
            thermal_threshold: ThermalState::Serious,
            min_process_cpu: 5.0,
        }
    }
}

/// Optimization recommendation
#[derive(Debug, Clone)]
pub struct OptimizationRecommendation {
    /// Processes recommended for termination
    pub terminate_processes: Vec<u32>,
    /// Recommended actions
    pub actions: Vec<OptimizationAction>,
    /// Urgency level (0.0 - 1.0)
    pub urgency: f32,
    /// Reason for recommendations
    pub reason: String,
}

/// Types of optimization actions
#[derive(Debug, Clone)]
pub enum OptimizationAction {
    /// Terminate a specific process
    TerminateProcess { pid: u32, name: String },
    /// Reduce process priority
    ReducePriority { pid: u32, name: String },
    /// Enable power saving mode
    EnablePowerSaving,
    /// Reduce visual effects
    ReduceVisualEffects,
    /// Clear system cache
    ClearCache,
    /// Custom action
    Custom { name: String, description: String },
}

impl Optimizer {
    /// Create a new optimizer with default config
    pub fn new() -> Self {
        Self {
            config: OptimizerConfig::default(),
        }
    }

    /// Create optimizer with custom config
    pub fn with_config(config: OptimizerConfig) -> Self {
        Self { config }
    }

    /// Analyze system state and return recommendations
    pub fn analyze(
        &self,
        telemetry: &SystemTelemetry,
        processes: &[ProcessInfo],
    ) -> OptimizationRecommendation {
        let mut terminate = Vec::new();
        let mut actions = Vec::new();
        let mut urgency: f32 = 0.0;
        let mut reasons = Vec::new();

        // Check CPU usage
        if telemetry.cpu.usage_percent > self.config.cpu_threshold {
            urgency = urgency.max(0.6);
            reasons.push(format!(
                "CPU usage high ({:.1}%)",
                telemetry.cpu.usage_percent
            ));

            // Find high-CPU safe-to-kill processes
            for process in processes {
                if process.cpu_percent > self.config.min_process_cpu
                    && process.category == ProcessCategory::SafeToKill
                {
                    terminate.push(process.pid);
                    actions.push(OptimizationAction::TerminateProcess {
                        pid: process.pid,
                        name: process.name.clone(),
                    });
                }
            }
        }

        // Check memory pressure
        let memory_percent = (telemetry.memory.used_bytes as f64
            / telemetry.memory.total_bytes as f64
            * 100.0) as f32;

        if memory_percent > self.config.memory_threshold {
            urgency = urgency.max(0.7);
            reasons.push(format!("Memory usage high ({:.1}%)", memory_percent));

            // Find high-memory safe-to-kill processes
            for process in processes {
                if process.memory_percent > 2.0
                    && process.category == ProcessCategory::SafeToKill
                    && !terminate.contains(&process.pid)
                {
                    terminate.push(process.pid);
                    actions.push(OptimizationAction::TerminateProcess {
                        pid: process.pid,
                        name: process.name.clone(),
                    });
                }
            }
        }

        // Check memory pressure level
        if telemetry.memory.pressure == MemoryPressure::Critical {
            urgency = urgency.max(0.9);
            reasons.push("Memory pressure critical".to_string());
            actions.push(OptimizationAction::ClearCache);
        }

        // Check thermal state - use pattern match since ThermalState doesn't impl Ord
        let thermal_severe_or_worse = matches!(
            telemetry.thermal.state,
            ThermalState::Serious | ThermalState::Critical
        );
        if thermal_severe_or_worse {
            urgency = urgency.max(0.8);
            reasons.push(format!(
                "Thermal state: {:?}",
                telemetry.thermal.state
            ));
            actions.push(OptimizationAction::EnablePowerSaving);

            if telemetry.thermal.is_throttling {
                urgency = 1.0;
                reasons.push("System is throttling".to_string());
            }
        }

        OptimizationRecommendation {
            terminate_processes: terminate,
            actions,
            urgency,
            reason: reasons.join("; "),
        }
    }

    /// Check if optimization is recommended
    pub fn should_optimize(&self, telemetry: &SystemTelemetry) -> bool {
        let thermal_needs_action = matches!(
            telemetry.thermal.state,
            ThermalState::Serious | ThermalState::Critical
        );
        telemetry.cpu.usage_percent > self.config.cpu_threshold
            || telemetry.memory.pressure != MemoryPressure::Normal
            || thermal_needs_action
    }

    /// Get urgency level based on system state (0.0 - 1.0)
    pub fn get_urgency(&self, telemetry: &SystemTelemetry) -> f32 {
        let mut urgency: f32 = 0.0;

        // CPU contribution
        if telemetry.cpu.usage_percent > self.config.cpu_threshold {
            urgency += (telemetry.cpu.usage_percent - self.config.cpu_threshold) / 20.0;
        }

        // Memory contribution
        let memory_percent = (telemetry.memory.used_bytes as f64
            / telemetry.memory.total_bytes as f64
            * 100.0) as f32;
        if memory_percent > self.config.memory_threshold {
            urgency += (memory_percent - self.config.memory_threshold) / 15.0;
        }

        // Memory pressure contribution
        urgency += match telemetry.memory.pressure {
            MemoryPressure::Normal => 0.0,
            MemoryPressure::Warning => 0.2,
            MemoryPressure::Critical => 0.5,
        };

        // Thermal contribution
        urgency += match telemetry.thermal.state {
            ThermalState::Nominal => 0.0,
            ThermalState::Fair => 0.1,
            ThermalState::Serious => 0.3,
            ThermalState::Critical => 0.5,
        };

        urgency.clamp(0.0, 1.0)
    }
}

impl Default for Optimizer {
    fn default() -> Self {
        Self::new()
    }
}
