/**
 * useAtmosphericFog - Hook for connecting AtmosphericFog to ring state
 *
 * Derives fog parameters from OptaRingContext state:
 * - energyLevel: Derived from ring state (dormant=0, active=0.7, processing=1)
 * - ringState: Direct mapping from context
 *
 * Also provides manual control overrides for transitions.
 *
 * @see Phase 30: Atmospheric Fog System
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useOptaRingOptional } from '@/contexts/OptaRingContext';
import type { RingState } from '@/components/OptaRing3D/types';

// =============================================================================
// TYPES
// =============================================================================

export interface AtmosphericFogState {
  /** Ring state for color determination */
  ringState: RingState;
  /** Energy level from 0 to 1 */
  energyLevel: number;
  /** Whether fog is enabled */
  enabled: boolean;
  /** Whether currently in an explosion/flash state */
  isExploding: boolean;
}

export interface AtmosphericFogControls {
  /** Trigger explosion effect (flash to bright, then fade) */
  triggerExplosion: () => void;
  /** Set manual energy level override */
  setEnergyOverride: (energy: number | null) => void;
  /** Enable/disable fog */
  setEnabled: (enabled: boolean) => void;
  /** Pulse the fog briefly */
  pulse: () => void;
}

export interface UseAtmosphericFogReturn extends AtmosphericFogState, AtmosphericFogControls {}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Energy levels for each ring state
 * @see 30-02: Fog intensity synced with ring energy level
 */
const RING_STATE_ENERGY: Record<RingState, number> = {
  dormant: 0,       // Barely visible fog
  waking: 0.3,      // Transitioning up
  active: 0.7,      // Moderate fog
  sleeping: 0.3,    // Transitioning down
  processing: 1,    // Full dramatic fog
  exploding: 1,     // Max intensity
  recovering: 0.6,  // Post-explosion cooldown
};

/** Duration of explosion flash effect in ms */
const EXPLOSION_DURATION = 300;

/** Duration of pulse effect in ms */
const PULSE_DURATION = 400;

// =============================================================================
// HOOK
// =============================================================================

export function useAtmosphericFog(): UseAtmosphericFogReturn {
  // Get ring context (optional - works without it)
  const ringContext = useOptaRingOptional();

  // Local state for overrides and effects
  const [energyOverride, setEnergyOverride] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [isExploding, setIsExploding] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  // Derive ring state from context or default to dormant
  const ringState: RingState = ringContext?.state ?? 'dormant';

  // Calculate energy level
  const energyLevel = useMemo(() => {
    // If exploding, use max energy
    if (isExploding) return 1;

    // If pulsing, boost energy
    if (isPulsing) {
      const baseEnergy = energyOverride ?? RING_STATE_ENERGY[ringState];
      return Math.min(1, baseEnergy + 0.3);
    }

    // Use override if set, otherwise derive from ring state
    if (energyOverride !== null) return energyOverride;

    return RING_STATE_ENERGY[ringState];
  }, [ringState, energyOverride, isExploding, isPulsing]);

  // Trigger explosion effect
  const triggerExplosion = useCallback(() => {
    setIsExploding(true);

    // Clear explosion after duration
    const timer = setTimeout(() => {
      setIsExploding(false);
    }, EXPLOSION_DURATION);

    return () => clearTimeout(timer);
  }, []);

  // Pulse the fog
  const pulse = useCallback(() => {
    setIsPulsing(true);

    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, PULSE_DURATION);

    return () => clearTimeout(timer);
  }, []);

  // Sync with ring transitions
  useEffect(() => {
    if (ringContext?.isTransitioning) {
      // Boost energy during transitions
      setEnergyOverride(0.8);
    } else {
      // Clear override when not transitioning
      setEnergyOverride(null);
    }
  }, [ringContext?.isTransitioning]);

  return {
    // State
    ringState,
    energyLevel,
    enabled,
    isExploding,
    // Controls
    triggerExplosion,
    setEnergyOverride,
    setEnabled,
    pulse,
  };
}

/**
 * useAtmosphericFogSimple - Simplified hook with just state
 *
 * Use this when you only need to read fog state, not control it.
 */
export function useAtmosphericFogSimple(): AtmosphericFogState {
  const ringContext = useOptaRingOptional();
  const ringState: RingState = ringContext?.state ?? 'dormant';

  return {
    ringState,
    energyLevel: RING_STATE_ENERGY[ringState],
    enabled: true,
    isExploding: false,
  };
}

export default useAtmosphericFog;
