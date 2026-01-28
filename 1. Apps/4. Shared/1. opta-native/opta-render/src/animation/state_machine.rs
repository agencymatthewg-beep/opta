//! Animation state machine for managing complex animation sequences.
//!
//! This module provides a state machine abstraction for orchestrating
//! multi-state animations with automatic transitions, timing, and spring-based
//! value interpolation.
//!
//! # Example
//!
//! ```
//! use opta_render::animation::{AnimationState, AnimationStateMachine, Transition, SpringConfig};
//! use std::time::Duration;
//!
//! // Create states
//! let idle = AnimationState::new("idle")
//!     .with_value("opacity", 1.0)
//!     .with_value("scale", 1.0);
//!
//! let active = AnimationState::new("active")
//!     .with_duration(Duration::from_millis(500))
//!     .with_value("opacity", 0.8)
//!     .with_value("scale", 1.2);
//!
//! // Create state machine
//! let mut sm = AnimationStateMachine::new("idle");
//! sm.add_state(idle);
//! sm.add_state(active);
//! sm.add_transition(Transition::new("idle", "active"));
//! sm.add_transition(Transition::new("active", "idle"));
//!
//! // Transition and animate
//! sm.transition_to("active");
//! sm.update(Duration::from_millis(16));
//! ```

use super::{Spring, SpringConfig};
use std::collections::HashMap;
use std::time::Duration;

/// Type alias for state identifiers.
pub type StateId = &'static str;

/// Callback type for state transitions.
/// Called with (from_state, to_state) when a transition occurs.
///
/// Reserved for future use with transition event hooks.
#[allow(dead_code)]
pub type TransitionCallback = Box<dyn Fn(StateId, StateId) + Send + Sync>;

/// Defines an animation state with target values and optional timing.
///
/// Each state can specify:
/// - A unique identifier
/// - Optional duration (for auto-transitioning states)
/// - A spring configuration for entering this state
/// - Target values for animated properties
#[derive(Debug, Clone)]
pub struct AnimationState {
    /// Unique identifier for this state.
    pub id: StateId,

    /// Optional duration after which the state auto-transitions.
    /// If None, the state persists until explicitly transitioned.
    pub duration: Option<Duration>,

    /// Spring configuration used when entering this state.
    pub entry_spring: SpringConfig,

    /// Target values for each animated property.
    pub values: HashMap<&'static str, f32>,
}

impl AnimationState {
    /// Create a new animation state with the given identifier.
    #[must_use]
    pub fn new(id: StateId) -> Self {
        Self {
            id,
            duration: None,
            entry_spring: SpringConfig::RESPONSIVE,
            values: HashMap::new(),
        }
    }

    /// Set the duration for this state (enables auto-transition).
    #[must_use]
    pub fn with_duration(mut self, duration: Duration) -> Self {
        self.duration = Some(duration);
        self
    }

    /// Set the spring configuration for entering this state.
    #[must_use]
    pub fn with_spring(mut self, spring: SpringConfig) -> Self {
        self.entry_spring = spring;
        self
    }

    /// Add a target value for an animated property.
    #[must_use]
    pub fn with_value(mut self, key: &'static str, value: f32) -> Self {
        self.values.insert(key, value);
        self
    }
}

/// Defines a transition between two states.
///
/// Transitions can have:
/// - Source and destination states
/// - Optional delay before the transition begins
/// - Optional spring override for the transition animation
#[derive(Debug, Clone)]
pub struct Transition {
    /// State to transition from.
    pub from: StateId,

    /// State to transition to.
    pub to: StateId,

    /// Delay before the transition begins.
    pub delay: Duration,

    /// Optional spring configuration override for this transition.
    /// If None, uses the target state's entry_spring.
    pub spring: Option<SpringConfig>,
}

impl Transition {
    /// Create a new transition between two states.
    #[must_use]
    pub fn new(from: StateId, to: StateId) -> Self {
        Self {
            from,
            to,
            delay: Duration::ZERO,
            spring: None,
        }
    }

    /// Set a delay before the transition begins.
    #[must_use]
    pub fn with_delay(mut self, delay: Duration) -> Self {
        self.delay = delay;
        self
    }

    /// Set a custom spring configuration for this transition.
    #[must_use]
    pub fn with_spring(mut self, spring: SpringConfig) -> Self {
        self.spring = Some(spring);
        self
    }
}

/// Pending transition information.
#[derive(Debug, Clone)]
struct PendingTransition {
    target: StateId,
    delay_remaining: Duration,
    spring_override: Option<SpringConfig>,
}

/// A state machine for managing complex animation sequences.
///
/// The state machine manages:
/// - A set of named states with target values
/// - Transitions between states with optional delays
/// - Spring-based interpolation of values
/// - Automatic transitions based on state duration
pub struct AnimationStateMachine {
    /// Registered states.
    states: HashMap<StateId, AnimationState>,

    /// Registered transitions.
    transitions: Vec<Transition>,

    /// Current active state.
    current_state: StateId,

    /// Time spent in the current state.
    time_in_state: Duration,

    /// Animated values with their spring instances.
    values: HashMap<&'static str, Spring>,

    /// Pending transition (if any).
    pending_transition: Option<PendingTransition>,
}

impl AnimationStateMachine {
    /// Create a new state machine with the given initial state.
    ///
    /// Note: The initial state should be added via `add_state()` before use.
    #[must_use]
    pub fn new(initial_state: StateId) -> Self {
        Self {
            states: HashMap::new(),
            transitions: Vec::new(),
            current_state: initial_state,
            time_in_state: Duration::ZERO,
            values: HashMap::new(),
            pending_transition: None,
        }
    }

    /// Add a state to the state machine.
    ///
    /// If this is the first state added and matches the initial state,
    /// the values will be initialized.
    pub fn add_state(&mut self, state: AnimationState) {
        let is_current = state.id == self.current_state;
        let state_values = state.values.clone();
        let spring_config = state.entry_spring;

        self.states.insert(state.id, state);

        // Initialize values if this is the current state
        if is_current {
            for (key, value) in state_values {
                self.values
                    .insert(key, Spring::new(value, spring_config));
            }
        }
    }

    /// Add a transition to the state machine.
    pub fn add_transition(&mut self, transition: Transition) {
        self.transitions.push(transition);
    }

    /// Get the current state identifier.
    #[must_use]
    pub fn current_state(&self) -> StateId {
        self.current_state
    }

    /// Get the current value for a property.
    ///
    /// Returns 0.0 if the property doesn't exist.
    #[must_use]
    pub fn get_value(&self, key: &str) -> f32 {
        self.values.get(key).map_or(0.0, |s| s.value())
    }

    /// Get all current values as a map.
    #[must_use]
    pub fn get_values(&self) -> HashMap<&'static str, f32> {
        self.values.iter().map(|(k, v)| (*k, v.value())).collect()
    }

    /// Check if all springs are at rest.
    #[must_use]
    pub fn is_at_rest(&self) -> bool {
        self.pending_transition.is_none() && self.values.values().all(|s| s.is_at_rest())
    }

    /// Attempt to transition to a target state.
    ///
    /// Returns true if a valid transition was found and initiated.
    /// Returns false if no valid transition exists from the current state.
    pub fn transition_to(&mut self, target: StateId) -> bool {
        // Find a valid transition
        let transition = self
            .transitions
            .iter()
            .find(|t| t.from == self.current_state && t.to == target);

        if let Some(t) = transition {
            if t.delay.is_zero() {
                self.execute_transition(target, t.spring);
            } else {
                self.pending_transition = Some(PendingTransition {
                    target,
                    delay_remaining: t.delay,
                    spring_override: t.spring,
                });
            }
            true
        } else {
            false
        }
    }

    /// Force a transition to a target state without requiring a registered transition.
    ///
    /// This ignores the transition graph and directly moves to the target state.
    pub fn force_transition(&mut self, target: StateId) {
        self.execute_transition(target, None);
    }

    /// Execute the actual transition to a state.
    fn execute_transition(&mut self, target: StateId, spring_override: Option<SpringConfig>) {
        if let Some(state) = self.states.get(target) {
            let spring_config = spring_override.unwrap_or(state.entry_spring);

            // Update targets for all values in the new state
            for (key, &target_value) in &state.values {
                if let Some(spring) = self.values.get_mut(key) {
                    // Update existing spring with new config and target
                    *spring = Spring::new(spring.value(), spring_config);
                    spring.set_target(target_value);
                } else {
                    // Create new spring for this value
                    let mut spring = Spring::new(0.0, spring_config);
                    spring.set_target(target_value);
                    self.values.insert(key, spring);
                }
            }

            self.current_state = target;
            self.time_in_state = Duration::ZERO;
            self.pending_transition = None;
        }
    }

    /// Update the state machine by the given time delta.
    ///
    /// This handles:
    /// - Pending transition delays
    /// - Auto-transitions based on state duration
    /// - Spring animation updates
    pub fn update(&mut self, dt: Duration) {
        // Handle pending transition
        if let Some(ref mut pending) = self.pending_transition {
            if pending.delay_remaining <= dt {
                let target = pending.target;
                let spring = pending.spring_override;
                self.execute_transition(target, spring);
            } else {
                pending.delay_remaining -= dt;
            }
        }

        // Update time in state
        self.time_in_state += dt;

        // Check for auto-transition
        if self.pending_transition.is_none() {
            if let Some(state) = self.states.get(self.current_state) {
                if let Some(duration) = state.duration {
                    if self.time_in_state >= duration {
                        // Find the first valid transition from this state
                        let next_state = self
                            .transitions
                            .iter()
                            .find(|t| t.from == self.current_state)
                            .map(|t| (t.to, t.spring));

                        if let Some((target, spring)) = next_state {
                            self.execute_transition(target, spring);
                        }
                    }
                }
            }
        }

        // Update all springs
        let dt_secs = dt.as_secs_f32();
        for spring in self.values.values_mut() {
            spring.update(dt_secs);
        }
    }
}

/// Pre-defined ring animation states and state machine factory.
pub mod ring_states {
    use super::*;

    /// Dormant state - ring at rest, minimal activity.
    pub const DORMANT: StateId = "dormant";

    /// Waking state - transitioning from dormant to active.
    pub const WAKING: StateId = "waking";

    /// Active state - ring fully engaged and ready.
    pub const ACTIVE: StateId = "active";

    /// Processing state - ring actively processing.
    pub const PROCESSING: StateId = "processing";

    /// Exploding state - dramatic expansion/effect.
    pub const EXPLODING: StateId = "exploding";

    /// Recovering state - returning to normal after explosion.
    pub const RECOVERING: StateId = "recovering";

    /// Create a pre-configured ring state machine with all states and transitions.
    ///
    /// States:
    /// - dormant: Low energy, slow spin, tilted, no glow
    /// - waking: Medium energy, increasing spin, straightening (800ms auto-transition)
    /// - active: Full energy, normal spin, level, glowing
    /// - processing: High energy, fast spin, bright glow
    /// - exploding: Maximum energy, very fast spin, intense glow (500ms auto-transition)
    /// - recovering: Reducing energy, slowing spin (1500ms auto-transition)
    #[must_use]
    pub fn create_ring_state_machine() -> AnimationStateMachine {
        let mut sm = AnimationStateMachine::new(DORMANT);

        // Dormant state - minimal activity
        sm.add_state(
            AnimationState::new(DORMANT)
                .with_spring(SpringConfig::GENTLE)
                .with_value("energy", 0.0)
                .with_value("spin", 0.1)
                .with_value("tilt", 15.0)
                .with_value("glow", 0.0)
                .with_value("plasma", 0.0),
        );

        // Waking state - transitioning to active
        sm.add_state(
            AnimationState::new(WAKING)
                .with_duration(Duration::from_millis(800))
                .with_spring(SpringConfig::RESPONSIVE)
                .with_value("energy", 0.5)
                .with_value("spin", 0.5)
                .with_value("tilt", 5.0)
                .with_value("glow", 0.3)
                .with_value("plasma", 0.2),
        );

        // Active state - fully engaged
        sm.add_state(
            AnimationState::new(ACTIVE)
                .with_spring(SpringConfig::RESPONSIVE)
                .with_value("energy", 1.0)
                .with_value("spin", 1.0)
                .with_value("tilt", 0.0)
                .with_value("glow", 0.6)
                .with_value("plasma", 0.5),
        );

        // Processing state - high activity
        sm.add_state(
            AnimationState::new(PROCESSING)
                .with_spring(SpringConfig::STIFF)
                .with_value("energy", 1.5)
                .with_value("spin", 2.0)
                .with_value("tilt", 0.0)
                .with_value("glow", 1.0)
                .with_value("plasma", 0.8),
        );

        // Exploding state - dramatic effect
        sm.add_state(
            AnimationState::new(EXPLODING)
                .with_duration(Duration::from_millis(500))
                .with_spring(SpringConfig::WOBBLY)
                .with_value("energy", 3.0)
                .with_value("spin", 5.0)
                .with_value("tilt", 0.0)
                .with_value("glow", 2.0)
                .with_value("plasma", 1.5),
        );

        // Recovering state - returning to normal
        sm.add_state(
            AnimationState::new(RECOVERING)
                .with_duration(Duration::from_millis(1500))
                .with_spring(SpringConfig::MOLASSES)
                .with_value("energy", 0.8)
                .with_value("spin", 0.8)
                .with_value("tilt", 2.0)
                .with_value("glow", 0.4)
                .with_value("plasma", 0.3),
        );

        // Transitions
        // From dormant
        sm.add_transition(Transition::new(DORMANT, WAKING));

        // From waking (auto-transitions to active after 800ms)
        sm.add_transition(Transition::new(WAKING, ACTIVE));

        // From active
        sm.add_transition(Transition::new(ACTIVE, PROCESSING));
        sm.add_transition(Transition::new(ACTIVE, DORMANT));
        sm.add_transition(Transition::new(ACTIVE, EXPLODING));

        // From processing
        sm.add_transition(Transition::new(PROCESSING, ACTIVE));
        sm.add_transition(Transition::new(PROCESSING, EXPLODING));

        // From exploding (auto-transitions to recovering after 500ms)
        sm.add_transition(Transition::new(EXPLODING, RECOVERING));

        // From recovering (auto-transitions to active after 1500ms)
        sm.add_transition(Transition::new(RECOVERING, ACTIVE));

        sm
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_machine_basic() {
        let mut sm = AnimationStateMachine::new("idle");

        // Add states
        sm.add_state(
            AnimationState::new("idle")
                .with_value("opacity", 1.0)
                .with_value("scale", 1.0),
        );

        sm.add_state(
            AnimationState::new("active")
                .with_value("opacity", 0.8)
                .with_value("scale", 1.5),
        );

        // Add transitions
        sm.add_transition(Transition::new("idle", "active"));
        sm.add_transition(Transition::new("active", "idle"));

        // Verify initial state
        assert_eq!(sm.current_state(), "idle");
        assert!((sm.get_value("opacity") - 1.0).abs() < 0.001);
        assert!((sm.get_value("scale") - 1.0).abs() < 0.001);

        // Transition to active
        assert!(sm.transition_to("active"));
        assert_eq!(sm.current_state(), "active");

        // Animate for 2 seconds
        for _ in 0..120 {
            sm.update(Duration::from_millis(16));
        }

        // Should have reached target values
        assert!(
            (sm.get_value("opacity") - 0.8).abs() < 0.1,
            "opacity = {}",
            sm.get_value("opacity")
        );
        assert!(
            (sm.get_value("scale") - 1.5).abs() < 0.1,
            "scale = {}",
            sm.get_value("scale")
        );

        // Invalid transition should return false
        assert!(!sm.transition_to("nonexistent"));

        // Force transition should work without registered transition
        sm.force_transition("idle");
        assert_eq!(sm.current_state(), "idle");
    }

    #[test]
    fn test_ring_state_machine() {
        use ring_states::*;

        let mut sm = create_ring_state_machine();

        // Verify initial state
        assert_eq!(sm.current_state(), DORMANT);
        assert!((sm.get_value("energy") - 0.0).abs() < 0.001);
        assert!((sm.get_value("spin") - 0.1).abs() < 0.001);

        // Transition to waking
        assert!(sm.transition_to(WAKING));
        assert_eq!(sm.current_state(), WAKING);

        // Simulate time passing (800ms + some buffer)
        // The waking state should auto-transition to active after 800ms
        for _ in 0..60 {
            sm.update(Duration::from_millis(16)); // ~960ms total
        }

        // Should have auto-transitioned to active
        assert_eq!(
            sm.current_state(),
            ACTIVE,
            "Should have auto-transitioned from waking to active"
        );

        // Verify active state values after more animation
        for _ in 0..120 {
            sm.update(Duration::from_millis(16));
        }

        assert!(
            (sm.get_value("energy") - 1.0).abs() < 0.2,
            "energy = {}",
            sm.get_value("energy")
        );
        assert!(
            (sm.get_value("spin") - 1.0).abs() < 0.2,
            "spin = {}",
            sm.get_value("spin")
        );

        // Test processing transition
        assert!(sm.transition_to(PROCESSING));
        assert_eq!(sm.current_state(), PROCESSING);

        // Test exploding transition
        assert!(sm.transition_to(EXPLODING));
        assert_eq!(sm.current_state(), EXPLODING);

        // Exploding should auto-transition to recovering after 500ms
        for _ in 0..40 {
            sm.update(Duration::from_millis(16)); // ~640ms total
        }

        assert_eq!(
            sm.current_state(),
            RECOVERING,
            "Should have auto-transitioned from exploding to recovering"
        );

        // Recovering should auto-transition to active after 1500ms
        for _ in 0..100 {
            sm.update(Duration::from_millis(16)); // ~1600ms total
        }

        assert_eq!(
            sm.current_state(),
            ACTIVE,
            "Should have auto-transitioned from recovering to active"
        );
    }

    #[test]
    fn test_transition_with_delay() {
        let mut sm = AnimationStateMachine::new("a");

        sm.add_state(AnimationState::new("a").with_value("x", 0.0));
        sm.add_state(AnimationState::new("b").with_value("x", 100.0));

        sm.add_transition(Transition::new("a", "b").with_delay(Duration::from_millis(500)));

        assert!(sm.transition_to("b"));

        // Should still be in state 'a' due to delay
        sm.update(Duration::from_millis(100));
        assert_eq!(sm.current_state(), "a");

        sm.update(Duration::from_millis(200));
        assert_eq!(sm.current_state(), "a");

        // After total of 500ms, should transition
        sm.update(Duration::from_millis(250));
        assert_eq!(sm.current_state(), "b");
    }

    #[test]
    fn test_is_at_rest() {
        let mut sm = AnimationStateMachine::new("idle");

        sm.add_state(
            AnimationState::new("idle")
                .with_spring(SpringConfig::STIFF)
                .with_value("x", 0.0),
        );

        sm.add_state(
            AnimationState::new("active")
                .with_spring(SpringConfig::STIFF)
                .with_value("x", 10.0),
        );

        sm.add_transition(Transition::new("idle", "active"));

        // Initially at rest
        assert!(sm.is_at_rest());

        // After transition, not at rest
        sm.transition_to("active");
        sm.update(Duration::from_millis(16));
        assert!(!sm.is_at_rest());

        // After enough time, should be at rest
        for _ in 0..200 {
            sm.update(Duration::from_millis(16));
        }
        assert!(sm.is_at_rest());
    }
}
