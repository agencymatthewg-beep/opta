import { statSync } from 'node:fs';
import { nanoid } from 'nanoid';
import type { AgentMessage } from '../core/agent.js';
import { agentLoop } from '../core/agent.js';
import { loadConfig, type OptaConfig } from '../core/config.js';
import { LmxClient } from '../lmx/client.js';
import { findMatchingModelId, normalizeConfiguredModelId } from '../lmx/model-lifecycle.js';
import {
  appendSessionEvent,
  hasSessionStore,
  listStoredSessions,
  readSessionEventsAfter,
  readSessionSnapshot,
  writeSessionSnapshot,
  type StoredSessionSnapshot,
} from './session-store.js';
import { PermissionCoordinator } from './permission-coordinator.js';
import { TurnQueue, type QueuedTurn } from './turn-queue.js';
import { makeEnvelope } from '../protocol/v3/events.js';
import { ToolWorkerPool } from './worker-pool.js';
import type {
  BackgroundOutputSlice,
  BackgroundProcessSnapshot,
  BackgroundSignal,
  ClientSubmitTurn,
  CreateSessionRequest,
  PermissionDecision,
  SessionSnapshot,
  TurnDonePayload,
  TurnErrorCode,
  TurnErrorPayload,
  V3Envelope,
} from '../protocol/v3/types.js';
import { logDaemonEvent } from './telemetry.js';
import {
  BackgroundManager,
  type BackgroundManagerEvent,
  type BackgroundOutputQuery,
} from './background-manager.js';
import { errorMessage } from '../utils/errors.js';

const CHARS_PER_TOKEN = 4;
const PREFLIGHT_CACHE_TTL_MS = 10_000;

// Tool result cache constants
const CACHEABLE_TOOLS = new Set(['read_file', 'list_dir', 'search_files', 'find_files']);
const MTIME_TOOLS = new Set(['read_file', 'list_dir']);
const WRITE_TOOLS = new Set(['write_file', 'edit_file']);
const CACHE_MAX_SIZE = 200;
const CACHE_TTL_MS = 30_000;

interface ToolCacheEntry {
  result: string;
  cachedAt: number;
  fileMtimeMs?: number;
}
const LMX_PREFLIGHT_TIMEOUT_MS = 8_000;
const NO_MODEL_LOADED_MESSAGE = 'No Model Loaded - Use Opta Menu to begin.';

interface CodedTurnError extends Error {
  turnErrorCode?: TurnErrorCode;
}

interface ManagedSession {
  sessionId: string;
  model: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
  toolCallCount: number;
  queue: TurnQueue;
  activeTurn?: QueuedTurn;
  activeAbort?: AbortController;
  seq: number;
  toolCache: Map<string, ToolCacheEntry>;
}

type SessionSubscriber = (event: V3Envelope) => void;

export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly subscribers = new Map<string, Set<SessionSubscriber>>();
  private readonly permissionCoordinator = new PermissionCoordinator();
  private readonly toolWorkers = new ToolWorkerPool();
  private preflightCache: { modelIds: string[]; cachedAt: number } | null = null;
  private readonly backgroundManager = new BackgroundManager({
    maxConcurrent: 5,
    defaultTimeout: 300_000,
    maxBufferSize: 1_048_576,
  });
  private readonly unsubscribeBackgroundEvents: () => void;
  private ingressSeq = 0;
  private evictionInterval: NodeJS.Timeout;

  constructor(
    private readonly daemonId: string,
    private readonly getConfig: () => Promise<OptaConfig> = async () => loadConfig()
  ) {
    this.unsubscribeBackgroundEvents = this.backgroundManager.subscribe((event) => {
      void this.handleBackgroundEvent(event);
    });
    this.evictionInterval = setInterval(() => this.evictIdleSessions(), 5 * 60 * 1000);
    this.evictionInterval.unref();
  }

  private evictIdleSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (
        session.queue.size === 0 &&
        !session.activeTurn &&
        !this.subscribers.has(sessionId) &&
        now - new Date(session.updatedAt).getTime() > 30 * 60 * 1000
      ) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async hydrateFromDisk(): Promise<void> {
    const sessionIds = await listStoredSessions();
    for (const sessionId of sessionIds) {
      const snapshot = await readSessionSnapshot(sessionId);
      if (!snapshot) continue;
      this.sessions.set(sessionId, {
        sessionId: snapshot.sessionId,
        model: snapshot.model,
        title: snapshot.title,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        messages: snapshot.messages,
        toolCallCount: snapshot.toolCallCount,
        queue: new TurnQueue(),
        seq: snapshot.seq,
        toolCache: new Map(),
      });
    }
  }

  /** Pre-spawn idle tool workers to eliminate cold-start latency on first tool call. */
  warmUpWorkers(count: number = 2): void {
    this.toolWorkers.warmUp(count);
  }

  private sessionToSnapshot(session: ManagedSession): SessionSnapshot {
    const writers = new Set<string>();
    for (const queued of session.queue.toArray()) {
      writers.add(queued.writerId);
    }
    if (session.activeTurn) writers.add(session.activeTurn.writerId);

    return {
      sessionId: session.sessionId,
      model: session.model,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      activeTurnId: session.activeTurn?.turnId,
      queuedTurns: session.queue.size,
      toolCallCount: session.toolCallCount,
      writerCount: writers.size,
    };
  }

  async createSession(req: CreateSessionRequest): Promise<SessionSnapshot> {
    const cfg = await this.getConfig();
    const sessionId = req.sessionId ?? nanoid(12);

    const now = new Date().toISOString();
    let existing = this.sessions.get(sessionId);
    if (!existing && (await hasSessionStore(sessionId))) {
      const snapshot = await readSessionSnapshot(sessionId);
      if (snapshot) {
        existing = {
          sessionId,
          model: snapshot.model,
          title: snapshot.title,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
          messages: snapshot.messages,
          toolCallCount: snapshot.toolCallCount,
          queue: new TurnQueue(),
          seq: snapshot.seq,
          toolCache: new Map(),
        };
      }
    }

    const session = existing ?? {
      sessionId,
      model: req.model ?? cfg.model.default,
      title: req.title,
      createdAt: now,
      updatedAt: now,
      messages: this.normalizeMessages(req.messages),
      toolCallCount: 0,
      queue: new TurnQueue(),
      seq: 0,
      toolCache: new Map(),
    };

    this.sessions.set(sessionId, session);
    await this.persistSnapshot(session);
    await this.emit(session, 'session.snapshot', {
      snapshot: this.sessionToSnapshot(session),
      messages: session.messages,
    });

    return this.sessionToSnapshot(session);
  }

  async getSession(sessionId: string): Promise<SessionSnapshot | null> {
    let session = this.sessions.get(sessionId);
    if (!session && (await hasSessionStore(sessionId))) {
      const snapshot = await readSessionSnapshot(sessionId);
      if (snapshot) {
        session = {
          sessionId,
          model: snapshot.model,
          title: snapshot.title,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
          messages: snapshot.messages,
          toolCallCount: snapshot.toolCallCount,
          queue: new TurnQueue(),
          seq: snapshot.seq,
          toolCache: new Map(),
        };
        this.sessions.set(sessionId, session);
      }
    }
    if (!session) return null;
    return this.sessionToSnapshot(session);
  }

  async getSessionMessages(sessionId: string): Promise<AgentMessage[] | null> {
    let session = this.sessions.get(sessionId);
    if (!session && (await hasSessionStore(sessionId))) {
      await this.getSession(sessionId); // hydrates it
      session = this.sessions.get(sessionId);
    }
    if (!session) return null;
    return session.messages;
  }

  async submitTurn(
    sessionId: string,
    payload: ClientSubmitTurn
  ): Promise<{ turnId: string; queued: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (payload.lastSeenSeq !== undefined && payload.lastSeenSeq < session.seq) {
      throw this.newTurnError('Session state conflict: context has been modified since last seen', 'state-conflict' as TurnErrorCode);
    }

    const turn: QueuedTurn = {
      turnId: nanoid(12),
      ingressSeq: ++this.ingressSeq,
      sessionId,
      clientId: payload.clientId,
      writerId: payload.writerId,
      content: payload.content,
      mode: payload.mode,
      metadata: payload.metadata,
      createdAt: new Date().toISOString(),
    };

    session.queue.enqueue(turn);
    session.updatedAt = new Date().toISOString();
    await this.emit(session, 'turn.queued', {
      turnId: turn.turnId,
      writerId: turn.writerId,
      clientId: turn.clientId,
      queueSize: session.queue.size,
    });
    await this.persistSnapshot(session);

    // processSessionQueue handles all its own errors internally (try/catch in
    // the loop body emits turn.error on failure).  The void here is intentional
    // — we do not await it so the HTTP response returns immediately — but we
    // attach a catch to prevent unhandled-rejection crashes if the outer async
    // scaffolding throws before reaching the internal try/catch (e.g. a config
    // load failure before getConfig() is awaited).
    void this.processSessionQueue(sessionId).catch((err) => {
      void logDaemonEvent({
        level: 'error',
        daemonId: this.daemonId,
        sessionId,
        msg: 'processSessionQueue unhandled rejection',
        data: { message: errorMessage(err) },
      });
    });
    return { turnId: turn.turnId, queued: session.queue.size };
  }

  async cancelSessionTurns(
    sessionId: string,
    opts: { turnId?: string; writerId?: string }
  ): Promise<number> {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    let cancelled = 0;
    if (opts.turnId) {
      cancelled += session.queue.cancelByTurnId(opts.turnId) ? 1 : 0;
    } else if (opts.writerId) {
      cancelled += session.queue.cancelByWriter(opts.writerId);
    }

    // Active turn cancellation: cooperative abort via AbortController.
    const active = session.activeTurn;
    if (active && session.activeAbort) {
      const matchesTurn = opts.turnId ? active.turnId === opts.turnId : false;
      const matchesWriter = opts.writerId ? active.writerId === opts.writerId : false;
      if (matchesTurn || matchesWriter) {
        session.activeAbort.abort();
        cancelled += 1;
      }
    }

    if (cancelled > 0) {
      await this.emit(session, 'session.cancelled', {
        cancelled,
        turnId: opts.turnId,
        writerId: opts.writerId,
      });
      await this.persistSnapshot(session);
    }
    return cancelled;
  }

  resolvePermission(
    sessionId: string,
    decision: PermissionDecision
  ): { ok: boolean; conflict: boolean; message?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, conflict: false, message: 'Session not found' };
    const result = this.permissionCoordinator.resolve(decision.requestId, decision.decision);
    return result;
  }

  async getEventsAfter(sessionId: string, afterSeq: number): Promise<V3Envelope[]> {
    return readSessionEventsAfter(sessionId, afterSeq);
  }

  subscribe(sessionId: string, cb: SessionSubscriber): () => void {
    const existing = this.subscribers.get(sessionId) ?? new Set<SessionSubscriber>();
    existing.add(cb);
    this.subscribers.set(sessionId, existing);
    return () => {
      const current = this.subscribers.get(sessionId);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.subscribers.delete(sessionId);
    };
  }

  getRuntimeStats(): {
    sessionCount: number;
    activeTurnCount: number;
    queuedTurnCount: number;
    subscriberCount: number;
    ingressSeq: number;
    toolWorkers: { workers: number; busy: number; queued: number };
  } {
    let activeTurnCount = 0;
    let queuedTurnCount = 0;
    for (const session of this.sessions.values()) {
      if (session.activeTurn) activeTurnCount += 1;
      queuedTurnCount += session.queue.size;
    }
    let subscriberCount = 0;
    for (const set of this.subscribers.values()) {
      subscriberCount += set.size;
    }
    return {
      sessionCount: this.sessions.size,
      activeTurnCount,
      queuedTurnCount,
      subscriberCount,
      ingressSeq: this.ingressSeq,
      toolWorkers: this.toolWorkers.getStats(),
    };
  }

  listBackgroundProcesses(sessionId?: string): BackgroundProcessSnapshot[] {
    if (sessionId && !this.sessions.has(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return this.backgroundManager.list(sessionId);
  }

  async startBackgroundProcess(input: {
    sessionId: string;
    command: string;
    label?: string;
    cwd?: string;
    timeoutMs?: number;
  }): Promise<BackgroundProcessSnapshot> {
    if (!this.sessions.has(input.sessionId)) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    await this.refreshBackgroundOptions();
    return this.backgroundManager.start(input);
  }

  getBackgroundStatus(processId: string): BackgroundProcessSnapshot | null {
    return this.backgroundManager.status(processId);
  }

  getBackgroundOutput(
    processId: string,
    query: BackgroundOutputQuery
  ): BackgroundOutputSlice | null {
    return this.backgroundManager.output(processId, query);
  }

  killBackgroundProcess(
    processId: string,
    signal: BackgroundSignal = 'SIGTERM'
  ): {
    killed: boolean;
    process: BackgroundProcessSnapshot;
  } | null {
    return this.backgroundManager.kill(processId, signal);
  }

  async close(): Promise<void> {
    clearInterval(this.evictionInterval);
    this.unsubscribeBackgroundEvents();
    const cfg = await this.getConfig().catch(() => null);
    if (cfg) {
      this.backgroundManager.updateOptions({
        maxConcurrent: cfg.background.maxConcurrent,
        defaultTimeout: cfg.background.defaultTimeout,
        maxBufferSize: cfg.background.maxBufferSize,
      });
    }
    if (cfg?.background.killOnSessionEnd ?? true) {
      this.backgroundManager.close();
    }
    this.toolWorkers.close();
  }

  private normalizeMessages(raw?: unknown[]): AgentMessage[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is AgentMessage => {
      if (!item || typeof item !== 'object') return false;
      const maybe = item as Partial<AgentMessage>;
      return typeof maybe.role === 'string';
    });
  }

  private runToolWithDaemonPolicy(
    name: string,
    argsJson: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (name === 'ask_user') {
      return Promise.resolve(
        'Error: ask_user is unavailable in daemon mode. Resolve permissions from an attached client instead.'
      );
    }
    return this.toolWorkers.runTool(name, argsJson, signal);
  }

  private async runToolWithCache(
    session: ManagedSession,
    name: string,
    argsJson: string,
    signal?: AbortSignal
  ): Promise<string> {
    // Write tools: execute then clear the entire session cache
    if (WRITE_TOOLS.has(name)) {
      const result = await this.runToolWithDaemonPolicy(name, argsJson, signal);
      session.toolCache.clear();
      return result;
    }

    if (!CACHEABLE_TOOLS.has(name)) {
      return this.runToolWithDaemonPolicy(name, argsJson, signal);
    }

    const key = `${name}:${argsJson}`;
    const now = Date.now();
    const cached = session.toolCache.get(key);

    if (cached) {
      if (MTIME_TOOLS.has(name) && cached.fileMtimeMs !== undefined) {
        // Validate by checking current mtime
        try {
          const args = JSON.parse(argsJson) as { path?: string };
          const filePath = args.path;
          if (filePath) {
            const stat = statSync(filePath, { throwIfNoEntry: false });
            if (stat && stat.mtimeMs === cached.fileMtimeMs) return cached.result;
            // Mtime changed — fall through to re-execute
            session.toolCache.delete(key);
          } else {
            return cached.result;
          }
        } catch {
          return cached.result;
        }
      } else if (now - cached.cachedAt < CACHE_TTL_MS) {
        return cached.result;
      } else {
        session.toolCache.delete(key);
      }
    }

    const result = await this.runToolWithDaemonPolicy(name, argsJson, signal);

    // All code below is synchronous (no awaits), so concurrent JS turns cannot
    // interleave here.  We evict as many entries as needed so that after
    // inserting the new one the map stays at or below CACHE_MAX_SIZE.
    const overflow = session.toolCache.size - CACHE_MAX_SIZE + 1; // +1 for the entry we are about to add
    if (overflow > 0) {
      // Collect all entries sorted oldest-first and delete the required count.
      const sorted = [...session.toolCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
      for (let i = 0; i < overflow && i < sorted.length; i++) {
        session.toolCache.delete(sorted[i]![0]);
      }
    }

    let fileMtimeMs: number | undefined;
    if (MTIME_TOOLS.has(name)) {
      try {
        const args = JSON.parse(argsJson) as { path?: string };
        if (args.path) {
          const stat = statSync(args.path, { throwIfNoEntry: false });
          if (stat) fileMtimeMs = stat.mtimeMs;
        }
      } catch {
        // Ignore stat errors; cache without mtime validation
      }
    }

    session.toolCache.set(key, { result, cachedAt: now, fileMtimeMs });
    return result;
  }

  private throwIfTurnAborted(session: ManagedSession): void {
    if (!session.activeAbort?.signal.aborted) return;
    const err = new Error('Turn cancelled');
    err.name = 'AbortError';
    throw err;
  }

  private newTurnError(message: string, code?: TurnErrorCode): CodedTurnError {
    const err = new Error(message) as CodedTurnError;
    if (code) err.turnErrorCode = code;
    return err;
  }

  private normalizeErrorCode(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const raw = (err as { code?: unknown }).code;
    return typeof raw === 'string' ? raw.toLowerCase() : undefined;
  }

  private inferTransportErrorCode(err: unknown, message: string): TurnErrorCode | undefined {
    const lower = message.toLowerCase();
    const code = this.normalizeErrorCode(err);

    if (
      code === 'econnrefused' ||
      lower.includes('econnrefused') ||
      lower.includes('connection refused')
    ) {
      return 'lmx-connection-refused';
    }

    if (
      code === 'econnreset' ||
      lower.includes('econnreset') ||
      lower.includes('websocket closed') ||
      lower.includes('socket closed') ||
      lower.includes('socket hang up') ||
      lower.includes('connection closed')
    ) {
      return 'lmx-ws-closed';
    }

    if (
      code === 'etimedout' ||
      code === 'esockettimedout' ||
      code === 'econnaborted' ||
      lower.includes('timed out') ||
      lower.includes('timeout')
    ) {
      return 'lmx-timeout';
    }

    return undefined;
  }

  private resolveTurnErrorCode(err: unknown, message: string): TurnErrorCode | undefined {
    if (err && typeof err === 'object') {
      const coded = (err as { turnErrorCode?: unknown }).turnErrorCode;
      if (
        coded === 'no-model-loaded' ||
        coded === 'lmx-ws-closed' ||
        coded === 'lmx-timeout' ||
        coded === 'lmx-connection-refused'
      ) {
        return coded;
      }
    }

    if (message.toLowerCase().includes('no model loaded')) return 'no-model-loaded';
    return this.inferTransportErrorCode(err, message);
  }

  private async runTurnModelPreflight(session: ManagedSession, config: OptaConfig): Promise<void> {
    if (config.provider.active !== 'lmx') return;

    this.throwIfTurnAborted(session);

    const targetModel = normalizeConfiguredModelId(session.model);
    let loadedModelIds: string[] = [];
    const now = Date.now();
    const cachedPreflight = this.preflightCache;
    if (cachedPreflight && now - cachedPreflight.cachedAt < PREFLIGHT_CACHE_TTL_MS) {
      loadedModelIds = cachedPreflight.modelIds;
    } else {
      try {
        const lmx = new LmxClient({
          host: config.connection.host,
          fallbackHosts: config.connection.fallbackHosts,
          port: config.connection.port,
          adminKey: config.connection.adminKey,
          timeoutMs: LMX_PREFLIGHT_TIMEOUT_MS,
          maxRetries: 0,
        });
        const loaded = await lmx.models({
          timeoutMs: LMX_PREFLIGHT_TIMEOUT_MS,
          maxRetries: 0,
        });
        loadedModelIds = loaded.models.map((model) => model.model_id);
        this.preflightCache = { modelIds: loadedModelIds, cachedAt: now };
      } catch (err) {
        this.throwIfTurnAborted(session);
        const detail = errorMessage(err);
        const code = this.inferTransportErrorCode(err, detail) ?? 'no-model-loaded';
        throw this.newTurnError(`${NO_MODEL_LOADED_MESSAGE} LMX preflight failed: ${detail}`, code);
      }
    }

    this.throwIfTurnAborted(session);
    if (loadedModelIds.length === 0) {
      throw this.newTurnError(NO_MODEL_LOADED_MESSAGE, 'no-model-loaded');
    }

    const canonicalModelId = targetModel
      ? findMatchingModelId(targetModel, loadedModelIds)
      : undefined;
    if (!canonicalModelId) {
      if (!targetModel) {
        throw this.newTurnError(
          `${NO_MODEL_LOADED_MESSAGE} Session model is not configured.`,
          'no-model-loaded'
        );
      }
      throw this.newTurnError(
        `${NO_MODEL_LOADED_MESSAGE} Session model "${session.model}" is not loaded.`,
        'no-model-loaded'
      );
    }

    if (session.model !== canonicalModelId) {
      session.model = canonicalModelId;
      session.updatedAt = new Date().toISOString();
      await this.persistSnapshot(session);
    }
  }

  private async processSessionQueue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.activeTurn) return;

    const turn = session.queue.dequeue();
    if (!turn) return;
    session.activeTurn = turn;
    session.activeAbort = new AbortController();
    session.updatedAt = new Date().toISOString();
    await this.persistSnapshot(session);

    const turnStart = Date.now();
    let firstTokenMs: number | null = null;
    let completionTokens = 0;
    let promptTokens = 0;
    let toolCalls = 0;

    try {
      const cfg = await this.getConfig();
      await this.runTurnModelPreflight(session, cfg);
      this.throwIfTurnAborted(session);

      await this.emit(session, 'turn.start', {
        turnId: turn.turnId,
        writerId: turn.writerId,
        clientId: turn.clientId,
        mode: turn.mode,
      });

      const run = await agentLoop(turn.content, cfg, {
        existingMessages: session.messages,
        sessionId,
        silent: true,
        signal: session.activeAbort.signal,
        toolExecutor: (name, argsJson, signal) =>
          this.runToolWithCache(session, name, argsJson, signal),
        onStream: {
          // NOTE: these streaming callbacks are synchronous, so emit() cannot
          // be awaited inline.  Events are fire-and-forget here; sequence
          // numbers assigned inside emit() may interleave if emit() is slow
          // (e.g. during a persistence flush under I/O pressure).  For strict
          // ordering guarantees, a serial emit queue would be required.
          onToken: (text) => {
            if (firstTokenMs === null) firstTokenMs = Date.now() - turnStart;
            completionTokens += Math.ceil(text.length / CHARS_PER_TOKEN);
            void this.emit(session, 'turn.token', { turnId: turn.turnId, text });
          },
          onThinking: (text) => {
            void this.emit(session, 'turn.thinking', { turnId: turn.turnId, text });
          },
          onToolStart: (name, id, args) => {
            toolCalls++;
            void this.emit(session, 'tool.start', { turnId: turn.turnId, name, id, args });
          },
          onToolEnd: (name, id, result) => {
            void this.emit(session, 'tool.end', { turnId: turn.turnId, name, id, result });
          },
          onUsage: (usage) => {
            promptTokens = usage.promptTokens;
          },
          onPermissionRequest: async (toolName, args) => {
            const { request, decision } = this.permissionCoordinator.request(
              sessionId,
              toolName,
              args
            );
            await this.emit(session, 'permission.request', {
              turnId: turn.turnId,
              requestId: request.requestId,
              toolName,
              args,
            });
            const resolved = await decision;
            await this.emit(session, 'permission.resolved', {
              turnId: turn.turnId,
              requestId: request.requestId,
              decision: resolved,
            });
            return resolved;
          },
        },
      });

      session.messages = run.messages;
      session.toolCallCount += run.toolCallCount;
      session.updatedAt = new Date().toISOString();

      const elapsed = (Date.now() - turnStart) / 1000;
      const payload: TurnDonePayload = {
        turnId: turn.turnId,
        writerId: turn.writerId,
        clientId: turn.clientId,
        stats: {
          tokens: completionTokens,
          promptTokens,
          completionTokens,
          toolCalls,
          elapsed,
          speed: elapsed > 0.1 ? completionTokens / elapsed : 0,
          firstTokenLatencyMs: firstTokenMs,
        },
      };
      await this.emit(session, 'turn.done', payload);
      await this.emit(session, 'session.updated', {
        snapshot: this.sessionToSnapshot(session),
      });
      await this.persistSnapshot(session);
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      const message = aborted ? 'Turn cancelled' : errorMessage(err);
      const code = aborted ? undefined : this.resolveTurnErrorCode(err, message);
      const payload: TurnErrorPayload = {
        turnId: turn.turnId,
        writerId: turn.writerId,
        clientId: turn.clientId,
        message,
      };
      if (code) {
        payload.code = code;
        if (code === 'no-model-loaded' || code === 'lmx-connection-refused' || code === 'lmx-ws-closed' || code === 'lmx-timeout') {
          this.preflightCache = null;
        }
      }

      await this.emit(session, 'turn.error', payload);
      if (!aborted) {
        await logDaemonEvent({
          level: 'error',
          daemonId: this.daemonId,
          sessionId,
          msg: 'turn processing failed',
          data: { turnId: turn.turnId, message },
        });
      }
    } finally {
      session.activeTurn = undefined;
      session.activeAbort = undefined;
      session.updatedAt = new Date().toISOString();
      await this.persistSnapshot(session);
      if (session.queue.size > 0) {
        setImmediate(() => {
          void this.processSessionQueue(sessionId);
        });
      }
    }
  }

  private async persistSnapshot(session: ManagedSession): Promise<void> {
    const stored: StoredSessionSnapshot = {
      sessionId: session.sessionId,
      model: session.model,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
      toolCallCount: session.toolCallCount,
      seq: session.seq,
    };
    await writeSessionSnapshot(stored);
  }

  private async handleBackgroundEvent(event: BackgroundManagerEvent): Promise<void> {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    if (event.type === 'output') {
      await this.emit(session, 'background.output', event.payload);
    } else {
      await this.emit(session, 'background.status', event.payload);
    }
    session.updatedAt = new Date().toISOString();
    await this.persistSnapshot(session);
  }

  private async refreshBackgroundOptions(): Promise<void> {
    const config = await this.getConfig();
    this.backgroundManager.updateOptions({
      maxConcurrent: config.background.maxConcurrent,
      defaultTimeout: config.background.defaultTimeout,
      maxBufferSize: config.background.maxBufferSize,
    });
  }

  private async emit(
    session: ManagedSession,
    event: V3Envelope['event'],
    payload: unknown
  ): Promise<void> {
    session.seq += 1;
    const envelope = makeEnvelope(
      {
        daemonId: this.daemonId,
        sessionId: session.sessionId,
        seq: session.seq,
      },
      event,
      payload
    );

    // High-frequency streaming events are delivered to live subscribers but not
    // written to disk — they are ephemeral. Reconnecting clients get the complete
    // final content from the session snapshot once the turn finishes.
    if (event !== 'turn.token' && event !== 'turn.thinking') {
      await appendSessionEvent(session.sessionId, envelope);
    }
    const watchers = this.subscribers.get(session.sessionId);
    if (watchers) {
      for (const cb of watchers) {
        try {
          cb(envelope);
        } catch {
          // Ignore subscriber errors so one bad client does not poison the session.
        }
      }
    }
  }
}
