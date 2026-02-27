/**
 * Safe JSON parsing utility.
 * Replaces 10+ scattered try/catch JSON.parse blocks with a single function.
 */

/**
 * Parse a JSON string, returning the fallback on failure.
 * Avoids the need for a try/catch wrapper at every call site.
 */
export function safeParseJson<T = unknown>(input: string, fallback: T): T;
export function safeParseJson(input: string): unknown | undefined;
export function safeParseJson<T = unknown>(input: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
