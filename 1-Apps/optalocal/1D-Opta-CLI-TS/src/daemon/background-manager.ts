import { spawn, type ChildProcess } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { nanoid } from 'nanoid';
import type {
  BackgroundOutputChunk,
  BackgroundOutputEventPayload,
  BackgroundOutputSlice,
  BackgroundProcessSnapshot,
  BackgroundProcessState,
  BackgroundSignal,
  BackgroundStatusEventPayload,
  BackgroundStream,
} from '../protocol/v3/types.js';

export interface BackgroundManagerOptions {
  maxConcurrent: number;
  defaultTimeout: number;
  maxBufferSize: number;
}

export interface StartBackgroundProcessInput {
  sessionId: string;
  command: string;
  label?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface BackgroundOutputQuery {
  afterSeq: number;
  limit: number;
  stream: 'stdout' | 'stderr' | 'both';
}

export interface KillBackgroundResult {
  killed: boolean;
  process: BackgroundProcessSnapshot;
}

export type BackgroundManagerEvent =
  | {
      type: 'output';
      sessionId: string;
      payload: BackgroundOutputEventPayload;
    }
  | {
      type: 'status';
      sessionId: string;
      payload: BackgroundStatusEventPayload;
    };

type BackgroundEventSubscriber = (event: BackgroundManagerEvent) => void;

interface ManagedBackgroundProcess {
  processId: string;
  sessionId: string;
  pid: number;
  command: string;
  label?: string;
  cwd: string;
  state: BackgroundProcessState;
  exitCode: number | null;
  startedAtMs: number;
  endedAtMs: number | null;
  timeoutMs: number;
  child: ChildProcess;
  requestedSignal?: BackgroundSignal;
  outputs: BackgroundOutputChunk[];
  outputBytes: number;
  nextOutputSeq: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  killEscalationHandle?: ReturnType<typeof setTimeout>;
}

function parseShellCommand(cmd: string): [string, string[]] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '\\' && !inSingle && i + 1 < cmd.length) {
      current += cmd[++i];
      continue;
    }
    if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  const [exe = '', ...args] = tokens;
  return [exe, args];
}

function reasonFromState(state: BackgroundProcessState): BackgroundStatusEventPayload['reason'] {
  switch (state) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'killed':
      return 'killed';
    case 'timeout':
      return 'timeout';
    case 'running':
      return 'running';
  }
}

export class BackgroundManager {
  private static readonly SIGTERM_GRACE_MS = 3_000;
  private static readonly SIGKILL_GRACE_MS = 5_000;

  private readonly processes = new Map<string, ManagedBackgroundProcess>();
  private readonly subscribers = new Set<BackgroundEventSubscriber>();
  private options: BackgroundManagerOptions;

  constructor(options: BackgroundManagerOptions) {
    this.options = { ...options };
  }

  updateOptions(next: BackgroundManagerOptions): void {
    this.options = { ...next };
  }

  subscribe(cb: BackgroundEventSubscriber): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  list(sessionId?: string): BackgroundProcessSnapshot[] {
    const snapshots: BackgroundProcessSnapshot[] = [];
    for (const proc of this.processes.values()) {
      if (sessionId && proc.sessionId !== sessionId) continue;
      snapshots.push(this.toSnapshot(proc));
    }
    snapshots.sort((a, b) => {
      if (a.startedAt === b.startedAt) {
        return a.processId.localeCompare(b.processId);
      }
      return a.startedAt.localeCompare(b.startedAt);
    });
    return snapshots;
  }

  status(processId: string): BackgroundProcessSnapshot | null {
    const proc = this.processes.get(processId);
    if (!proc) return null;
    return this.toSnapshot(proc);
  }

  output(processId: string, query: BackgroundOutputQuery): BackgroundOutputSlice | null {
    const proc = this.processes.get(processId);
    if (!proc) return null;

    const matching = proc.outputs.filter((chunk) => {
      if (chunk.seq <= query.afterSeq) return false;
      if (query.stream === 'both') return true;
      return chunk.stream === query.stream;
    });
    const hasMore = matching.length > query.limit;
    const chunks = matching.slice(0, query.limit);
    const lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : undefined;
    const nextSeq = lastChunk ? lastChunk.seq : query.afterSeq;

    return {
      process: this.toSnapshot(proc),
      chunks,
      nextSeq,
      hasMore,
    };
  }

  start(input: StartBackgroundProcessInput): BackgroundProcessSnapshot {
    const running = [...this.processes.values()].filter((proc) => proc.state === 'running').length;
    if (running >= this.options.maxConcurrent) {
      throw new Error(`Max concurrent processes (${this.options.maxConcurrent}) reached`);
    }

    const processId = nanoid(8);
    const cwd = resolvePath(input.cwd ?? process.cwd());
    const timeoutMs = input.timeoutMs ?? this.options.defaultTimeout;

    const [exe, args] = parseShellCommand(input.command);
    const child = spawn(exe, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    if (!child.pid) {
      throw new Error(`Background process failed to start: ${input.command}`);
    }

    const nowMs = Date.now();
    const proc: ManagedBackgroundProcess = {
      processId,
      sessionId: input.sessionId,
      pid: child.pid,
      command: input.command,
      label: input.label,
      cwd,
      state: 'running',
      exitCode: null,
      startedAtMs: nowMs,
      endedAtMs: null,
      timeoutMs,
      child,
      outputs: [],
      outputBytes: 0,
      nextOutputSeq: 0,
    };
    this.processes.set(processId, proc);

    child.stdout?.on('data', (chunk: Buffer) => {
      this.appendOutput(proc, 'stdout', chunk.toString('utf-8'));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      this.appendOutput(proc, 'stderr', chunk.toString('utf-8'));
    });

    child.on('error', () => {
      const previous = proc.state;
      proc.state = 'failed';
      proc.endedAtMs = Date.now();
      this.clearTimers(proc);
      this.emitStatus(proc, {
        reason: 'spawn-error',
        previousState: previous,
      });
    });

    child.on('close', (code, signal) => {
      const previous = proc.state;
      if (proc.state === 'running') {
        if (proc.requestedSignal || signal) {
          proc.state = 'killed';
        } else if (code === 0) {
          proc.state = 'completed';
        } else {
          proc.state = 'failed';
        }
      }

      proc.exitCode = code;
      proc.endedAtMs = Date.now();
      this.clearTimers(proc);
      this.emitStatus(proc, {
        reason: reasonFromState(proc.state),
        previousState: previous,
        signal: proc.requestedSignal,
      });

      // Prune processes completed more than 5 minutes ago
      const COMPLETED_RETENTION_MS = 5 * 60 * 1_000;
      const cutoff = Date.now() - COMPLETED_RETENTION_MS;
      for (const [id, p] of this.processes) {
        if (p.state !== 'running' && (p.endedAtMs ?? p.startedAtMs) < cutoff) {
          this.processes.delete(id);
        }
      }
    });

    if (timeoutMs > 0) {
      proc.timeoutHandle = setTimeout(() => {
        if (proc.state !== 'running') return;
        const previous = proc.state;
        proc.state = 'timeout';
        this.emitStatus(proc, {
          reason: 'timeout',
          previousState: previous,
        });
        proc.child.kill('SIGTERM');
        proc.killEscalationHandle = setTimeout(() => {
          if (proc.state === 'running' || proc.state === 'timeout') {
            proc.child.kill('SIGKILL');
          }
        }, BackgroundManager.SIGTERM_GRACE_MS);
        proc.killEscalationHandle.unref();
      }, timeoutMs);
      proc.timeoutHandle.unref();
    }

    this.emitStatus(proc, { reason: 'started' });
    return this.toSnapshot(proc);
  }

  kill(processId: string, signal: BackgroundSignal = 'SIGTERM'): KillBackgroundResult | null {
    const proc = this.processes.get(processId);
    if (!proc) return null;
    if (proc.state !== 'running') {
      return { killed: false, process: this.toSnapshot(proc) };
    }

    proc.requestedSignal = signal;
    const killed = proc.child.kill(signal);

    if (signal !== 'SIGKILL') {
      proc.killEscalationHandle = setTimeout(() => {
        if (proc.state === 'running') {
          proc.requestedSignal = 'SIGKILL';
          proc.child.kill('SIGKILL');
        }
      }, BackgroundManager.SIGKILL_GRACE_MS);
      proc.killEscalationHandle.unref();
    }

    return { killed, process: this.toSnapshot(proc) };
  }

  killSession(sessionId: string, signal: BackgroundSignal = 'SIGTERM'): number {
    let killed = 0;
    for (const proc of this.processes.values()) {
      if (proc.sessionId !== sessionId || proc.state !== 'running') continue;
      const result = this.kill(proc.processId, signal);
      if (result?.killed) killed += 1;
    }
    return killed;
  }

  close(signal: BackgroundSignal = 'SIGTERM'): void {
    const running = [...this.processes.values()].filter((proc) => proc.state === 'running');
    for (const proc of running) {
      this.kill(proc.processId, signal);
    }
  }

  private appendOutput(
    proc: ManagedBackgroundProcess,
    stream: BackgroundStream,
    text: string
  ): void {
    if (text.length === 0) return;
    const chunk: BackgroundOutputChunk = {
      seq: ++proc.nextOutputSeq,
      ts: new Date().toISOString(),
      stream,
      text,
    };

    proc.outputs.push(chunk);
    proc.outputBytes += Buffer.byteLength(text, 'utf-8');
    while (proc.outputBytes > this.options.maxBufferSize && proc.outputs.length > 0) {
      const evicted = proc.outputs.shift();
      if (!evicted) break;
      proc.outputBytes -= Buffer.byteLength(evicted.text, 'utf-8');
    }

    this.emit({
      type: 'output',
      sessionId: proc.sessionId,
      payload: {
        processId: proc.processId,
        sessionId: proc.sessionId,
        pid: proc.pid,
        seq: chunk.seq,
        ts: chunk.ts,
        stream: chunk.stream,
        text: chunk.text,
      },
    });
  }

  private emitStatus(
    proc: ManagedBackgroundProcess,
    input: {
      reason: BackgroundStatusEventPayload['reason'];
      previousState?: BackgroundProcessState;
      signal?: BackgroundSignal;
    }
  ): void {
    this.emit({
      type: 'status',
      sessionId: proc.sessionId,
      payload: {
        process: this.toSnapshot(proc),
        reason: input.reason,
        previousState: input.previousState,
        signal: input.signal,
      },
    });
  }

  private emit(event: BackgroundManagerEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // Isolate subscriber failures.
      }
    }
  }

  private toSnapshot(proc: ManagedBackgroundProcess): BackgroundProcessSnapshot {
    return {
      processId: proc.processId,
      sessionId: proc.sessionId,
      pid: proc.pid,
      command: proc.command,
      label: proc.label,
      cwd: proc.cwd,
      state: proc.state,
      exitCode: proc.exitCode,
      startedAt: new Date(proc.startedAtMs).toISOString(),
      endedAt: proc.endedAtMs ? new Date(proc.endedAtMs).toISOString() : null,
      runtimeMs: (proc.endedAtMs ?? Date.now()) - proc.startedAtMs,
      timeoutMs: proc.timeoutMs,
    };
  }

  private clearTimers(proc: ManagedBackgroundProcess): void {
    if (proc.timeoutHandle) {
      clearTimeout(proc.timeoutHandle);
      proc.timeoutHandle = undefined;
    }
    if (proc.killEscalationHandle) {
      clearTimeout(proc.killEscalationHandle);
      proc.killEscalationHandle = undefined;
    }
  }
}
