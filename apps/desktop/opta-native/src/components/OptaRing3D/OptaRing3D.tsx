import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { cn } from '@/lib/utils';
import { RingMesh } from './RingMesh';
import { type RingState, type RingSize, getDefaultEnergy } from './types';

/**
 * OptaRing3D - Premium WebGL 3D Ring Component
 *
 * The visual protagonist of the Opta application, rendered as a
 * Three.js torus with glassmorphism shader material.
 *
 * ## Implementation Phases
 * - **Phase 24**: 3D Ring Foundation (torus geometry, lighting)
 * - **Phase 25**: Glassmorphism Shader (fresnel, energy glow, SSS)
 * - **Phase 26**: Wake-Up Animation (spring physics transitions)
 * - **Phase 28**: Extended State Machine (7 states)
 *
 * ## Technical Features
 * - Transparent canvas background for seamless glass integration
 * - High-performance WebGL with capped 2x DPR
 * - Professional 3-point lighting setup:
 *   - Key light: white, upper-right (intensity 1.2)
 *   - Fill light: lavender, lower-left (intensity 0.4)
 *   - Rim light: purple, behind ring (intensity 0.8)
 * - Cinematic camera with low FOV (35-40 degrees)
 * - Optimized torus geometry (96 radial x 64 tubular segments)
 *
 * ## Ring States
 * | State | Tilt | Spin | Energy | Description |
 * |-------|------|------|--------|-------------|
 * | dormant | 15deg | 0.1 rad/s | 0-0.2 | Idle, dark glass |
 * | waking | 15->0deg | 0.1->0.3 | 0.2-0.5 | Spring transition to active |
 * | active | 0deg | 0.3 rad/s | 0.5-0.7 | Facing camera, engaged |
 * | sleeping | 0->15deg | 0.3->0.1 | 0.5-0.2 | Ease-out to dormant |
 * | processing | 0deg | 0.5 rad/s | 0.6-0.9 | Pulsing glow |
 * | exploding | 0deg | 0.6 rad/s | 0.9-1.0 | Particle burst |
 * | recovering | 0deg | 0.24 rad/s | 0.5-0.7 | Cooldown |
 *
 * @see types.ts for state machine definitions
 * @see RingMesh.tsx for Three.js implementation
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 */

// Re-export types for convenience
export type { RingSize } from './types';

// =============================================================================
// PROP TYPES
// =============================================================================

/**
 * Props for the OptaRing3D component.
 */
export interface OptaRing3DProps {
  /**
   * Current state of the ring from the 7-state machine.
   * @default 'dormant'
   */
  state?: RingState;

  /**
   * Size variant controlling container dimensions and camera distance.
   * @default 'md'
   */
  size?: RingSize;

  /**
   * Energy level override (0-1). When provided, takes precedence
   * over the state-derived default energy level.
   * Controls glow intensity, fresnel power, and emissive strength.
   */
  energyLevel?: number;

  /**
   * Enable spring physics for state transitions.
   * Set to false for reduced-motion accessibility support.
   * @default true
   */
  springEnabled?: boolean;

  /**
   * Click event handler. Ring becomes interactive when provided.
   */
  onClick?: () => void;

  /**
   * Additional CSS classes for the container div.
   */
  className?: string;

  /**
   * Enable debug mode with OrbitControls for camera manipulation.
   * Reserved for future implementation.
   * @default false
   * @internal
   */
  debug?: boolean;
}

// =============================================================================
// SIZE CONFIGURATION
// =============================================================================

/**
 * Tailwind CSS classes for each ring size variant.
 * Matches the 2D OptaRing component for consistency.
 */
const SIZE_CLASSES: Readonly<Record<RingSize, string>> = {
  xs: 'w-6 h-6',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-48 h-48 md:w-64 md:h-64',
} as const;

/**
 * Camera Z-axis position for each size.
 * Closer camera with lower FOV creates a more cinematic,
 * less perspective-distorted look.
 */
const CAMERA_Z_POSITIONS: Readonly<Record<RingSize, number>> = {
  xs: 5.5,
  sm: 5.5,
  md: 5.2,
  lg: 5.0,
  xl: 4.8,
  hero: 4.5,
} as const;

/**
 * Camera field-of-view (degrees) for each size.
 * Lower FOV = more cinematic/telephoto look.
 * Range: 35-40 degrees for dramatic perspective.
 */
const CAMERA_FOV_DEGREES: Readonly<Record<RingSize, number>> = {
  xs: 40,
  sm: 40,
  md: 38,
  lg: 36,
  xl: 35,
  hero: 35,
} as const;

// =============================================================================
// LIGHTING CONFIGURATION
// =============================================================================

/** Ambient light intensity for base illumination */
const AMBIENT_LIGHT_INTENSITY = 0.2;

/** Key light configuration (main illumination) */
const KEY_LIGHT = {
  position: [5, 5, 5] as const,
  intensity: 1.2,
  color: '#ffffff',
} as const;

/** Fill light configuration (softens shadows) */
const FILL_LIGHT = {
  position: [-3, -2, 2] as const,
  intensity: 0.4,
  color: '#E9D5FF', // Lavender (purple-200)
} as const;

/** Rim light configuration (purple edge glow from behind) */
const RIM_LIGHT = {
  position: [0, 0, -3] as const,
  intensity: 0.8,
  color: '#9333EA', // Primary purple
  distance: 10,
  decay: 2,
} as const;

/** Camera near/far clipping planes */
const CAMERA_CLIP = { near: 0.1, far: 100 } as const;

/** Device pixel ratio cap for performance */
const DPR_RANGE: [number, number] = [1, 2];

// =============================================================================
// COMPONENT
// =============================================================================

export function OptaRing3D({
  state = 'dormant',
  size = 'md',
  energyLevel,
  springEnabled = true,
  onClick,
  className,
  debug: _debug = false, // Reserved for future OrbitControls integration
}: OptaRing3DProps): React.ReactNode {
  // Suppress unused variable warning (debug reserved for future use)
  void _debug;

  // Calculate energy level from state if not provided
  const calculatedEnergy = energyLevel ?? getDefaultEnergy(state);

  // Determine if ring should be interactive
  const isInteractive = Boolean(onClick);

  return (
    <div
      className={cn(
        'relative select-none',
        SIZE_CLASSES[size],
        isInteractive && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <Canvas
        camera={{
          position: [0, 0, CAMERA_Z_POSITIONS[size]],
          fov: CAMERA_FOV_DEGREES[size],
          near: CAMERA_CLIP.near,
          far: CAMERA_CLIP.far,
        }}
        dpr={DPR_RANGE}
        gl={{
          antialias: true,
          alpha: true, // Transparent background for glass integration
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false, // Better performance
          failIfMajorPerformanceCaveat: false,
        }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        flat // Disables tone mapping for more accurate colors
        linear // Disables sRGB encoding for consistent colors
      >
        {/* 3-Point Lighting Setup */}

        {/* Ambient: subtle base illumination */}
        <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />

        {/* Key: white, upper-right, main illumination source */}
        <directionalLight
          position={KEY_LIGHT.position}
          intensity={KEY_LIGHT.intensity}
          color={KEY_LIGHT.color}
          castShadow={false}
        />

        {/* Fill: soft lavender, lower-left, softens shadows */}
        <directionalLight
          position={FILL_LIGHT.position}
          intensity={FILL_LIGHT.intensity}
          color={FILL_LIGHT.color}
        />

        {/* Rim: purple edge glow from behind for depth */}
        <pointLight
          position={RIM_LIGHT.position}
          intensity={RIM_LIGHT.intensity}
          color={RIM_LIGHT.color}
          distance={RIM_LIGHT.distance}
          decay={RIM_LIGHT.decay}
        />

        {/* Ring Mesh with Suspense for async shader loading */}
        <Suspense fallback={<mesh><boxGeometry args={[0.5, 0.5, 0.5]} /><meshBasicMaterial color="purple" /></mesh>}>
          <RingMesh
            state={state}
            energyLevel={calculatedEnergy}
            springEnabled={springEnabled}
          />
        </Suspense>
      </Canvas>

      {/* Screen reader accessibility label */}
      <span className="sr-only">
        Opta Ring 3D - {getAccessibilityLabel(state)}
      </span>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get human-readable accessibility label for ring state.
 * Used for screen reader announcements.
 */
function getAccessibilityLabel(state: RingState): string {
  const STATE_LABELS: Record<RingState, string> = {
    dormant: 'Ready',
    waking: 'Waking up',
    active: 'Active',
    sleeping: 'Going to sleep',
    processing: 'Loading',
    exploding: 'Celebrating',
    recovering: 'Cooling down',
  };
  return STATE_LABELS[state];
}

export default OptaRing3D;
