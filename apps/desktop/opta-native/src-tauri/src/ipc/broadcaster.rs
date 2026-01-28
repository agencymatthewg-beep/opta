//! Rate-limited metrics broadcast system.
//!
//! This module provides a broadcast channel for streaming serialized
//! metrics to multiple consumers (socket server, event emitters, etc.)
//! with built-in rate limiting to prevent excessive CPU usage.
//!
//! ## Rate Limiting
//!
//! The broadcaster enforces a maximum update rate (default 25Hz) to:
//! - Prevent CPU spikes from rapid updates
//! - Allow UI to update smoothly at 60fps
//! - Reduce thermal impact on the device

use std::time::{Duration, Instant};
use tokio::sync::broadcast;

use super::metrics_types::SystemMetricsData;
use super::serializer::SERIALIZER;

/// Default broadcast rate in Hz.
pub const BROADCAST_RATE_HZ: u64 = 25;

/// Minimum interval between broadcasts (40ms for 25Hz).
pub const MIN_BROADCAST_INTERVAL: Duration = Duration::from_millis(1000 / BROADCAST_RATE_HZ);

/// Buffer size for broadcast channel.
/// Enough to handle brief bursts without dropping.
const CHANNEL_BUFFER_SIZE: usize = 16;

/// Broadcasts serialized metrics to multiple subscribers.
///
/// The broadcaster:
/// - Serializes metrics using FlatBuffers
/// - Rate-limits to prevent excessive updates
/// - Supports multiple subscribers (socket server, etc.)
pub struct MetricsBroadcaster {
    /// Broadcast sender
    tx: broadcast::Sender<Vec<u8>>,
    /// Last broadcast timestamp for rate limiting
    last_broadcast: Instant,
    /// Minimum interval between broadcasts
    min_interval: Duration,
    /// Count of broadcasts (for diagnostics)
    broadcast_count: u64,
    /// Count of skipped broadcasts due to rate limiting
    skipped_count: u64,
}

impl MetricsBroadcaster {
    /// Create a new broadcaster with default rate limit.
    ///
    /// Returns the broadcaster and an initial receiver.
    pub fn new() -> (Self, broadcast::Receiver<Vec<u8>>) {
        Self::with_rate(BROADCAST_RATE_HZ)
    }

    /// Create a new broadcaster with custom rate limit.
    ///
    /// # Arguments
    ///
    /// * `rate_hz` - Maximum broadcasts per second
    pub fn with_rate(rate_hz: u64) -> (Self, broadcast::Receiver<Vec<u8>>) {
        let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
        let min_interval = if rate_hz > 0 {
            Duration::from_millis(1000 / rate_hz)
        } else {
            Duration::from_millis(0)
        };

        (
            Self {
                tx,
                last_broadcast: Instant::now() - min_interval, // Allow immediate first broadcast
                min_interval,
                broadcast_count: 0,
                skipped_count: 0,
            },
            rx,
        )
    }

    /// Broadcast metrics if rate limit allows.
    ///
    /// If not enough time has passed since the last broadcast,
    /// the call returns without sending.
    ///
    /// # Arguments
    ///
    /// * `metrics` - System metrics to broadcast
    ///
    /// # Returns
    ///
    /// `true` if the metrics were broadcast, `false` if rate-limited.
    pub fn broadcast(&mut self, metrics: &SystemMetricsData) -> bool {
        // Check rate limit
        let elapsed = self.last_broadcast.elapsed();
        if elapsed < self.min_interval {
            self.skipped_count += 1;
            return false;
        }

        // Serialize to FlatBuffer
        // Handle poisoned mutex gracefully - recover and continue
        let data = {
            let mut serializer = SERIALIZER
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            serializer.serialize(metrics)
        };

        // Broadcast (ignore errors if no receivers)
        let _ = self.tx.send(data);

        self.last_broadcast = Instant::now();
        self.broadcast_count += 1;

        true
    }

    /// Force broadcast regardless of rate limit.
    ///
    /// Use sparingly - only for critical updates that must be delivered.
    pub fn broadcast_force(&mut self, metrics: &SystemMetricsData) {
        // Handle poisoned mutex gracefully - recover and continue
        let data = {
            let mut serializer = SERIALIZER
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            serializer.serialize(metrics)
        };

        let _ = self.tx.send(data);
        self.last_broadcast = Instant::now();
        self.broadcast_count += 1;
    }

    /// Get a new receiver for the broadcast channel.
    ///
    /// Multiple receivers can subscribe to the same broadcast.
    pub fn subscribe(&self) -> broadcast::Receiver<Vec<u8>> {
        self.tx.subscribe()
    }

    /// Get the number of current subscribers.
    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }

    /// Get the total number of successful broadcasts.
    pub fn broadcast_count(&self) -> u64 {
        self.broadcast_count
    }

    /// Get the number of skipped broadcasts due to rate limiting.
    pub fn skipped_count(&self) -> u64 {
        self.skipped_count
    }

    /// Get the effective broadcast rate in Hz.
    pub fn effective_rate(&self) -> f64 {
        1000.0 / self.min_interval.as_millis() as f64
    }

    /// Get diagnostics about the broadcaster.
    pub fn diagnostics(&self) -> BroadcasterDiagnostics {
        BroadcasterDiagnostics {
            broadcast_count: self.broadcast_count,
            skipped_count: self.skipped_count,
            receiver_count: self.receiver_count(),
            rate_hz: self.effective_rate(),
        }
    }
}

impl Default for MetricsBroadcaster {
    fn default() -> Self {
        Self::new().0
    }
}

/// Diagnostics information about the broadcaster.
#[derive(Debug, Clone)]
pub struct BroadcasterDiagnostics {
    /// Total successful broadcasts
    pub broadcast_count: u64,
    /// Broadcasts skipped due to rate limiting
    pub skipped_count: u64,
    /// Current number of subscribers
    pub receiver_count: usize,
    /// Configured rate in Hz
    pub rate_hz: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_broadcaster_creation() {
        let (broadcaster, _rx) = MetricsBroadcaster::new();
        assert_eq!(broadcaster.broadcast_count(), 0);
        assert_eq!(broadcaster.skipped_count(), 0);
        assert!((broadcaster.effective_rate() - 25.0).abs() < 1.0);
    }

    #[test]
    fn test_broadcast_rate_limiting() {
        let (mut broadcaster, _rx) = MetricsBroadcaster::new();
        let metrics = SystemMetricsData::empty();

        // First broadcast should succeed
        assert!(broadcaster.broadcast(&metrics));
        assert_eq!(broadcaster.broadcast_count(), 1);

        // Immediate second broadcast should be rate-limited
        assert!(!broadcaster.broadcast(&metrics));
        assert_eq!(broadcaster.broadcast_count(), 1);
        assert_eq!(broadcaster.skipped_count(), 1);
    }

    #[test]
    fn test_force_broadcast() {
        let (mut broadcaster, _rx) = MetricsBroadcaster::new();
        let metrics = SystemMetricsData::empty();

        // First broadcast
        assert!(broadcaster.broadcast(&metrics));

        // Force broadcast should work even immediately after
        broadcaster.broadcast_force(&metrics);
        assert_eq!(broadcaster.broadcast_count(), 2);
    }

    #[test]
    fn test_custom_rate() {
        let (broadcaster, _rx) = MetricsBroadcaster::with_rate(60);
        assert!((broadcaster.effective_rate() - 60.0).abs() < 2.0);
    }

    #[test]
    fn test_multiple_subscribers() {
        let (broadcaster, _rx1) = MetricsBroadcaster::new();
        let _rx2 = broadcaster.subscribe();
        let _rx3 = broadcaster.subscribe();

        // Should have 3 receivers (original + 2 subscribers)
        assert_eq!(broadcaster.receiver_count(), 3);
    }

    #[test]
    fn test_diagnostics() {
        let (mut broadcaster, _rx) = MetricsBroadcaster::new();
        let metrics = SystemMetricsData::empty();

        broadcaster.broadcast(&metrics);
        broadcaster.broadcast(&metrics); // Should be skipped

        let diag = broadcaster.diagnostics();
        assert_eq!(diag.broadcast_count, 1);
        assert_eq!(diag.skipped_count, 1);
        assert_eq!(diag.receiver_count, 1);
    }
}
