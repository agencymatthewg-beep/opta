/**
 * Expertise tracking hooks for adaptive user experience.
 *
 * These hooks provide utilities for:
 * 1. Tracking behavioral signals that indicate expertise level
 * 2. Getting content adapted to the current expertise level
 */

import { useCallback, useEffect, useRef } from 'react';
import { useExpertise as useExpertiseContext } from '@/components/ExpertiseContext';

/**
 * Hook for tracking expertise signals.
 * Call these functions when users perform actions that indicate expertise.
 */
export function useExpertiseTracking() {
  const { recordSignal } = useExpertiseContext();

  // Track when user expands technical details
  const trackTechnicalExpand = useCallback(() => {
    recordSignal('expands_technical_details', 100);
  }, [recordSignal]);

  // Track when user enables investigation mode
  const trackInvestigationMode = useCallback(() => {
    recordSignal('uses_investigation_mode', 100);
  }, [recordSignal]);

  // Track keyboard shortcut usage
  const trackShortcut = useCallback(() => {
    recordSignal('uses_shortcuts', 100);
  }, [recordSignal]);

  // Track when user reads documentation
  const trackDocumentation = useCallback(() => {
    recordSignal('reads_documentation', 100);
  }, [recordSignal]);

  // Track session start (call once per session)
  const trackSession = useCallback(() => {
    recordSignal('sessions_count', 1);
  }, [recordSignal]);

  // Track optimization applied
  const trackOptimization = useCallback(() => {
    recordSignal('optimizations_applied', 1);
  }, [recordSignal]);

  // Track usage of technical features
  const trackTechnicalFeature = useCallback(() => {
    recordSignal('uses_technical_features', 100);
  }, [recordSignal]);

  return {
    trackTechnicalExpand,
    trackInvestigationMode,
    trackShortcut,
    trackDocumentation,
    trackSession,
    trackOptimization,
    trackTechnicalFeature,
  };
}

/**
 * Hook for getting content based on expertise level.
 */
export function useExpertiseContent() {
  const { level } = useExpertiseContext();

  /**
   * Get the appropriate explanation based on expertise level.
   * Provide different content for each level.
   */
  const getExplanation = useCallback(
    (content: { simple: string; standard: string; power: string }) => {
      return content[level];
    },
    [level]
  );

  // Show extra technical details for power users
  const showTechnicalDetails = level === 'power';

  // Show simplified UI for simple users
  const showSimplifiedUI = level === 'simple';

  return {
    getExplanation,
    showTechnicalDetails,
    showSimplifiedUI,
    level,
  };
}

/**
 * Hook for tracking shortcut usage across the app.
 * Automatically tracks when user presses modifier keys with other keys.
 */
export function useShortcutTracking() {
  const { trackShortcut } = useExpertiseTracking();
  const lastTrackTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track if using modifier keys (indicates shortcut usage)
      if (e.metaKey || e.ctrlKey) {
        // Throttle to avoid tracking repeated key presses
        const now = Date.now();
        if (now - lastTrackTime.current > 5000) {
          lastTrackTime.current = now;
          trackShortcut();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trackShortcut]);
}

/**
 * Hook for tracking session on app mount.
 * Should be called once at app startup.
 */
export function useSessionTracking() {
  const { trackSession } = useExpertiseTracking();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      trackSession();
    }
  }, [trackSession]);
}

export default useExpertiseTracking;
