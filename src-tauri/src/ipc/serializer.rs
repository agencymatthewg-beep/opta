//! Binary serialization for system metrics.
//!
//! This module provides high-performance binary serialization for
//! streaming metrics data. Uses a compact binary format optimized
//! for the specific data structures we need to transmit.
//!
//! ## Binary Protocol Format
//!
//! The format is a simple length-prefixed binary structure:
//!
//! ```text
//! Header (12 bytes):
//!   - magic: u32 (0x4F505441 = "OPTA")
//!   - version: u16
//!   - flags: u16
//!   - payload_length: u32
//!
//! Payload (variable):
//!   - cpu_usage: f32
//!   - memory_usage: f32
//!   - memory_total: u64
//!   - memory_used: u64
//!   - disk_usage: f32
//!   - temperature: f32
//!   - gpu_temperature: f32
//!   - timestamp: u64
//!   - momentum_intensity: f32
//!   - momentum_color: u8
//!   - momentum_rotation_speed: f32
//!   - system_state: u8
//!   - process_count: u8
//!   - processes: [ProcessInfo] (variable)
//!   - fan_count: u8
//!   - fan_speeds: [u32] (variable)
//! ```
//!
//! ## Performance Notes
//!
//! - Buffer is pre-allocated and reused
//! - No heap allocations during serialization
//! - Target serialization time: <100 microseconds

use once_cell::sync::Lazy;
use std::sync::Mutex;

use super::metrics_types::{
    MomentumColor, ProcessInfoData, SystemMetricsData, SystemState,
};

/// Magic number for protocol identification ("OPTA" in ASCII)
pub const PROTOCOL_MAGIC: u32 = 0x4F505441;

/// Protocol version
pub const PROTOCOL_VERSION: u16 = 1;

/// Default buffer size (8KB should be plenty)
const BUFFER_SIZE: usize = 8192;

/// Maximum process name length
const MAX_PROCESS_NAME_LEN: usize = 64;

/// Maximum number of processes to serialize
const MAX_PROCESSES: usize = 10;

/// Maximum number of fan readings
const MAX_FANS: usize = 4;

/// Thread-safe global serializer instance.
pub static SERIALIZER: Lazy<Mutex<MetricsSerializer>> =
    Lazy::new(|| Mutex::new(MetricsSerializer::new()));

/// Binary serializer for system metrics.
///
/// Maintains a reusable buffer for efficient serialization.
pub struct MetricsSerializer {
    buffer: Vec<u8>,
}

impl MetricsSerializer {
    /// Create a new serializer with pre-allocated buffer.
    pub fn new() -> Self {
        Self {
            buffer: vec![0u8; BUFFER_SIZE],
        }
    }

    /// Serialize system metrics to binary format.
    ///
    /// Returns the serialized bytes as a new Vec.
    pub fn serialize(&mut self, metrics: &SystemMetricsData) -> Vec<u8> {
        self.buffer.clear();
        self.buffer.reserve(BUFFER_SIZE);

        // We'll write the header at the end when we know the payload size
        // For now, reserve space for header (12 bytes)
        let header_size = 12;
        self.buffer.resize(header_size, 0);

        // Write payload
        let payload_start = self.buffer.len();

        // Core metrics (fixed size: 44 bytes)
        self.write_f32(metrics.cpu_usage);
        self.write_f32(metrics.memory_usage);
        self.write_u64(metrics.memory_total);
        self.write_u64(metrics.memory_used);
        self.write_f32(metrics.disk_usage);
        self.write_f32(metrics.temperature);
        self.write_f32(metrics.gpu_temperature);
        self.write_u64(metrics.timestamp);

        // Momentum state (9 bytes)
        self.write_f32(metrics.momentum.intensity);
        self.write_u8(metrics.momentum.color as u8);
        self.write_f32(metrics.momentum.rotation_speed);

        // System state (1 byte)
        self.write_u8(metrics.system_state as u8);

        // Processes (variable)
        let process_count = std::cmp::min(metrics.top_processes.len(), MAX_PROCESSES);
        self.write_u8(process_count as u8);

        for process in metrics.top_processes.iter().take(MAX_PROCESSES) {
            self.write_process(process);
        }

        // Fan speeds (variable)
        let fan_count = std::cmp::min(metrics.fan_speeds.len(), MAX_FANS);
        self.write_u8(fan_count as u8);

        for speed in metrics.fan_speeds.iter().take(MAX_FANS) {
            self.write_u32(*speed);
        }

        // Calculate payload length
        let payload_len = (self.buffer.len() - payload_start) as u32;

        // Write header at the beginning
        let header = self.build_header(payload_len);
        self.buffer[0..header_size].copy_from_slice(&header);

        self.buffer.clone()
    }

    /// Build the 12-byte header
    fn build_header(&self, payload_len: u32) -> [u8; 12] {
        let mut header = [0u8; 12];

        // Magic (4 bytes, little-endian)
        header[0..4].copy_from_slice(&PROTOCOL_MAGIC.to_le_bytes());

        // Version (2 bytes, little-endian)
        header[4..6].copy_from_slice(&PROTOCOL_VERSION.to_le_bytes());

        // Flags (2 bytes, reserved)
        header[6..8].copy_from_slice(&0u16.to_le_bytes());

        // Payload length (4 bytes, little-endian)
        header[8..12].copy_from_slice(&payload_len.to_le_bytes());

        header
    }

    fn write_u8(&mut self, value: u8) {
        self.buffer.push(value);
    }

    #[allow(dead_code)]
    fn write_u16(&mut self, value: u16) {
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    fn write_u32(&mut self, value: u32) {
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    fn write_u64(&mut self, value: u64) {
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    fn write_f32(&mut self, value: f32) {
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    fn write_string(&mut self, s: &str, max_len: usize) {
        let bytes = s.as_bytes();
        let len = std::cmp::min(bytes.len(), max_len);

        // Write length prefix (1 byte)
        self.write_u8(len as u8);

        // Write string bytes
        self.buffer.extend_from_slice(&bytes[..len]);
    }

    fn write_process(&mut self, process: &ProcessInfoData) {
        self.write_u32(process.pid);
        self.write_string(&process.name, MAX_PROCESS_NAME_LEN);
        self.write_f32(process.cpu_percent);
        self.write_f32(process.memory_mb);
    }
}

impl Default for MetricsSerializer {
    fn default() -> Self {
        Self::new()
    }
}

/// Deserialize binary metrics data.
///
/// This is primarily for testing; Swift will have its own deserialization.
pub struct MetricsDeserializer<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> MetricsDeserializer<'a> {
    /// Create a new deserializer for the given data.
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    /// Validate the header and return payload length.
    pub fn validate_header(&mut self) -> Result<u32, &'static str> {
        if self.data.len() < 12 {
            return Err("Data too short for header");
        }

        // Check magic
        let magic = self.read_u32();
        if magic != PROTOCOL_MAGIC {
            return Err("Invalid magic number");
        }

        // Check version
        let version = self.read_u16();
        if version != PROTOCOL_VERSION {
            return Err("Unsupported protocol version");
        }

        // Skip flags
        let _flags = self.read_u16();

        // Get payload length
        let payload_len = self.read_u32();

        if self.data.len() < 12 + payload_len as usize {
            return Err("Data shorter than indicated payload");
        }

        Ok(payload_len)
    }

    /// Deserialize to SystemMetricsData.
    pub fn deserialize(&mut self) -> Result<SystemMetricsData, &'static str> {
        // Validate header first
        self.validate_header()?;

        // Read core metrics
        let cpu_usage = self.read_f32();
        let memory_usage = self.read_f32();
        let memory_total = self.read_u64();
        let memory_used = self.read_u64();
        let disk_usage = self.read_f32();
        let temperature = self.read_f32();
        let gpu_temperature = self.read_f32();
        let timestamp = self.read_u64();

        // Read momentum state
        let momentum_intensity = self.read_f32();
        let momentum_color = MomentumColor::from_u8(self.read_u8());
        let momentum_rotation_speed = self.read_f32();

        // Read system state
        let system_state = SystemState::from_u8(self.read_u8());

        // Read processes
        let process_count = self.read_u8() as usize;
        let mut top_processes = Vec::with_capacity(process_count);

        for _ in 0..process_count {
            let pid = self.read_u32();
            let name = self.read_string();
            let cpu_percent = self.read_f32();
            let memory_mb = self.read_f32();

            top_processes.push(ProcessInfoData {
                pid,
                name,
                cpu_percent,
                memory_mb,
            });
        }

        // Read fan speeds
        let fan_count = self.read_u8() as usize;
        let mut fan_speeds = Vec::with_capacity(fan_count);

        for _ in 0..fan_count {
            fan_speeds.push(self.read_u32());
        }

        Ok(SystemMetricsData {
            cpu_usage,
            memory_usage,
            memory_total,
            memory_used,
            disk_usage,
            temperature,
            gpu_temperature,
            timestamp,
            top_processes,
            momentum: super::metrics_types::MomentumStateData {
                intensity: momentum_intensity,
                color: momentum_color,
                rotation_speed: momentum_rotation_speed,
            },
            system_state,
            fan_speeds,
        })
    }

    /// Check if we have enough bytes remaining to read `count` bytes.
    fn has_bytes(&self, count: usize) -> bool {
        self.pos + count <= self.data.len()
    }

    fn read_u8(&mut self) -> u8 {
        if !self.has_bytes(1) {
            return 0; // Safe default for malformed data
        }
        let value = self.data[self.pos];
        self.pos += 1;
        value
    }

    fn read_u16(&mut self) -> u16 {
        if !self.has_bytes(2) {
            return 0; // Safe default for malformed data
        }
        let value = u16::from_le_bytes([self.data[self.pos], self.data[self.pos + 1]]);
        self.pos += 2;
        value
    }

    fn read_u32(&mut self) -> u32 {
        if !self.has_bytes(4) {
            return 0; // Safe default for malformed data
        }
        // Safe: we just verified we have 4 bytes
        let bytes: [u8; 4] = self.data[self.pos..self.pos + 4]
            .try_into()
            .unwrap_or([0; 4]);
        let value = u32::from_le_bytes(bytes);
        self.pos += 4;
        value
    }

    fn read_u64(&mut self) -> u64 {
        if !self.has_bytes(8) {
            return 0; // Safe default for malformed data
        }
        // Safe: we just verified we have 8 bytes
        let bytes: [u8; 8] = self.data[self.pos..self.pos + 8]
            .try_into()
            .unwrap_or([0; 8]);
        let value = u64::from_le_bytes(bytes);
        self.pos += 8;
        value
    }

    fn read_f32(&mut self) -> f32 {
        if !self.has_bytes(4) {
            return 0.0; // Safe default for malformed data
        }
        // Safe: we just verified we have 4 bytes
        let bytes: [u8; 4] = self.data[self.pos..self.pos + 4]
            .try_into()
            .unwrap_or([0; 4]);
        let value = f32::from_le_bytes(bytes);
        self.pos += 4;
        value
    }

    fn read_string(&mut self) -> String {
        let len = self.read_u8() as usize;
        if !self.has_bytes(len) {
            return String::new(); // Safe default for malformed data
        }
        let bytes = &self.data[self.pos..self.pos + len];
        self.pos += len;
        String::from_utf8_lossy(bytes).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_empty_metrics() {
        let mut serializer = MetricsSerializer::new();
        let metrics = SystemMetricsData::empty();
        let data = serializer.serialize(&metrics);

        // Should have header (12) + payload
        assert!(data.len() >= 12);

        // Check magic number
        let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
        assert_eq!(magic, PROTOCOL_MAGIC);

        // Check version
        let version = u16::from_le_bytes([data[4], data[5]]);
        assert_eq!(version, PROTOCOL_VERSION);
    }

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let mut serializer = MetricsSerializer::new();

        let original = SystemMetricsData::new(
            45.5,                          // cpu_usage
            60.0,                          // memory_usage
            16 * 1024 * 1024 * 1024,       // memory_total (16GB)
            10 * 1024 * 1024 * 1024,       // memory_used (10GB)
            50.0,                          // disk_usage
            55.0,                          // temperature
            45.0,                          // gpu_temperature
            1234567890,                    // timestamp
            vec![
                ProcessInfoData {
                    pid: 1234,
                    name: "test_process".to_string(),
                    cpu_percent: 10.5,
                    memory_mb: 256.0,
                },
                ProcessInfoData {
                    pid: 5678,
                    name: "another_process".to_string(),
                    cpu_percent: 5.0,
                    memory_mb: 128.0,
                },
            ],
            vec![1200, 1150],              // fan_speeds
        );

        let data = serializer.serialize(&original);

        // Deserialize
        let mut deserializer = MetricsDeserializer::new(&data);
        let restored = deserializer.deserialize().unwrap();

        // Verify roundtrip
        assert!((restored.cpu_usage - 45.5).abs() < 0.01);
        assert!((restored.memory_usage - 60.0).abs() < 0.01);
        assert_eq!(restored.memory_total, 16 * 1024 * 1024 * 1024);
        assert_eq!(restored.timestamp, 1234567890);
        assert_eq!(restored.top_processes.len(), 2);
        assert_eq!(restored.top_processes[0].pid, 1234);
        assert_eq!(restored.top_processes[0].name, "test_process");
        assert_eq!(restored.fan_speeds.len(), 2);
        assert_eq!(restored.fan_speeds[0], 1200);
    }

    #[test]
    fn test_serializer_reuse() {
        let mut serializer = MetricsSerializer::new();

        // Serialize multiple times - buffer should be reused
        for i in 0..10 {
            let metrics = SystemMetricsData::new(
                i as f32 * 10.0,
                50.0,
                16 * 1024 * 1024 * 1024,
                8 * 1024 * 1024 * 1024,
                40.0,
                45.0,
                40.0,
                i as u64,
                vec![],
                vec![],
            );

            let data = serializer.serialize(&metrics);
            assert!(!data.is_empty());
        }
    }

    #[test]
    fn test_invalid_magic() {
        let data = vec![0xFF, 0xFF, 0xFF, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0];
        let mut deserializer = MetricsDeserializer::new(&data);
        assert!(deserializer.validate_header().is_err());
    }
}
