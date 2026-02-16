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

  const toMask = toolResultIndices.slice(0, -windowSize || undefined);

  return messages.map((m, i) => {
    if (toMask.includes(i) && m.content && m.content.length > 200) {
      const firstLine = m.content.split('\n')[0]?.slice(0, 100) ?? '';
      return {
        ...m,
        content: `[Tool result truncated: ${m.content.length} chars, first line: ${firstLine}]`,
      };
    }
    return m;
  });
}
