/**
 * Canonical token estimation and formatting utilities.
 *
 * All token counting in Opta CLI MUST use these functions
 * rather than inline `text.length / 4` or ad-hoc approaches.
 */

/** A content part in a multimodal message. */
interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

/** A chat message with optional multimodal content and tool calls. */
interface TokenMessage {
  role: string;
  content?: string | ContentPart[] | null;
  tool_calls?: unknown[];
}

/**
 * Estimate token count for a plain string using chars/4 heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for an array of chat messages.
 * Handles string content, ContentPart[] (multimodal), and tool_calls.
 */
export function estimateMessageTokens(messages: TokenMessage[]): number {
  return messages.reduce((sum, m) => {
    let contentLen = 0;
    if (typeof m.content === 'string') {
      contentLen = m.content.length;
    } else if (Array.isArray(m.content)) {
      contentLen = m.content.reduce((s: number, p: ContentPart) => {
        if (p.type === 'text' && p.text) return s + p.text.length;
        if (p.type === 'image_url') return s + 1000;
        return s;
      }, 0);
    }
    const toolCallsStr = m.tool_calls ? JSON.stringify(m.tool_calls) : '';
    return sum + Math.ceil((contentLen + toolCallsStr.length) / 4);
  }, 0);
}

/**
 * Format a token count for display.
 */
export function formatTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
