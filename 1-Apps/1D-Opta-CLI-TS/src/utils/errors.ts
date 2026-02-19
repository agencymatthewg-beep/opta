/**
 * Extract a human-readable message from any caught error value.
 * Replaces the repeated `err instanceof Error ? err.message : String(err)` pattern.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
