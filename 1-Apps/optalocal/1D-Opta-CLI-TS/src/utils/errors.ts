/**
 * Canonical error messages for "no model" conditions.
 *
 * Use NO_MODEL_ERROR when no model is configured at all (config + env + probe all failed).
 * Use NO_MODELS_LOADED when LMX is reachable but has zero loaded models.
 */
export const NO_MODEL_ERROR =
  'No model configured — run `opta /load <model-id>` or set ANTHROPIC_API_KEY for cloud fallback.';
export const NO_MODELS_LOADED =
  'No models loaded on LMX — run `/lmx load <model-id>` to load one.';

/**
 * Extract a human-readable message from any caught error value.
 * Replaces the repeated `err instanceof Error ? err.message : String(err)` pattern.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || 'unknown error';
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const candidates = ['message', 'error', 'detail', 'reason', 'title'] as const;
    for (const key of candidates) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
      if (value && typeof value === 'object') {
        const nested = errorMessage(value);
        if (nested && nested !== '[object Object]') {
          return nested;
        }
      }
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return '[error object]';
    }
  }
  return String(err);
}
