//! GPU memory management utilities.
//!
//! This module provides:
//! - Buffer pooling for reduced allocation overhead
//! - Size-class based buffer management
//! - Memory statistics for monitoring
//!
//! ## Example
//!
//! ```ignore
//! use opta_render::memory::{BufferPool, BufferSizeClass, PoolStats};
//! use wgpu::BufferUsages;
//!
//! let mut pool = BufferPool::new();
//!
//! // Acquire buffers (will allocate on first use)
//! let buf1 = pool.acquire(&device, 256, BufferUsages::UNIFORM, Some("uniforms"));
//! let buf2 = pool.acquire(&device, 256, BufferUsages::UNIFORM, Some("uniforms2"));
//!
//! // Release back to pool
//! pool.release(buf1, BufferUsages::UNIFORM);
//!
//! // Next acquire of same size/usage will reuse
//! let buf3 = pool.acquire(&device, 256, BufferUsages::UNIFORM, Some("uniforms3"));
//!
//! // Check reuse statistics
//! let stats = pool.stats();
//! assert!(stats.reuse_rate > 0.0);
//! ```

mod pool;

pub use pool::{BufferPool, BufferSizeClass, PoolStats};
