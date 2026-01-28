/**
 * ExpertiseTracking - Component for tracking expertise signals.
 *
 * This component handles:
 * 1. Session tracking on mount
 * 2. Global keyboard shortcut tracking
 *
 * Should be rendered inside ExpertiseProvider.
 */

import { useEffect, useRef } from 'react';
import { useExpertiseTracking } from '@/hooks/useExpertise';

/**
 * Invisible component that tracks expertise signals.
 * Handles session and shortcut tracking automatically.
 */
export function ExpertiseTracking() {
  const { trackSession, trackShortcut } = useExpertiseTracking();
  const sessionTracked = useRef(false);
  const lastShortcutTime = useRef(0);

  // Track session on mount (once per app load)
  useEffect(() => {
    if (!sessionTracked.current) {
      sessionTracked.current = true;
      trackSession();
    }
  }, [trackSession]);

  // Track keyboard shortcuts globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track if using modifier keys (indicates shortcut usage)
      if (e.metaKey || e.ctrlKey) {
        // Throttle to avoid tracking repeated key presses
        const now = Date.now();
        if (now - lastShortcutTime.current > 5000) {
          lastShortcutTime.current = now;
          trackShortcut();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trackShortcut]);

  // This component renders nothing - it's just for side effects
  return null;
}

export default ExpertiseTracking;
