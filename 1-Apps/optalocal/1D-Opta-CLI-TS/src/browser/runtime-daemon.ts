import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  pruneBrowserArtifactSessionDirs,
  resolveBrowserArtifactRetentionPolicy,
  type BrowserArtifactRetentionPolicy,
} from './artifacts.js';
import {
  NativeSessionManager,
  type NativeSessionActionOptions,
  type NativeSessionManagerOptions,
} from './native-session-manager.js';
import {
  pruneBrowserProfileDirs,
  resolveBrowserProfileRetentionPolicy,
  type BrowserProfileRetentionPolicy,
} from './profile-store.js';
import {
  BrowserSessionStore,
  type BrowserRuntimeSessionRecord,
} from './session-store.js';
import { refreshBrowserRunCorpusSummary } from './run-corpus.js';
import { withRetryTaxonomy } from './retry-taxonomy.js';
import type {
  BrowserAction,
  BrowserActionError,
  BrowserActionResult,
  BrowserClickInput,
  BrowserNavigateInput,
  BrowserOpenSessionInput,
  BrowserScreenshotData,
  BrowserScreenshotInput,
  BrowserSession,
  BrowserSnapshotData,
  BrowserTypeInput,
} from './types.js';

export { browserRuntimeSessionStorePath } from './session-store.js';

export interface BrowserRuntimeDaemonOptions {
  cwd?: string;
  now?: () => Date;
  maxSessions?: number;
  persistSessions?: boolean;
  persistProfileContinuity?: boolean;
  profileRetentionPolicy?: Partial<BrowserProfileRetentionPolicy>;
  profilePruneIntervalMs?: number;
  artifactPrune?: Partial<BrowserRuntimeArtifactPruneConfig>;
  runCorpusRefresh?: Partial<BrowserRuntimeRunCorpusRefreshConfig>;
  idFactory?: () => string;
  loadPlaywright?: NativeSessionManagerOptions['loadPlaywright'];
  sessionStore?: BrowserSessionStore;
  sessionManager?: NativeSessionManager;
}

export interface BrowserRuntimeHealth {
  running: boolean;
  paused: boolean;
  killed: boolean;
  maxSessions: number;
  sessionCount: number;
  recoveredSessionIds: string[];
  profilePrune: BrowserRuntimeProfilePruneHealth;
  artifactPrune?: BrowserRuntimeArtifactPruneHealth;
  runCorpusRefresh?: BrowserRuntimeRunCorpusRefreshHealth;
  sessions: Array<{
    sessionId: string;
    mode: BrowserSession['mode'];
    status: BrowserSession['status'];
    runtime: BrowserSession['runtime'];
    currentUrl?: string;
    updatedAt: string;
  }>;
}

export type BrowserProfilePruneReason = 'startup' | 'interval';
export type BrowserProfilePruneStatus = 'success' | 'error';
export type BrowserArtifactPruneReason = 'startup' | 'interval';
export type BrowserArtifactPruneStatus = 'success' | 'error';
export type BrowserRunCorpusRefreshReason = 'startup' | 'session-close' | 'stop';
export type BrowserRunCorpusRefreshStatus = 'success' | 'error';

export interface BrowserRuntimeProfilePruneHealth {
  enabled: boolean;
  intervalMs?: number;
  inFlight: boolean;
  lastRunAt?: string;
  lastReason?: BrowserProfilePruneReason;
  lastStatus?: BrowserProfilePruneStatus;
  lastListedCount?: number;
  lastKeptCount?: number;
  lastPrunedCount?: number;
  lastError?: string;
}

export interface BrowserRuntimeArtifactPruneHealth {
  enabled: boolean;
  intervalMs?: number;
  inFlight: boolean;
  lastRunAt?: string;
  lastReason?: BrowserArtifactPruneReason;
  lastStatus?: BrowserArtifactPruneStatus;
  lastListedCount?: number;
  lastKeptCount?: number;
  lastPrunedCount?: number;
  lastError?: string;
}

export interface BrowserRuntimeRunCorpusRefreshHealth {
  enabled: boolean;
  windowHours?: number;
  inFlight: boolean;
  lastRunAt?: string;
  lastReason?: BrowserRunCorpusRefreshReason;
  lastStatus?: BrowserRunCorpusRefreshStatus;
  lastError?: string;
  lastAssessedSessionCount?: number;
}

export interface BrowserRuntimeArtifactPruneConfig {
  enabled: boolean;
  policy: BrowserArtifactRetentionPolicy;
  intervalMs: number;
}

export interface BrowserRuntimeRunCorpusRefreshConfig {
  enabled: boolean;
  windowHours: number;
}

interface StopOptions {
  closeSessions?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROFILE_PRUNE_INTERVAL_MS = DAY_MS;
const DEFAULT_ARTIFACT_PRUNE_INTERVAL_MS = DAY_MS;
const DEFAULT_RUN_CORPUS_WINDOW_HOURS = 168;

function cloneSession(session: BrowserSession): BrowserSession {
  return {
    ...session,
    lastError: session.lastError ? { ...session.lastError } : undefined,
  };
}

function cloneActionError(error: BrowserActionError | undefined): BrowserActionError | undefined {
  if (!error) return undefined;
  const normalized = withRetryTaxonomy(error.code, error.message);
  return {
    ...normalized,
    ...error,
    retryable: error.retryable ?? normalized.retryable,
    retryCategory: error.retryCategory ?? normalized.retryCategory,
    retryHint: error.retryHint ?? normalized.retryHint,
  };
}

function normalizePruneIntervalMs(v: unknown, defaultMs: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.max(1_000, Math.floor(n)) : defaultMs;
}

function normalizeRunCorpusWindowHours(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_RUN_CORPUS_WINDOW_HOURS;
  }
  return Math.max(1, Math.floor(value));
}

export class BrowserRuntimeDaemon {
  private readonly cwd: string;
  private readonly now: () => Date;
  private readonly maxSessions: number;
  private readonly persistSessions: boolean;
  private readonly persistProfileContinuity: boolean;
  private readonly profileRetentionPolicy: BrowserProfileRetentionPolicy;
  private readonly profilePruneIntervalMs: number;
  private readonly artifactPruneEnabled: boolean;
  private readonly artifactRetentionPolicy: BrowserArtifactRetentionPolicy;
  private readonly artifactPruneIntervalMs: number;
  private readonly runCorpusRefreshEnabled: boolean;
  private readonly runCorpusWindowHours: number;
  private readonly idFactory: () => string;
  private readonly sessionManager: NativeSessionManager;
  private readonly sessionStore: BrowserSessionStore;

  private readonly sessions = new Map<string, BrowserSession>();
  private readonly recoveredSessionIds = new Set<string>();
  private readonly pendingOpenSessionIds = new Set<string>();
  private readonly profilePruneHealth: BrowserRuntimeProfilePruneHealth;
  private readonly artifactPruneHealth: BrowserRuntimeArtifactPruneHealth;
  private readonly runCorpusRefreshHealth: BrowserRuntimeRunCorpusRefreshHealth;
  private profilePruneTimer: NodeJS.Timeout | null = null;
  private artifactPruneTimer: NodeJS.Timeout | null = null;
  private runCorpusRefreshInFlight: Promise<void> | null = null;
  private running = false;
  private paused = false;
  private killed = false;
  private daemonActionSequence = 0;
  private actionAbortController = new AbortController();

  constructor(options: BrowserRuntimeDaemonOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? (() => new Date());
    this.maxSessions = Math.max(1, Math.floor(options.maxSessions ?? 3));
    this.persistSessions = options.persistSessions !== false;
    this.persistProfileContinuity = options.persistProfileContinuity === true;
    this.profileRetentionPolicy = resolveBrowserProfileRetentionPolicy(options.profileRetentionPolicy);
    this.profilePruneIntervalMs = normalizePruneIntervalMs(options.profilePruneIntervalMs, DEFAULT_PROFILE_PRUNE_INTERVAL_MS);
    this.artifactPruneEnabled = options.artifactPrune?.enabled === true;
    this.artifactRetentionPolicy = resolveBrowserArtifactRetentionPolicy(options.artifactPrune?.policy);
    this.artifactPruneIntervalMs = normalizePruneIntervalMs(options.artifactPrune?.intervalMs, DEFAULT_ARTIFACT_PRUNE_INTERVAL_MS);
    this.runCorpusRefreshEnabled = options.runCorpusRefresh?.enabled !== false;
    this.runCorpusWindowHours = normalizeRunCorpusWindowHours(options.runCorpusRefresh?.windowHours);
    this.idFactory = options.idFactory ?? (() => randomUUID());
    this.sessionManager = options.sessionManager ?? new NativeSessionManager({
      cwd: this.cwd,
      now: this.now,
      idFactory: this.idFactory,
      loadPlaywright: options.loadPlaywright,
    });
    this.sessionStore = options.sessionStore ?? new BrowserSessionStore({
      cwd: this.cwd,
      now: this.now,
    });
    this.profilePruneHealth = {
      enabled: this.persistProfileContinuity,
      intervalMs: this.persistProfileContinuity ? this.profilePruneIntervalMs : undefined,
      inFlight: false,
    };
    this.artifactPruneHealth = {
      enabled: this.artifactPruneEnabled,
      intervalMs: this.artifactPruneEnabled ? this.artifactPruneIntervalMs : undefined,
      inFlight: false,
    };
    this.runCorpusRefreshHealth = {
      enabled: this.runCorpusRefreshEnabled,
      windowHours: this.runCorpusRefreshEnabled ? this.runCorpusWindowHours : undefined,
      inFlight: false,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.killed = false;
    this.actionAbortController = new AbortController();
    this.recoveredSessionIds.clear();
    await this.recoverPersistedSessions();
    await this.pruneProfiles('startup');
    await this.pruneArtifacts('startup');
    await this.refreshRunCorpus('startup');
    this.ensureProfilePruneTimer();
    this.ensureArtifactPruneTimer();
  }

  async stop(options: StopOptions = {}): Promise<void> {
    this.clearProfilePruneTimer();
    this.clearArtifactPruneTimer();
    if (!this.running) return;
    const closeSessions = options.closeSessions !== false;

    if (closeSessions) {
      for (const sessionId of this.sessions.keys()) {
        await this.sessionManager.closeSession(sessionId).catch(() => {});
      }
      this.sessions.clear();
      this.recoveredSessionIds.clear();
    }

    await this.persistOpenSessions();
    await this.refreshRunCorpus('stop');
    this.running = false;
    this.paused = false;
  }

  pause(): void {
    if (!this.running) return;
    this.paused = true;
  }

  resume(): void {
    if (!this.running || this.killed) return;
    this.paused = false;
  }

  async kill(): Promise<void> {
    if (!this.actionAbortController.signal.aborted) {
      this.actionAbortController.abort();
    }
    await this.stop({ closeSessions: true });
    this.killed = true;
    this.paused = true;
  }

  health(): BrowserRuntimeHealth {
    const sessions = [...this.sessions.values()]
      .map((session) => ({
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        runtime: session.runtime,
        currentUrl: session.currentUrl,
        updatedAt: session.updatedAt,
      }))
      .sort((a, b) => a.sessionId.localeCompare(b.sessionId));

    return {
      running: this.running,
      paused: this.paused,
      killed: this.killed,
      maxSessions: this.maxSessions,
      sessionCount: sessions.length,
      recoveredSessionIds: [...this.recoveredSessionIds].sort((a, b) => a.localeCompare(b)),
      profilePrune: { ...this.profilePruneHealth },
      artifactPrune: { ...this.artifactPruneHealth },
      runCorpusRefresh: { ...this.runCorpusRefreshHealth },
      sessions,
    };
  }

  async ensureSession(input: BrowserOpenSessionInput): Promise<BrowserActionResult<BrowserSession>> {
    const requestedId = input.sessionId?.trim();
    if (requestedId && this.sessions.has(requestedId)) {
      const existing = this.sessions.get(requestedId)!;
      return {
        ok: true,
        action: this.createDaemonAction(requestedId, 'openSession', { reused: true }),
        data: cloneSession(existing),
      };
    }
    return this.openSession(input);
  }

  async openSession(input: BrowserOpenSessionInput = {}): Promise<BrowserActionResult<BrowserSession>> {
    const sessionId = input.sessionId?.trim() || this.idFactory();
    const mode = input.mode ?? 'isolated';
    const profileDir = input.profileDir ?? this.resolveSessionProfileDir(sessionId, mode);
    const gate = this.checkDaemonGate<BrowserSession>(sessionId, 'openSession', { ...input }, {
      allowWhilePaused: false,
    });
    if (gate) return gate;

    if (!this.sessions.has(sessionId) && this.pendingOpenSessionIds.has(sessionId)) {
      return this.daemonError(
        sessionId,
        'openSession',
        'SESSION_OPENING',
        `Browser session "${sessionId}" is currently opening.`,
        input as Record<string, unknown>,
      );
    }

    const pendingCount = this.pendingOpenSessionIds.has(sessionId)
      ? this.pendingOpenSessionIds.size - 1
      : this.pendingOpenSessionIds.size;
    const activeOrPendingCount = this.sessions.size + pendingCount;

    if (!this.sessions.has(sessionId) && activeOrPendingCount >= this.maxSessions) {
      return this.daemonError(
        sessionId,
        'openSession',
        'MAX_SESSIONS_REACHED',
        `Browser runtime max sessions reached (${this.maxSessions}).`,
        input as Record<string, unknown>,
      );
    }

    this.pendingOpenSessionIds.add(sessionId);
    let result: BrowserActionResult<BrowserSession>;
    try {
      result = await this.sessionManager.openSession({
        ...input,
        sessionId,
        mode,
        profileDir,
      }, this.actionOptions());

      const keepSessionRecord = result.ok || result.error?.code === 'PLAYWRIGHT_UNAVAILABLE';
      if (result.data && keepSessionRecord) {
        this.sessions.set(sessionId, cloneSession(result.data));
      } else if (result.data && !result.ok) {
        // Failed opens should not consume daemon capacity as active sessions.
        await this.sessionManager.closeSession(sessionId).catch(() => {});
      }
    } finally {
      this.pendingOpenSessionIds.delete(sessionId);
    }

    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  async closeSession(
    sessionId: string,
  ): Promise<BrowserActionResult<{ sessionId: string; status: 'closed' }>> {
    const gate = this.checkDaemonGate<{ sessionId: string; status: 'closed' }>(sessionId, 'closeSession', {}, {
      allowWhilePaused: true,
    });
    if (gate) return gate;

    const result = await this.sessionManager.closeSession(sessionId);
    if (result.ok) {
      this.sessions.delete(sessionId);
      this.recoveredSessionIds.delete(sessionId);
    }

    await this.persistOpenSessions();
    if (result.ok) {
      await this.refreshRunCorpus('session-close');
    }
    return this.cloneActionResult(result);
  }

  async navigate(
    sessionId: string,
    input: BrowserNavigateInput,
  ): Promise<BrowserActionResult<{ url: string }>> {
    const gate = this.checkDaemonGate<{ url: string }>(sessionId, 'navigate', { ...input });
    if (gate) return gate;

    const result = await this.sessionManager.navigate(sessionId, input, this.actionOptions());
    if (result.ok) {
      const existing = this.sessions.get(sessionId);
      if (existing && result.data?.url) {
        existing.currentUrl = result.data.url;
        existing.updatedAt = this.timestamp();
        this.sessions.set(sessionId, cloneSession(existing));
      }
    }

    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  async click(sessionId: string, input: BrowserClickInput): Promise<BrowserActionResult> {
    const gate = this.checkDaemonGate<undefined>(sessionId, 'click', { ...input });
    if (gate) return gate;

    const result = await this.sessionManager.click(sessionId, input, this.actionOptions());
    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  async type(sessionId: string, input: BrowserTypeInput): Promise<BrowserActionResult> {
    const gate = this.checkDaemonGate<undefined>(sessionId, 'type', { ...input });
    if (gate) return gate;

    const result = await this.sessionManager.type(sessionId, input, this.actionOptions());
    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  async snapshot(sessionId: string): Promise<BrowserActionResult<BrowserSnapshotData>> {
    const gate = this.checkDaemonGate<BrowserSnapshotData>(sessionId, 'snapshot', {});
    if (gate) return gate;

    const result = await this.sessionManager.snapshot(sessionId, this.actionOptions());
    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  async screenshot(
    sessionId: string,
    input: BrowserScreenshotInput = {},
  ): Promise<BrowserActionResult<BrowserScreenshotData>> {
    const gate = this.checkDaemonGate<BrowserScreenshotData>(sessionId, 'screenshot', { ...input });
    if (gate) return gate;

    const result = await this.sessionManager.screenshot(sessionId, input, this.actionOptions());
    await this.persistOpenSessions();
    return this.cloneActionResult(result);
  }

  private async recoverPersistedSessions(): Promise<void> {
    if (!this.persistSessions) return;

    const persisted = await this.sessionStore.list();
    for (const record of persisted) {
      if (record.status !== 'open') continue;
      if (this.sessions.size >= this.maxSessions) break;

      try {
        const recovered = await this.sessionManager.openSession({
          sessionId: record.sessionId,
          mode: record.mode,
          wsEndpoint: record.wsEndpoint,
          profileDir: this.resolveSessionProfileDir(record.sessionId, record.mode),
        }, this.actionOptions());

        if (!recovered.data) continue;

        // When a real browser endpoint was reconnected, validate the page is
        // still functional to avoid zombie sessions with dead contexts.
        if (recovered.ok && record.wsEndpoint) {
          const probe = await this.sessionManager.snapshot(record.sessionId, this.actionOptions());
          if (!probe.ok) {
            await this.sessionManager.closeSession(record.sessionId).catch(() => {});
            continue;
          }
        }

        this.sessions.set(record.sessionId, cloneSession(recovered.data));
        this.recoveredSessionIds.add(record.sessionId);
      } catch (error) {
        if (process.env.OPTA_DEBUG) {
          console.error(`Failed to recover browser session "${record.sessionId}":`, error);
        }
      }
    }

    await this.persistOpenSessions();
  }

  private async persistOpenSessions(): Promise<void> {
    if (!this.persistSessions) return;

    const records: BrowserRuntimeSessionRecord[] = [];
    for (const session of this.sessions.values()) {
      if (session.status !== 'open') continue;

      records.push({
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        runtime: session.runtime,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        currentUrl: session.currentUrl,
        wsEndpoint: session.wsEndpoint,
        lastError: cloneActionError(session.lastError),
        recoveredAt: this.recoveredSessionIds.has(session.id) ? this.timestamp() : undefined,
      });
    }

    await this.sessionStore.replaceSessions(records);
  }

  private checkDaemonGate<T>(
    sessionId: string,
    type: BrowserAction['type'],
    input: Record<string, unknown>,
    options: { allowWhilePaused?: boolean } = {},
  ): BrowserActionResult<T> | null {
    if (!this.running || this.killed) {
      return this.daemonError(
        sessionId,
        type,
        'DAEMON_STOPPED',
        'Browser runtime daemon is not running.',
        input,
      );
    }

    if (this.paused && !options.allowWhilePaused) {
      return this.daemonError(
        sessionId,
        type,
        'DAEMON_PAUSED',
        'Browser runtime daemon is paused.',
        input,
      );
    }

    return null;
  }

  private createDaemonAction(
    sessionId: string,
    type: BrowserAction['type'],
    input: Record<string, unknown>,
  ): BrowserAction {
    this.daemonActionSequence += 1;
    return {
      id: `daemon-action-${String(this.daemonActionSequence).padStart(6, '0')}`,
      sessionId,
      type,
      createdAt: this.timestamp(),
      input,
    };
  }

  private daemonError<T>(
    sessionId: string,
    type: BrowserAction['type'],
    code: string,
    message: string,
    input: Record<string, unknown>,
  ): BrowserActionResult<T> {
    return {
      ok: false,
      action: this.createDaemonAction(sessionId, type, input),
      error: withRetryTaxonomy(code, message),
    };
  }

  private cloneActionResult<T>(result: BrowserActionResult<T>): BrowserActionResult<T> {
    return {
      ...result,
      action: { ...result.action },
      error: cloneActionError(result.error),
      data: result.data,
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private actionOptions(): NativeSessionActionOptions {
    return {
      signal: this.actionAbortController.signal,
    };
  }

  private ensureProfilePruneTimer(): void {
    this.clearProfilePruneTimer();
    if (!this.persistProfileContinuity) return;

    const timer = setInterval(() => {
      void this.pruneProfiles('interval');
    }, this.profilePruneIntervalMs);
    timer.unref?.();
    this.profilePruneTimer = timer;
  }

  private clearProfilePruneTimer(): void {
    if (!this.profilePruneTimer) return;
    clearInterval(this.profilePruneTimer);
    this.profilePruneTimer = null;
  }

  private ensureArtifactPruneTimer(): void {
    this.clearArtifactPruneTimer();
    if (!this.artifactPruneEnabled) return;

    const timer = setInterval(() => {
      void this.pruneArtifacts('interval');
    }, this.artifactPruneIntervalMs);
    timer.unref?.();
    this.artifactPruneTimer = timer;
  }

  private clearArtifactPruneTimer(): void {
    if (!this.artifactPruneTimer) return;
    clearInterval(this.artifactPruneTimer);
    this.artifactPruneTimer = null;
  }

  private async pruneProfiles(reason: BrowserProfilePruneReason): Promise<void> {
    if (!this.persistProfileContinuity) return;
    if (this.profilePruneHealth.inFlight) return;

    this.profilePruneHealth.inFlight = true;
    this.profilePruneHealth.lastRunAt = this.timestamp();
    this.profilePruneHealth.lastReason = reason;

    try {
      const result = await pruneBrowserProfileDirs({
        cwd: this.cwd,
        now: this.now,
        policy: this.profileRetentionPolicy,
        excludeSessionIds: [...this.sessions.keys()],
      });
      this.profilePruneHealth.lastStatus = 'success';
      this.profilePruneHealth.lastListedCount = result.listed.length;
      this.profilePruneHealth.lastKeptCount = result.kept.length;
      this.profilePruneHealth.lastPrunedCount = result.pruned.length;
      delete this.profilePruneHealth.lastError;
    } catch (error) {
      this.profilePruneHealth.lastStatus = 'error';
      this.profilePruneHealth.lastListedCount = undefined;
      this.profilePruneHealth.lastKeptCount = undefined;
      this.profilePruneHealth.lastPrunedCount = undefined;
      this.profilePruneHealth.lastError = error instanceof Error ? error.message : String(error);
      if (process.env.OPTA_DEBUG) {
        console.error('Browser profile auto-prune failed:', error);
      }
    } finally {
      this.profilePruneHealth.inFlight = false;
    }
  }

  private async pruneArtifacts(reason: BrowserArtifactPruneReason): Promise<void> {
    if (!this.artifactPruneEnabled) return;
    if (this.artifactPruneHealth.inFlight) return;

    this.artifactPruneHealth.inFlight = true;
    this.artifactPruneHealth.lastRunAt = this.timestamp();
    this.artifactPruneHealth.lastReason = reason;

    try {
      const result = await pruneBrowserArtifactSessionDirs({
        cwd: this.cwd,
        now: this.now,
        policy: this.artifactRetentionPolicy,
        excludeSessionIds: [...this.sessions.keys()],
      });
      this.artifactPruneHealth.lastStatus = 'success';
      this.artifactPruneHealth.lastListedCount = result.listed.length;
      this.artifactPruneHealth.lastKeptCount = result.kept.length;
      this.artifactPruneHealth.lastPrunedCount = result.pruned.length;
      delete this.artifactPruneHealth.lastError;
    } catch (error) {
      this.artifactPruneHealth.lastStatus = 'error';
      this.artifactPruneHealth.lastListedCount = undefined;
      this.artifactPruneHealth.lastKeptCount = undefined;
      this.artifactPruneHealth.lastPrunedCount = undefined;
      this.artifactPruneHealth.lastError = error instanceof Error ? error.message : String(error);
      if (process.env.OPTA_DEBUG) {
        console.error('Browser artifact auto-prune failed:', error);
      }
    } finally {
      this.artifactPruneHealth.inFlight = false;
    }
  }

  private async refreshRunCorpus(reason: BrowserRunCorpusRefreshReason): Promise<void> {
    if (!this.runCorpusRefreshEnabled) return;
    if (this.runCorpusRefreshInFlight) {
      await this.runCorpusRefreshInFlight;
      return;
    }

    this.runCorpusRefreshHealth.inFlight = true;
    this.runCorpusRefreshHealth.lastRunAt = this.timestamp();
    this.runCorpusRefreshHealth.lastReason = reason;

    const refreshPromise = (async () => {
      try {
        const refreshed = await refreshBrowserRunCorpusSummary(this.cwd, {
          enabled: true,
          windowHours: this.runCorpusWindowHours,
          now: this.now,
        });
        this.runCorpusRefreshHealth.lastStatus = 'success';
        this.runCorpusRefreshHealth.lastAssessedSessionCount = refreshed?.summary.assessedSessionCount;
        delete this.runCorpusRefreshHealth.lastError;
      } catch (error) {
        this.runCorpusRefreshHealth.lastStatus = 'error';
        this.runCorpusRefreshHealth.lastAssessedSessionCount = undefined;
        this.runCorpusRefreshHealth.lastError = error instanceof Error ? error.message : String(error);
        if (process.env.OPTA_DEBUG) {
          console.error('Browser run-corpus auto-refresh failed:', error);
        }
      } finally {
        this.runCorpusRefreshHealth.inFlight = false;
      }
    })();

    this.runCorpusRefreshInFlight = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      this.runCorpusRefreshInFlight = null;
    }
  }

  private resolveSessionProfileDir(
    sessionId: string,
    mode: BrowserOpenSessionInput['mode'],
  ): string | undefined {
    if (!this.persistProfileContinuity) return undefined;
    if (mode === 'attach') return undefined;
    return join(this.cwd, '.opta', 'browser', 'profiles', sessionId);
  }
}

let sharedDaemon: BrowserRuntimeDaemon | null = null;
let sharedDaemonKey = '';

export async function getSharedBrowserRuntimeDaemon(
  options: BrowserRuntimeDaemonOptions = {},
): Promise<BrowserRuntimeDaemon> {
  const cwd = options.cwd ?? process.cwd();
  const persistSessions = options.persistSessions !== false;
  const persistProfileContinuity = options.persistProfileContinuity === true;
  const maxSessions = Math.max(1, Math.floor(options.maxSessions ?? 3));
  const profileRetentionPolicy = resolveBrowserProfileRetentionPolicy(options.profileRetentionPolicy);
  const profilePruneIntervalMs = normalizePruneIntervalMs(options.profilePruneIntervalMs, DEFAULT_PROFILE_PRUNE_INTERVAL_MS);
  const artifactPruneEnabled = options.artifactPrune?.enabled === true;
  const artifactRetentionPolicy = resolveBrowserArtifactRetentionPolicy(options.artifactPrune?.policy);
  const artifactPruneIntervalMs = normalizePruneIntervalMs(options.artifactPrune?.intervalMs, DEFAULT_ARTIFACT_PRUNE_INTERVAL_MS);
  const runCorpusRefreshEnabled = options.runCorpusRefresh?.enabled !== false;
  const runCorpusWindowHours = normalizeRunCorpusWindowHours(options.runCorpusRefresh?.windowHours);
  const key = [
    cwd,
    persistSessions ? 'persist' : 'ephemeral',
    persistProfileContinuity ? 'profile' : 'noprof',
    `max${maxSessions}`,
    `ret${profileRetentionPolicy.retentionDays}`,
    `maxprof${profileRetentionPolicy.maxPersistedProfiles}`,
    `pprune${profilePruneIntervalMs}`,
    artifactPruneEnabled ? 'artifact-prune' : 'artifact-keep',
    `aret${artifactRetentionPolicy.retentionDays}`,
    `amax${artifactRetentionPolicy.maxPersistedSessions}`,
    `aprune${artifactPruneIntervalMs}`,
    runCorpusRefreshEnabled ? 'run-corpus-on' : 'run-corpus-off',
    `rwindow${runCorpusWindowHours}`,
  ].join('::');

  if (!sharedDaemon || sharedDaemonKey !== key) {
    if (sharedDaemon) {
      // Reconfiguration must fully close prior runtime resources; keeping sessions
      // alive here can orphan browser contexts when the singleton is replaced.
      await sharedDaemon.stop({ closeSessions: true }).catch(() => {});
    }
    sharedDaemon = new BrowserRuntimeDaemon({
      ...options,
      cwd,
      persistSessions,
      persistProfileContinuity,
      maxSessions,
      profileRetentionPolicy,
      profilePruneIntervalMs,
      artifactPrune: {
        enabled: artifactPruneEnabled,
        policy: artifactRetentionPolicy,
        intervalMs: artifactPruneIntervalMs,
      },
      runCorpusRefresh: {
        enabled: runCorpusRefreshEnabled,
        windowHours: runCorpusWindowHours,
      },
    });
    sharedDaemonKey = key;
  }

  return sharedDaemon;
}

export async function resetSharedBrowserRuntimeDaemonForTests(): Promise<void> {
  if (sharedDaemon) {
    await sharedDaemon.stop({ closeSessions: true }).catch(() => {});
  }
  sharedDaemon = null;
  sharedDaemonKey = '';
}
