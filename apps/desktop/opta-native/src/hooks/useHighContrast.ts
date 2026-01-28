import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user prefers high contrast mode.
 * Respects the `prefers-contrast: more` media query.
 *
 * Usage:
 * ```tsx
 * const highContrast = useHighContrast();
 * const borderClass = highContrast ? 'border-white' : 'border-white/10';
 * ```
 *
 * @returns boolean - true if high contrast mode is preferred
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
 */
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    // Check if the media query is supported
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');

    // Set initial value
    setHighContrast(mediaQuery.matches);

    // Handler for changes
    const handler = (event: MediaQueryListEvent) => {
      setHighContrast(event.matches);
    };

    // Listen for changes
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return highContrast;
}

export default useHighContrast;
