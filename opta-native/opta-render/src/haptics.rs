//! Haptics module for triggering tactile feedback from Rust.
//!
//! This module provides a thread-safe mechanism for Rust rendering code
//! to trigger haptic feedback on iOS devices. It works by storing a callback
//! function pointer that Swift sets during initialization.
//!
//! # Architecture
//!
//! The haptics system uses a callback pattern:
//! 1. Swift registers a callback via `opta_render_set_haptic_callback`
//! 2. Rust code calls convenience functions like `haptic_tap()` or `haptic_explosion()`
//! 3. The callback invokes Swift's `HapticsManager` to play the haptic
//!
//! # Thread Safety
//!
//! The callback is stored in an `AtomicPtr`, making it safe to call from
//! any thread. However, Swift's `HapticsManager` dispatches to the main
//! actor for actual haptic playback.
//!
//! # Example
//!
//! ```ignore
//! use opta_render::haptics::{haptic_tap, haptic_explosion};
//!
//! // Trigger a simple tap when user interacts
//! haptic_tap();
//!
//! // Trigger explosion when ring explodes
//! haptic_explosion();
//! ```

use std::sync::atomic::{AtomicPtr, Ordering};

/// Types of haptic feedback that can be triggered.
///
/// These map directly to `OptaHapticType` in the bridging header
/// and `HapticType` in Swift.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HapticType {
    /// Simple tap feedback for interactions
    Tap = 0,
    /// Explosion with aftershock waves for ring explosion animations
    Explosion = 1,
    /// Gentle ramp up for ring activation animations
    WakeUp = 2,
    /// Soft pulse for idle breathing animations
    Pulse = 3,
    /// Double tap warning for alerts
    Warning = 4,
}

/// Type alias for the haptic callback function pointer.
///
/// The callback takes a `u32` representing the `HapticType` enum value.
pub type HapticCallback = Option<extern "C" fn(u32)>;

/// Static storage for the haptic callback, using AtomicPtr for thread safety.
///
/// Initially null, set by Swift during app initialization.
static HAPTIC_CALLBACK: AtomicPtr<()> = AtomicPtr::new(std::ptr::null_mut());

/// Set the haptic callback that will be invoked when haptics are triggered.
///
/// This function is called from Swift during app initialization to register
/// the callback that will forward haptic requests to CoreHaptics.
///
/// # Safety
///
/// The callback must remain valid for the lifetime of the application.
/// Swift should set this once during initialization and not change it.
///
/// # Arguments
///
/// * `callback` - The callback function to invoke, or None to clear it
pub fn set_haptic_callback(callback: HapticCallback) {
    let ptr = match callback {
        Some(f) => f as *mut (),
        None => std::ptr::null_mut(),
    };
    HAPTIC_CALLBACK.store(ptr, Ordering::Release);
}

/// Trigger a haptic of the specified type.
///
/// This function retrieves the stored callback and invokes it with the
/// haptic type. If no callback is registered, this is a no-op.
///
/// # Arguments
///
/// * `haptic_type` - The type of haptic feedback to trigger
pub fn trigger_haptic(haptic_type: HapticType) {
    let ptr = HAPTIC_CALLBACK.load(Ordering::Acquire);

    if !ptr.is_null() {
        // SAFETY: We checked that ptr is not null, and it was set from a valid
        // function pointer in set_haptic_callback.
        let callback: extern "C" fn(u32) = unsafe { std::mem::transmute(ptr) };
        callback(haptic_type as u32);
    }
}

// MARK: - Convenience Functions

/// Trigger a simple tap haptic.
///
/// Use for basic UI interactions like button presses.
#[inline]
pub fn haptic_tap() {
    trigger_haptic(HapticType::Tap);
}

/// Trigger an explosion haptic with aftershock waves.
///
/// Use when the Opta Ring explodes or during impactful visual effects.
/// This produces a strong initial burst followed by 3 decreasing aftershocks.
#[inline]
pub fn haptic_explosion() {
    trigger_haptic(HapticType::Explosion);
}

/// Trigger a gentle wake-up haptic.
///
/// Use when the Opta Ring activates or wakes from idle state.
/// This produces a ramping sensation from soft to medium intensity.
#[inline]
pub fn haptic_wake_up() {
    trigger_haptic(HapticType::WakeUp);
}

/// Trigger a soft pulse haptic.
///
/// Use during idle breathing animations or subtle state changes.
/// This produces a gentle, brief vibration.
#[inline]
pub fn haptic_pulse() {
    trigger_haptic(HapticType::Pulse);
}

/// Trigger a double-tap warning haptic.
///
/// Use for warnings, alerts, or error states.
/// This produces two sharp taps in quick succession.
#[inline]
pub fn haptic_warning() {
    trigger_haptic(HapticType::Warning);
}

// MARK: - FFI Functions

/// FFI function to set the haptic callback from Swift.
///
/// # Safety
///
/// This function is called from Swift with a valid function pointer.
/// The callback must remain valid for the lifetime of the application.
#[no_mangle]
pub extern "C" fn opta_render_set_haptic_callback(callback: Option<extern "C" fn(u32)>) {
    set_haptic_callback(callback);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haptic_type_values() {
        assert_eq!(HapticType::Tap as u32, 0);
        assert_eq!(HapticType::Explosion as u32, 1);
        assert_eq!(HapticType::WakeUp as u32, 2);
        assert_eq!(HapticType::Pulse as u32, 3);
        assert_eq!(HapticType::Warning as u32, 4);
    }

    #[test]
    fn test_trigger_without_callback() {
        // Clear any existing callback first
        set_haptic_callback(None);

        // Should not panic when no callback is set
        trigger_haptic(HapticType::Tap);
        trigger_haptic(HapticType::Explosion);
        trigger_haptic(HapticType::WakeUp);
        trigger_haptic(HapticType::Pulse);
        trigger_haptic(HapticType::Warning);
    }

    #[test]
    fn test_set_and_clear_callback() {
        use std::sync::atomic::{AtomicU32, Ordering as AtomicOrdering};

        static CALL_COUNT: AtomicU32 = AtomicU32::new(0);

        extern "C" fn counting_callback(_haptic_type: u32) {
            CALL_COUNT.fetch_add(1, AtomicOrdering::SeqCst);
        }

        // Reset state
        CALL_COUNT.store(0, AtomicOrdering::SeqCst);

        // Set callback and verify it gets called
        set_haptic_callback(Some(counting_callback));
        trigger_haptic(HapticType::Tap);
        assert!(CALL_COUNT.load(AtomicOrdering::SeqCst) >= 1);

        // Clear callback
        set_haptic_callback(None);

        // After clearing, triggers should still not panic
        trigger_haptic(HapticType::Tap);
    }

    #[test]
    fn test_haptic_type_enum_copy() {
        let tap = HapticType::Tap;
        let tap_copy = tap;
        assert_eq!(tap, tap_copy);
    }
}
