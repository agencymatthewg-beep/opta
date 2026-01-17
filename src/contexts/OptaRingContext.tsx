import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  type RingState,
  type RingSize,
  getDefaultEnergy,
  getTransitionTiming,
  isValidTransition,
} from '@/components/OptaRing3D/types';

/**
 * OptaRingContext - Global State Machine for the Opta Ring Protagonist
 *
 * Phase 28: Ring State Machine & Context
 *
 * Provides app-wide control of the Opta Ring including:
 * - Full state machine with 7 states (dormant, waking, active, sleeping, processing, exploding, recovering)
 * - Energy level tracking (0-1) derived from state
 * - Automatic state transitions with proper timing
 * - Explosion trigger for celebration moments
 * - Processing state for async operations
 * - SSR-safe implementation
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see src/components/OptaRing3D/types.ts for state definitions
 */

/** Ring position for floating ring */
export type RingPosition =
  | { x: number; y: number }
  | 'center'
  | 'sidebar'
  | 'hidden';

/** Internal state shape */
interface OptaRingInternalState {
  /** Current ring state */
  state: RingState;
  /** Energy level (0-1) */
  energyLevel: number;
  /** Current position */
  position: RingPosition;
  /** Size for the floating ring */
  size: RingSize;
  /** Whether the ring is currently transitioning */
  isTransitioning: boolean;
  /** Whether the floating ring overlay is visible */
  showFloating: boolean;
  /** State before processing started (for recovery) */
  previousState: RingState | null;
}

/** Context value exposed to consumers */
export interface OptaRingContextValue {
  // State
  /** Current ring state */
  state: RingState;
  /** Energy level (0-1) - derived from state with smooth transitions */
  energyLevel: number;
  /** Current position */
  position: RingPosition;
  /** Size for the floating ring */
  size: RingSize;
  /** Whether the ring is currently transitioning */
  isTransitioning: boolean;
  /** Whether the floating ring overlay is visible */
  showFloating: boolean;

  // Actions
  /** Trigger explosion effect (celebration) */
  triggerExplosion: () => void;
  /** Set processing state (for async operations) */
  setProcessing: (processing: boolean) => void;
  /** Trigger ignition (dormant → waking → active) */
  ignite: () => Promise<void>;
  /** Return to dormant state (active → sleeping → dormant) */
  sleep: () => Promise<void>;
  /** Set ring state directly (validates transitions) */
  setState: (state: RingState) => void;
  /** Force state without validation (use sparingly) */
  forceState: (state: RingState) => void;
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

/** Default state */
const DEFAULT_STATE: OptaRingInternalState = {
  state: 'dormant',
  energyLevel: 0.1, // Default dormant energy
  position: 'sidebar',
  size: 'md',
  isTransitioning: false,
  showFloating: false,
  previousState: null,
};

/** Animation timing constants (ms) */
const WAKING_DURATION = 800;
const SLEEPING_DURATION = 800;
const EXPLODING_DURATION = 800;
const RECOVERING_DURATION = 500;
const FLASH_DURATION = 300;
const POSITION_TRANSITION_DURATION = 300;

/**
 * Provider component for OptaRing global state
 */
export function OptaRingProvider({ children }: { children: React.ReactNode }) {
  const [internalState, setInternalState] = useState<OptaRingInternalState>(DEFAULT_STATE);

  // Refs for cleanup
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const energyAnimationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Clear timeouts on cleanup
  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const clearEnergyAnimation = useCallback(() => {
    if (energyAnimationRef.current) {
      cancelAnimationFrame(energyAnimationRef.current);
      energyAnimationRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTransitionTimeout();
      clearEnergyAnimation();
    };
  }, [clearTransitionTimeout, clearEnergyAnimation]);

  // Animate energy level
  const animateEnergy = useCallback(
    (targetEnergy: number, duration: number) => {
      clearEnergyAnimation();

      const startEnergy = internalState.energyLevel;
      const startTime = performance.now();
      const delta = targetEnergy - startEnergy;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newEnergy = startEnergy + delta * easeOut;

        setInternalState((prev) => ({ ...prev, energyLevel: newEnergy }));

        if (progress < 1) {
          energyAnimationRef.current = requestAnimationFrame(animate);
        }
      };

      if (duration > 0) {
        energyAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setInternalState((prev) => ({ ...prev, energyLevel: targetEnergy }));
      }
    },
    [internalState.energyLevel, clearEnergyAnimation]
  );

  // Trigger explosion effect
  const triggerExplosion = useCallback(() => {
    const currentState = internalState.state;

    // Can only explode from active or processing
    if (currentState !== 'active' && currentState !== 'processing') {
      console.warn(`Cannot trigger explosion from state: ${currentState}`);
      return;
    }

    clearTransitionTimeout();

    // Set exploding state
    setInternalState((prev) => ({
      ...prev,
      state: 'exploding',
      energyLevel: 1.0,
      isTransitioning: true,
    }));

    // Transition to recovering after explosion duration
    transitionTimeoutRef.current = setTimeout(() => {
      setInternalState((prev) => ({
        ...prev,
        state: 'recovering',
        isTransitioning: true,
      }));

      animateEnergy(0.55, RECOVERING_DURATION);

      // Transition back to active after recovery
      transitionTimeoutRef.current = setTimeout(() => {
        setInternalState((prev) => ({
          ...prev,
          state: 'active',
          isTransitioning: false,
        }));

        animateEnergy(0.6, 200);
      }, RECOVERING_DURATION);
    }, EXPLODING_DURATION);
  }, [internalState.state, animateEnergy, clearTransitionTimeout]);

  // Set processing state
  const setProcessing = useCallback(
    (processing: boolean) => {
      if (processing) {
        // Start processing - store previous state
        setInternalState((prev) => ({
          ...prev,
          state: 'processing',
          previousState: prev.state,
          isTransitioning: false,
        }));
        animateEnergy(0.75, 200);
      } else {
        // Stop processing - return to previous state
        setInternalState((prev) => {
          const returnState = prev.previousState ?? 'active';
          return {
            ...prev,
            state: returnState,
            previousState: null,
            isTransitioning: false,
          };
        });
        animateEnergy(0.6, 200);
      }
    },
    [animateEnergy]
  );

  // Ignite: dormant → waking → active
  const ignite = useCallback(async () => {
    clearTransitionTimeout();

    // Start waking
    setInternalState((prev) => ({
      ...prev,
      state: 'waking',
      isTransitioning: true,
    }));

    animateEnergy(0.5, WAKING_DURATION);

    // Wait for waking duration
    await new Promise<void>((resolve) => {
      transitionTimeoutRef.current = setTimeout(() => {
        setInternalState((prev) => ({
          ...prev,
          state: 'active',
          isTransitioning: false,
        }));
        animateEnergy(0.6, 200);
        resolve();
      }, WAKING_DURATION);
    });
  }, [animateEnergy, clearTransitionTimeout]);

  // Sleep: active → sleeping → dormant
  const sleep = useCallback(async () => {
    clearTransitionTimeout();

    // Start sleeping
    setInternalState((prev) => ({
      ...prev,
      state: 'sleeping',
      isTransitioning: true,
    }));

    animateEnergy(0.2, SLEEPING_DURATION);

    // Wait for sleeping duration
    await new Promise<void>((resolve) => {
      transitionTimeoutRef.current = setTimeout(() => {
        setInternalState((prev) => ({
          ...prev,
          state: 'dormant',
          isTransitioning: false,
        }));
        animateEnergy(0.1, 200);
        resolve();
      }, SLEEPING_DURATION);
    });
  }, [animateEnergy, clearTransitionTimeout]);

  // Set state with validation
  const setState = useCallback(
    (newState: RingState) => {
      const currentState = internalState.state;

      if (!isValidTransition(currentState, newState)) {
        console.warn(`Invalid state transition: ${currentState} → ${newState}`);
        return;
      }

      const timing = getTransitionTiming(currentState, newState);

      setInternalState((prev) => ({
        ...prev,
        state: newState,
        isTransitioning: timing.duration > 0,
      }));

      animateEnergy(getDefaultEnergy(newState), timing.duration || 200);

      if (timing.duration > 0) {
        clearTransitionTimeout();
        transitionTimeoutRef.current = setTimeout(() => {
          setInternalState((prev) => ({
            ...prev,
            isTransitioning: false,
          }));
        }, timing.duration);
      }
    },
    [internalState.state, animateEnergy, clearTransitionTimeout]
  );

  // Force state without validation
  const forceState = useCallback(
    (newState: RingState) => {
      clearTransitionTimeout();
      setInternalState((prev) => ({
        ...prev,
        state: newState,
        energyLevel: getDefaultEnergy(newState),
        isTransitioning: false,
      }));
    },
    [clearTransitionTimeout]
  );

  // Move ring to position
  const moveTo = useCallback(async (position: RingPosition) => {
    setInternalState((prev) => ({
      ...prev,
      position,
      isTransitioning: true,
    }));

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        setInternalState((prev) => ({
          ...prev,
          isTransitioning: false,
        }));
        resolve();
      }, POSITION_TRANSITION_DURATION);
    });
  }, []);

  // Show/hide floating ring
  const setShowFloating = useCallback((show: boolean) => {
    setInternalState((prev) => ({
      ...prev,
      showFloating: show,
    }));
  }, []);

  // Set ring size
  const setSize = useCallback((size: RingSize) => {
    setInternalState((prev) => ({
      ...prev,
      size,
    }));
  }, []);

  // Page transition sequence
  const triggerPageTransition = useCallback(async () => {
    // 1. Show floating ring at center
    setInternalState((prev) => ({
      ...prev,
      position: 'center',
      showFloating: true,
      size: 'xl',
      isTransitioning: true,
    }));

    // 2. Ignite (dormant → waking → active)
    await new Promise((resolve) => setTimeout(resolve, 100));
    await ignite();

    // 3. Hold at active briefly
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Sleep (active → sleeping → dormant)
    await sleep();

    // 5. Hide floating ring
    setInternalState((prev) => ({
      ...prev,
      showFloating: false,
      position: 'sidebar',
      size: 'md',
      isTransitioning: false,
    }));
  }, [ignite, sleep]);

  // Flash for feedback
  const flash = useCallback(async () => {
    const currentState = internalState.state;
    const currentEnergy = internalState.energyLevel;

    // Quick ignite
    setInternalState((prev) => ({
      ...prev,
      state: 'active',
      energyLevel: 0.8,
    }));

    await new Promise((resolve) => setTimeout(resolve, FLASH_DURATION));

    // Return to previous state
    setInternalState((prev) => ({
      ...prev,
      state: currentState,
      energyLevel: currentEnergy,
    }));
  }, [internalState.state, internalState.energyLevel]);

  // Build context value
  const value: OptaRingContextValue = useMemo(
    () => ({
      state: internalState.state,
      energyLevel: internalState.energyLevel,
      position: internalState.position,
      size: internalState.size,
      isTransitioning: internalState.isTransitioning,
      showFloating: internalState.showFloating,
      triggerExplosion,
      setProcessing,
      ignite,
      sleep,
      setState,
      forceState,
      moveTo,
      setShowFloating,
      setSize,
      triggerPageTransition,
      flash,
    }),
    [
      internalState,
      triggerExplosion,
      setProcessing,
      ignite,
      sleep,
      setState,
      forceState,
      moveTo,
      setShowFloating,
      setSize,
      triggerPageTransition,
      flash,
    ]
  );

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

/**
 * Hook to get just the ring state (for performance-sensitive renders)
 */
export function useRingState(): RingState {
  const context = useOptaRing();
  return context.state;
}

/**
 * Hook to get just the energy level
 */
export function useRingEnergy(): number {
  const context = useOptaRing();
  return context.energyLevel;
}

export default OptaRingContext;
