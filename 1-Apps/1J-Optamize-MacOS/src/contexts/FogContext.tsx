import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { FogIntensity, ColorTemperature } from '@/components/AtmosphericFog';

/**
 * FogContext - Global state for the atmospheric fog system
 *
 * Controls fog intensity across the app, synchronizing with:
 * - User interactions (hover, click, focus)
 * - Page transitions
 * - Loading/processing states
 * - OptaRing state changes
 *
 * @see DESIGN_SYSTEM.md - Part 2: Visual Identity
 */

interface FogState {
  /** Current fog intensity mode */
  intensity: FogIntensity;
  /** Custom opacity override (0-1), null means use intensity default */
  customOpacity: number | null;
  /** Whether fog is enabled */
  enabled: boolean;
  /** Whether fog is currently transitioning */
  isTransitioning: boolean;
  /** Whether to use WebGL fog (when chrome system is active) */
  useWebGL: boolean;
  /** Ring energy level (0-1) for dynamic fog coupling */
  ringEnergy: number;
  /** Whether fog is billowing (activation animation) */
  isBillowing: boolean;
  /** Color temperature shift for ring state coupling */
  colorTemperature: ColorTemperature;
}

export type { FogIntensity };

interface FogContextValue extends FogState {
  /** Set fog intensity directly */
  setIntensity: (intensity: FogIntensity) => void;
  /** Set custom opacity (0-1) */
  setOpacity: (opacity: number | null) => void;
  /** Enable/disable fog */
  setEnabled: (enabled: boolean) => void;
  /** Trigger a brief intensity pulse */
  pulse: () => void;
  /** Trigger storm mode for heavy tasks */
  storm: (duration?: number) => void;
  /** Activate fog for interaction feedback */
  activate: () => void;
  /** Return to idle state */
  idle: () => void;
  /** Sync fog with OptaRing state */
  syncWithRing: (ringState: 'dormant' | 'active' | 'processing') => void;
  /** Enable/disable WebGL mode */
  setUseWebGL: (useWebGL: boolean) => void;
  /** Set ring energy level (0-1) for dynamic fog coupling */
  setRingEnergy: (energy: number) => void;
  /** Trigger billowing animation on ring activation */
  billow: () => void;
  /** Set color temperature for ring state coupling */
  setColorTemperature: (temp: ColorTemperature) => void;
}

const FogContext = createContext<FogContextValue | null>(null);

const DEFAULT_STATE: FogState = {
  intensity: 'idle',
  customOpacity: null,
  enabled: true,
  isTransitioning: false,
  useWebGL: false,
  ringEnergy: 0,
  isBillowing: false,
  colorTemperature: 'neutral',
};

// Durations in ms
const PULSE_DURATION = 400;
const DEFAULT_STORM_DURATION = 3000;
const TRANSITION_DURATION = 300;
const BILLOW_DURATION = 600;

export function FogProvider({ children }: { children: React.ReactNode }) {
  const [fogState, setFogState] = useState<FogState>(DEFAULT_STATE);
  const previousIntensityRef = useRef<FogIntensity>('idle');
  const stormTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (stormTimeoutRef.current) clearTimeout(stormTimeoutRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (billowTimeoutRef.current) clearTimeout(billowTimeoutRef.current);
    };
  }, []);

  // Set intensity directly
  const setIntensity = useCallback((intensity: FogIntensity) => {
    setFogState((prev) => {
      previousIntensityRef.current = prev.intensity;
      return {
        ...prev,
        intensity,
        isTransitioning: true,
      };
    });

    setTimeout(() => {
      setFogState((prev) => ({
        ...prev,
        isTransitioning: false,
      }));
    }, TRANSITION_DURATION);
  }, []);

  // Set custom opacity
  const setOpacity = useCallback((opacity: number | null) => {
    setFogState((prev) => ({
      ...prev,
      customOpacity: opacity,
    }));
  }, []);

  // Enable/disable fog
  const setEnabled = useCallback((enabled: boolean) => {
    setFogState((prev) => ({
      ...prev,
      enabled,
    }));
  }, []);

  // Pulse: brief intensity spike then return
  const pulse = useCallback(() => {
    // Clear any existing pulse timeout
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }

    const current = fogState.intensity;

    // Quick spike to active
    setFogState((prev) => ({
      ...prev,
      intensity: 'active',
      isTransitioning: true,
    }));

    // Return to previous state
    pulseTimeoutRef.current = setTimeout(() => {
      setFogState((prev) => ({
        ...prev,
        intensity: current,
        isTransitioning: false,
      }));
    }, PULSE_DURATION);
  }, [fogState.intensity]);

  // Storm: sustained high intensity
  const storm = useCallback((duration = DEFAULT_STORM_DURATION) => {
    // Clear any existing storm timeout
    if (stormTimeoutRef.current) {
      clearTimeout(stormTimeoutRef.current);
    }

    const current = fogState.intensity;
    previousIntensityRef.current = current;

    // Activate storm mode
    setFogState((prev) => ({
      ...prev,
      intensity: 'storm',
      isTransitioning: true,
    }));

    // Return to previous state after duration
    stormTimeoutRef.current = setTimeout(() => {
      setFogState((prev) => ({
        ...prev,
        intensity: previousIntensityRef.current,
        isTransitioning: false,
      }));
    }, duration);
  }, [fogState.intensity]);

  // Activate: set to active intensity
  const activate = useCallback(() => {
    setIntensity('active');
  }, [setIntensity]);

  // Idle: return to idle intensity
  const idle = useCallback(() => {
    setIntensity('idle');
  }, [setIntensity]);

  // Sync with OptaRing state
  const syncWithRing = useCallback((ringState: 'dormant' | 'active' | 'processing') => {
    switch (ringState) {
      case 'dormant':
        setIntensity('idle');
        setFogState((prev) => ({ ...prev, colorTemperature: 'cool' }));
        break;
      case 'active':
        setIntensity('active');
        setFogState((prev) => ({ ...prev, colorTemperature: 'warm' }));
        break;
      case 'processing':
        // Processing triggers a subtle active state
        setIntensity('active');
        setFogState((prev) => ({ ...prev, colorTemperature: 'warm' }));
        break;
    }
  }, [setIntensity]);

  // Set ring energy level for dynamic fog coupling
  const setRingEnergy = useCallback((energy: number) => {
    const clampedEnergy = Math.max(0, Math.min(1, energy));
    setFogState((prev) => ({
      ...prev,
      ringEnergy: clampedEnergy,
    }));
  }, []);

  // Trigger billowing animation on ring activation
  const billow = useCallback(() => {
    // Clear any existing billow timeout
    if (billowTimeoutRef.current) {
      clearTimeout(billowTimeoutRef.current);
    }

    // Start billowing
    setFogState((prev) => ({
      ...prev,
      isBillowing: true,
    }));

    // End billowing after duration
    billowTimeoutRef.current = setTimeout(() => {
      setFogState((prev) => ({
        ...prev,
        isBillowing: false,
      }));
    }, BILLOW_DURATION);
  }, []);

  // Set color temperature
  const setColorTemperature = useCallback((temp: ColorTemperature) => {
    setFogState((prev) => ({
      ...prev,
      colorTemperature: temp,
    }));
  }, []);

  // Enable/disable WebGL mode
  const setUseWebGL = useCallback((useWebGL: boolean) => {
    setFogState((prev) => ({
      ...prev,
      useWebGL,
    }));
  }, []);

  const value: FogContextValue = {
    ...fogState,
    setIntensity,
    setOpacity,
    setEnabled,
    pulse,
    storm,
    activate,
    idle,
    syncWithRing,
    setUseWebGL,
    setRingEnergy,
    billow,
    setColorTemperature,
  };

  return (
    <FogContext.Provider value={value}>
      {children}
    </FogContext.Provider>
  );
}

/**
 * Hook to access Fog context
 * @throws Error if used outside FogProvider
 */
export function useFog(): FogContextValue {
  const context = useContext(FogContext);
  if (!context) {
    throw new Error('useFog must be used within a FogProvider');
  }
  return context;
}

/**
 * Hook to access Fog context with optional provider
 * Returns null if no provider is present (useful for conditional usage)
 */
export function useFogOptional(): FogContextValue | null {
  return useContext(FogContext);
}

/**
 * Hook to trigger fog pulse on interaction
 * Use this in click handlers for interactive elements
 */
export function useFogPulse(): () => void {
  const fog = useFogOptional();
  return useCallback(() => {
    fog?.pulse();
  }, [fog]);
}

/**
 * Hook to sync fog with loading state
 * Automatically activates fog during loading
 */
export function useFogLoading(isLoading: boolean): void {
  const fog = useFogOptional();

  useEffect(() => {
    if (!fog) return;

    if (isLoading) {
      fog.activate();
    } else {
      fog.idle();
    }
  }, [isLoading, fog]);
}

export default FogContext;
