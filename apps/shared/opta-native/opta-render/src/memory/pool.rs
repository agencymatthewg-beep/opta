//! GPU buffer memory pool for efficient resource management.
//!
//! Provides buffer pooling to reduce allocation overhead by reusing GPU buffers.
//! This is particularly important for temporary buffers in render passes.
//!
//! ## Usage
//!
//! ```ignore
//! use opta_render::memory::{BufferPool, BufferSizeClass};
//! use wgpu::BufferUsages;
//!
//! let mut pool = BufferPool::new();
//!
//! // Acquire a buffer (creates new or reuses pooled)
//! let buffer = pool.acquire(&device, 512, BufferUsages::VERTEX, Some("my_buffer"));
//!
//! // Use the buffer...
//!
//! // Release back to pool for reuse
//! pool.release(buffer, BufferUsages::VERTEX);
//!
//! // Check statistics
//! let stats = pool.stats();
//! println!("Reuse rate: {:.1}%", stats.reuse_rate * 100.0);
//! ```

use std::collections::HashMap;
use wgpu::{Buffer, BufferUsages, Device};

/// Size classes for pooled buffers.
///
/// Buffers are grouped by size class to improve reuse rates.
/// Requests are rounded up to the next size class.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum BufferSizeClass {
    /// 256 bytes - tiny buffers for small uniform data
    Tiny,
    /// 1 KB - small buffers for per-draw uniforms
    Small,
    /// 4 KB - medium buffers for small vertex data
    Medium,
    /// 16 KB - large buffers for typical meshes
    Large,
    /// 64 KB - huge buffers for large data sets
    Huge,
}

impl BufferSizeClass {
    /// Returns the size in bytes for this class.
    #[must_use]
    pub const fn size(self) -> u64 {
        match self {
            BufferSizeClass::Tiny => 256,
            BufferSizeClass::Small => 1024,
            BufferSizeClass::Medium => 4096,
            BufferSizeClass::Large => 16384,
            BufferSizeClass::Huge => 65536,
        }
    }

    /// Returns the appropriate size class for a given size.
    ///
    /// Rounds up to the smallest class that can fit the requested size.
    /// Returns `None` if the size exceeds the largest class.
    #[must_use]
    pub fn from_size(size: u64) -> Option<Self> {
        if size <= 256 {
            Some(BufferSizeClass::Tiny)
        } else if size <= 1024 {
            Some(BufferSizeClass::Small)
        } else if size <= 4096 {
            Some(BufferSizeClass::Medium)
        } else if size <= 16384 {
            Some(BufferSizeClass::Large)
        } else if size <= 65536 {
            Some(BufferSizeClass::Huge)
        } else {
            None
        }
    }

    /// Returns all size classes in ascending order.
    #[must_use]
    pub const fn all() -> [BufferSizeClass; 5] {
        [
            BufferSizeClass::Tiny,
            BufferSizeClass::Small,
            BufferSizeClass::Medium,
            BufferSizeClass::Large,
            BufferSizeClass::Huge,
        ]
    }
}

impl Default for BufferSizeClass {
    fn default() -> Self {
        Self::Small
    }
}

/// Statistics for the buffer pool.
#[derive(Debug, Clone, Default)]
pub struct PoolStats {
    /// Total number of buffers allocated (new allocations).
    pub allocated: u64,
    /// Total number of buffers reused from pool.
    pub reused: u64,
    /// Current number of buffers in the pool (available for reuse).
    pub pooled: u64,
    /// Reuse rate (0.0 to 1.0).
    pub reuse_rate: f32,
}

impl PoolStats {
    /// Returns the total number of acquisition requests.
    #[must_use]
    pub fn total_requests(&self) -> u64 {
        self.allocated + self.reused
    }
}

/// Key for pool lookup (size class + usage flags).
type PoolKey = (BufferSizeClass, BufferUsages);

/// GPU buffer pool for efficient memory management.
///
/// Maintains pools of buffers organized by size class and usage flags.
/// When a buffer is released, it's returned to the pool for later reuse.
pub struct BufferPool {
    /// Pools indexed by (size_class, usage)
    pools: HashMap<PoolKey, Vec<Buffer>>,
    /// Number of buffers allocated (new)
    allocated: u64,
    /// Number of buffers reused from pool
    reused: u64,
}

impl BufferPool {
    /// Creates a new empty buffer pool.
    #[must_use]
    pub fn new() -> Self {
        Self {
            pools: HashMap::new(),
            allocated: 0,
            reused: 0,
        }
    }

    /// Acquires a buffer of at least the requested size.
    ///
    /// If a suitable buffer is available in the pool, it's reused.
    /// Otherwise, a new buffer is allocated.
    ///
    /// # Arguments
    ///
    /// * `device` - The wgpu device for creating buffers
    /// * `size` - Minimum required size in bytes
    /// * `usage` - Buffer usage flags
    /// * `label` - Optional debug label
    ///
    /// # Returns
    ///
    /// A buffer with at least the requested size. For sizes larger than
    /// the largest pool class (64KB), a new buffer is always allocated.
    pub fn acquire(
        &mut self,
        device: &Device,
        size: u64,
        usage: BufferUsages,
        label: Option<&str>,
    ) -> Buffer {
        // Try to find a size class for pooling
        if let Some(size_class) = BufferSizeClass::from_size(size) {
            let key = (size_class, usage);

            // Try to get a buffer from the pool
            if let Some(pool) = self.pools.get_mut(&key) {
                if let Some(buffer) = pool.pop() {
                    self.reused += 1;
                    return buffer;
                }
            }

            // No pooled buffer available, allocate new
            self.allocated += 1;
            self.create_buffer(device, size_class.size(), usage, label)
        } else {
            // Size too large for pooling, allocate directly
            self.allocated += 1;
            self.create_buffer(device, size, usage, label)
        }
    }

    /// Releases a buffer back to the pool for later reuse.
    ///
    /// # Arguments
    ///
    /// * `buffer` - The buffer to release
    /// * `usage` - The usage flags (must match what was used during acquire)
    ///
    /// Note: Buffers larger than the largest pool class are dropped
    /// instead of being pooled.
    pub fn release(&mut self, buffer: Buffer, usage: BufferUsages) {
        let size = buffer.size();

        // Only pool if within size class range
        if let Some(size_class) = BufferSizeClass::from_size(size) {
            let key = (size_class, usage);
            self.pools.entry(key).or_default().push(buffer);
        }
        // Buffers too large are just dropped (freed)
    }

    /// Returns statistics about pool usage.
    #[must_use]
    pub fn stats(&self) -> PoolStats {
        let pooled: u64 = self.pools.values().map(|v| v.len() as u64).sum();
        let total_requests = self.allocated + self.reused;
        let reuse_rate = if total_requests > 0 {
            self.reused as f32 / total_requests as f32
        } else {
            0.0
        };

        PoolStats {
            allocated: self.allocated,
            reused: self.reused,
            pooled,
            reuse_rate,
        }
    }

    /// Clears all pooled buffers, freeing GPU memory.
    ///
    /// Statistics are preserved. Use this when you need to reclaim
    /// GPU memory (e.g., on low memory warning).
    pub fn clear(&mut self) {
        self.pools.clear();
    }

    /// Returns the number of buffers currently pooled.
    #[must_use]
    pub fn pooled_count(&self) -> usize {
        self.pools.values().map(Vec::len).sum()
    }

    /// Returns the number of buffers pooled for a specific size class and usage.
    #[must_use]
    pub fn pooled_for(&self, size_class: BufferSizeClass, usage: BufferUsages) -> usize {
        self.pools
            .get(&(size_class, usage))
            .map_or(0, Vec::len)
    }

    /// Creates a new wgpu buffer.
    fn create_buffer(
        &self,
        device: &Device,
        size: u64,
        usage: BufferUsages,
        label: Option<&str>,
    ) -> Buffer {
        device.create_buffer(&wgpu::BufferDescriptor {
            label,
            size,
            usage,
            mapped_at_creation: false,
        })
    }
}

impl Default for BufferPool {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for BufferPool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let stats = self.stats();
        f.debug_struct("BufferPool")
            .field("allocated", &stats.allocated)
            .field("reused", &stats.reused)
            .field("pooled", &stats.pooled)
            .field("reuse_rate", &format!("{:.1}%", stats.reuse_rate * 100.0))
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_size_class_size() {
        assert_eq!(BufferSizeClass::Tiny.size(), 256);
        assert_eq!(BufferSizeClass::Small.size(), 1024);
        assert_eq!(BufferSizeClass::Medium.size(), 4096);
        assert_eq!(BufferSizeClass::Large.size(), 16384);
        assert_eq!(BufferSizeClass::Huge.size(), 65536);
    }

    #[test]
    fn test_buffer_size_class_from_size() {
        // Exact matches
        assert_eq!(BufferSizeClass::from_size(256), Some(BufferSizeClass::Tiny));
        assert_eq!(BufferSizeClass::from_size(1024), Some(BufferSizeClass::Small));
        assert_eq!(BufferSizeClass::from_size(4096), Some(BufferSizeClass::Medium));
        assert_eq!(BufferSizeClass::from_size(16384), Some(BufferSizeClass::Large));
        assert_eq!(BufferSizeClass::from_size(65536), Some(BufferSizeClass::Huge));

        // Round up
        assert_eq!(BufferSizeClass::from_size(1), Some(BufferSizeClass::Tiny));
        assert_eq!(BufferSizeClass::from_size(100), Some(BufferSizeClass::Tiny));
        assert_eq!(BufferSizeClass::from_size(257), Some(BufferSizeClass::Small));
        assert_eq!(BufferSizeClass::from_size(1025), Some(BufferSizeClass::Medium));
        assert_eq!(BufferSizeClass::from_size(4097), Some(BufferSizeClass::Large));
        assert_eq!(BufferSizeClass::from_size(16385), Some(BufferSizeClass::Huge));

        // Too large
        assert_eq!(BufferSizeClass::from_size(65537), None);
        assert_eq!(BufferSizeClass::from_size(100000), None);
    }

    #[test]
    fn test_buffer_size_class_all() {
        let all = BufferSizeClass::all();
        assert_eq!(all.len(), 5);
        assert_eq!(all[0], BufferSizeClass::Tiny);
        assert_eq!(all[4], BufferSizeClass::Huge);
    }

    #[test]
    fn test_buffer_size_class_ordering() {
        assert!(BufferSizeClass::Tiny < BufferSizeClass::Small);
        assert!(BufferSizeClass::Small < BufferSizeClass::Medium);
        assert!(BufferSizeClass::Medium < BufferSizeClass::Large);
        assert!(BufferSizeClass::Large < BufferSizeClass::Huge);
    }

    #[test]
    fn test_pool_stats_default() {
        let stats = PoolStats::default();
        assert_eq!(stats.allocated, 0);
        assert_eq!(stats.reused, 0);
        assert_eq!(stats.pooled, 0);
        assert_eq!(stats.reuse_rate, 0.0);
    }

    #[test]
    fn test_pool_stats_total_requests() {
        let stats = PoolStats {
            allocated: 5,
            reused: 3,
            pooled: 2,
            reuse_rate: 0.375,
        };
        assert_eq!(stats.total_requests(), 8);
    }

    #[test]
    fn test_buffer_pool_new() {
        let pool = BufferPool::new();
        let stats = pool.stats();
        assert_eq!(stats.allocated, 0);
        assert_eq!(stats.reused, 0);
        assert_eq!(stats.pooled, 0);
        assert_eq!(pool.pooled_count(), 0);
    }

    #[test]
    fn test_buffer_pool_default() {
        let pool = BufferPool::default();
        assert_eq!(pool.pooled_count(), 0);
    }

    #[test]
    fn test_buffer_pool_debug() {
        let pool = BufferPool::new();
        let debug_str = format!("{:?}", pool);
        assert!(debug_str.contains("BufferPool"));
        assert!(debug_str.contains("allocated"));
        assert!(debug_str.contains("reused"));
    }

    // Note: Tests requiring actual wgpu Device would need integration tests
    // or a mock device. The following test documents expected behavior.
    #[test]
    fn test_buffer_pool_stats_calculation() {
        // Simulate pool statistics manually
        let mut pool = BufferPool::new();
        pool.allocated = 10;
        pool.reused = 5;

        let stats = pool.stats();
        assert_eq!(stats.allocated, 10);
        assert_eq!(stats.reused, 5);
        // reuse_rate = 5 / 15 = 0.333...
        assert!((stats.reuse_rate - 0.333).abs() < 0.01);
    }

    #[test]
    fn test_buffer_pool_clear() {
        let mut pool = BufferPool::new();
        pool.allocated = 5;
        pool.reused = 3;

        // Clear should not affect statistics
        pool.clear();
        let stats = pool.stats();
        assert_eq!(stats.allocated, 5);
        assert_eq!(stats.reused, 3);
        assert_eq!(stats.pooled, 0);
    }
}
