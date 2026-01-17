import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { cn } from '@/lib/utils';
import { RingMesh } from './RingMesh';
import { type RingState, type RingSize, getDefaultEnergy } from './types';

/**
 * OptaRing3D - WebGL 3D Opta Ring with premium visuals
 *
 * Phase 24: 3D Ring Foundation
 * Phase 26: Wake-Up Animation with Spring Physics
 * Phase 28: Extended State Machine
 *
 * Features:
 * - Transparent background for glass integration
 * - High-performance WebGL settings
 * - Professional 3-point lighting with purple rim
 * - Cinematic camera positioning (FOV 35-40)
 * - Optimized torus geometry (96+ segments)
 * - Full state machine lifecycle (7 states)
 * - Spring physics for smooth wake/sleep transitions
 *
 * States:
 * - dormant: Tilted 15 deg, slow spin (0.1 rad/s), subtle bob, low energy
 * - waking: Transitioning to active (800ms spring)
 * - active: Facing camera, faster spin (0.3 rad/s), medium energy
 * - sleeping: Transitioning to dormant (800ms ease-out)
 * - processing: Active + pulsing, high energy
 * - exploding: Particle burst, max energy
 * - recovering: Post-explosion cooldown (500ms)
 *
 * @see types.ts for full state definitions
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see .claude/skills/opta-ring-animation.md
 */

// Re-export types for convenience
export type { RingSize } from './types';

interface OptaRing3DProps {
  /** Current state of the ring */
  state?: RingState;
  /** Size of the ring */
  size?: RingSize;
  /** Energy level 0-1 (overrides state-derived default) */
  energyLevel?: number;
  /** Whether spring animations are enabled (for reduced motion support) */
  springEnabled?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Enable debug mode (shows OrbitControls) */
  debug?: boolean;
}

// Size mappings (matching OptaRing.tsx)
const sizeClasses: Record<RingSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-48 h-48 md:w-64 md:h-64',
};

// Camera Z position tuned per size for optimal framing
// Closer camera with lower FOV creates more cinematic, less distorted look
const cameraPositions: Record<RingSize, number> = {
  xs: 5.5,
  sm: 5.5,
  md: 5.2,
  lg: 5.0,
  xl: 4.8,
  hero: 4.5,
};

// FOV per size - lower FOV = more cinematic, less distortion
// Ranges 35-40 for dramatic perspective
const cameraFOVs: Record<RingSize, number> = {
  xs: 40,
  sm: 40,
  md: 38,
  lg: 36,
  xl: 35,
  hero: 35,
};

export function OptaRing3D({
  state = 'dormant',
  size = 'md',
  energyLevel,
  springEnabled = true,
  onClick,
  className,
  // Reserved for future OrbitControls integration
  debug: _debug = false,
}: OptaRing3DProps) {
  // Suppress unused variable warning (debug reserved for future use)
  void _debug;
  // Calculate energy level from state if not provided
  const calculatedEnergy = energyLevel ?? getDefaultEnergy(state);

  return (
    <div
      className={cn(
        'relative select-none',
        sizeClasses[size],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <Canvas
        camera={{
          position: [0, 0, cameraPositions[size]],
          fov: cameraFOVs[size],
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]} // Cap DPR at 2 for performance
        gl={{
          antialias: true,
          alpha: true, // Transparent background for glass integration
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false, // Better performance
          failIfMajorPerformanceCaveat: false,
        }}
        style={{ background: 'transparent' }}
        flat // Disables tone mapping for more accurate colors
        linear // Disables sRGB encoding for consistent colors
      >
        {/* Ambient light - subtle base illumination */}
        <ambientLight intensity={0.2} />

        {/* Key light: white, upper-right, main illumination */}
        <directionalLight
          position={[5, 5, 5]}
          intensity={1.2}
          color="#ffffff"
          castShadow={false}
        />

        {/* Fill light: soft lavender, lower-left, softens shadows */}
        <directionalLight
          position={[-3, -2, 2]}
          intensity={0.4}
          color="#E9D5FF" // Lavender (purple-200)
        />

        {/* Rim light: purple edge glow from behind */}
        <pointLight
          position={[0, 0, -3]}
          intensity={0.8}
          color="#9333EA" // Primary purple
          distance={10}
          decay={2}
        />

        <Suspense fallback={null}>
          <RingMesh
            state={state}
            energyLevel={calculatedEnergy}
            springEnabled={springEnabled}
          />
        </Suspense>
      </Canvas>

      {/* Accessibility label */}
      <span className="sr-only">
        Opta Ring 3D - {
          state === 'processing' ? 'Loading' :
          state === 'active' ? 'Active' :
          state === 'exploding' ? 'Celebrating' :
          state === 'waking' ? 'Waking up' :
          state === 'sleeping' ? 'Going to sleep' :
          state === 'recovering' ? 'Cooling down' :
          'Ready'
        }
      </span>
    </div>
  );
}

export default OptaRing3D;
