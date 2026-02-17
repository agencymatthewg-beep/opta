/**
 * TUI Adapter — EventEmitter bridge between agentLoop() and the React/Ink TUI.
 *
 * Converts the streaming agent response into discrete events that React components
 * can subscribe to via useEffect, enabling real-time token display, tool call
 * visualization, and live stats updates.
 */

import { EventEmitter } from 'node:events';
import type { OptaConfig } from '../core/config.js';
import type { AgentMessage, AgentLoopOptions, AgentLoopResult } from '../core/agent.js';
import type { Session } from '../memory/store.js';

// --- Event Types ---

export interface TurnStats {
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
  elapsed: number;
  speed: number;
}

export interface TuiEventMap {
  'token': [text: string];
  'tool:start': [name: string, id: string, args: string];
  'tool:end': [name: string, id: string, result: string];
  'thinking': [text: string];
  'turn:start': [];
  'turn:end': [stats: TurnStats];
  'error': [msg: string];
}

export class TuiEmitter extends EventEmitter {
  override emit<K extends keyof TuiEventMap>(event: K, ...args: TuiEventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof TuiEventMap>(event: K, listener: (...args: TuiEventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override off<K extends keyof TuiEventMap>(event: K, listener: (...args: TuiEventMap[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

// --- Adapter: Runs agent loop and emits events ---

export interface TuiAdapterOptions {
  config: OptaConfig;
  session: Session;
}

/**
 * Run the agent loop for a user message and emit streaming events.
 *
 * This creates the onStream callbacks, passes them into agentLoop,
 * and emits higher-level events (turn:start, turn:end) around it.
 */
export async function runAgentWithEvents(
  emitter: TuiEmitter,
  task: string,
  config: OptaConfig,
  session: Session,
): Promise<AgentLoopResult> {
  const startTime = Date.now();
  let completionTokens = 0;
  let toolCallCount = 0;

  emitter.emit('turn:start');

  const { agentLoop } = await import('../core/agent.js');

  const options: AgentLoopOptions = {
    existingMessages: session.messages,
    sessionId: session.id,
    silent: true, // We handle display in the TUI
    onStream: {
      onToken(text: string) {
        // Estimate tokens from text length
        completionTokens += Math.ceil(text.length / 4);
        emitter.emit('token', text);
      },
      onToolStart(name: string, id: string, args: string) {
        toolCallCount++;
        emitter.emit('tool:start', name, id, args);
      },
      onToolEnd(name: string, id: string, result: string) {
        emitter.emit('tool:end', name, id, result);
      },
      onThinking(text: string) {
        emitter.emit('thinking', text);
      },
    },
  };

  try {
    const result = await agentLoop(task, config, options);

    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0.1 ? completionTokens / elapsed : 0;

    emitter.emit('turn:end', {
      tokens: completionTokens,
      promptTokens: 0, // Not available from current API
      completionTokens,
      toolCalls: toolCallCount,
      elapsed,
      speed,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitter.emit('error', msg);
    throw err;
  }
}

/**
 * Create a fresh TuiEmitter instance.
 */
export function createTuiEmitter(): TuiEmitter {
  return new TuiEmitter();
}
