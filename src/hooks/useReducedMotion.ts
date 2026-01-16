import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user prefers reduced motion.
 * Respects the `prefers-reduced-motion: reduce` media query.
 * Returns true if reduced motion is preferred, false otherwise.
 *
 * Usage:
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 };
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
