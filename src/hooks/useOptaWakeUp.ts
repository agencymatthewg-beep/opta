/**
 * useOptaWakeUp - Ring Wake-Up Interaction Hook
 *
 * Phase 26: Tracks user engagement to trigger ring wake-up animation.
 * Phase 28: Enhanced with extended activity detection and timing.
 *
 * The ring transitions between dormant (0%) and active (50%) states
 * based on hover, keyboard, scroll, and click activity.
 *
 * Behavior:
 * - Wake trigger: Immediate on activity detected (throttled to 100ms)
 * - Sleep trigger: 3000ms after last interaction
 * - Returns isEngaged, energyLevel, phase, lastActivity, engagementDuration
 *
 * Activity Detection:
 * - Mouse movement (within element or global)
 * - Keyboard input (keydown)
 * - Scroll events
 * - Click/touch events
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see .claude/skills/opta-ring-animation.md
 * @see src/components/OptaRing3D/types.ts for RingState
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RingState } from '@/components/OptaRing3D/types';

/** Activity events that can trigger wake-up */
export type ActivityEvent =
  | 'mousemove'
  | 'keydown'
  | 'scroll'
  | 'click'
  | 'touchstart'
  | 'mousedown'
  | 'wheel'
  | 'mouseenter'
  | 'mouseleave';

export interface WakeUpState {
  /** Whether the ring should be in active (engaged) state */
  isEngaged: boolean;
  /** Energy level from 0 (dormant) to 0.5 (active) */
  energyLevel: number;
  /** Current animation phase matching RingState */
  phase: RingState;
  /** Timestamp of last detected activity (ms since epoch) */
  lastActivity: number;
  /** Duration of current engagement session (ms) */
  engagementDuration: number;
}

export interface UseOptaWakeUpOptions {
  /** Ref to the element to track hover on */
  elementRef?: React.RefObject<HTMLElement | null>;
  /** Whether to track global activity (keyboard, scroll, etc.) */
  trackGlobal?: boolean;
  /** Whether to track keyboard activity specifically */
  trackKeyboard?: boolean;
  /** Whether to track scroll activity */
  trackScroll?: boolean;
  /** Whether to track click/touch activity */
  trackClick?: boolean;
  /** Throttle interval for activity detection (ms) - default 100ms */
  throttleMs?: number;
  /** Delay before sleeping (ms) - default 3000ms */
  sleepDelay?: number;
  /** Whether the hook is enabled */
  enabled?: boolean;
  /** Initial engaged state */
  initialEngaged?: boolean;
  /** Callback when engagement changes */
  onEngagementChange?: (engaged: boolean, phase: RingState) => void;
}

/** Actions returned from the hook */
export interface WakeUpActions {
  /** Manually wake up the ring */
  wake: () => void;
  /** Manually put the ring to sleep */
  sleep: () => void;
  /** Reset activity tracking */
  reset: () => void;
}

// Default timing constants from spec
const DEFAULT_THROTTLE_MS = 100; // 100ms throttle
const DEFAULT_SLEEP_DELAY = 3000; // 3s before sleep
const ENERGY_TRANSITION_DURATION = 800; // 800ms spring transition

/**
 * Hook to track user engagement and control ring wake-up state.
 *
 * @param options - Configuration options
 * @returns WakeUpState with isEngaged, energyLevel, phase, lastActivity, engagementDuration
 *
 * @example
 * ```tsx
 * const ringRef = useRef<HTMLDivElement>(null);
 * const {
 *   isEngaged,
 *   energyLevel,
 *   phase,
 *   lastActivity,
 *   engagementDuration,
 *   wake,
 *   sleep,
 * } = useOptaWakeUp({
 *   elementRef: ringRef,
 *   trackGlobal: true,
 * });
 *
 * return (
 *   <div ref={ringRef}>
 *     <OptaRing3D state={phase} energyLevel={energyLevel} />
 *   </div>
 * );
 * ```
 */
export function useOptaWakeUp(options: UseOptaWakeUpOptions = {}): WakeUpState & WakeUpActions {
  const {
    elementRef,
    trackGlobal = true,
    trackKeyboard = true,
    trackScroll = true,
    trackClick = true,
    throttleMs = DEFAULT_THROTTLE_MS,
    sleepDelay = DEFAULT_SLEEP_DELAY,
    enabled = true,
    initialEngaged = false,
    onEngagementChange,
  } = options;

  // Core state
  const [phase, setPhase] = useState<RingState>(initialEngaged ? 'active' : 'dormant');
  const [energyLevel, setEnergyLevel] = useState(initialEngaged ? 0.5 : 0);
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [engagementStart, setEngagementStart] = useState<number | null>(
    initialEngaged ? Date.now() : null
  );
  const [engagementDuration, setEngagementDuration] = useState(0);

  // Refs for timers and throttling
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const energyAnimationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const durationAnimationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isThrottledRef = useRef(false);
  const phaseRef = useRef(phase);
  const engagementStartRef = useRef(engagementStart);

  // Keep refs in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    engagementStartRef.current = engagementStart;
  }, [engagementStart]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (energyAnimationRef.current) {
      cancelAnimationFrame(energyAnimationRef.current);
      energyAnimationRef.current = null;
    }
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }
    if (durationAnimationRef.current) {
      cancelAnimationFrame(durationAnimationRef.current);
      durationAnimationRef.current = null;
    }
  }, []);

  // Animate energy level with ease-out curve
  const animateEnergy = useCallback(
    (targetEnergy: number, duration: number, startEnergy: number) => {
      const startTime = performance.now();
      const delta = targetEnergy - startEnergy;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic curve for sleepy feel
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newEnergy = startEnergy + delta * easeOut;

        setEnergyLevel(newEnergy);

        if (progress < 1) {
          energyAnimationRef.current = requestAnimationFrame(animate);
        }
      };

      if (energyAnimationRef.current) {
        cancelAnimationFrame(energyAnimationRef.current);
      }
      energyAnimationRef.current = requestAnimationFrame(animate);
    },
    []
  );

  // Manual wake function
  const wake = useCallback(() => {
    const now = Date.now();
    lastInteractionRef.current = now;
    setLastActivity(now);

    // Cancel any pending sleep
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    const currentPhase = phaseRef.current;

    // Start waking if dormant or sleeping
    if (currentPhase === 'dormant' || currentPhase === 'sleeping') {
      setPhase('waking');
      setEngagementStart(now);
      animateEnergy(0.5, ENERGY_TRANSITION_DURATION, currentPhase === 'dormant' ? 0 : 0.25);

      // After animation completes, set to active
      setTimeout(() => {
        setPhase('active');
      }, ENERGY_TRANSITION_DURATION);
    }
  }, [animateEnergy]);

  // Manual sleep function
  const sleep = useCallback(() => {
    const currentPhase = phaseRef.current;

    if (currentPhase === 'active' || currentPhase === 'waking') {
      setPhase('sleeping');
      const currentEnergy = currentPhase === 'waking' ? 0.25 : 0.5;
      animateEnergy(0, ENERGY_TRANSITION_DURATION, currentEnergy);

      // After animation completes, set to dormant
      setTimeout(() => {
        setPhase('dormant');
        setEngagementStart(null);
        setEngagementDuration(0);
      }, ENERGY_TRANSITION_DURATION);
    }
  }, [animateEnergy]);

  // Reset function
  const reset = useCallback(() => {
    clearTimers();
    setPhase('dormant');
    setEnergyLevel(0);
    setEngagementStart(null);
    setEngagementDuration(0);
    setLastActivity(Date.now());
    isThrottledRef.current = false;
  }, [clearTimers]);

  // Schedule sleep after inactivity
  const scheduleSleep = useCallback(() => {
    // Clear any existing sleep timer
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
    }

    sleepTimerRef.current = setTimeout(() => {
      sleep();
    }, sleepDelay);
  }, [sleep, sleepDelay]);

  // Handle user interaction
  const handleInteraction = useCallback(() => {
    if (!enabled) return;

    // Throttle activity detection
    if (isThrottledRef.current) return;

    const now = Date.now();
    lastInteractionRef.current = now;
    setLastActivity(now);

    // Start waking if not already active/waking
    const currentPhase = phaseRef.current;
    if (currentPhase === 'dormant' || currentPhase === 'sleeping') {
      wake();
    }

    // Always reschedule sleep on any activity
    scheduleSleep();

    // Throttle subsequent detections
    isThrottledRef.current = true;
    throttleRef.current = setTimeout(() => {
      isThrottledRef.current = false;
    }, throttleMs);
  }, [enabled, throttleMs, wake, scheduleSleep]);

  // Handle mouse leave (start sleep countdown immediately)
  const handleMouseLeave = useCallback(() => {
    if (!enabled) return;
    scheduleSleep();
  }, [enabled, scheduleSleep]);

  // Update engagement duration while engaged
  useEffect(() => {
    if (phase !== 'active' && phase !== 'waking') {
      if (durationAnimationRef.current) {
        cancelAnimationFrame(durationAnimationRef.current);
        durationAnimationRef.current = null;
      }
      return;
    }

    const updateDuration = () => {
      if (engagementStartRef.current !== null) {
        setEngagementDuration(Date.now() - engagementStartRef.current);
      }
      durationAnimationRef.current = requestAnimationFrame(updateDuration);
    };

    durationAnimationRef.current = requestAnimationFrame(updateDuration);

    return () => {
      if (durationAnimationRef.current) {
        cancelAnimationFrame(durationAnimationRef.current);
      }
    };
  }, [phase]);

  // Fire callback when engagement changes
  useEffect(() => {
    onEngagementChange?.(phase === 'active' || phase === 'waking', phase);
  }, [phase, onEngagementChange]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // SSR safety check
    if (typeof window === 'undefined') return;

    const element = elementRef?.current;

    // Element-specific events
    if (element) {
      element.addEventListener('mouseenter', handleInteraction, { passive: true });
      element.addEventListener('mouseleave', handleMouseLeave, { passive: true });
      element.addEventListener('mousemove', handleInteraction, { passive: true });
      if (trackClick) {
        element.addEventListener('click', handleInteraction, { passive: true });
        element.addEventListener('touchstart', handleInteraction, { passive: true });
      }
    }

    // Global events
    if (trackGlobal) {
      if (trackKeyboard) {
        window.addEventListener('keydown', handleInteraction, { passive: true });
      }
      if (trackScroll) {
        window.addEventListener('scroll', handleInteraction, { passive: true });
        window.addEventListener('wheel', handleInteraction, { passive: true });
      }
      if (trackClick) {
        window.addEventListener('mousedown', handleInteraction, { passive: true });
      }
      // Global mouse movement (optional - can be very frequent)
      if (!element) {
        window.addEventListener('mousemove', handleInteraction, { passive: true });
      }
    }

    return () => {
      if (element) {
        element.removeEventListener('mouseenter', handleInteraction);
        element.removeEventListener('mouseleave', handleMouseLeave);
        element.removeEventListener('mousemove', handleInteraction);
        if (trackClick) {
          element.removeEventListener('click', handleInteraction);
          element.removeEventListener('touchstart', handleInteraction);
        }
      }
      if (trackGlobal) {
        if (trackKeyboard) {
          window.removeEventListener('keydown', handleInteraction);
        }
        if (trackScroll) {
          window.removeEventListener('scroll', handleInteraction);
          window.removeEventListener('wheel', handleInteraction);
        }
        if (trackClick) {
          window.removeEventListener('mousedown', handleInteraction);
        }
        if (!element) {
          window.removeEventListener('mousemove', handleInteraction);
        }
      }
      clearTimers();
    };
  }, [
    enabled,
    elementRef,
    trackGlobal,
    trackKeyboard,
    trackScroll,
    trackClick,
    handleInteraction,
    handleMouseLeave,
    clearTimers,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Calculate isEngaged from phase
  const isEngaged = phase === 'active' || phase === 'waking';

  return {
    isEngaged,
    energyLevel,
    phase,
    lastActivity,
    engagementDuration,
    wake,
    sleep,
    reset,
  };
}

/**
 * Lightweight hook that only returns engagement state
 * Use when you don't need duration tracking or energy animation
 */
export function useIsEngaged(
  options: Omit<UseOptaWakeUpOptions, 'onEngagementChange'> = {}
): boolean {
  const { isEngaged } = useOptaWakeUp(options);
  return isEngaged;
}

export default useOptaWakeUp;
