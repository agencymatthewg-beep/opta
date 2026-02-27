/**
 * Session Message Mapper
 *
 * Converts CLI SessionMessage[] to Web ChatMessage[] for rendering
 * CLI sessions in the browser. Handles multi-modal content, tool calls,
 * tool results, and generates stable IDs for consistent rendering.
 */

import type {
  SessionFull,
  SessionMessage,
  ContentPart,
  ChatMessage,
} from '@/types/lmx';

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

/**
 * Extract displayable text from a SessionMessage's content field.
 *
 * - string: used directly
 * - ContentPart[]: extract text parts, join with newline
 * - null: empty string
 */
function extractContent(content: SessionMessage['content']): string {
  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  // ContentPart[] — extract text parts only (skip image_url for now)
  return (content as ContentPart[])
    .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a stable, deterministic ID from session ID + message index.
 * Uses a simple hash to avoid random IDs that change across renders.
 */
function stableId(sessionId: string, index: number): string {
  return `${sessionId}-msg-${index}`;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Convert a full CLI session into an array of ChatMessages for the web UI.
 *
 * - Skips 'system' role messages (system prompts should not be displayed)
 * - Maps 'user' and 'assistant' messages to ChatMessage with extracted content
 * - Attaches tool_calls metadata to assistant messages that made tool calls
 * - Maps 'tool' role messages with tool_call_id and tool_name for rendering
 * - Uses the session's created timestamp for all messages (CLI doesn't track per-message timestamps)
 * - Sets model on assistant messages from the session's model field
 */
export function mapSessionToChat(session: SessionFull): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const createdAt = session.created;

  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i]!;

    // Skip system messages — don't display system prompts
    if (msg.role === 'system') {
      continue;
    }

    if (msg.role === 'user') {
      messages.push({
        id: stableId(session.id, i),
        role: 'user',
        content: extractContent(msg.content),
        created_at: createdAt,
      });
      continue;
    }

    if (msg.role === 'assistant') {
      messages.push({
        id: stableId(session.id, i),
        role: 'assistant',
        content: extractContent(msg.content),
        model: session.model,
        created_at: createdAt,
        // Attach tool calls if present
        ...(msg.tool_calls && msg.tool_calls.length > 0
          ? { tool_calls: msg.tool_calls }
          : {}),
      });
      continue;
    }

    if (msg.role === 'tool') {
      messages.push({
        id: stableId(session.id, i),
        role: 'tool',
        content: extractContent(msg.content),
        created_at: createdAt,
        tool_call_id: msg.tool_call_id,
        tool_name: msg.name,
      });
      continue;
    }
  }

  return messages;
}
