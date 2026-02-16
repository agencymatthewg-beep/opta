import type { AgentMessage } from './agent.js';

/**
 * Replace old tool results with compact placeholders.
 * Keeps the last `windowSize` tool results verbatim.
 * Results under 200 chars are never masked (they're cheap).
 */
export function maskOldObservations(
  messages: AgentMessage[],
  windowSize: number
): AgentMessage[] {
  const toolResultIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'tool') toolResultIndices.push(i);
  });

  const toMask = new Set(toolResultIndices.slice(0, -windowSize || undefined));

  return messages.map((m, i) => {
    if (toMask.has(i) && m.content && m.content.length > 200) {
      const firstLine = m.content.split('\n')[0]?.slice(0, 100) ?? '';
      return {
        ...m,
        content: `[Tool result truncated: ${m.content.length} chars, first line: ${firstLine}]`,
      };
    }
    return m;
  });
}

export const COMPACTION_PROMPT = `Summarize this coding assistant conversation for continuity. Preserve:

1. FILES MODIFIED: Every file path that was read, edited, or created, with the nature of changes
2. DECISIONS MADE: Architectural choices, rejected alternatives, and rationale
3. ERRORS ENCOUNTERED: Bugs found, failed attempts, and how they were resolved
4. CURRENT STATE: What is done, what remains, any blockers
5. KEY CODE PATTERNS: Variable names, function signatures, data structures being worked with

Be thorough — this summary replaces the full history. Include specific file paths and code identifiers.`;
