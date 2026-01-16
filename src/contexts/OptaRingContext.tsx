import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { RingState, RingSize } from '@/components/OptaRing';

/**
 * OptaRingContext - Global state for the Opta Ring protagonist
 *
 * Controls ring behavior across the app including:
 * - State transitions (dormant, active, processing)
 * - Position for page transitions (ring moves to center, ignites, dissolves)
 * - Coordination with fog/atmosphere effects
 *
 * @see DESIGN_SYSTEM.md - Part 7: The Opta Ring
 */

export type RingPosition = {
  x: number;
  y: number;
} | 'center' | 'sidebar' | 'hidden';

interface OptaRingState {
  /** Current ring state */
  state: RingState;
  /** Current position */
  position: RingPosition;
  /** Size for the floating ring */
  size: RingSize;
  /** Whether the ring is currently transitioning */
  isTransitioning: boolean;
  /** Whether the floating ring overlay is visible */
  showFloating: boolean;
}

interface OptaRingContextValue extends OptaRingState {
  /** Trigger ignition (0% → 50%) */
  ignite: () => Promise<void>;
  /** Return to dormant state (50% → 0%) */
  sleep: () => Promise<void>;
  /** Start processing animation */
  startProcessing: () => void;
  /** Stop processing and return to previous state */
  stopProcessing: () => void;
  /** Set ring state directly */
  setState: (state: RingState) => void;
  /** Move ring to a position */
  moveTo: (position: RingPosition) => Promise<void>;
  /** Show/hide floating ring overlay */
  setShowFloating: (show: boolean) => void;
  /** Set floating ring size */
  setSize: (size: RingSize) => void;
  /** Trigger page transition sequence */
  triggerPageTransition: () => Promise<void>;
  /** Flash the ring briefly (for feedback) */
  flash: () => Promise<void>;
}

const OptaRingContext = createContext<OptaRingContextValue | null>(null);

const DEFAULT_STATE: OptaRingState = {
  state: 'dormant',
  position: 'sidebar',
  size: 'md',
  isTransitioning: false,
  showFloating: false,
};

// Transition durations in ms
const TRANSITION_DURATION = 600;
const FLASH_DURATION = 300;

export function OptaRingProvider({ children }: { children: React.ReactNode }) {
  const [ringState, setRingState] = useState<OptaRingState>(DEFAULT_STATE);
  const previousStateRef = useRef<RingState>('dormant');

  // Ignite: transition from 0% to 50%
  const ignite = useCallback(async () => {
    setRingState((prev) => ({
      ...prev,
      state: 'active',
      isTransitioning: true,
    }));

    await new Promise((resolve) => setTimeout(resolve, TRANSITION_DURATION));

    setRingState((prev) => ({
      ...prev,
      isTransitioning: false,
    }));
  }, []);

  // Sleep: transition from 50% to 0%
  const sleep = useCallback(async () => {
    setRingState((prev) => ({
      ...prev,
      state: 'dormant',
      isTransitioning: true,
    }));

    await new Promise((resolve) => setTimeout(resolve, TRANSITION_DURATION));

    setRingState((prev) => ({
      ...prev,
      isTransitioning: false,
    }));
  }, []);

  // Start processing animation
  const startProcessing = useCallback(() => {
    setRingState((prev) => {
      previousStateRef.current = prev.state;
      return {
        ...prev,
        state: 'processing',
      };
    });
  }, []);

  // Stop processing and return to previous state
  const stopProcessing = useCallback(() => {
    setRingState((prev) => ({
      ...prev,
      state: previousStateRef.current,
    }));
  }, []);

  // Set state directly
  const setState = useCallback((state: RingState) => {
    setRingState((prev) => ({
      ...prev,
      state,
    }));
  }, []);

  // Move ring to position
  const moveTo = useCallback(async (position: RingPosition) => {
    setRingState((prev) => ({
      ...prev,
      position,
      isTransitioning: true,
    }));

    await new Promise((resolve) => setTimeout(resolve, TRANSITION_DURATION / 2));

    setRingState((prev) => ({
      ...prev,
      isTransitioning: false,
    }));
  }, []);

  // Show/hide floating ring
  const setShowFloating = useCallback((show: boolean) => {
    setRingState((prev) => ({
      ...prev,
      showFloating: show,
    }));
  }, []);

  // Set ring size
  const setSize = useCallback((size: RingSize) => {
    setRingState((prev) => ({
      ...prev,
      size,
    }));
  }, []);

  // Page transition sequence
  const triggerPageTransition = useCallback(async () => {
    // 1. Show floating ring at center
    setRingState((prev) => ({
      ...prev,
      position: 'center',
      showFloating: true,
      size: 'xl',
      isTransitioning: true,
    }));

    // 2. Ignite (0% → 50%)
    await new Promise((resolve) => setTimeout(resolve, 100));
    setRingState((prev) => ({
      ...prev,
      state: 'active',
    }));

    // 3. Hold at 50%
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 4. Fade out
    setRingState((prev) => ({
      ...prev,
      state: 'dormant',
    }));

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 5. Hide floating ring
    setRingState((prev) => ({
      ...prev,
      showFloating: false,
      position: 'sidebar',
      size: 'md',
      isTransitioning: false,
    }));
  }, []);

  // Flash for feedback
  const flash = useCallback(async () => {
    const currentState = ringState.state;

    setRingState((prev) => ({
      ...prev,
      state: 'active',
    }));

    await new Promise((resolve) => setTimeout(resolve, FLASH_DURATION));

    setRingState((prev) => ({
      ...prev,
      state: currentState,
    }));
  }, [ringState.state]);

  const value: OptaRingContextValue = {
    ...ringState,
    ignite,
    sleep,
    startProcessing,
    stopProcessing,
    setState,
    moveTo,
    setShowFloating,
    setSize,
    triggerPageTransition,
    flash,
  };

  return (
    <OptaRingContext.Provider value={value}>
      {children}
    </OptaRingContext.Provider>
  );
}

/**
 * Hook to access OptaRing context
 * @throws Error if used outside OptaRingProvider
 */
export function useOptaRing(): OptaRingContextValue {
  const context = useContext(OptaRingContext);
  if (!context) {
    throw new Error('useOptaRing must be used within an OptaRingProvider');
  }
  return context;
}

/**
 * Hook to access OptaRing context with optional provider
 * Returns null if no provider is present (useful for conditional usage)
 */
export function useOptaRingOptional(): OptaRingContextValue | null {
  return useContext(OptaRingContext);
}

export default OptaRingContext;
