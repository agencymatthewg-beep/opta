/**
 * Shared formatting and text utilities.
 *
 * Consolidates duplicated helpers (truncate, shortModelName, etc.)
 * so every component uses a single source of truth.
 */

/** Truncate a string to `maxLen` characters, appending an ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Extract a short display name from a full HuggingFace-style model path.
 * e.g. "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit" → "Qwen2.5-Coder-32B-Instruct-4bit"
 */
export function shortModelName(model: string, maxLen = 30): string {
  const parts = model.split('/');
  const name = parts.length > 1 ? parts[parts.length - 1]! : model;
  return truncate(name, maxLen);
}
