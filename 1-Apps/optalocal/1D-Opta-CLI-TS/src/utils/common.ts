/**
 * Shared utility functions used across multiple modules.
 * Import from here instead of defining locally per-file.
 */

/** Pause execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamp a number to the [0, 1] range. Returns 0 for non-finite inputs. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
