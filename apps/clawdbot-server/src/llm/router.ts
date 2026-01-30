/**
 * LLM Router
 * Routes messages to appropriate LLM providers and handles responses.
 */

import type { Config } from '../config/env';
import type { Connection } from '../websocket/connection';
import type { ChatMessage } from '../protocol/types';
import { GeminiProvider, createGeminiProvider } from './gemini';
import { createStreamingSession, createStreamCallbacks } from './streaming';

export class LLMRouter {
  private gemini: GeminiProvider;

  constructor(config: Config) {
    this.gemini = createGeminiProvider(config);
  }

  /**
   * Process a chat message and stream the response
   */
  async processMessage(connection: Connection, message: ChatMessage): Promise<void> {
    // Update bot state to thinking
    connection.sendBotState('thinking');

    // Create streaming session
    const session = createStreamingSession();
    const callbacks = createStreamCallbacks(connection, session);

    // Update bot state to typing once streaming starts
    const wrappedCallbacks = {
      ...callbacks,
      onChunk: (text: string, chunkIndex: number) => {
        if (chunkIndex === 0) {
          connection.sendBotState('typing');
        }
        callbacks.onChunk(text, chunkIndex);
      },
    };

    // Stream response from Gemini
    await this.gemini.streamResponse(
      connection.data.id,
      message.content,
      wrappedCallbacks
    );
  }

  /**
   * Add context to a connection's chat session
   */
  async addContext(connectionId: string, context: string): Promise<void> {
    await this.gemini.addContext(connectionId, context);
  }

  /**
   * Clear a connection's chat history
   */
  clearHistory(connectionId: string): void {
    this.gemini.clearSession(connectionId);
  }
}

/**
 * Create an LLM router from config
 */
export function createLLMRouter(config: Config): LLMRouter {
  return new LLMRouter(config);
}
