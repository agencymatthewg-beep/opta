//! Telemetry data structures for system monitoring visualization.
//!
//! These structures represent CPU, memory, and GPU telemetry data that
//! can be visualized using the GPU-rendered meter components.

// Allow precision loss for conversions in this module
#![allow(clippy::cast_precision_loss)]

/// Maximum number of CPU cores supported for per-core usage tracking.
pub const MAX_CPU_CORES: usize = 16;

/// CPU telemetry data.
///
/// Contains current CPU usage metrics including per-core activity,
/// temperature, and frequency information.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct CpuTelemetry {
    /// Overall CPU usage (0.0 to 1.0).
    pub usage: f32,
    /// Per-core CPU usage (0.0 to 1.0 for each core).
    pub core_usage: [f32; MAX_CPU_CORES],
    /// Number of active CPU cores.
    pub core_count: u32,
    /// CPU temperature in Celsius (0 = unavailable).
    pub temperature: f32,
    /// CPU frequency in GHz.
    pub frequency: f32,
    /// Padding for 16-byte alignment.
    pub _padding: f32,
}

impl Default for CpuTelemetry {
    fn default() -> Self {
        Self {
            usage: 0.0,
            core_usage: [0.0; MAX_CPU_CORES],
            core_count: 4,
            temperature: 45.0,
            frequency: 2.4,
            _padding: 0.0,
        }
    }
}

impl CpuTelemetry {
    /// Creates a new CPU telemetry instance with the given core count.
    pub fn new(core_count: u32) -> Self {
        Self {
            core_count: core_count.min(MAX_CPU_CORES as u32),
            ..Default::default()
        }
    }

    /// Updates the overall usage value.
    pub fn set_usage(&mut self, usage: f32) {
        self.usage = usage.clamp(0.0, 1.0);
    }

    /// Updates the usage for a specific core.
    pub fn set_core_usage(&mut self, core: usize, usage: f32) {
        if core < MAX_CPU_CORES {
            self.core_usage[core] = usage.clamp(0.0, 1.0);
        }
    }

    /// Updates the CPU temperature.
    pub fn set_temperature(&mut self, temp_celsius: f32) {
        self.temperature = temp_celsius.max(0.0);
    }

    /// Updates the CPU frequency.
    pub fn set_frequency(&mut self, freq_ghz: f32) {
        self.frequency = freq_ghz.max(0.0);
    }

    /// Returns a normalized temperature value (0 = cold, 1 = hot).
    /// Based on typical CPU temperature range of 30-100C.
    pub fn normalized_temperature(&self) -> f32 {
        ((self.temperature - 30.0) / 70.0).clamp(0.0, 1.0)
    }

    /// Returns the average core usage across all active cores.
    pub fn average_core_usage(&self) -> f32 {
        if self.core_count == 0 {
            return 0.0;
        }
        let sum: f32 = self.core_usage[..self.core_count as usize].iter().sum();
        sum / self.core_count as f32
    }
}

/// Memory telemetry data.
///
/// Contains current memory usage metrics including RAM and swap usage,
/// and memory pressure information.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct MemoryTelemetry {
    /// Total system memory in GB.
    pub total: f32,
    /// Used memory in GB.
    pub used: f32,
    /// Memory pressure (0.0 = low, 1.0 = critical).
    pub pressure: f32,
    /// Swap usage ratio (0.0 to 1.0).
    pub swap_usage: f32,
}

impl Default for MemoryTelemetry {
    fn default() -> Self {
        Self {
            total: 16.0,
            used: 8.0,
            pressure: 0.3,
            swap_usage: 0.0,
        }
    }
}

impl MemoryTelemetry {
    /// Creates a new memory telemetry instance with the given total memory.
    pub fn new(total_gb: f32) -> Self {
        Self {
            total: total_gb,
            used: 0.0,
            pressure: 0.0,
            swap_usage: 0.0,
        }
    }

    /// Updates the used memory value.
    pub fn set_used(&mut self, used_gb: f32) {
        self.used = used_gb.clamp(0.0, self.total);
    }

    /// Updates the memory pressure.
    pub fn set_pressure(&mut self, pressure: f32) {
        self.pressure = pressure.clamp(0.0, 1.0);
    }

    /// Updates the swap usage.
    pub fn set_swap_usage(&mut self, swap: f32) {
        self.swap_usage = swap.clamp(0.0, 1.0);
    }

    /// Returns the memory usage ratio (0.0 to 1.0).
    pub fn usage_ratio(&self) -> f32 {
        if self.total <= 0.0 {
            return 0.0;
        }
        (self.used / self.total).clamp(0.0, 1.0)
    }

    /// Returns free memory in GB.
    pub fn free(&self) -> f32 {
        (self.total - self.used).max(0.0)
    }
}

/// GPU telemetry data.
///
/// Contains current GPU usage metrics including utilization,
/// VRAM usage, temperature, and power consumption.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GpuTelemetry {
    /// GPU utilization (0.0 to 1.0).
    pub usage: f32,
    /// VRAM usage ratio (0.0 to 1.0).
    pub vram_usage: f32,
    /// GPU temperature in Celsius (0 = unavailable).
    pub temperature: f32,
    /// Power consumption ratio (0.0 to 1.0 of TDP).
    pub power: f32,
}

impl Default for GpuTelemetry {
    fn default() -> Self {
        Self {
            usage: 0.0,
            vram_usage: 0.0,
            temperature: 40.0,
            power: 0.3,
        }
    }
}

impl GpuTelemetry {
    /// Creates a new GPU telemetry instance.
    pub fn new() -> Self {
        Self::default()
    }

    /// Updates the GPU utilization.
    pub fn set_usage(&mut self, usage: f32) {
        self.usage = usage.clamp(0.0, 1.0);
    }

    /// Updates the VRAM usage.
    pub fn set_vram_usage(&mut self, vram: f32) {
        self.vram_usage = vram.clamp(0.0, 1.0);
    }

    /// Updates the GPU temperature.
    pub fn set_temperature(&mut self, temp_celsius: f32) {
        self.temperature = temp_celsius.max(0.0);
    }

    /// Updates the power consumption.
    pub fn set_power(&mut self, power: f32) {
        self.power = power.clamp(0.0, 1.0);
    }

    /// Returns a normalized temperature value (0 = cold, 1 = hot).
    /// Based on typical GPU temperature range of 30-90C.
    pub fn normalized_temperature(&self) -> f32 {
        ((self.temperature - 30.0) / 60.0).clamp(0.0, 1.0)
    }
}

/// Combined system telemetry.
///
/// Aggregates CPU, memory, and GPU telemetry for unified system monitoring.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct SystemTelemetry {
    /// CPU telemetry data.
    pub cpu: CpuTelemetry,
    /// Memory telemetry data.
    pub memory: MemoryTelemetry,
    /// GPU telemetry data.
    pub gpu: GpuTelemetry,
}

impl Default for SystemTelemetry {
    fn default() -> Self {
        Self {
            cpu: CpuTelemetry::default(),
            memory: MemoryTelemetry::default(),
            gpu: GpuTelemetry::default(),
        }
    }
}

impl SystemTelemetry {
    /// Creates a new system telemetry instance.
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a system telemetry instance with custom initial values.
    pub fn with_config(core_count: u32, total_memory_gb: f32) -> Self {
        Self {
            cpu: CpuTelemetry::new(core_count),
            memory: MemoryTelemetry::new(total_memory_gb),
            gpu: GpuTelemetry::new(),
        }
    }

    /// Returns the overall system load (average of CPU, memory, GPU).
    pub fn overall_load(&self) -> f32 {
        (self.cpu.usage + self.memory.usage_ratio() + self.gpu.usage) / 3.0
    }

    /// Returns the maximum temperature across all components.
    pub fn max_temperature(&self) -> f32 {
        self.cpu.temperature.max(self.gpu.temperature)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_telemetry_size() {
        // CpuTelemetry: usage(4) + core_usage(64) + core_count(4) + temp(4) + freq(4) + pad(4) = 84 bytes
        // Rounded for alignment
        let size = std::mem::size_of::<CpuTelemetry>();
        assert_eq!(size, 84);
    }

    #[test]
    fn test_memory_telemetry_size() {
        // MemoryTelemetry: total(4) + used(4) + pressure(4) + swap(4) = 16 bytes
        assert_eq!(std::mem::size_of::<MemoryTelemetry>(), 16);
    }

    #[test]
    fn test_gpu_telemetry_size() {
        // GpuTelemetry: usage(4) + vram(4) + temp(4) + power(4) = 16 bytes
        assert_eq!(std::mem::size_of::<GpuTelemetry>(), 16);
    }

    #[test]
    fn test_system_telemetry_size() {
        // SystemTelemetry: cpu(84) + memory(16) + gpu(16) = 116 bytes
        assert_eq!(std::mem::size_of::<SystemTelemetry>(), 116);
    }

    #[test]
    fn test_cpu_telemetry_default() {
        let cpu = CpuTelemetry::default();
        assert!((cpu.usage - 0.0).abs() < f32::EPSILON);
        assert_eq!(cpu.core_count, 4);
        assert!((cpu.temperature - 45.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_cpu_telemetry_methods() {
        let mut cpu = CpuTelemetry::new(8);
        assert_eq!(cpu.core_count, 8);

        cpu.set_usage(0.5);
        assert!((cpu.usage - 0.5).abs() < f32::EPSILON);

        cpu.set_core_usage(0, 0.8);
        cpu.set_core_usage(1, 0.6);
        assert!((cpu.core_usage[0] - 0.8).abs() < f32::EPSILON);
        assert!((cpu.core_usage[1] - 0.6).abs() < f32::EPSILON);

        cpu.set_temperature(75.0);
        let norm_temp = cpu.normalized_temperature();
        // (75 - 30) / 70 = 0.642...
        assert!(norm_temp > 0.6 && norm_temp < 0.7);
    }

    #[test]
    fn test_memory_telemetry_methods() {
        let mut mem = MemoryTelemetry::new(32.0);
        assert!((mem.total - 32.0).abs() < f32::EPSILON);

        mem.set_used(16.0);
        assert!((mem.usage_ratio() - 0.5).abs() < f32::EPSILON);
        assert!((mem.free() - 16.0).abs() < f32::EPSILON);

        mem.set_pressure(0.7);
        assert!((mem.pressure - 0.7).abs() < f32::EPSILON);
    }

    #[test]
    fn test_gpu_telemetry_methods() {
        let mut gpu = GpuTelemetry::new();

        gpu.set_usage(0.9);
        assert!((gpu.usage - 0.9).abs() < f32::EPSILON);

        gpu.set_temperature(80.0);
        let norm_temp = gpu.normalized_temperature();
        // (80 - 30) / 60 = 0.833...
        assert!(norm_temp > 0.8 && norm_temp < 0.9);
    }

    #[test]
    fn test_system_telemetry() {
        let sys = SystemTelemetry::with_config(8, 32.0);
        assert_eq!(sys.cpu.core_count, 8);
        assert!((sys.memory.total - 32.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_bytemuck_compatibility() {
        // Verify that all types are bytemuck-compatible
        let cpu = CpuTelemetry::default();
        let _bytes: &[u8] = bytemuck::bytes_of(&cpu);

        let mem = MemoryTelemetry::default();
        let _bytes: &[u8] = bytemuck::bytes_of(&mem);

        let gpu = GpuTelemetry::default();
        let _bytes: &[u8] = bytemuck::bytes_of(&gpu);

        let sys = SystemTelemetry::default();
        let _bytes: &[u8] = bytemuck::bytes_of(&sys);
    }

    #[test]
    fn test_clamping() {
        let mut cpu = CpuTelemetry::default();
        cpu.set_usage(1.5);
        assert!((cpu.usage - 1.0).abs() < f32::EPSILON);

        cpu.set_usage(-0.5);
        assert!((cpu.usage - 0.0).abs() < f32::EPSILON);
    }
}
