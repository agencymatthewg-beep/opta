"use client";

import { useState, useEffect } from "react";

/**
 * Hook to track media query matches
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with SSR-safe check to prevent hydration mismatch
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  // During SSR and initial hydration, return false to match server render
  if (!mounted) return false;

  return matches;
}

/**
 * Hook to detect if viewport is mobile (< 768px)
 * Matches the md: breakpoint used throughout the app
 */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
