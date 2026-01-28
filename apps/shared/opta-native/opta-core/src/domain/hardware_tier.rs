//! Hardware Tier Detection
//!
//! Logic for detecting and classifying hardware tier based on system specs.

use opta_shared::{SystemTelemetry, HardwareTier, CpuInfo, GpuInfo, MemoryInfo};

/// Detector for hardware tier classification
pub struct HardwareTierDetector {
    /// Classification thresholds
    config: TierConfig,
}

/// Configuration for tier classification
#[derive(Debug, Clone)]
pub struct TierConfig {
    /// Minimum RAM for mid tier (GB)
    pub mid_ram_gb: u64,
    /// Minimum RAM for high tier (GB)
    pub high_ram_gb: u64,
    /// Minimum RAM for enthusiast tier (GB)
    pub enthusiast_ram_gb: u64,
    /// Minimum cores for mid tier
    pub mid_cores: u32,
    /// Minimum cores for high tier
    pub high_cores: u32,
    /// Minimum cores for enthusiast tier
    pub enthusiast_cores: u32,
}

impl Default for TierConfig {
    fn default() -> Self {
        Self {
            mid_ram_gb: 8,
            high_ram_gb: 16,
            enthusiast_ram_gb: 32,
            mid_cores: 4,
            high_cores: 8,
            enthusiast_cores: 12,
        }
    }
}

/// Detailed hardware classification result
#[derive(Debug, Clone)]
pub struct HardwareClassification {
    /// Overall tier
    pub tier: HardwareTier,
    /// CPU tier contribution
    pub cpu_tier: HardwareTier,
    /// GPU tier contribution
    pub gpu_tier: HardwareTier,
    /// Memory tier contribution
    pub memory_tier: HardwareTier,
    /// Confidence in classification (0.0 - 1.0)
    pub confidence: f32,
    /// Description of the hardware
    pub description: String,
}

impl HardwareTierDetector {
    /// Create a new detector with default config
    pub fn new() -> Self {
        Self {
            config: TierConfig::default(),
        }
    }

    /// Create with custom config
    pub fn with_config(config: TierConfig) -> Self {
        Self { config }
    }

    /// Classify hardware tier from telemetry
    pub fn classify(&self, telemetry: &SystemTelemetry) -> HardwareClassification {
        let cpu_tier = self.classify_cpu(&telemetry.cpu);
        let memory_tier = self.classify_memory(&telemetry.memory);
        let gpu_tier = telemetry
            .gpu
            .as_ref()
            .map(|g| self.classify_gpu(g))
            .unwrap_or(HardwareTier::Entry);

        // Overall tier is the minimum of components (bottleneck)
        let tier = self.combine_tiers(&[cpu_tier, memory_tier, gpu_tier]);

        // Generate description
        let description = self.generate_description(telemetry, tier);

        // Confidence based on how consistent the tiers are
        let tiers = [cpu_tier, memory_tier, gpu_tier];
        let confidence = self.calculate_confidence(&tiers);

        HardwareClassification {
            tier,
            cpu_tier,
            gpu_tier,
            memory_tier,
            confidence,
            description,
        }
    }

    /// Classify CPU tier
    fn classify_cpu(&self, cpu: &CpuInfo) -> HardwareTier {
        let cores = cpu.physical_cores;

        // Check for Apple Silicon
        let is_apple_silicon = cpu.name.contains("Apple M");
        if is_apple_silicon {
            return self.classify_apple_silicon(&cpu.name);
        }

        // Standard classification by core count
        if cores >= self.config.enthusiast_cores {
            HardwareTier::Enthusiast
        } else if cores >= self.config.high_cores {
            HardwareTier::High
        } else if cores >= self.config.mid_cores {
            HardwareTier::Mid
        } else {
            HardwareTier::Entry
        }
    }

    /// Classify Apple Silicon by chip name
    fn classify_apple_silicon(&self, name: &str) -> HardwareTier {
        if name.contains("Ultra") || name.contains("Max") {
            HardwareTier::Enthusiast
        } else if name.contains("Pro") {
            HardwareTier::High
        } else if name.contains("M3") || name.contains("M2") {
            HardwareTier::Mid
        } else {
            HardwareTier::Entry
        }
    }

    /// Classify memory tier
    fn classify_memory(&self, memory: &MemoryInfo) -> HardwareTier {
        let ram_gb = memory.total_bytes / (1024 * 1024 * 1024);

        if ram_gb >= self.config.enthusiast_ram_gb {
            HardwareTier::Enthusiast
        } else if ram_gb >= self.config.high_ram_gb {
            HardwareTier::High
        } else if ram_gb >= self.config.mid_ram_gb {
            HardwareTier::Mid
        } else {
            HardwareTier::Entry
        }
    }

    /// Classify GPU tier
    fn classify_gpu(&self, gpu: &GpuInfo) -> HardwareTier {
        // Check for Apple Silicon integrated GPU
        if gpu.name.contains("Apple") {
            return self.classify_apple_gpu(&gpu.name);
        }

        // Check VRAM for discrete GPUs
        let vram_gb = gpu.vram_total_bytes / (1024 * 1024 * 1024);

        if vram_gb >= 16 {
            HardwareTier::Enthusiast
        } else if vram_gb >= 8 {
            HardwareTier::High
        } else if vram_gb >= 4 {
            HardwareTier::Mid
        } else {
            HardwareTier::Entry
        }
    }

    /// Classify Apple GPU
    fn classify_apple_gpu(&self, name: &str) -> HardwareTier {
        // Apple Silicon GPUs are classified by chip
        if name.contains("Ultra") || name.contains("Max") {
            HardwareTier::Enthusiast
        } else if name.contains("Pro") {
            HardwareTier::High
        } else if name.contains("M3") || name.contains("M2") {
            HardwareTier::Mid
        } else {
            HardwareTier::Entry
        }
    }

    /// Combine component tiers into overall tier
    fn combine_tiers(&self, tiers: &[HardwareTier]) -> HardwareTier {
        // Use the lowest tier as the bottleneck
        tiers
            .iter()
            .min_by_key(|t| match t {
                HardwareTier::Entry => 0,
                HardwareTier::Mid => 1,
                HardwareTier::High => 2,
                HardwareTier::Enthusiast => 3,
            })
            .copied()
            .unwrap_or(HardwareTier::Mid)
    }

    /// Calculate confidence in classification
    fn calculate_confidence(&self, tiers: &[HardwareTier]) -> f32 {
        // If all tiers match, high confidence
        let first = &tiers[0];
        let all_match = tiers.iter().all(|t| t == first);

        if all_match {
            1.0
        } else {
            // Calculate spread
            let tier_values: Vec<u32> = tiers
                .iter()
                .map(|t| match t {
                    HardwareTier::Entry => 0,
                    HardwareTier::Mid => 1,
                    HardwareTier::High => 2,
                    HardwareTier::Enthusiast => 3,
                })
                .collect();

            let min = *tier_values.iter().min().unwrap_or(&0);
            let max = *tier_values.iter().max().unwrap_or(&3);
            let spread = max - min;

            match spread {
                0 => 1.0,
                1 => 0.8,
                2 => 0.6,
                _ => 0.4,
            }
        }
    }

    /// Generate human-readable description
    fn generate_description(&self, telemetry: &SystemTelemetry, tier: HardwareTier) -> String {
        let cpu = &telemetry.cpu.name;
        let ram_gb = telemetry.memory.total_bytes / (1024 * 1024 * 1024);
        let gpu = telemetry
            .gpu
            .as_ref()
            .map(|g| g.name.clone())
            .unwrap_or_else(|| "Integrated".to_string());

        format!(
            "{} system: {} with {}GB RAM and {} GPU",
            tier.display_name(),
            cpu,
            ram_gb,
            gpu
        )
    }
}

impl Default for HardwareTierDetector {
    fn default() -> Self {
        Self::new()
    }
}
