import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { nanoid } from 'nanoid';

interface WorkerResponse {
  id: string;
  ok: boolean;
  result?: string;
  error?: string;
}

interface ToolJob {
  id: string;
  tool: string;
  argsJson: string;
  signal?: AbortSignal;
  aborted: boolean;
  settled: boolean;
  onAbort?: () => void;
  resolve: (value: string) => void;
  reject: (err: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
  disposed: boolean;
  currentJob?: ToolJob;
  lastIdleAt?: number;
}

function makeAbortError(message: string): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export class ToolWorkerPool {
  private static readonly IDLE_REAP_MS = 60_000;
  private static readonly REAPER_INTERVAL_MS = 30_000;

  private readonly maxWorkers: number;
  private readonly minWorkers: number;
  private readonly queue: ToolJob[] = [];
  private readonly workers: WorkerSlot[] = [];
  private closed = false;
  private reaperTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxWorkers: number = defaultWorkerCount(), minWorkers: number = 2) {
    this.maxWorkers = Math.max(1, maxWorkers);
    this.minWorkers = Math.min(Math.max(0, minWorkers), this.maxWorkers);
    this.startReaper();
  }

  private startReaper(): void {
    this.reaperTimer = setInterval(() => {
      this.reapIdleWorkers();
    }, ToolWorkerPool.REAPER_INTERVAL_MS);
    // Allow Node.js to exit even when the reaper timer is active
    this.reaperTimer.unref();
  }

  private reapIdleWorkers(): void {
    if (this.closed) return;
    const now = Date.now();
    const idleSlots = this.workers
      .filter((slot) => !slot.busy && !slot.disposed && slot.lastIdleAt !== undefined)
      .sort((a, b) => (a.lastIdleAt ?? 0) - (b.lastIdleAt ?? 0)); // oldest idle first

    const liveCount = this.workers.filter((s) => !s.disposed).length;
    const reaperBudget = Math.max(0, liveCount - this.minWorkers);

    let reaped = 0;
    for (const slot of idleSlots) {
      if (reaped >= reaperBudget) break;
      if ((slot.lastIdleAt ?? now) + ToolWorkerPool.IDLE_REAP_MS <= now) {
        this.detachWorker(slot);
        reaped++;
      }
    }
  }

  async runTool(tool: string, argsJson: string, signal?: AbortSignal): Promise<string> {
    if (this.closed) {
      throw new Error('Tool worker pool is closed');
    }
    if (signal?.aborted) {
      throw makeAbortError('Tool execution cancelled');
    }

    return new Promise<string>((resolve, reject) => {
      const job: ToolJob = {
        id: nanoid(10),
        tool,
        argsJson,
        signal,
        aborted: false,
        settled: false,
        resolve,
        reject,
      };

      if (signal) {
        const onAbort = () => {
          this.abortJob(job);
        };
        job.onAbort = onAbort;
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.queue.push(job);
      this.dispatch();
    });
  }

  close(): void {
    this.closed = true;
    if (this.reaperTimer !== null) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;
      this.rejectJob(job, new Error('Tool worker pool closed'));
    }

    const snapshots = [...this.workers];
    for (const slot of snapshots) {
      if (slot.currentJob) {
        this.rejectJob(slot.currentJob, new Error('Tool worker pool closed'));
        slot.currentJob = undefined;
      }
      this.detachWorker(slot);
    }
  }

  getStats(): { workers: number; busy: number; queued: number } {
    const workers = this.workers.length;
    const busy = this.workers.reduce((count, slot) => count + (slot.busy ? 1 : 0), 0);
    return { workers, busy, queued: this.queue.length };
  }

  /**
   * Pre-spawn idle workers so the first tool call experiences no cold-start
   * latency from Worker thread creation (~30-80 ms each).
   */
  warmUp(count: number = 2): void {
    if (this.closed) return;
    const toCreate = Math.min(count, this.maxWorkers) - this.workers.length;
    for (let i = 0; i < toCreate; i++) {
      this.createWorker();
    }
  }

  private dispatch(): void {
    if (this.closed) return;

    while (this.queue.length > 0) {
      const nextWorker = this.getIdleOrCreateWorker();
      if (!nextWorker) return;
      const nextJob = this.queue.shift();
      if (!nextJob) return;
      if (nextJob.aborted) {
        this.rejectJob(nextJob, makeAbortError('Tool execution cancelled'));
        continue;
      }
      this.assignJob(nextWorker, nextJob);
    }
  }

  private getIdleOrCreateWorker(): WorkerSlot | null {
    const idle = this.workers.find((slot) => !slot.busy && !slot.disposed);
    if (idle) return idle;
    if (this.workers.length >= this.maxWorkers) return null;
    return this.createWorker();
  }

  private createWorker(): WorkerSlot {
    const workerPath = this.resolveWorkerPath();
    const execArgv = workerPath.pathname.endsWith('.ts') ? ['--import', 'tsx'] : [];
    const worker = new Worker(workerPath, { execArgv });

    const slot: WorkerSlot = {
      worker,
      busy: false,
      disposed: false,
      lastIdleAt: Date.now(),
    };

    worker.on('message', (message: WorkerResponse) => {
      if (slot.disposed || !slot.currentJob) return;
      const job = slot.currentJob;
      if (message.id !== job.id) return;
      slot.currentJob = undefined;
      slot.busy = false;
      slot.lastIdleAt = Date.now();
      if (message.ok) {
        this.resolveJob(job, message.result ?? '');
      } else {
        this.rejectJob(job, new Error(message.error ?? 'Unknown worker error'));
      }
      this.dispatch();
    });

    worker.on('error', (err) => {
      if (slot.disposed) return;
      this.failWorker(slot, err instanceof Error ? err : new Error(String(err)));
    });

    worker.on('exit', (code) => {
      if (slot.disposed) return;
      const error =
        code === 0
          ? new Error('Worker exited before returning a result')
          : new Error(`Worker exited with code ${code}`);
      this.failWorker(slot, error);
    });

    this.workers.push(slot);
    return slot;
  }

  private assignJob(slot: WorkerSlot, job: ToolJob): void {
    slot.busy = true;
    slot.currentJob = job;
    slot.worker.postMessage({
      id: job.id,
      tool: job.tool,
      argsJson: job.argsJson,
    });
  }

  private failWorker(slot: WorkerSlot, err: Error): void {
    const job = slot.currentJob;
    slot.currentJob = undefined;
    slot.busy = false;
    if (job) {
      this.rejectJob(job, err);
    }
    this.detachWorker(slot);
    this.dispatch();
  }

  private detachWorker(slot: WorkerSlot): void {
    if (slot.disposed) return;
    slot.disposed = true;
    const idx = this.workers.indexOf(slot);
    if (idx >= 0) {
      this.workers.splice(idx, 1);
    }
    slot.worker.removeAllListeners();
    void slot.worker.terminate();
  }

  private abortJob(job: ToolJob): void {
    if (job.settled || job.aborted) return;
    job.aborted = true;

    const queuedIndex = this.queue.findIndex((item) => item.id === job.id);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      this.rejectJob(job, makeAbortError('Tool execution cancelled'));
      return;
    }

    const active = this.workers.find((slot) => slot.currentJob?.id === job.id);
    if (!active || !active.currentJob) return;
    this.rejectJob(job, makeAbortError('Tool execution cancelled'));
    active.currentJob = undefined;
    active.busy = false;
    // NOTE: detachWorker calls worker.terminate() fire-and-forget.  The OS
    // thread may still be alive for a brief period after this returns.  This
    // is an accepted limitation — Node Worker threads have no synchronous
    // termination API.  dispatch() immediately allocates a new worker slot
    // for the next queued job rather than waiting for the old one to exit.
    this.detachWorker(active);
    this.dispatch();
  }

  private resolveJob(job: ToolJob, value: string): void {
    if (job.settled) return;
    job.settled = true;
    if (job.signal && job.onAbort) {
      job.signal.removeEventListener('abort', job.onAbort);
    }
    job.resolve(value);
  }

  private rejectJob(job: ToolJob, err: Error): void {
    if (job.settled) return;
    job.settled = true;
    if (job.signal && job.onAbort) {
      job.signal.removeEventListener('abort', job.onAbort);
    }
    job.reject(err);
  }

  private resolveWorkerPath(): URL {
    const selfPath = fileURLToPath(import.meta.url);
    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
    const baseDir = dirname(selfPath);

    // Source layout: src/daemon/worker-pool.ts -> src/daemon/worker-pool-worker.ts
    // Bundled layout: dist/chunk-*.js -> dist/daemon/worker-pool-worker.js
    const candidates = [
      join(baseDir, `worker-pool-worker${ext}`),
      join(baseDir, 'daemon', `worker-pool-worker${ext}`),
      join(baseDir, '..', 'daemon', `worker-pool-worker${ext}`),
    ];

    const found = candidates.find((p) => existsSync(p));
    return pathToFileURL(found ?? candidates[0]!);
  }
}

function defaultWorkerCount(): number {
  const envRaw = process.env['OPTA_DAEMON_TOOL_WORKERS'];
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const cpuCount = cpus().length;
  return Math.max(1, Math.min(8, cpuCount - 1));
}
