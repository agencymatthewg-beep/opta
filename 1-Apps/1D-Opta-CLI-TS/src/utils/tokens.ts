/**
 * Canonical token estimation and formatting utilities.
 *
 * All token counting in Opta CLI should use these functions
 * rather than inline `text.length / 4` or ad-hoc formatters.
 */

/**
 * Estimate token count using chars/4 heuristic.
 * This is a fast approximation — actual tokenizer counts vary by model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for an array of chat messages.
 * Accounts for tool_calls JSON serialization overhead.
 */
export function estimateMessageTokens(
  messages: Array<{ role: string; content?: string | null; tool_calls?: unknown[] }>,
): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content ?? '');
    if (msg.tool_calls) {
      total += estimateTokens(JSON.stringify(msg.tool_calls));
    }
  }
  return total;
}

/**
 * Format a token count for display.
 *
 * - 100K+ → "100K" (no decimal)
 * - 1K–99.9K → "1.5K" (one decimal)
 * - <1K → "500" (raw number)
 */
export function formatTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
