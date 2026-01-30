/**
 * Streaming Transformer
 * Transforms LLM stream chunks into protocol StreamingChunk messages.
 */

import type { Connection } from '../websocket/connection';
import { generateMessageID } from '../protocol/types';

export interface StreamingSession {
  messageId: string;
  chunkIndex: number;
  accumulatedText: string;
}

/**
 * Create a new streaming session
 */
export function createStreamingSession(): StreamingSession {
  return {
    messageId: generateMessageID(),
    chunkIndex: 0,
    accumulatedText: '',
  };
}

/**
 * Send a streaming chunk to the client
 */
export function sendChunk(
  connection: Connection,
  session: StreamingSession,
  content: string,
  isFinal: boolean = false
): void {
  session.accumulatedText += content;
  connection.sendStreamingChunk(
    session.messageId,
    session.chunkIndex++,
    content,
    isFinal
  );
}

/**
 * Finalize a streaming session
 */
export function finalizeStream(
  connection: Connection,
  session: StreamingSession
): void {
  // Send final chunk if not already sent
  if (session.chunkIndex === 0 || !session.accumulatedText.endsWith('')) {
    connection.sendStreamingChunk(
      session.messageId,
      session.chunkIndex,
      '',
      true
    );
  }
}

/**
 * Create stream callbacks for a connection
 */
export function createStreamCallbacks(connection: Connection, session: StreamingSession) {
  return {
    onChunk: (text: string, _chunkIndex: number) => {
      sendChunk(connection, session, text, false);
    },
    onComplete: (_fullText: string) => {
      // Send final empty chunk to signal completion
      connection.sendStreamingChunk(
        session.messageId,
        session.chunkIndex,
        '',
        true
      );
      // Update bot state to idle
      connection.sendBotState('idle');
    },
    onError: (error: Error) => {
      console.error('[Streaming] Error:', error.message);
      connection.sendError('LLM_ERROR', error.message);
      connection.sendBotState('idle');
    },
  };
}
