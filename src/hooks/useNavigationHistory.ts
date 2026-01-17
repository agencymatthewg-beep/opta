/**
 * useNavigationHistory - Browser-like navigation history for Opta
 *
 * Tracks page navigation history and provides back/forward functionality.
 * Works with Magic Mouse swipe gestures for natural navigation.
 *
 * @example
 * ```tsx
 * const { canGoBack, canGoForward, goBack, goForward, navigate } = useNavigationHistory('dashboard');
 * ```
 */

import { useState, useCallback, useRef } from 'react';

export interface NavigationHistoryState {
  /** Current page ID */
  currentPage: string;
  /** Whether we can go back */
  canGoBack: boolean;
  /** Whether we can go forward */
  canGoForward: boolean;
  /** Navigate to a new page (pushes to history) */
  navigate: (pageId: string) => void;
  /** Go back in history */
  goBack: () => string | null;
  /** Go forward in history */
  goForward: () => string | null;
  /** Get the history stack (for debugging) */
  getHistory: () => { stack: string[]; index: number };
}

/**
 * Hook for managing navigation history with back/forward support.
 *
 * @param initialPage - The starting page ID
 * @param onNavigate - Callback when navigation occurs (for syncing with parent state)
 */
export function useNavigationHistory(
  initialPage: string,
  onNavigate?: (pageId: string) => void
): NavigationHistoryState {
  // History stack and current position
  const historyRef = useRef<string[]>([initialPage]);
  const indexRef = useRef<number>(0);

  // Force re-render when history changes
  const [, setVersion] = useState(0);
  const forceUpdate = useCallback(() => setVersion((v) => v + 1), []);

  // Current state derived from refs
  const currentPage = historyRef.current[indexRef.current];
  const canGoBack = indexRef.current > 0;
  const canGoForward = indexRef.current < historyRef.current.length - 1;

  /**
   * Navigate to a new page - pushes to history stack.
   * If we're in the middle of history, truncates forward history.
   */
  const navigate = useCallback(
    (pageId: string) => {
      // Don't add duplicate consecutive pages
      if (pageId === historyRef.current[indexRef.current]) {
        return;
      }

      // Truncate any forward history
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);

      // Add new page
      historyRef.current.push(pageId);
      indexRef.current = historyRef.current.length - 1;

      // Limit history size to prevent memory issues
      const MAX_HISTORY = 50;
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY);
        indexRef.current = historyRef.current.length - 1;
      }

      forceUpdate();
      onNavigate?.(pageId);
    },
    [onNavigate, forceUpdate]
  );

  /**
   * Go back in history.
   * Returns the page ID we navigated to, or null if can't go back.
   */
  const goBack = useCallback((): string | null => {
    if (indexRef.current <= 0) {
      return null;
    }

    indexRef.current -= 1;
    const pageId = historyRef.current[indexRef.current];

    forceUpdate();
    onNavigate?.(pageId);

    return pageId;
  }, [onNavigate, forceUpdate]);

  /**
   * Go forward in history.
   * Returns the page ID we navigated to, or null if can't go forward.
   */
  const goForward = useCallback((): string | null => {
    if (indexRef.current >= historyRef.current.length - 1) {
      return null;
    }

    indexRef.current += 1;
    const pageId = historyRef.current[indexRef.current];

    forceUpdate();
    onNavigate?.(pageId);

    return pageId;
  }, [onNavigate, forceUpdate]);

  /**
   * Get current history state (for debugging).
   */
  const getHistory = useCallback(() => {
    return {
      stack: [...historyRef.current],
      index: indexRef.current,
    };
  }, []);

  return {
    currentPage,
    canGoBack,
    canGoForward,
    navigate,
    goBack,
    goForward,
    getHistory,
  };
}

export default useNavigationHistory;
