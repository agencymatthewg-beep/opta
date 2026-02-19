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
import { InsightEngine, type Insight } from '../core/insights.js';
import { errorMessage } from '../utils/errors.js';

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
  firstTokenLatencyMs: number | null;
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
  'turn:first-token': [latencyMs: number];
  'turn:progress': [stats: { elapsed: number; speed: number; completionTokens: number }];
  'connection:status': [status: 'checking' | 'connected' | 'disconnected' | 'error' | 'reconnecting'];
  'error': [msg: string];
  'permission:request': [request: PermissionRequest];
  'permission:response': [id: string, decision: PermissionDecision];
  'title': [title: string];
  'insight': [insight: Insight];
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
  images?: Array<{ base64: string; mimeType: string; name?: string }>,
  mode?: string,
): Promise<AgentLoopResult> {
  const turnStartTime = Date.now();
  let completionTokens = 0;
  let toolCallCount = 0;
  let firstTokenTime: number | null = null;
  let apiPromptTokens = 0;

  // Insight engine — observes agent events and emits ★ blocks
  const insights = new InsightEngine((insight) => {
    emitter.emit('insight', insight);
  });
  insights.setModel(config.model.default);
  insights.setContextLimit(config.model.contextLimit);

  emitter.emit('turn:start');
  insights.turnStart();

  // Progress timer: emits turn:progress every 500ms with live stats
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - turnStartTime) / 1000;
    const speed = elapsed > MIN_ELAPSED_FOR_SPEED
      ? completionTokens / elapsed
      : 0;
    emitter.emit('turn:progress', { elapsed, speed, completionTokens });
    insights.progress(completionTokens, speed, elapsed);
  }, 500);

  const { agentLoop } = await import('../core/agent.js');

  const options: AgentLoopOptions = {
    existingMessages: session.messages,
    sessionId: session.id,
    silent: true, // We handle display in the TUI
    images,
    mode: (mode && mode !== 'normal') ? mode as 'plan' | 'review' | 'research' : undefined,
    onStream: {
      onToken(text: string) {
        // Track first token latency
        if (firstTokenTime === null) {
          firstTokenTime = Date.now();
          const latencyMs = firstTokenTime - turnStartTime;
          emitter.emit('turn:first-token', latencyMs);
          insights.firstToken(latencyMs);
        }

        completionTokens += Math.ceil(text.length / CHARS_PER_TOKEN);
        emitter.emit('token', text);
      },
      onToolStart(name: string, id: string, args: string) {
        toolCallCount++;
        emitter.emit('tool:start', name, id, args);
        insights.toolStart(name, args);
      },
      onToolEnd(name: string, id: string, result: string) {
        emitter.emit('tool:end', name, id, result);
        insights.toolEnd(name, id, result);
      },
      onThinking(text: string) {
        emitter.emit('thinking', text);
      },
      onConnectionStatus(status: 'checking' | 'connected' | 'disconnected' | 'reconnecting') {
        emitter.emit('connection:status', status as 'checking' | 'connected' | 'disconnected' | 'error');
        insights.connectionStatus(status);
      },
      onUsage(usage: { promptTokens: number; completionTokens: number }) {
        apiPromptTokens = usage.promptTokens;
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

    clearInterval(progressInterval);

    const elapsedMs = Date.now() - turnStartTime;
    const elapsed = elapsedMs / 1000;
    const speed = elapsed > MIN_ELAPSED_FOR_SPEED
      ? completionTokens / elapsed
      : 0;
    const firstTokenLatencyMs = firstTokenTime !== null
      ? firstTokenTime - turnStartTime
      : null;

    const turnStats = {
      tokens: completionTokens,
      promptTokens: apiPromptTokens,
      completionTokens,
      toolCalls: toolCallCount,
      elapsed,
      speed,
      firstTokenLatencyMs,
    };

    insights.turnEnd(turnStats);
    emitter.emit('turn:end', turnStats);

    return result;
  } catch (err) {
    clearInterval(progressInterval);
    const errMsg = errorMessage(err);
    emitter.emit('error', errMsg);
    throw err;
  }
}

export function createTuiEmitter(): TuiEmitter {
  return new TuiEmitter();
}

/**
 * Check connectivity to the Opta-LMX server and emit connection status events.
 *
 * Emits 'connection:status' with 'checking', then 'connected' on success,
 * 'error' on non-OK response, or 'disconnected' on network failure.
 */
export async function checkConnection(emitter: TuiEmitter, config: OptaConfig): Promise<void> {
  emitter.emit('connection:status', 'checking');
  try {
    const url = `http://${config.connection.host}:${config.connection.port}/v1/models`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      emitter.emit('connection:status', 'connected');
    } else {
      emitter.emit('connection:status', 'error');
    }
  } catch {
    emitter.emit('connection:status', 'disconnected');
  }
}
