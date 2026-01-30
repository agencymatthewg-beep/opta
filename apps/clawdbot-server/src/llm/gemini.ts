/**
 * Gemini LLM Provider
 * Integrates with Google's Gemini API for chat responses.
 */

import { GoogleGenerativeAI, type GenerativeModel, type ChatSession } from '@google/generative-ai';
import type { Config } from '../config/env';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface StreamCallbacks {
  onChunk: (text: string, chunkIndex: number) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const SYSTEM_PROMPT = `You are Clawdbot, a helpful AI assistant integrated into the Opta Life Manager app.

Your role is to help users manage their life by:
- Answering questions about their schedule, tasks, and events
- Helping them plan their day, week, or month
- Providing insights about their productivity and habits
- Assisting with task creation and organization
- Giving helpful reminders and suggestions

Guidelines:
- Be concise but helpful - users are often busy
- When discussing times or dates, be specific
- If you can take action (create tasks, schedule events), offer to do so
- Use a friendly, supportive tone
- If you don't have enough context, ask clarifying questions

You have access to the user's Opta Life data including calendars, tasks, and habits.`;

export class GeminiProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private chatSessions = new Map<string, ChatSession>();

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.model,
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  /**
   * Get or create a chat session for a connection
   */
  private getSession(connectionId: string): ChatSession {
    let session = this.chatSessions.get(connectionId);
    if (!session) {
      session = this.model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });
      this.chatSessions.set(connectionId, session);
    }
    return session;
  }

  /**
   * Send a message and stream the response
   */
  async streamResponse(
    connectionId: string,
    userMessage: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const session = this.getSession(connectionId);

    try {
      const result = await session.sendMessageStream(userMessage);

      let chunkIndex = 0;
      let fullText = '';

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          callbacks.onChunk(text, chunkIndex++);
        }
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send a message and get a complete response (non-streaming)
   */
  async getResponse(connectionId: string, userMessage: string): Promise<string> {
    const session = this.getSession(connectionId);

    try {
      const result = await session.sendMessage(userMessage);
      return result.response.text();
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Clear chat history for a connection
   */
  clearSession(connectionId: string): void {
    this.chatSessions.delete(connectionId);
  }

  /**
   * Add context to the system prompt (e.g., user's current data)
   */
  async addContext(connectionId: string, context: string): Promise<void> {
    const session = this.getSession(connectionId);

    // Send context as a system-style message that sets up the conversation
    await session.sendMessage(
      `[System Context Update]\n${context}\n\nPlease acknowledge this context update briefly.`
    );
  }
}

/**
 * Create a Gemini provider from config
 */
export function createGeminiProvider(config: Config): GeminiProvider {
  return new GeminiProvider({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });
}
