/**
 * InsightEngine — Real-time observability into local model inference.
 *
 * Generates ★ Insight blocks from agent loop events: first-token latency,
 * generation speed, context utilization, tool selection, compaction, and
 * connection status. Zero extra model calls — pure event observation.
 */

import { estimateTokens } from '../utils/tokens.js';

export type InsightCategory = 'perf' | 'context' | 'tool' | 'connection' | 'summary';

export interface Insight {
  category: InsightCategory;
  text: string;
  /** Unix timestamp when the insight was generated. */
  ts: number;
}

export type InsightCallback = (insight: Insight) => void;

interface TurnState {
  startTime: number;
  firstTokenMs: number | null;
  tokens: number;
  toolCalls: string[];
  compacted: boolean;
  peakSpeed: number;
  lastSpeedInsightAt: number;
  reconnectAttempts: number;
}

/** Minimum interval (ms) between speed insights to avoid spam. */
const SPEED_INSIGHT_INTERVAL = 5000;

/** Token threshold before first speed insight (skip trivial responses). */
const SPEED_INSIGHT_MIN_TOKENS = 50;

export class InsightEngine {
  private cb: InsightCallback;
  private turn: TurnState | null = null;
  private model = '';
  private contextLimit = 32768;
  private contextUsed = 0;

  constructor(callback: InsightCallback) {
    this.cb = callback;
  }

  setModel(model: string): void {
    this.model = shortName(model);
  }

  setContextLimit(limit: number): void {
    this.contextLimit = limit;
  }

  // --- Turn Lifecycle ---

  turnStart(): void {
    this.turn = {
      startTime: Date.now(),
      firstTokenMs: null,
      tokens: 0,
      toolCalls: [],
      compacted: false,
      peakSpeed: 0,
      lastSpeedInsightAt: 0,
      reconnectAttempts: 0,
    };
  }

  firstToken(latencyMs: number): void {
    if (!this.turn) return;
    this.turn.firstTokenMs = latencyMs;

    let qualifier: string;
    if (latencyMs < 200) qualifier = 'instant';
    else if (latencyMs < 500) qualifier = 'fast';
    else if (latencyMs < 1500) qualifier = 'warm-up complete';
    else qualifier = 'cold start';

    this.emit('perf', `First token in ${latencyMs}ms — ${qualifier}`);
  }

  // --- Streaming Progress ---

  progress(tokens: number, speed: number, _elapsed: number): void {
    if (!this.turn) return;
    this.turn.tokens = tokens;
    if (speed > this.turn.peakSpeed) this.turn.peakSpeed = speed;

    const now = Date.now();
    const sinceLastSpeed = now - this.turn.lastSpeedInsightAt;

    if (tokens >= SPEED_INSIGHT_MIN_TOKENS && sinceLastSpeed >= SPEED_INSIGHT_INTERVAL) {
      this.turn.lastSpeedInsightAt = now;

      let qualifier: string;
      if (speed > 80) qualifier = 'blazing';
      else if (speed > 40) qualifier = 'strong';
      else if (speed > 15) qualifier = 'steady';
      else qualifier = 'deliberate';

      this.emit(
        'perf',
        `${speed.toFixed(1)} tok/s ${this.model ? `on ${this.model}` : ''} — ${qualifier} generation`
      );
    }
  }

  // --- Context ---

  contextUpdate(usedTokens: number): void {
    this.contextUsed = usedTokens;
    const pct = Math.round((usedTokens / this.contextLimit) * 100);

    if (pct >= 80) {
      this.emit(
        'context',
        `Context pressure: ${pct}% used (${fmtK(usedTokens)}/${fmtK(this.contextLimit)}) — compaction imminent`
      );
    } else if (pct >= 60) {
      this.emit(
        'context',
        `Context: ${pct}% used (${fmtK(usedTokens)}/${fmtK(this.contextLimit)})`
      );
    }
  }

  compaction(oldMessages: number, recoveredTokens: number): void {
    if (!this.turn) return;
    this.turn.compacted = true;
    this.emit(
      'context',
      `Compacted ${oldMessages} messages — recovered ~${fmtK(recoveredTokens)} tokens`
    );
  }

  // --- Tool Selection ---

  toolStart(name: string, args: string): void {
    if (!this.turn) return;
    this.turn.toolCalls.push(name);

    const brief = toolBrief(name, args);
    this.emit('tool', `${name}${brief ? ` → ${brief}` : ''}`);
  }

  toolEnd(name: string, _id: string, result: string): void {
    const resultLen = result.length;
    if (resultLen > 5000) {
      this.emit('tool', `${name} returned ${fmtK(estimateTokens(result))} tokens of context`);
    }
  }

  // --- Connection ---

  connectionStatus(status: string, attempt?: number): void {
    if (!this.turn) return;
    if (status === 'reconnecting') {
      this.turn.reconnectAttempts = attempt ?? this.turn.reconnectAttempts + 1;
      this.emit('connection', `Reconnecting to LMX (attempt ${this.turn.reconnectAttempts})`);
    } else if (status === 'connected' && this.turn.reconnectAttempts > 0) {
      this.emit(
        'connection',
        `Reconnected after ${this.turn.reconnectAttempts} attempt${this.turn.reconnectAttempts > 1 ? 's' : ''}`
      );
    } else if (status === 'disconnected') {
      this.emit('connection', 'LMX connection lost');
    }
  }

  // --- Turn Summary ---

  turnEnd(stats: {
    tokens: number;
    toolCalls: number;
    elapsed: number;
    speed: number;
    firstTokenLatencyMs: number | null;
  }): void {
    if (!this.turn) return;

    const parts: string[] = [];
    parts.push(`${stats.tokens} tokens`);
    if (stats.toolCalls > 0) parts.push(`${stats.toolCalls} tool${stats.toolCalls > 1 ? 's' : ''}`);
    parts.push(`${stats.elapsed.toFixed(1)}s`);
    if (stats.speed > 0) parts.push(`${stats.speed.toFixed(0)} tok/s`);
    if (this.turn.compacted) parts.push('compacted');

    this.emit('summary', parts.join(' · '));
    this.turn = null;
  }

  // --- Internal ---

  private emit(category: InsightCategory, text: string): void {
    this.cb({ category, text, ts: Date.now() });
  }
}

// --- Helpers ---

function shortName(model: string): string {
  return model.replace(/^mlx-community\//, '').replace(/^huggingface\//, '');
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Extract a brief description from tool args for insight display. */
function toolBrief(name: string, argsJson: string): string {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const strArg = (key: string, fallback = ''): string => {
      const v = args[key];
      if (v === undefined || v === null) return fallback;
      if (typeof v === 'string') return v;
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v as number | boolean | bigint);
    };
    switch (name) {
      case 'read_file':
      case 'write_file':
      case 'edit_file':
      case 'delete_file':
        return shortPath(strArg('path'));
      case 'search_files':
        return `"${strArg('pattern').slice(0, 30)}"`;
      case 'find_files':
        return `"${strArg('pattern').slice(0, 30)}"`;
      case 'run_command':
        return `$ ${strArg('command').slice(0, 40)}`;
      case 'list_dir':
        return shortPath(strArg('path', '.'));
      case 'web_fetch':
        return strArg('url').slice(0, 50);
      case 'web_search':
        return `"${strArg('query').slice(0, 40)}"`;
      default:
        return '';
    }
  } catch {
    return '';
  }
}

function shortPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `.../${parts.slice(-2).join('/')}`;
}
