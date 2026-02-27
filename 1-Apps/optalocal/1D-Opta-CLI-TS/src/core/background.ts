import { spawn, type ChildProcess } from 'node:child_process';
import { nanoid } from 'nanoid';
import { debug } from './debug.js';

// --- CircularBuffer ---

export class CircularBuffer {
  private buffer: string = '';
  private maxSize: number;
  private _totalBytesWritten = 0;
  private _lineCount = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get totalBytesWritten(): number {
    return this._totalBytesWritten;
  }

  get currentOffset(): number {
    return this._lineCount;
  }

  append(data: string): void {
    this.buffer += data;
    this._totalBytesWritten += data.length;

    // Count new newlines
    for (let i = this.buffer.length - data.length; i < this.buffer.length; i++) {
      if (this.buffer[i] === '\n') this._lineCount++;
    }

    // Evict from front if over budget
    if (this.buffer.length > this.maxSize) {
      const excess = this.buffer.length - this.maxSize;
      const cutAt = this.buffer.indexOf('\n', excess);
      if (cutAt !== -1) {
        this.buffer = this.buffer.slice(cutAt + 1);
      } else {
        // No newline found beyond excess — clear everything
        this.buffer = '';
      }
    }
  }

  getLines(count: number): string[] {
    const lines = this.buffer.split('\n').filter((l) => l.length > 0);
    return lines.slice(-count);
  }

  getLinesSince(offset: number): string[] {
    const lines = this.buffer.split('\n').filter((l) => l.length > 0);
    const total = lines.length;
    const newCount = this._lineCount - offset;
    if (newCount <= 0) return [];
    return lines.slice(Math.max(0, total - newCount));
  }
}

// --- Types ---

export interface ProcessHandle {
  id: string;
  pid: number;
  command: string;
}

export type ProcessState = 'running' | 'completed' | 'failed' | 'killed' | 'timeout';

export interface ProcessStatus {
  id: string;
  pid: number;
  command: string;
  label?: string;
  state: ProcessState;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  runtimeMs: number;
}

export interface OutputSlice {
  stdout: string;
  stderr: string;
  truncated: boolean;
}

interface ManagedProcess {
  id: string;
  pid: number;
  command: string;
  label?: string;
  state: ProcessState;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  stdout: CircularBuffer;
  stderr: CircularBuffer;
  lastReadOffset: { stdout: number; stderr: number };
  child: ChildProcess;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

export interface ProcessManagerOptions {
  maxConcurrent: number;
  defaultTimeout: number;
  maxBufferSize: number;
}

// --- ProcessManager ---

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private opts: ProcessManagerOptions;

  constructor(opts: ProcessManagerOptions) {
    this.opts = opts;
  }

  get activeCount(): number {
    return [...this.processes.values()].filter((p) => p.state === 'running').length;
  }

  async start(
    command: string,
    opts?: { timeout?: number; label?: string }
  ): Promise<ProcessHandle> {
    if (this.activeCount >= this.opts.maxConcurrent) {
      throw new Error(
        `Max concurrent processes (${this.opts.maxConcurrent}) reached. Kill a process first.`
      );
    }

    const id = nanoid(8);
    const timeout = opts?.timeout ?? this.opts.defaultTimeout;
    const child = spawn('sh', ['-c', command], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    if (!child.pid) {
      throw new Error(`Background process: Failed to spawn "${command}". Verify the command exists and is executable.`);
    }

    const proc: ManagedProcess = {
      id,
      pid: child.pid,
      command,
      label: opts?.label,
      state: 'running',
      exitCode: null,
      startedAt: Date.now(),
      endedAt: null,
      stdout: new CircularBuffer(this.opts.maxBufferSize),
      stderr: new CircularBuffer(this.opts.maxBufferSize),
      lastReadOffset: { stdout: 0, stderr: 0 },
      child,
    };

    child.stdout!.on('data', (chunk: Buffer) => proc.stdout.append(chunk.toString()));
    child.stderr!.on('data', (chunk: Buffer) => proc.stderr.append(chunk.toString()));

    child.on('error', (err) => {
      if (proc.state === 'running') {
        proc.state = 'failed';
      }
      proc.endedAt = Date.now();
      if (proc.timeoutHandle) clearTimeout(proc.timeoutHandle);
      debug(`bg[${id}] spawn error: ${err.message}`);
    });

    child.on('close', (code, signal) => {
      if (proc.state === 'running') {
        proc.state = signal ? 'killed' : code === 0 ? 'completed' : 'failed';
      }
      proc.exitCode = code;
      proc.endedAt = Date.now();
      if (proc.timeoutHandle) clearTimeout(proc.timeoutHandle);
      debug(`bg[${id}] exited: ${proc.state} (code=${code}, signal=${signal})`);
    });

    if (timeout > 0) {
      proc.timeoutHandle = setTimeout(() => {
        if (proc.state === 'running') {
          proc.state = 'timeout';
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 3000);
        }
      }, timeout);
    }

    this.processes.set(id, proc);
    debug(`bg[${id}] started: pid=${child.pid} cmd="${command}"`);
    return { id, pid: child.pid, command };
  }

  status(id?: string): ProcessStatus | ProcessStatus[] {
    if (!id) {
      return [...this.processes.values()].map((p) => this.toStatus(p));
    }
    const proc = this.processes.get(id);
    if (!proc) throw new Error(`Process "${id}" not found`);
    return this.toStatus(proc);
  }

  private toStatus(p: ManagedProcess): ProcessStatus {
    return {
      id: p.id,
      pid: p.pid,
      command: p.command,
      label: p.label,
      state: p.state,
      exitCode: p.exitCode,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      runtimeMs: (p.endedAt ?? Date.now()) - p.startedAt,
    };
  }

  output(
    id: string,
    opts?: {
      lines?: number;
      stream?: 'stdout' | 'stderr' | 'both';
      sinceLastRead?: boolean;
    }
  ): OutputSlice {
    const proc = this.processes.get(id);
    if (!proc) throw new Error(`Process "${id}" not found`);

    const lines = opts?.lines ?? 50;
    const stream = opts?.stream ?? 'both';
    const sinceLastRead = opts?.sinceLastRead ?? true;

    let stdout = '';
    let stderr = '';

    if (stream === 'stdout' || stream === 'both') {
      stdout = sinceLastRead
        ? proc.stdout.getLinesSince(proc.lastReadOffset.stdout).join('\n')
        : proc.stdout.getLines(lines).join('\n');
      proc.lastReadOffset.stdout = proc.stdout.currentOffset;
    }

    if (stream === 'stderr' || stream === 'both') {
      stderr = sinceLastRead
        ? proc.stderr.getLinesSince(proc.lastReadOffset.stderr).join('\n')
        : proc.stderr.getLines(lines).join('\n');
      proc.lastReadOffset.stderr = proc.stderr.currentOffset;
    }

    return { stdout, stderr, truncated: false };
  }

  async kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const proc = this.processes.get(id);
    if (!proc) throw new Error(`Process "${id}" not found`);
    if (proc.state !== 'running') return false;

    proc.child.kill(signal);
    proc.state = 'killed';

    // Force-kill after 5s if still alive
    if (signal !== 'SIGKILL') {
      setTimeout(() => {
        if (!proc.child.killed) {
          proc.child.kill('SIGKILL');
        }
      }, 5000);
    }

    return true;
  }

  async killAll(): Promise<void> {
    const running = [...this.processes.values()].filter((p) => p.state === 'running');
    await Promise.all(running.map((p) => this.kill(p.id)));
  }

  async cleanup(): Promise<void> {
    await this.killAll();
    this.processes.clear();
  }
}
