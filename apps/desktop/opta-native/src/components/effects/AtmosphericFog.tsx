/**
 * AtmosphericFog - Phase 30: Atmospheric Fog System
 *
 * A CSS-based radial gradient fog that emanates from the ring center,
 * creating a mystical atmosphere that responds to ring state and energy level.
 *
 * Features:
 * - Radial gradient fog from ring center (30-01)
 * - Fog intensity synced with ring energy level (30-02)
 * - Dynamic color shift based on ring state (30-03)
 * - Subtle breathing/pulsing CSS animations (30-04)
 *
 * Performance:
 * - CSS-only animations (no JS animation loops)
 * - Respects prefers-reduced-motion
 * - Uses will-change for GPU acceleration
 * - Pointer-events: none to avoid scroll interference
 *
 * @see DESIGN_SYSTEM.md - Part 2: Visual Identity
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { RingState } from '@/components/OptaRing3D/types';

// =============================================================================
// TYPES
// =============================================================================

export interface AtmosphericFogProps {
  /** Ring state for color determination */
  ringState?: RingState;
  /** Energy level from 0 to 1 (controls fog opacity) */
  energyLevel?: number;
  /** Whether fog is enabled */
  enabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom center position (defaults to viewport center) */
  centerX?: string;
  centerY?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Fog colors for each ring state
 * @see 30-03: Fog color shift specification
 */
const FOG_COLORS: Record<RingState, string> = {
  dormant: '#1a0a2e',     // Deep purple, almost black
  waking: '#2d1b4e',      // Warming up purple
  active: '#3B1D5A',      // Electric violet base
  sleeping: '#2d1b4e',    // Cooling down purple
  processing: '#3B1D5A',  // Uses processing pulse animation
  exploding: '#9333EA',   // Bright flash violet
  recovering: '#3B1D5A',  // Post-explosion calm
};

/**
 * Secondary fog colors for gradient blending
 */
const FOG_SECONDARY_COLORS: Record<RingState, string> = {
  dormant: '#0d0518',
  waking: '#1a0f2e',
  active: '#2d1b4e',
  sleeping: '#1a0f2e',    // Cooling down, matches waking
  processing: '#9333EA',  // Pulses to this
  exploding: '#c084fc',
  recovering: '#2d1b4e',  // Post-explosion calm, matches active
};

/**
 * Opacity mapping based on energy level
 * @see 30-02: Energy level to opacity mapping
 *
 * energyLevel 0: opacity 0.05 (barely visible)
 * energyLevel 0.5: opacity 0.15
 * energyLevel 1: opacity 0.3 (dramatic)
 */
function getOpacityForEnergy(energyLevel: number): number {
  // Linear interpolation: 0 -> 0.05, 0.5 -> 0.15, 1 -> 0.3
  // Formula: 0.05 + (energyLevel * 0.25)
  return Math.max(0.05, Math.min(0.3, 0.05 + energyLevel * 0.25));
}

/**
 * Maps RingState to the fog color key
 */
function getColorKeyForState(state: RingState): keyof typeof FOG_COLORS {
  switch (state) {
    case 'dormant':
      return 'dormant';
    case 'active':
      return 'active';
    case 'processing':
      return 'processing';
    default:
      return 'dormant';
  }
}

// =============================================================================
// CSS KEYFRAMES (injected via style tag for isolation)
// =============================================================================

const FOG_KEYFRAMES = `
@keyframes fog-breathe {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.02);
  }
}

@keyframes fog-opacity-micro {
  0%, 100% {
    opacity: var(--fog-base-opacity);
  }
  50% {
    opacity: calc(var(--fog-base-opacity) + 0.02);
  }
}

@keyframes fog-processing-pulse {
  0%, 100% {
    --fog-color: var(--fog-color-primary);
  }
  50% {
    --fog-color: var(--fog-color-secondary);
  }
}

@keyframes fog-explode-flash {
  0% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.5);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2);
  }
}
`;

// =============================================================================
// COMPONENT
// =============================================================================

export function AtmosphericFog({
  ringState = 'dormant',
  energyLevel = 0,
  enabled = true,
  className,
  centerX = '50%',
  centerY = '50%',
}: AtmosphericFogProps) {
  // Calculate fog parameters based on ring state and energy
  const fogParams = useMemo(() => {
    const colorKey = getColorKeyForState(ringState);
    const primaryColor = FOG_COLORS[colorKey];
    const secondaryColor = FOG_SECONDARY_COLORS[colorKey];
    const baseOpacity = getOpacityForEnergy(energyLevel);

    return {
      primaryColor,
      secondaryColor,
      baseOpacity,
      isProcessing: ringState === 'processing',
    };
  }, [ringState, energyLevel]);

  if (!enabled) return null;

  return (
    <>
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: FOG_KEYFRAMES }} />

      {/* Fog Container */}
      <div
        className={cn(
          'fixed inset-0 pointer-events-none overflow-hidden',
          className
        )}
        style={{
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        {/* Primary Fog Layer - Radial Gradient from Ring Center */}
        <div
          className="absolute"
          style={{
            // Position at ring center
            left: centerX,
            top: centerY,
            // Size to cover viewport with room for breathing animation
            width: '200vmax',
            height: '200vmax',
            transform: 'translate(-50%, -50%)',
            // Radial gradient: transparent center -> purple fog -> transparent edge
            background: `radial-gradient(
              ellipse 50% 50% at 50% 50%,
              transparent 0%,
              ${fogParams.primaryColor}40 20%,
              ${fogParams.primaryColor}60 35%,
              ${fogParams.secondaryColor}30 55%,
              transparent 70%
            )`,
            // Base opacity controlled by energy level
            opacity: fogParams.baseOpacity,
            // Smooth transition for state changes
            transition: 'opacity 500ms ease, background 500ms ease',
            // GPU acceleration
            willChange: 'transform, opacity',
            // CSS custom properties for animation
            ['--fog-base-opacity' as string]: fogParams.baseOpacity,
            ['--fog-color-primary' as string]: fogParams.primaryColor,
            ['--fog-color-secondary' as string]: fogParams.secondaryColor,
            // Breathing animation: scale 1 -> 1.02 -> 1, 4s cycle
            animation: fogParams.isProcessing
              ? 'fog-breathe 2s ease-in-out infinite, fog-processing-pulse 1s ease-in-out infinite'
              : 'fog-breathe 4s ease-in-out infinite, fog-opacity-micro 2s ease-in-out infinite',
          }}
        />

        {/* Secondary Fog Layer - Deeper, slower breathing */}
        <div
          className="absolute"
          style={{
            left: centerX,
            top: centerY,
            width: '250vmax',
            height: '250vmax',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(
              ellipse 40% 40% at 50% 50%,
              transparent 0%,
              ${fogParams.secondaryColor}20 30%,
              ${fogParams.primaryColor}15 50%,
              transparent 65%
            )`,
            opacity: fogParams.baseOpacity * 0.6,
            transition: 'opacity 500ms ease, background 500ms ease',
            willChange: 'transform, opacity',
            // Slower breathing for depth
            animation: 'fog-breathe 6s ease-in-out infinite',
            animationDelay: '-2s',
          }}
        />

        {/* Inner Glow - Close to ring center */}
        <div
          className="absolute"
          style={{
            left: centerX,
            top: centerY,
            width: '150vmax',
            height: '150vmax',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(
              circle at 50% 50%,
              ${fogParams.primaryColor}30 0%,
              ${fogParams.primaryColor}10 25%,
              transparent 45%
            )`,
            opacity: fogParams.baseOpacity * 0.8,
            transition: 'opacity 500ms ease, background 500ms ease',
            willChange: 'transform, opacity',
            // Faster micro-variation
            animation: 'fog-opacity-micro 2s ease-in-out infinite',
            animationDelay: '-1s',
          }}
        />
      </div>
    </>
  );
}

// =============================================================================
// REDUCED MOTION VARIANT
// =============================================================================

/**
 * AtmosphericFogStatic - Static version for reduced motion preference
 *
 * Provides the same visual appearance without animations.
 * Use this when prefers-reduced-motion is enabled.
 */
export function AtmosphericFogStatic({
  ringState = 'dormant',
  energyLevel = 0,
  enabled = true,
  className,
  centerX = '50%',
  centerY = '50%',
}: AtmosphericFogProps) {
  const fogParams = useMemo(() => {
    const colorKey = getColorKeyForState(ringState);
    const primaryColor = FOG_COLORS[colorKey];
    const secondaryColor = FOG_SECONDARY_COLORS[colorKey];
    const baseOpacity = getOpacityForEnergy(energyLevel);

    return { primaryColor, secondaryColor, baseOpacity };
  }, [ringState, energyLevel]);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none overflow-hidden',
        className
      )}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{
          left: centerX,
          top: centerY,
          width: '200vmax',
          height: '200vmax',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(
            ellipse 50% 50% at 50% 50%,
            transparent 0%,
            ${fogParams.primaryColor}40 20%,
            ${fogParams.primaryColor}60 35%,
            ${fogParams.secondaryColor}30 55%,
            transparent 70%
          )`,
          opacity: fogParams.baseOpacity,
          transition: 'opacity 500ms ease, background 500ms ease',
        }}
      />
    </div>
  );
}

// =============================================================================
// WRAPPER WITH MOTION PREFERENCE
// =============================================================================

/**
 * AtmosphericFogAuto - Automatically respects prefers-reduced-motion
 *
 * Uses the animated version by default, falls back to static when
 * the user prefers reduced motion.
 */
export function AtmosphericFogAuto(props: AtmosphericFogProps) {
  // Check for reduced motion preference via CSS media query
  // This is handled by the CSS @media (prefers-reduced-motion: reduce) rules
  return (
    <div
      className="fog-auto-wrapper"
      style={{
        // Use CSS to toggle between animated and static
        // The animations will be disabled by the media query in the style tag
      }}
    >
      <AtmosphericFog {...props} />

      {/* Media query style for reduced motion */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .fog-auto-wrapper [style*="animation"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// CONNECTED COMPONENT (with OptaRingContext integration)
// =============================================================================

/**
 * AtmosphericFogConnected - Pre-connected to OptaRingContext
 *
 * Automatically syncs fog state with the ring. Use this in Layout.tsx
 * for the main atmospheric fog layer.
 */
export { AtmosphericFogConnected } from './AtmosphericFogConnected';

export default AtmosphericFog;
