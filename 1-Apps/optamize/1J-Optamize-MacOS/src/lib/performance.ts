/**
 * Performance metrics logging utility for Opta.
 *
 * Provides development-time performance measurement tools
 * for identifying slow renders and operations.
 */

/**
 * Log a performance metric to the console (development only).
 *
 * @param metric - Name of the metric being measured
 * @param value - Duration in milliseconds
 */
export function logPerformance(metric: string, value: number): void {
  if (import.meta.env.DEV) {
    console.log(`[Perf] ${metric}: ${value.toFixed(2)}ms`);
  }
}

/**
 * Measure render duration of a component.
 * Call the returned function when render completes.
 *
 * @param componentName - Name of the component being measured
 * @returns Cleanup function to call after render
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useEffect(() => {
 *     const endMeasure = measureRender('MyComponent');
 *     return () => endMeasure();
 *   }, []);
 *   return <div>...</div>;
 * }
 * ```
 */
export function measureRender(componentName: string): () => void {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    // Warn if render takes more than one frame (16ms at 60fps)
    if (duration > 16 && import.meta.env.DEV) {
      console.warn(
        `[Perf] Slow render: ${componentName} took ${duration.toFixed(2)}ms`
      );
    }
  };
}

/**
 * Measure the duration of an async operation.
 *
 * @param operationName - Name of the operation being measured
 * @param operation - Async function to measure
 * @returns Result of the operation
 *
 * @example
 * ```tsx
 * const data = await measureAsync('fetchGames', async () => {
 *   return invoke('detect_games');
 * });
 * ```
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    logPerformance(operationName, performance.now() - start);
    return result;
  } catch (error) {
    logPerformance(`${operationName} (failed)`, performance.now() - start);
    throw error;
  }
}

/**
 * Performance threshold constants.
 * Used to determine when to warn about slow operations.
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Maximum acceptable render time (ms) - one frame at 60fps */
  RENDER_FRAME: 16,
  /** Maximum acceptable initial load time (ms) */
  INITIAL_LOAD: 2000,
  /** Maximum acceptable navigation time (ms) */
  NAVIGATION: 300,
  /** Maximum acceptable API call time (ms) */
  API_CALL: 1000,
} as const;

/**
 * Check if Web Vitals API is available.
 */
export function hasPerformanceAPI(): boolean {
  return typeof performance !== 'undefined' && typeof performance.now === 'function';
}

/**
 * Get navigation timing metrics.
 * Returns null if Performance API is not available.
 */
export function getNavigationTiming(): {
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint: number | null;
} | null {
  if (!hasPerformanceAPI() || !performance.getEntriesByType) {
    return null;
  }

  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming | undefined;

  if (!navigation) {
    return null;
  }

  // Get First Contentful Paint if available
  const paintEntries = performance.getEntriesByType('paint');
  const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

  return {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
    loadComplete: navigation.loadEventEnd - navigation.startTime,
    firstContentfulPaint: fcp ? fcp.startTime : null,
  };
}
