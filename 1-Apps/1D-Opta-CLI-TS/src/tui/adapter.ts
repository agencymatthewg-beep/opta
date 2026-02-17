/**
 * TUI Adapter — EventEmitter bridge between agentLoop() and the React/Ink TUI.
 *
 * Converts the streaming agent response into discrete events that React components
 * can subscribe to via useEffect, enabling real-time token display, tool call
 * visualization, and live stats updates.
 */

import { EventEmitter } from 'node:events';
import type { OptaConfig } from '../core/config.js';
import type { AgentLoopOptions, AgentLoopResult } from '../core/agent.js';
import type { Session } from '../memory/store.js';
import type { PermissionDecision } from './PermissionPrompt.js';

/** Average characters per token for rough estimation. */
const CHARS_PER_TOKEN = 4;

/** Minimum elapsed seconds before computing tokens/sec (avoids division spikes). */
const MIN_ELAPSED_FOR_SPEED = 0.1;

// --- Event Types ---

export interface TurnStats {
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
  elapsed: number;
  speed: number;
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface TuiEventMap {
  'token': [text: string];
  'tool:start': [name: string, id: string, args: string];
  'tool:end': [name: string, id: string, result: string];
  'thinking': [text: string];
  'turn:start': [];
  'turn:end': [stats: TurnStats];
  'error': [msg: string];
  'permission:request': [request: PermissionRequest];
  'permission:response': [id: string, decision: PermissionDecision];
  'title': [title: string];
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

/** Counter for unique permission request IDs. */
let permissionRequestCounter = 0;

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
  const turnStartTime = Date.now();
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
        completionTokens += Math.ceil(text.length / CHARS_PER_TOKEN);
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
      /**
       * Bridge permission requests from the agent loop to the TUI.
       *
       * Emits a 'permission:request' event and returns a Promise that
       * resolves when the TUI sends back a 'permission:response' event.
       * This blocks the agent loop until the user makes a decision.
       */
      onPermissionRequest(toolName: string, args: Record<string, unknown>): Promise<PermissionDecision> {
        const requestId = `perm-${++permissionRequestCounter}`;

        return new Promise<PermissionDecision>((resolve) => {
          // Listen for the response matching this request ID
          const onResponse = (id: string, decision: PermissionDecision) => {
            if (id === requestId) {
              emitter.off('permission:response', onResponse);
              resolve(decision);
            }
          };
          emitter.on('permission:response', onResponse);

          // Emit the request to the TUI
          emitter.emit('permission:request', { id: requestId, toolName, args });
        });
      },
    },
  };

  try {
    const result = await agentLoop(task, config, options);

    const elapsedMs = Date.now() - turnStartTime;
    const elapsed = elapsedMs / 1000;
    const speed = elapsed > MIN_ELAPSED_FOR_SPEED
      ? completionTokens / elapsed
      : 0;

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
    const errorMessage = err instanceof Error ? err.message : String(err);
    emitter.emit('error', errorMessage);
    throw err;
  }
}

export function createTuiEmitter(): TuiEmitter {
  return new TuiEmitter();
}
