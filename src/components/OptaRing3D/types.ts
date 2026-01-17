/**
 * OptaRing3D Type Definitions
 *
 * Extended ring state machine types for the Opta Ring protagonist.
 * These types define the full lifecycle of the ring's visual states.
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
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
  | 'dormant'     // Tilted, slow spin, low energy
  | 'waking'      // Transitioning to active (800ms)
  | 'active'      // Facing camera, faster spin, medium energy
  | 'sleeping'    // Transitioning to dormant (800ms ease-out)
  | 'processing'  // Active + pulsing, high energy
  | 'exploding'   // Particle burst, max energy
  | 'recovering'; // Post-explosion cooldown (500ms)

/**
 * Ring size variants
 */
export type RingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

/**
 * Energy level ranges for each state
 * Used to derive visual properties from state
 */
export const ENERGY_LEVELS: Record<RingState, { min: number; max: number; default: number }> = {
  dormant: { min: 0, max: 0.2, default: 0.1 },
  waking: { min: 0.2, max: 0.5, default: 0.35 },
  active: { min: 0.5, max: 0.7, default: 0.6 },
  sleeping: { min: 0.2, max: 0.5, default: 0.35 },
  processing: { min: 0.6, max: 0.9, default: 0.75 },
  exploding: { min: 0.9, max: 1.0, default: 1.0 },
  recovering: { min: 0.5, max: 0.7, default: 0.55 },
};

/**
 * Transition timing configuration
 */
export interface TransitionTiming {
  /** Duration in milliseconds */
  duration: number;
  /** Easing type */
  easing: 'spring' | 'ease-out' | 'ease-in-out' | 'linear';
  /** Spring stiffness (if easing is 'spring') */
  stiffness?: number;
  /** Spring damping (if easing is 'spring') */
  damping?: number;
}

/**
 * State transition configuration
 * Maps from -> to state transitions with timing
 */
export const STATE_TRANSITIONS: Record<string, TransitionTiming> = {
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
  const key = `${from}->${to}`;
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
 * Visual properties derived from state and energy
 */
export interface RingVisualProperties {
  /** Rotation on X axis (radians) - tilted vs facing camera */
  rotationX: number;
  /** Rotation speed on Y axis (radians/second) */
  rotationSpeedY: number;
  /** Glow intensity (0-1) */
  glowIntensity: number;
  /** Base color (hex) */
  baseColor: string;
  /** Emissive color (hex) */
  emissiveColor: string;
  /** Emissive intensity (0-1) */
  emissiveIntensity: number;
  /** Whether particles are active */
  particlesActive: boolean;
  /** Particle count (if active) */
  particleCount: number;
}

/**
 * Ring colors from design system
 */
export const RING_COLORS = {
  dormant: '#3B1D5A',    // Dark violet (hsl 265 50% 20%)
  active: '#9333EA',     // Electric violet (hsl 265 90% 65%)
  exploding: '#A855F7',  // Bright violet for explosion
  plasma: '#C084FC',     // Plasma glow color
} as const;

/**
 * Get visual properties for a state and energy level
 *
 * @param state - Current ring state
 * @param energyLevel - Current energy (0-1)
 * @returns Visual properties for rendering
 */
export function getVisualProperties(
  state: RingState,
  energyLevel: number
): RingVisualProperties {
  const DORMANT_TILT = Math.PI * 0.08; // ~15 degrees
  const DORMANT_SPEED = 0.1; // radians/second
  const ACTIVE_SPEED = 0.3;
  const PROCESSING_SPEED = 0.5;

  switch (state) {
    case 'dormant':
      return {
        rotationX: DORMANT_TILT,
        rotationSpeedY: DORMANT_SPEED,
        glowIntensity: energyLevel * 0.3,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * 0.2,
        particlesActive: false,
        particleCount: 0,
      };

    case 'waking':
      // Interpolating between dormant and active
      const wakingProgress = (energyLevel - 0.2) / 0.3;
      return {
        rotationX: DORMANT_TILT * (1 - wakingProgress),
        rotationSpeedY: DORMANT_SPEED + (ACTIVE_SPEED - DORMANT_SPEED) * wakingProgress,
        glowIntensity: energyLevel * 0.5,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * 0.4,
        particlesActive: false,
        particleCount: 0,
      };

    case 'active':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPEED,
        glowIntensity: energyLevel * 0.6,
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * 0.5,
        particlesActive: false,
        particleCount: 0,
      };

    case 'sleeping': {
      // Interpolating between active and dormant (reverse of waking)
      const sleepingProgress = Math.max(0, Math.min(1, (0.5 - energyLevel) / 0.3));
      return {
        rotationX: DORMANT_TILT * sleepingProgress,
        rotationSpeedY: ACTIVE_SPEED - (ACTIVE_SPEED - DORMANT_SPEED) * sleepingProgress,
        glowIntensity: energyLevel * 0.5,
        baseColor: RING_COLORS.dormant,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * 0.4,
        particlesActive: false,
        particleCount: 0,
      };
    }

    case 'processing':
      return {
        rotationX: 0,
        rotationSpeedY: PROCESSING_SPEED,
        glowIntensity: 0.5 + Math.sin(Date.now() * 0.005) * 0.3, // Pulsing
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.plasma,
        emissiveIntensity: 0.4 + Math.sin(Date.now() * 0.005) * 0.3,
        particlesActive: false,
        particleCount: 0,
      };

    case 'exploding':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPEED * 2, // Faster spin during explosion
        glowIntensity: 1.0,
        baseColor: RING_COLORS.exploding,
        emissiveColor: RING_COLORS.plasma,
        emissiveIntensity: 1.0,
        particlesActive: true,
        particleCount: 250, // Phase 27: 200-300 particles
      };

    case 'recovering':
      return {
        rotationX: 0,
        rotationSpeedY: ACTIVE_SPEED * 0.8,
        glowIntensity: energyLevel * 0.5,
        baseColor: RING_COLORS.active,
        emissiveColor: RING_COLORS.active,
        emissiveIntensity: energyLevel * 0.4,
        particlesActive: true,
        particleCount: 20, // Diminishing particles
      };

    default:
      return {
        rotationX: DORMANT_TILT,
        rotationSpeedY: DORMANT_SPEED,
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
 * State machine valid transitions
 * Used to validate state changes
 */
export const VALID_TRANSITIONS: Record<RingState, RingState[]> = {
  dormant: ['waking'],
  waking: ['active', 'dormant'], // Can be interrupted back to dormant
  active: ['dormant', 'sleeping', 'processing', 'exploding'],
  sleeping: ['dormant', 'waking'], // Can be interrupted back to waking
  processing: ['active', 'exploding'],
  exploding: ['recovering'],
  recovering: ['active', 'dormant'],
};

/**
 * Check if a state transition is valid
 *
 * @param from - Current state
 * @param to - Target state
 * @returns Whether the transition is allowed
 */
export function isValidTransition(from: RingState, to: RingState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
