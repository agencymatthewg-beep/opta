/**
 * OptaRing3D Type Definitions
 *
 * Extended ring state machine types for the Opta Ring protagonist.
 * These types define the full lifecycle of the ring's visual states,
 * including energy levels, transition timings, and visual properties.
 *
 * @module OptaRing3D/types
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see RingMesh.tsx for visual implementation
 */

/**
 * Extended RingState type with full lifecycle states
 *
 * | State      | Visual Description                          | Energy Level |
 * |------------|---------------------------------------------|--------------|
 * | dormant    | Tilted, slow spin, low energy, dark glass   | 0 - 0.2      |
 * | waking     | Transitioning to active (800ms spring)      | 0.2 - 0.5    |
 * | active     | Facing camera, faster spin, medium energy   | 0.5 - 0.7    |
 * | sleeping   | Transitioning to dormant (800ms ease-out)   | 0.2 - 0.5    |
 * | processing | Active + pulsing glow, high energy          | 0.6 - 0.9    |
 * | exploding  | Particle burst, max energy, celebration     | 0.9 - 1.0    |
 * | recovering | Post-explosion cooldown (500ms ease-out)    | 0.5 - 0.7    |
 */
export type RingState =
  | 'dormant'     // Tilted 15deg, slow Y-spin (0.1 rad/s), low energy
  | 'waking'      // Transitioning to active via 800ms spring animation
  | 'active'      // Facing camera (0deg tilt), faster spin (0.3 rad/s)
  | 'sleeping'    // Transitioning to dormant via 800ms ease-out
  | 'processing'  // Active + pulsing glow, high energy, faster spin
  | 'exploding'   // Particle burst, shockwave, max energy bloom
  | 'recovering'; // Post-explosion cooldown (500ms fade)

/**
 * Ring size variants for responsive display
 *
 * | Size | Dimensions | Use Case |
 * |------|------------|----------|
 * | xs   | 24x24px    | Inline indicators |
 * | sm   | 40x40px    | List items, compact UI |
 * | md   | 64x64px    | Default, cards |
 * | lg   | 96x96px    | Feature sections |
 * | xl   | 128x128px  | Hero areas |
 * | hero | 192-256px  | Landing pages, transitions |
 */
export type RingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

/** Energy level range definition for a ring state */
interface EnergyLevelRange {
  /** Minimum energy for this state (0-1) */
  readonly min: number;
  /** Maximum energy for this state (0-1) */
  readonly max: number;
  /** Default/starting energy for this state (0-1) */
  readonly default: number;
}

/**
 * Energy level ranges for each ring state.
 * Used to derive visual properties and validate energy values.
 *
 * @remarks Energy levels control glow intensity, fresnel power, and emissive strength
 */
export const ENERGY_LEVELS: Readonly<Record<RingState, EnergyLevelRange>> = {
  dormant: { min: 0, max: 0.2, default: 0.1 },
  waking: { min: 0.2, max: 0.5, default: 0.35 },
  active: { min: 0.5, max: 0.7, default: 0.6 },
  sleeping: { min: 0.2, max: 0.5, default: 0.35 },
  processing: { min: 0.6, max: 0.9, default: 0.75 },
  exploding: { min: 0.9, max: 1.0, default: 1.0 },
  recovering: { min: 0.5, max: 0.7, default: 0.55 },
};

/** Easing function types for state transitions */
export type TransitionEasing = 'spring' | 'ease-out' | 'ease-in-out' | 'linear';

/**
 * Transition timing configuration for state changes.
 * Controls how the ring animates between states.
 */
export interface TransitionTiming {
  /** Duration in milliseconds (0 for immediate transitions) */
  readonly duration: number;
  /** Easing function type */
  readonly easing: TransitionEasing;
  /** Spring stiffness - only applies when easing is 'spring' */
  readonly stiffness?: number;
  /** Spring damping - only applies when easing is 'spring' */
  readonly damping?: number;
}

/** Transition key format: "fromState->toState" */
type TransitionKey = `${RingState}->${RingState}`;

/**
 * State transition timing configurations.
 * Maps "from->to" state pairs to their animation timing.
 *
 * @remarks
 * - Duration 0 indicates immediate state change (trigger-only)
 * - Spring easing provides bounce/overshoot for engagement
 * - Ease-out provides smooth deceleration for disengagement
 */
export const STATE_TRANSITIONS: Readonly<Partial<Record<TransitionKey, TransitionTiming>>> = {
  // Engagement transitions
  'dormant->waking': {
    duration: 0, // Immediate trigger
    easing: 'linear',
  },
  'waking->active': {
    duration: 800,
    easing: 'spring',
    stiffness: 300,
    damping: 25,
  },

  // Sleep transitions
  'active->sleeping': {
    duration: 0, // Immediate trigger
    easing: 'linear',
  },
  'sleeping->dormant': {
    duration: 800,
    easing: 'ease-out',
  },
  'active->dormant': {
    duration: 800,
    easing: 'ease-out',
  },

  // Processing transitions
  'active->processing': {
    duration: 0, // Immediate
    easing: 'linear',
  },
  'processing->active': {
    duration: 200,
    easing: 'ease-out',
  },

  // Explosion transitions
  'processing->exploding': {
    duration: 0, // Immediate on trigger
    easing: 'linear',
  },
  'active->exploding': {
    duration: 0, // Immediate on trigger
    easing: 'linear',
  },
  'exploding->recovering': {
    duration: 800,
    easing: 'ease-in-out',
  },

  // Recovery transitions
  'recovering->active': {
    duration: 500,
    easing: 'spring',
    stiffness: 250,
    damping: 20,
  },
  'recovering->dormant': {
    duration: 500,
    easing: 'ease-out',
  },
};

/**
 * Get transition timing for a state change
 *
 * @param from - Source state
 * @param to - Target state
 * @returns Transition timing or default fallback
 */
export function getTransitionTiming(from: RingState, to: RingState): TransitionTiming {
  const key = `${from}->${to}` as TransitionKey;
  return STATE_TRANSITIONS[key] ?? {
    duration: 300,
    easing: 'ease-out',
  };
}

/**
 * Get the default energy level for a state
 *
 * @param state - The ring state
 * @returns Energy level between 0 and 1
 */
export function getDefaultEnergy(state: RingState): number {
  return ENERGY_LEVELS[state].default;
}

/**
 * Clamp energy level to valid range for a state
 *
 * @param state - The ring state
 * @param energy - Raw energy value
 * @returns Clamped energy value
 */
export function clampEnergyToState(state: RingState, energy: number): number {
  const { min, max } = ENERGY_LEVELS[state];
  return Math.max(min, Math.min(max, energy));
}

/**
 * Visual properties derived from state and energy level.
 * Provides all rendering parameters for the ring mesh.
 */
export interface RingVisualProperties {
  /** X-axis rotation in radians (0 = facing camera, ~0.26 = 15deg tilt) */
  readonly rotationX: number;
  /** Y-axis rotation speed in radians per second */
  readonly rotationSpeedY: number;
  /** Glow/bloom intensity multiplier (0-1) */
  readonly glowIntensity: number;
  /** Base material color as hex string */
  readonly baseColor: string;
  /** Emissive/glow color as hex string */
  readonly emissiveColor: string;
  /** Emissive strength multiplier (0-1) */
  readonly emissiveIntensity: number;
  /** Whether particle effects are enabled */
  readonly particlesActive: boolean;
  /** Number of particles to emit (when active) */
  readonly particleCount: number;
}

/**
 * Ring color palette from design system.
 * All colors are CSS hex values matching the Opta brand.
 *
 * @see DESIGN_SYSTEM.md - Part 3: Color Palette
 */
export const RING_COLORS = {
  /** Dormant state: deep violet (hsl 265 50% 20%) */
  dormant: '#3B1D5A',
  /** Active state: electric violet (hsl 265 90% 65%) */
  active: '#9333EA',
  /** Explosion peak: bright violet for burst effect */
  exploding: '#A855F7',
  /** Plasma/inner glow: light purple for SSS simulation */
  plasma: '#C084FC',
} as const;

// =============================================================================
// VISUAL PROPERTY CONSTANTS
// =============================================================================

/** Dormant tilt angle: approximately 15 degrees in radians */
const DORMANT_TILT_RADIANS = Math.PI * 0.08;

/** Dormant Y-axis rotation speed in radians per second */
const DORMANT_SPIN_SPEED = 0.1;

/** Active Y-axis rotation speed in radians per second */
const ACTIVE_SPIN_SPEED = 0.3;

/** Processing Y-axis rotation speed in radians per second */
const PROCESSING_SPIN_SPEED = 0.5;

/** Explosion Y-axis rotation speed multiplier */
const EXPLOSION_SPIN_MULTIPLIER = 2;

/** Recovery Y-axis rotation speed multiplier */
const RECOVERY_SPIN_MULTIPLIER = 0.8;

/** Standard particle count for explosion effect */
const EXPLOSION_PARTICLE_COUNT = 250;

/** Diminishing particle count during recovery */
const RECOVERY_PARTICLE_COUNT = 20;

/**
 * Calculate visual properties for a given ring state and energy level.
 *
 * @param state - Current ring state from the state machine
 * @param energyLevel - Current energy level (0-1), affects glow and emissive
 * @returns Complete visual properties for rendering the ring
 *
 * @example
 * ```tsx
 * const props = getVisualProperties('active', 0.6);
 * // props.rotationX === 0 (facing camera)
 * // props.rotationSpeedY === 0.3 rad/s
 * ```
 */
export function getVisualProperties(
  state: RingState,
  energyLevel: number
): RingVisualProperties {

  // Glow and emissive intensity multipliers
  const GLOW_DORMANT_MULT = 0.3;
  const GLOW_WAKING_MULT = 0.5;
  const GLOW_ACTIVE_MULT = 0.6;
  const EMISSIVE_DORMANT_MULT = 0.2;
  const EMISSIVE_WAKING_MULT = 0.4;
  const EMISSIVE_ACTIVE_MULT = 0.5;

  // Processing pulse frequency (radians per millisecond)
  const PULSE_FREQUENCY = 0.005;
  const currentPulse = Math.sin(Date.now() * PULSE_FREQUENCY);

  switch (state) {
    case 'dormant':
      return {
        rotationX: DORMANT_TILT_RADIANS,
        rotationSpeedY: DORMANT_SPIN_SPEED,
        glowIntensity: energyLevel * GLOW_DORMANT_MULT,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * EMISSIVE_DORMANT_MULT,
        particlesActive: false,
        particleCount: 0,
      };

    case 'waking': {
      // Interpolate between dormant and active based on energy progress
      const wakingProgress = Math.max(0, (energyLevel - 0.2) / 0.3);
      const interpolatedTilt = DORMANT_TILT_RADIANS * (1 - wakingProgress);
      const interpolatedSpeed = DORMANT_SPIN_SPEED + (ACTIVE_SPIN_SPEED - DORMANT_SPIN_SPEED) * wakingProgress;
      return {
        rotationX: interpolatedTilt,
        rotationSpeedY: interpolatedSpeed,
        glowIntensity: energyLevel * GLOW_WAKING_MULT,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * EMISSIVE_WAKING_MULT,
        particlesActive: false,
        particleCount: 0,
      };
    }

    case 'active':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPIN_SPEED,
        glowIntensity: energyLevel * GLOW_ACTIVE_MULT,
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * EMISSIVE_ACTIVE_MULT,
        particlesActive: false,
        particleCount: 0,
      };

    case 'sleeping': {
      // Interpolate between active and dormant (reverse of waking)
      const sleepingProgress = Math.max(0, Math.min(1, (0.5 - energyLevel) / 0.3));
      const interpolatedTilt = DORMANT_TILT_RADIANS * sleepingProgress;
      const interpolatedSpeed = ACTIVE_SPIN_SPEED - (ACTIVE_SPIN_SPEED - DORMANT_SPIN_SPEED) * sleepingProgress;
      return {
        rotationX: interpolatedTilt,
        rotationSpeedY: interpolatedSpeed,
        glowIntensity: energyLevel * GLOW_WAKING_MULT,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * EMISSIVE_WAKING_MULT,
        particlesActive: false,
        particleCount: 0,
      };
    }

    case 'processing': {
      // Pulsing glow effect for loading states
      const pulseGlow = 0.5 + currentPulse * 0.3;
      const pulseEmissive = 0.4 + currentPulse * 0.3;
      return {
        rotationX: 0,
        rotationSpeedY: PROCESSING_SPIN_SPEED,
        glowIntensity: pulseGlow,
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.plasma,
        emissiveIntensity: pulseEmissive,
        particlesActive: false,
        particleCount: 0,
      };
    }

    case 'exploding':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPIN_SPEED * EXPLOSION_SPIN_MULTIPLIER,
        glowIntensity: 1.0,
        baseColor: RING_COLORS.exploding,
        emissiveColor: RING_COLORS.plasma,
        emissiveIntensity: 1.0,
        particlesActive: true,
        particleCount: EXPLOSION_PARTICLE_COUNT,
      };

    case 'recovering':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPIN_SPEED * RECOVERY_SPIN_MULTIPLIER,
        glowIntensity: energyLevel * GLOW_WAKING_MULT,
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * EMISSIVE_WAKING_MULT,
        particlesActive: true,
        particleCount: RECOVERY_PARTICLE_COUNT,
      };

    default:
      // Fallback to dormant visual properties
      return {
        rotationX: DORMANT_TILT_RADIANS,
        rotationSpeedY: DORMANT_SPIN_SPEED,
        glowIntensity: 0.1,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: 0.1,
        particlesActive: false,
        particleCount: 0,
      };
  }
}

/**
 * State machine valid transitions.
 * Defines which state transitions are allowed for proper lifecycle flow.
 *
 * @remarks
 * - Waking can be interrupted back to dormant (user disengages)
 * - Sleeping can be interrupted to waking (user re-engages)
 * - Exploding must always go through recovering
 */
export const VALID_TRANSITIONS: Readonly<Record<RingState, readonly RingState[]>> = {
  dormant: ['waking'],
  waking: ['active', 'dormant'], // Can be interrupted back to dormant
  active: ['dormant', 'sleeping', 'processing', 'exploding'],
  sleeping: ['dormant', 'waking'], // Can be interrupted back to waking
  processing: ['active', 'exploding'],
  exploding: ['recovering'],
  recovering: ['active', 'dormant'],
};

/**
 * Check if a state transition is valid according to the state machine.
 *
 * @param from - Current ring state
 * @param to - Target ring state
 * @returns True if the transition is allowed, false otherwise
 *
 * @example
 * ```tsx
 * isValidTransition('dormant', 'waking');  // true
 * isValidTransition('dormant', 'active');  // false (must wake first)
 * isValidTransition('exploding', 'dormant'); // false (must recover first)
 * ```
 */
export function isValidTransition(from: RingState, to: RingState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid RingState.
 *
 * @param value - String value to check
 * @returns True if value is a valid RingState
 */
export function isRingState(value: string): value is RingState {
  return ['dormant', 'waking', 'active', 'sleeping', 'processing', 'exploding', 'recovering'].includes(value);
}

/**
 * Type guard to check if a string is a valid RingSize.
 *
 * @param value - String value to check
 * @returns True if value is a valid RingSize
 */
export function isRingSize(value: string): value is RingSize {
  return ['xs', 'sm', 'md', 'lg', 'xl', 'hero'].includes(value);
}
