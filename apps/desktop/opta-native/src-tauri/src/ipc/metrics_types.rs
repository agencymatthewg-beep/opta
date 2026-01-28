//! Core metric types for IPC serialization.
//!
//! These types mirror the FlatBuffers schema and provide a Rust-native
//! representation for system metrics data.

use serde::{Deserialize, Serialize};

/// Process information for top resource consumers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfoData {
    /// Process ID
    pub pid: u32,
    /// Process name
    pub name: String,
    /// CPU usage percentage (0-100)
    pub cpu_percent: f32,
    /// Memory usage in megabytes
    pub memory_mb: f32,
}

/// Momentum color states for border animation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MomentumColor {
    /// Idle state - purple glow
    Idle = 0,
    /// Active state - cyan glow
    Active = 1,
    /// Critical state - red glow
    Critical = 2,
}

impl MomentumColor {
    /// Convert from u8 value
    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => MomentumColor::Idle,
            1 => MomentumColor::Active,
            2 => MomentumColor::Critical,
            _ => MomentumColor::Idle,
        }
    }
}

/// System health state for quick categorization.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum SystemState {
    /// System is healthy - low resource usage
    Healthy = 0,
    /// Elevated resource usage - may need attention
    Elevated = 1,
    /// Critical resource usage - system under stress
    Critical = 2,
}

impl SystemState {
    /// Calculate system state from CPU and memory usage
    pub fn from_metrics(cpu_usage: f32, memory_usage: f32) -> Self {
        if cpu_usage > 90.0 || memory_usage > 85.0 {
            SystemState::Critical
        } else if cpu_usage > 60.0 || memory_usage > 60.0 {
            SystemState::Elevated
        } else {
            SystemState::Healthy
        }
    }

    /// Convert from u8 value
    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => SystemState::Healthy,
            1 => SystemState::Elevated,
            2 => SystemState::Critical,
            _ => SystemState::Healthy,
        }
    }
}

/// Momentum state for the Momentum Border effect.
/// Border color/speed reflects live system health.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentumStateData {
    /// Intensity level (0.0 - 1.0)
    pub intensity: f32,
    /// Color state for border
    pub color: MomentumColor,
    /// Rotation speed multiplier for border animation
    pub rotation_speed: f32,
}

impl MomentumStateData {
    /// Calculate momentum state from CPU and memory usage.
    pub fn from_metrics(cpu_usage: f32, memory_usage: f32) -> Self {
        if cpu_usage > 90.0 || memory_usage > 85.0 {
            // Critical: intense red, fast rotation
            MomentumStateData {
                intensity: 1.0,
                color: MomentumColor::Critical,
                rotation_speed: 3.0,
            }
        } else if cpu_usage > 60.0 || memory_usage > 60.0 {
            // Active: moderate cyan, medium rotation
            MomentumStateData {
                intensity: 0.7,
                color: MomentumColor::Active,
                rotation_speed: 1.5,
            }
        } else {
            // Idle: subtle purple, slow rotation
            MomentumStateData {
                intensity: 0.3,
                color: MomentumColor::Idle,
                rotation_speed: 0.5,
            }
        }
    }
}

impl Default for MomentumStateData {
    fn default() -> Self {
        MomentumStateData {
            intensity: 0.3,
            color: MomentumColor::Idle,
            rotation_speed: 0.5,
        }
    }
}

/// Complete system metrics snapshot.
/// This is the main data structure streamed to the Menu Bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetricsData {
    /// CPU usage percentage (0-100)
    pub cpu_usage: f32,
    /// Memory usage percentage (0-100)
    pub memory_usage: f32,
    /// Total memory in bytes
    pub memory_total: u64,
    /// Memory used in bytes
    pub memory_used: u64,
    /// Disk usage percentage (0-100)
    pub disk_usage: f32,
    /// CPU temperature in Celsius
    pub temperature: f32,
    /// GPU temperature in Celsius
    pub gpu_temperature: f32,
    /// Timestamp in milliseconds since epoch
    pub timestamp: u64,
    /// Top processes by resource usage (limited to 10)
    pub top_processes: Vec<ProcessInfoData>,
    /// Momentum state for border animation
    pub momentum: MomentumStateData,
    /// Overall system state
    pub system_state: SystemState,
    /// Fan speeds in RPM
    pub fan_speeds: Vec<u32>,
}

impl SystemMetricsData {
    /// Create a new SystemMetricsData with calculated derived fields.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        cpu_usage: f32,
        memory_usage: f32,
        memory_total: u64,
        memory_used: u64,
        disk_usage: f32,
        temperature: f32,
        gpu_temperature: f32,
        timestamp: u64,
        top_processes: Vec<ProcessInfoData>,
        fan_speeds: Vec<u32>,
    ) -> Self {
        let momentum = MomentumStateData::from_metrics(cpu_usage, memory_usage);
        let system_state = SystemState::from_metrics(cpu_usage, memory_usage);

        SystemMetricsData {
            cpu_usage,
            memory_usage,
            memory_total,
            memory_used,
            disk_usage,
            temperature,
            gpu_temperature,
            timestamp,
            top_processes,
            momentum,
            system_state,
            fan_speeds,
        }
    }

    /// Create a default/empty metrics snapshot.
    pub fn empty() -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        SystemMetricsData {
            cpu_usage: 0.0,
            memory_usage: 0.0,
            memory_total: 0,
            memory_used: 0,
            disk_usage: 0.0,
            temperature: 0.0,
            gpu_temperature: 0.0,
            timestamp: now,
            top_processes: Vec::new(),
            momentum: MomentumStateData::default(),
            system_state: SystemState::Healthy,
            fan_speeds: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_momentum_state_calculation() {
        // Idle state
        let idle = MomentumStateData::from_metrics(30.0, 40.0);
        assert_eq!(idle.color, MomentumColor::Idle);
        assert!(idle.intensity < 0.5);

        // Active state
        let active = MomentumStateData::from_metrics(70.0, 50.0);
        assert_eq!(active.color, MomentumColor::Active);

        // Critical state
        let critical = MomentumStateData::from_metrics(95.0, 50.0);
        assert_eq!(critical.color, MomentumColor::Critical);
        assert!(critical.intensity > 0.9);
    }

    #[test]
    fn test_system_state_calculation() {
        assert_eq!(SystemState::from_metrics(30.0, 40.0), SystemState::Healthy);
        assert_eq!(SystemState::from_metrics(70.0, 50.0), SystemState::Elevated);
        assert_eq!(SystemState::from_metrics(95.0, 50.0), SystemState::Critical);
        assert_eq!(SystemState::from_metrics(50.0, 90.0), SystemState::Critical);
    }

    #[test]
    fn test_momentum_color_from_u8() {
        assert_eq!(MomentumColor::from_u8(0), MomentumColor::Idle);
        assert_eq!(MomentumColor::from_u8(1), MomentumColor::Active);
        assert_eq!(MomentumColor::from_u8(2), MomentumColor::Critical);
        assert_eq!(MomentumColor::from_u8(99), MomentumColor::Idle); // Default
    }
}
