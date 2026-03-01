---
status: archived
---

# Background Shell System — TDD Implementation Plan

> **Status:** Approved design
> **Date:** 2026-02-16
> **Phase:** V3 Phase 1
> **Goal:** Non-blocking shell execution enabling parallel workflows (builds, tests, dev servers)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Agent Loop                      │
│  (src/core/agent.ts)                             │
│                                                  │
│  bg_start("npm test")  ──►  ProcessManager       │
│  bg_status("p_1")      ──►    .start()           │
│  bg_output("p_1")      ──►    .status()          │
│  bg_kill("p_1")         ──►    .output()          │
│                                .kill()            │
└──────────────────────────────┬──────────────────-┘
                               │
         ┌─────────────────────▼──────────────────┐
         │         ProcessManager (singleton)       │
         │         src/core/background.ts           │
         │                                          │
         │  processes: Map<string, ManagedProcess>  │
         │  maxConcurrent: 5                        │
         │  defaultTimeout: 300_000 (5 min)         │
         │                                          │
         │  start(cmd, opts) → ProcessHandle        │
         │  status(id) → ProcessStatus              │
         │  output(id, opts) → OutputSlice          │
         │  kill(id, signal?) → boolean             │
         │  killAll() → void                        │
         │  cleanup() → void                        │
         └──────────────────────────────────────────┘
                               │
         ┌─────────────────────▼──────────────────┐
         │          ManagedProcess                  │
         │                                          │
         │  id: string (nanoid, 8 chars)            │
         │  pid: number                             │
         │  command: string                         │
         │  state: 'running' | 'completed' | 'failed' | 'killed' | 'timeout' │
         │  exitCode: number | null                 │
         │  startedAt: number (Date.now)            │
         │  endedAt: number | null                  │
         │  stdout: CircularBuffer                  │
         │  stderr: CircularBuffer                  │
         │  lastReadOffset: { stdout: number, stderr: number } │
         │  child: ChildProcess                     │
         └──────────────────────────────────────────┘
```

**Key decisions:**

- **`child_process.spawn`** over execa for background processes. Execa is great for
  await-style execution but spawn gives us the raw `ChildProcess` handle needed for
  non-blocking output streaming, signal delivery, and PID tracking. We already depend
  on execa for `run_command`; the bg system is intentionally separate.
- **Circular buffer** (in-memory, capped at 1MB per stream per process). File-based
  buffering adds complexity for marginal benefit -- processes producing >1MB of output
  are typically dev servers where only the tail matters.
- **Singleton ProcessManager** attached to the session. Created lazily on first
  `bg_start`, destroyed on session end via `cleanup()`.
- **Background processes do NOT count toward the circuit breaker tool-call limit.**
  The bg_start/bg_status/bg_output/bg_kill calls themselves count (they are tool
  calls), but the spawned processes run independently.

---

## 2. New Files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/core/background.ts` | ProcessManager + ManagedProcess + CircularBuffer | ~180 |
| `tests/core/background.test.ts` | Unit tests for ProcessManager | ~250 |

## 3. Modified Files

| File | Changes |
|------|---------|
| `src/core/tools.ts` | Add 4 bg_* tool schemas + 4 executor functions + permission defaults |
| `src/core/config.ts` | Add `background` config section to OptaConfigSchema |
| `src/core/agent.ts` | Initialize ProcessManager, pass to tool executors, cleanup on exit |
| `src/mcp/registry.ts` | Pass ProcessManager instance through registry.execute context |
| `tests/core/tools.test.ts` | Update tool count assertion (14 -> 18), add bg_* tool tests |

---

## 4. Tool Definitions (OpenAI Function Schemas)

### bg_start

```typescript
{
  type: 'function',
  function: {
    name: 'bg_start',
    description: 'Start a shell command in the background. Returns a process ID for tracking. Use for long-running commands (tests, builds, dev servers).',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: {
          type: 'number',
          description: 'Timeout in ms (default: 300000 = 5 min, 0 = no timeout)',
        },
        label: {
          type: 'string',
          description: 'Human-readable label (e.g. "test suite", "dev server")',
        },
      },
      required: ['command'],
    },
  },
}
```

### bg_status

```typescript
{
  type: 'function',
  function: {
    name: 'bg_status',
    description: 'Check the status of one or all background processes. Returns state, PID, runtime, exit code.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Process ID from bg_start. Omit to list all processes.',
        },
      },
      required: [],
    },
  },
}
```

### bg_output

```typescript
{
  type: 'function',
  function: {
    name: 'bg_output',
    description: 'Get stdout/stderr from a background process. Defaults to new output since last read.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Process ID from bg_start' },
        lines: {
          type: 'number',
          description: 'Number of lines to return from the end (default: 50)',
        },
        stream: {
          type: 'string',
          enum: ['stdout', 'stderr', 'both'],
          description: 'Which output stream (default: both)',
        },
        since_last_read: {
          type: 'boolean',
          description: 'Only return output since last bg_output call (default: true)',
        },
      },
      required: ['id'],
    },
  },
}
```

### bg_kill

```typescript
{
  type: 'function',
  function: {
    name: 'bg_kill',
    description: 'Terminate a background process. Sends SIGTERM, then SIGKILL after 5s if still running.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Process ID to kill' },
        signal: {
          type: 'string',
          enum: ['SIGTERM', 'SIGKILL', 'SIGINT'],
          description: 'Signal to send (default: SIGTERM)',
        },
      },
      required: ['id'],
    },
  },
}
```

---

## 5. Config Schema Additions

```typescript
// In OptaConfigSchema, add after 'search':
background: z
  .object({
    maxConcurrent: z.number().min(1).max(20).default(5),
    defaultTimeout: z.number().min(0).default(300_000), // 5 min
    maxBufferSize: z.number().min(1024).default(1_048_576), // 1MB per stream
    killOnSessionEnd: z.boolean().default(true),
  })
  .default({}),
```

Permission defaults for new tools:

```typescript
// In DEFAULT_TOOL_PERMISSIONS:
bg_start: 'ask',     // Starting processes is a write operation
bg_status: 'allow',  // Checking status is read-only
bg_output: 'allow',  // Reading output is read-only
bg_kill: 'ask',      // Killing processes needs confirmation
```

Mode overrides:

```typescript
// In MODE_PERMISSIONS:
auto: { ..., bg_start: 'allow', bg_kill: 'allow' },
plan: { ..., bg_start: 'deny', bg_kill: 'deny' },
dangerous: { ..., bg_start: 'allow', bg_kill: 'allow' },
ci: { ..., bg_start: 'deny', bg_kill: 'deny' },
```

---

## 6. Implementation Tasks (TDD)

### Task 1: CircularBuffer

A fixed-size text buffer that stores lines, discarding oldest when full.

**Test first** (`tests/core/background.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../../src/core/background.js';

describe('CircularBuffer', () => {
  it('stores and retrieves lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('line one\n');
    buf.append('line two\n');
    expect(buf.getLines(10)).toEqual(['line one', 'line two']);
  });

  it('returns last N lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('a\nb\nc\nd\ne\n');
    expect(buf.getLines(2)).toEqual(['d', 'e']);
  });

  it('evicts oldest data when full', () => {
    const buf = new CircularBuffer(20); // tiny buffer
    buf.append('aaaaaaaaaa\n'); // 11 bytes
    buf.append('bbbbbbbbbb\n'); // 11 bytes -- pushes out 'a' line
    const lines = buf.getLines(10);
    expect(lines).not.toContain('aaaaaaaaaa');
    expect(lines).toContain('bbbbbbbbbb');
  });

  it('tracks total bytes written', () => {
    const buf = new CircularBuffer(1024);
    buf.append('hello\n');
    expect(buf.totalBytesWritten).toBe(6);
  });

  it('returns lines since offset', () => {
    const buf = new CircularBuffer(1024);
    buf.append('line1\nline2\n');
    const offset1 = buf.currentOffset;
    buf.append('line3\nline4\n');
    expect(buf.getLinesSince(offset1)).toEqual(['line3', 'line4']);
  });

  it('handles partial lines (no trailing newline)', () => {
    const buf = new CircularBuffer(1024);
    buf.append('complete\npartial');
    expect(buf.getLines(10)).toEqual(['complete', 'partial']);
  });
});
```

**Implement** (`src/core/background.ts`):

```typescript
export class CircularBuffer {
  private buffer: string = '';
  private maxSize: number;
  private _totalBytesWritten = 0;
  private _lineBreaks: number[] = []; // byte offsets of \n chars

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get totalBytesWritten(): number { return this._totalBytesWritten; }
  get currentOffset(): number { return this._lineBreaks.length; }

  append(data: string): void {
    this.buffer += data;
    this._totalBytesWritten += data.length;

    // Track line breaks
    for (let i = this.buffer.length - data.length; i < this.buffer.length; i++) {
      if (this.buffer[i] === '\n') this._lineBreaks.push(i);
    }

    // Evict from front if over budget
    if (this.buffer.length > this.maxSize) {
      const excess = this.buffer.length - this.maxSize;
      const cutAt = this.buffer.indexOf('\n', excess);
      if (cutAt !== -1) {
        this.buffer = this.buffer.slice(cutAt + 1);
        // Recalculate lineBreaks relative to new buffer start
        const offset = cutAt + 1;
        this._lineBreaks = this._lineBreaks
          .filter(b => b >= offset)
          .map(b => b - offset);
      }
    }
  }

  getLines(count: number): string[] {
    const lines = this.buffer.split('\n').filter(l => l.length > 0);
    return lines.slice(-count);
  }

  getLinesSince(offset: number): string[] {
    const lines = this.buffer.split('\n').filter(l => l.length > 0);
    const total = lines.length;
    const newCount = this._lineBreaks.length - offset;
    return lines.slice(Math.max(0, total - newCount));
  }
}
```

---

### Task 2: ManagedProcess + ProcessManager Core

**Test first:**

```typescript
describe('ProcessManager', () => {
  let pm: ProcessManager;

  beforeEach(() => {
    pm = new ProcessManager({ maxConcurrent: 3, defaultTimeout: 5000, maxBufferSize: 1024 });
  });

  afterEach(async () => {
    await pm.killAll();
  });

  it('starts a process and returns a handle', async () => {
    const handle = await pm.start('echo hello');
    expect(handle.id).toBeTruthy();
    expect(handle.id.length).toBe(8);
    expect(handle.pid).toBeGreaterThan(0);
  });

  it('completes with exit code 0 for successful command', async () => {
    const handle = await pm.start('echo done');
    // Wait for completion
    await new Promise(r => setTimeout(r, 200));
    const status = pm.status(handle.id);
    expect(status.state).toBe('completed');
    expect(status.exitCode).toBe(0);
  });

  it('captures stdout', async () => {
    const handle = await pm.start('echo hello');
    await new Promise(r => setTimeout(r, 200));
    const output = pm.output(handle.id, { lines: 10 });
    expect(output.stdout).toContain('hello');
  });

  it('captures stderr', async () => {
    const handle = await pm.start('echo err >&2');
    await new Promise(r => setTimeout(r, 200));
    const output = pm.output(handle.id, { lines: 10, stream: 'stderr' });
    expect(output.stderr).toContain('err');
  });

  it('rejects when maxConcurrent reached', async () => {
    await pm.start('sleep 10');
    await pm.start('sleep 10');
    await pm.start('sleep 10');
    await expect(pm.start('sleep 10')).rejects.toThrow('concurrent');
  });

  it('kills a running process', async () => {
    const handle = await pm.start('sleep 30');
    const killed = await pm.kill(handle.id);
    expect(killed).toBe(true);
    await new Promise(r => setTimeout(r, 100));
    const status = pm.status(handle.id);
    expect(status.state).toBe('killed');
  });

  it('returns status for unknown id', () => {
    expect(() => pm.status('bogus')).toThrow('not found');
  });
});
```

**Implement:**

```typescript
import { spawn, type ChildProcess } from 'node:child_process';
import { nanoid } from 'nanoid';
import { debug } from './debug.js';

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
  timeoutHandle?: NodeJS.Timeout;
}

export interface ProcessManagerOptions {
  maxConcurrent: number;
  defaultTimeout: number;
  maxBufferSize: number;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private opts: ProcessManagerOptions;

  constructor(opts: ProcessManagerOptions) {
    this.opts = opts;
  }

  get activeCount(): number {
    return [...this.processes.values()].filter(p => p.state === 'running').length;
  }

  async start(command: string, opts?: { timeout?: number; label?: string }): Promise<ProcessHandle> {
    if (this.activeCount >= this.opts.maxConcurrent) {
      throw new Error(`Max concurrent processes (${this.opts.maxConcurrent}) reached. Kill a process first.`);
    }

    const id = nanoid(8);
    const timeout = opts?.timeout ?? this.opts.defaultTimeout;
    const child = spawn('sh', ['-c', command], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    const proc: ManagedProcess = {
      id,
      pid: child.pid!,
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

    child.on('close', (code, signal) => {
      if (proc.state === 'running') {
        proc.state = signal ? 'killed' : (code === 0 ? 'completed' : 'failed');
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
          setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 3000);
        }
      }, timeout);
    }

    this.processes.set(id, proc);
    debug(`bg[${id}] started: pid=${child.pid} cmd="${command}"`);
    return { id, pid: child.pid!, command };
  }

  // ... status(), output(), kill(), killAll() -- see Task 3, 4
}
```

---

### Task 3: Output Retrieval + Since-Last-Read

**Test first:**

```typescript
describe('ProcessManager.output', () => {
  it('returns new output since last read by default', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('echo line1 && sleep 0.1 && echo line2');

    await new Promise(r => setTimeout(r, 50));
    const first = pm.output(h.id, { sinceLastRead: true });
    expect(first.stdout).toContain('line1');

    await new Promise(r => setTimeout(r, 200));
    const second = pm.output(h.id, { sinceLastRead: true });
    expect(second.stdout).toContain('line2');
    expect(second.stdout).not.toContain('line1'); // already read

    await pm.killAll();
  });

  it('returns tail lines when sinceLastRead is false', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('seq 1 20');
    await new Promise(r => setTimeout(r, 200));

    const out = pm.output(h.id, { lines: 5, sinceLastRead: false });
    const lines = out.stdout.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(lines).toContain('20');

    await pm.killAll();
  });
});
```

**Implement** `status()` and `output()` methods on ProcessManager:

```typescript
status(id?: string): ProcessStatus | ProcessStatus[] {
  if (!id) {
    return [...this.processes.values()].map(p => this.toStatus(p));
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

output(id: string, opts?: { lines?: number; stream?: 'stdout' | 'stderr' | 'both'; sinceLastRead?: boolean }): OutputSlice {
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
```

---

### Task 4: Kill + Cleanup

**Test first:**

```typescript
describe('ProcessManager.kill', () => {
  it('sends SIGTERM then SIGKILL after grace period', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    // trap SIGTERM so process doesn't die immediately
    const h = await pm.start('trap "" TERM; sleep 30');
    await new Promise(r => setTimeout(r, 100));

    const killed = await pm.kill(h.id, 'SIGTERM');
    expect(killed).toBe(true);

    // After 6 seconds, SIGKILL should have fired
    await new Promise(r => setTimeout(r, 6000));
    const status = pm.status(h.id) as ProcessStatus;
    expect(status.state).not.toBe('running');

    await pm.killAll();
  }, 10000);

  it('killAll terminates all running processes', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    await pm.start('sleep 30');
    await pm.start('sleep 30');
    expect(pm.activeCount).toBe(2);

    await pm.killAll();
    await new Promise(r => setTimeout(r, 200));
    expect(pm.activeCount).toBe(0);
  });
});

describe('ProcessManager.timeout', () => {
  it('auto-kills process after timeout', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 500, maxBufferSize: 1024 });
    const h = await pm.start('sleep 30'); // default timeout = 500ms

    await new Promise(r => setTimeout(r, 1500));
    const status = pm.status(h.id) as ProcessStatus;
    expect(status.state).toBe('timeout');

    await pm.killAll();
  }, 5000);
});
```

**Implement:**

```typescript
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
  const running = [...this.processes.values()].filter(p => p.state === 'running');
  await Promise.all(running.map(p => this.kill(p.id)));
}

cleanup(): void {
  this.killAll();
  this.processes.clear();
}
```

---

### Task 5: Tool Executors + Integration

**Test first** (add to `tests/core/tools.test.ts`):

```typescript
describe('bg_start', () => {
  it('starts a background process', async () => {
    const result = await executeTool('bg_start', JSON.stringify({ command: 'echo bg-test' }));
    expect(result).toContain('Process started');
    expect(result).toMatch(/id.*[a-zA-Z0-9]{8}/);
  });
});

describe('bg_status', () => {
  it('returns status of a running process', async () => {
    const startResult = await executeTool('bg_start', JSON.stringify({ command: 'sleep 5' }));
    const id = startResult.match(/id[:\s]+([a-zA-Z0-9]{8})/)?.[1];
    const statusResult = await executeTool('bg_status', JSON.stringify({ id }));
    expect(statusResult).toContain('running');
  });

  it('lists all processes when no id given', async () => {
    await executeTool('bg_start', JSON.stringify({ command: 'sleep 5', label: 'first' }));
    await executeTool('bg_start', JSON.stringify({ command: 'sleep 5', label: 'second' }));
    const result = await executeTool('bg_status', JSON.stringify({}));
    expect(result).toContain('first');
    expect(result).toContain('second');
  });
});
```

**Implement** in `src/core/tools.ts`:

Add schemas to `TOOL_SCHEMAS` array, add cases to `executeTool` switch, add executor functions.
The ProcessManager singleton is lazily initialized on first `bg_start`:

```typescript
let _processManager: ProcessManager | null = null;

function getProcessManager(): ProcessManager {
  if (!_processManager) {
    // Use defaults; config-driven values set via initProcessManager()
    _processManager = new ProcessManager({
      maxConcurrent: 5,
      defaultTimeout: 300_000,
      maxBufferSize: 1_048_576,
    });
  }
  return _processManager;
}

export function initProcessManager(config: OptaConfig): void {
  const bg = config.background ?? {};
  _processManager = new ProcessManager({
    maxConcurrent: bg.maxConcurrent ?? 5,
    defaultTimeout: bg.defaultTimeout ?? 300_000,
    maxBufferSize: bg.maxBufferSize ?? 1_048_576,
  });
}

export function shutdownProcessManager(): void {
  _processManager?.cleanup();
  _processManager = null;
}
```

Tool executor return format:

```
bg_start  → "Process started: id=Ab3xK9mZ pid=12345 cmd=\"npm test\""
bg_status → "id=Ab3xK9mZ state=running pid=12345 runtime=3.2s cmd=\"npm test\""
bg_output → "[stdout]\nline1\nline2\n[stderr]\nwarning: ...\n"
bg_kill   → "Process Ab3xK9mZ killed (was running for 12.4s)"
```

---

### Task 6: Agent Loop Integration

**Modify `src/core/agent.ts`:**

```typescript
// At top of agentLoop():
const { initProcessManager, shutdownProcessManager } = await import('./tools.js');
initProcessManager(config);

// At bottom (after registry.close()):
shutdownProcessManager();
```

Also clean up in the SIGINT handler and in the session-end path of `chat.ts`.

---

## 7. Cleanup & Safety

### Session End

When the agent loop exits (normal completion, SIGINT, or error), `shutdownProcessManager()` is
called. This:

1. Sends SIGTERM to all running processes
2. Waits 3 seconds
3. Sends SIGKILL to any survivors
4. Clears the process map

### SIGINT Handling

Add to the existing SIGINT handler in `src/core/errors.ts` or at the top level in `index.ts`:

```typescript
process.on('SIGINT', () => {
  shutdownProcessManager();
  process.exit(EXIT.SIGINT);
});
```

### Plan Mode

In plan mode, `bg_start` and `bg_kill` are denied (added to `WRITE_TOOL_NAMES` set in
`registry.ts`). `bg_status` and `bg_output` remain available so the planner can observe
processes started in a previous mode.

### CI Mode

All bg_* tools are denied in CI mode. Background processes in CI are a liability; use
`run_command` with explicit timeouts instead.

### Resource Limits

| Limit | Default | Configurable? |
|-------|---------|---------------|
| Max concurrent processes | 5 | Yes (`background.maxConcurrent`) |
| Default timeout per process | 5 min (300s) | Yes (`background.defaultTimeout`) |
| Max buffer per stream | 1 MB | Yes (`background.maxBufferSize`) |
| Force-kill grace period | 5 s | No (hardcoded) |
| Timeout kill grace period | 3 s | No (hardcoded) |

---

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Process produces >1MB stdout | CircularBuffer evicts oldest lines, `truncated: true` in output |
| Process hangs (ignores SIGTERM) | SIGKILL after 5s grace period |
| Process outlives timeout | State set to `'timeout'`, SIGTERM sent, SIGKILL after 3s |
| `bg_output` on completed process | Returns buffered output (buffer persists after exit) |
| `bg_kill` on already-dead process | Returns `false`, no error |
| `bg_start` when at max concurrent | Throws with message suggesting `bg_kill` |
| `bg_status` with invalid ID | Returns "Process not found" error string |
| Session crash (unhandled exception) | `process.on('exit')` handler calls `shutdownProcessManager()` |
| Spawned process spawns children | Only direct child is tracked; children may orphan. Mitigation: use `detached: false` and process groups in future. |
| Binary output (non-UTF8) | `toString()` on Buffer handles it; garbage lines but no crash |
| Zero-timeout (no timeout) | Process runs until explicit kill or session end |
| Rapid bg_output polling | No-op when no new data (`sinceLastRead` returns empty string) |

---

## 9. Implementation Order

1. `CircularBuffer` class + tests (pure logic, no I/O)
2. `ProcessManager` class + tests (spawn, status, output, kill)
3. Config schema additions (background section)
4. Tool schemas + executors in `tools.ts`
5. Agent loop integration (init/shutdown)
6. Permission defaults + mode overrides
7. Update existing test assertions (tool count: 14 -> 18)
8. E2E: start a bg process from `opta chat`, poll output, kill it

**Estimated total effort:** ~430 LOC production, ~250 LOC tests.
