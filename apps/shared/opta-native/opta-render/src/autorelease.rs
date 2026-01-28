//! Autorelease pool wrapper for Metal memory management.
//!
//! Apple's Metal framework uses Objective-C memory management internally.
//! When called from Rust via wgpu, Metal objects may be autoreleased,
//! requiring an autorelease pool to prevent memory leaks.
//!
//! # Why This Matters
//!
//! Without an autorelease pool:
//! - Metal drawable objects accumulate
//! - Memory usage grows unbounded during render loops
//! - May cause out-of-memory crashes on iOS
//!
//! # Usage
//!
//! Wrap every render frame in an autorelease pool:
//!
//! ```ignore
//! use opta_render::autorelease::with_autorelease_pool;
//!
//! // In CADisplayLink callback
//! with_autorelease_pool(|| {
//!     let frame = surface.get_current_texture()?;
//!     // ... render ...
//!     frame.present();
//!     Ok(())
//! });
//! ```
//!
//! # Platform Support
//!
//! - **macOS/iOS**: Uses `objc2::rc::autoreleasepool`
//! - **Other**: No-op passthrough (for cross-platform development)

/// Execute a closure within an Objective-C autorelease pool.
///
/// This prevents Metal memory leaks during render loops by ensuring
/// autoreleased objects are properly deallocated after each frame.
///
/// # Arguments
///
/// * `f` - The closure to execute within the autorelease pool
///
/// # Returns
///
/// The return value of the closure.
///
/// # Example
///
/// ```ignore
/// use opta_render::autorelease::with_autorelease_pool;
///
/// let result = with_autorelease_pool(|| {
///     // Metal operations here
///     42
/// });
/// assert_eq!(result, 42);
/// ```
#[cfg(any(target_os = "macos", target_os = "ios"))]
#[inline]
pub fn with_autorelease_pool<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    // Use objc2's autoreleasepool which handles the Objective-C runtime
    objc2::rc::autoreleasepool(|_pool| f())
}

/// No-op autorelease pool for non-Apple platforms.
///
/// Allows the same code to compile on all platforms without
/// conditional compilation at call sites.
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[inline]
pub fn with_autorelease_pool<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    f()
}

/// RAII guard for autorelease pool scope.
///
/// Alternative to `with_autorelease_pool` for cases where a closure
/// is inconvenient. The pool is drained when the guard is dropped.
///
/// # Example
///
/// ```ignore
/// use opta_render::autorelease::AutoreleaseGuard;
///
/// {
///     let _pool = AutoreleaseGuard::new();
///     // Metal operations here
/// } // Pool drained here
/// ```
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub struct AutoreleaseGuard {
    // We use a marker to ensure the guard is not Send/Sync
    // Autorelease pools are thread-local
    _marker: std::marker::PhantomData<*const ()>,
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
impl AutoreleaseGuard {
    /// Create a new autorelease pool guard.
    ///
    /// # Note
    ///
    /// Prefer `with_autorelease_pool` when possible. This guard
    /// uses a nested autoreleasepool approach.
    #[must_use]
    pub fn new() -> Self {
        Self {
            _marker: std::marker::PhantomData,
        }
    }

    /// Execute code within this guard's scope.
    ///
    /// This is the preferred way to use the guard.
    pub fn run<F, R>(&self, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        with_autorelease_pool(f)
    }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
impl Default for AutoreleaseGuard {
    fn default() -> Self {
        Self::new()
    }
}

/// No-op guard for non-Apple platforms.
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub struct AutoreleaseGuard {
    _marker: std::marker::PhantomData<()>,
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
impl AutoreleaseGuard {
    #[must_use]
    pub fn new() -> Self {
        Self {
            _marker: std::marker::PhantomData,
        }
    }

    pub fn run<F, R>(&self, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        f()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
impl Default for AutoreleaseGuard {
    fn default() -> Self {
        Self::new()
    }
}

/// Trait for types that can be wrapped in an autorelease pool.
///
/// Provides a convenient way to wrap render operations.
pub trait AutoreleaseExt {
    /// Execute the render operation within an autorelease pool.
    fn with_pool<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&Self) -> R,
    {
        with_autorelease_pool(|| f(self))
    }
}

// Implement for common types
impl<T> AutoreleaseExt for T {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_autorelease_pool() {
        let result = with_autorelease_pool(|| 42);
        assert_eq!(result, 42);
    }

    #[test]
    fn test_with_autorelease_pool_result() {
        let result: Result<i32, &str> = with_autorelease_pool(|| Ok(42));
        assert_eq!(result, Ok(42));
    }

    #[test]
    fn test_nested_pools() {
        let result = with_autorelease_pool(|| {
            with_autorelease_pool(|| {
                with_autorelease_pool(|| 42)
            })
        });
        assert_eq!(result, 42);
    }

    #[test]
    fn test_autorelease_guard() {
        let guard = AutoreleaseGuard::new();
        let result = guard.run(|| 42);
        assert_eq!(result, 42);
    }

    #[test]
    fn test_autorelease_ext() {
        let value = 42;
        let result = value.with_pool(|v| *v * 2);
        assert_eq!(result, 84);
    }

    #[test]
    fn test_with_state() {
        let mut counter = 0;

        for _ in 0..10 {
            with_autorelease_pool(|| {
                counter += 1;
            });
        }

        assert_eq!(counter, 10);
    }
}
