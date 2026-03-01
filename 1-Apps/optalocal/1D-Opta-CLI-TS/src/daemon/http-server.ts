import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import { VERSION } from '../core/version.js';
import {
  BackgroundKillHttpSchema,
  BackgroundListQuerySchema,
  BackgroundOutputQuerySchema,
  BackgroundProcessParamsSchema,
  BackgroundStartHttpSchema,
  BackgroundStatusQuerySchema,
  CreateSessionHttpSchema,
  EventsQuerySchema,
  PermissionDecisionHttpSchema,
  PermissionParamsSchema,
  SessionParamsSchema,
  SubmitTurnHttpSchema,
} from '../protocol/v3/http.js';
import { OperationExecuteBodySchema, OperationParamsSchema } from '../protocol/v3/operations.js';
import type { V3Envelope } from '../protocol/v3/types.js';
import type { SessionManager } from './session-manager.js';
import { registerWsServer } from './ws-server.js';
import { writeDaemonState, type DaemonState } from './lifecycle.js';
import { daemonLogsPath } from './telemetry.js';
import { expectedDaemonContract } from './contract.js';
import { isStorageRelatedError } from '../utils/disk.js';
import { errorMessage } from '../utils/errors.js';
import { loadConfig } from '../core/config.js';
import { LmxClient } from '../lmx/client.js';
import { executeDaemonOperation, listDaemonOperationsResponse } from './operations/execute.js';

export interface HttpServerOptions {
  daemonId: string;
  host: string;
  port: number;
  token: string;
  sessionManager: SessionManager;
  listen?: boolean;
}

export interface RunningHttpServer {
  app: FastifyInstance;
  host: string;
  port: number;
  close: () => Promise<void>;
}

const LOOPBACK_ORIGIN_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS = 'Authorization,Content-Type';

function readBearer(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  return trimmed.slice(7).trim() || null;
}

function tokenEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      // Pad both to the same length so the comparison work is proportional to
      // max(len(a), len(b)) rather than leaking the expected token length via
      // a fast early return.  timingSafeEqual requires equal-length buffers.
      const maxLen = Math.max(aBuf.length, bBuf.length);
      const padA = Buffer.alloc(maxLen, 0);
      const padB = Buffer.alloc(maxLen, 0);
      aBuf.copy(padA);
      bBuf.copy(padB);
      timingSafeEqual(padA, padB); // always false after padding, but work is done
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function isAuthorized(req: FastifyRequest, expectedToken: string): boolean {
  const fromHeader = readBearer(req);
  if (fromHeader !== null && tokenEqual(fromHeader, expectedToken)) return true;
  const query = req.query as { token?: string } | undefined;
  return query?.token !== undefined && tokenEqual(query.token, expectedToken);
}

function rejectUnauthorized(reply: FastifyReply): FastifyReply {
  return reply.status(401).send({ error: 'Unauthorized' });
}

function appendVaryOrigin(reply: FastifyReply): void {
  const existing = reply.getHeader('vary');
  if (typeof existing !== 'string' || existing.trim() === '') {
    reply.header('Vary', 'Origin');
    return;
  }
  const parts = existing
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.includes('origin')) {
    reply.header('Vary', `${existing}, Origin`);
  }
}

function applyLoopbackCorsHeaders(req: FastifyRequest, reply: FastifyReply): void {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !LOOPBACK_ORIGIN_RE.test(origin)) return;
  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  reply.header('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  appendVaryOrigin(reply);
}

function mapMutationError(err: unknown): { status: number; message: string } {
  const message = errorMessage(err);
  if (/Session not found/i.test(message)) {
    return { status: 404, message };
  }
  if (/Session state conflict/i.test(message)) {
    return { status: 409, message };
  }
  if (isStorageRelatedError(err)) {
    return { status: 507, message };
  }
  return { status: 500, message };
}

async function waitForTurnDone(
  sessionManager: SessionManager,
  sessionId: string,
  turnId: string,
  timeoutMs = 600_000
): Promise<{ stats: unknown; message: string }> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      unsubscribe();
      reject(new Error(`Timed out waiting for turn ${turnId}`));
    }, timeoutMs);
    timeout.unref();

    const unsubscribe = sessionManager.subscribe(sessionId, (event) => {
      if (done) return;
      if (event.event === 'turn.done') {
        const payload = event.payload as { turnId?: string; stats?: unknown };
        if (payload.turnId !== turnId) return;
        done = true;
        clearTimeout(timeout);
        unsubscribe();
        sessionManager
          .getSessionMessages(sessionId)
          .then((messages) => {
            const assistantMsgs = (messages ?? []).filter((m) => m.role === 'assistant');
            const last = assistantMsgs[assistantMsgs.length - 1];
            const text = typeof last?.content === 'string' ? last.content : '';
            resolve({ stats: payload.stats, message: text });
          })
          .catch((err: unknown) => {
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      }
      if (event.event === 'turn.error') {
        const payload = event.payload as { turnId?: string; message?: string };
        if (payload.turnId !== turnId) return;
        done = true;
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error(payload.message ?? 'Turn failed'));
      }
    });
  });
}

function registerHttpRoutes(app: FastifyInstance, opts: HttpServerOptions): void {
  app.get('/health', () => ({
    status: 'ok',
    version: VERSION,
    daemon: true,
  }));

  app.get('/v3/health', (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    return {
      status: 'ok',
      version: VERSION,
      daemonId: opts.daemonId,
      contract: expectedDaemonContract(),
      runtime: opts.sessionManager.getRuntimeStats(),
    };
  });

  app.get('/v3/metrics', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const runtime = opts.sessionManager.getRuntimeStats();
    return {
      daemonId: opts.daemonId,
      runtime,
      ts: new Date().toISOString(),
    };
  });

  app.get('/v3/operations', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    return listDaemonOperationsResponse();
  });

  app.post('/v3/operations/:id', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = OperationParamsSchema.safeParse(req.params);
    if (!params.success)
      return reply
        .status(400)
        .send({ error: 'Invalid operation id', details: params.error.issues });

    const body = OperationExecuteBodySchema.safeParse(req.body ?? {});
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues });

    const result = await executeDaemonOperation({
      id: params.data.id,
      input: body.data.input,
      confirmDangerous: body.data.confirmDangerous,
    });
    return reply.status(result.statusCode).send(result.body);
  });

  app.get('/v3/lmx/status', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const status = await lmx.status();
    return status;
  });

  app.get('/v3/lmx/models', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const models = await lmx.models();
    return models;
  });

  app.get('/v3/lmx/memory', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const memory = await lmx.memory();
    return memory;
  });

  app.get('/v3/lmx/models/available', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const available = await lmx.available();
    return available;
  });

  app.post('/v3/lmx/models/load', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const body = req.body as
      | { modelId?: string; backend?: string; autoDownload?: boolean }
      | undefined;
    if (!body?.modelId || !body.modelId.trim()) {
      return reply.status(400).send({ error: 'Missing modelId' });
    }

    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const result = await lmx.loadModel(body.modelId, {
      backend: body.backend,
      autoDownload: body.autoDownload,
    });
    return result;
  });

  app.post('/v3/lmx/models/unload', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const body = req.body as { modelId?: string } | undefined;
    if (!body?.modelId || !body.modelId.trim()) {
      return reply.status(400).send({ error: 'Missing modelId' });
    }

    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const result = await lmx.unloadModel(body.modelId);
    return result;
  });

  app.delete('/v3/lmx/models/:modelId', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = req.params as { modelId?: string };
    if (!params.modelId || !params.modelId.trim()) {
      return reply.status(400).send({ error: 'Missing modelId' });
    }

    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const result = await lmx.deleteModel(params.modelId);
    return result;
  });

  app.post('/v3/lmx/models/download', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const body = req.body as { repoId?: string } | undefined;
    if (!body?.repoId || !body.repoId.trim()) {
      return reply.status(400).send({ error: 'Missing repoId' });
    }

    const config = await loadConfig();
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
    });
    const result = await lmx.downloadModel(body.repoId);
    return {
      download_id: result.downloadId,
      repo_id: result.repoId,
      status: result.status,
    };
  });

  app.post('/v3/sessions', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const parsed = CreateSessionHttpSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    const snapshot = await opts.sessionManager.createSession(parsed.data);
    return reply.status(201).send(snapshot);
  });

  app.get('/v3/sessions/:sessionId', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const parsed = SessionParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid session id' });

    const snapshot = await opts.sessionManager.getSession(parsed.data.sessionId);
    if (!snapshot) return reply.status(404).send({ error: 'Session not found' });
    const messages = await opts.sessionManager.getSessionMessages(parsed.data.sessionId);
    return { ...snapshot, messages: messages ?? [] };
  });

  app.post('/v3/sessions/:sessionId/turns', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = SessionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid session id' });
    const body = SubmitTurnHttpSchema.safeParse(req.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues });
    }

    try {
      const queued = await opts.sessionManager.submitTurn(params.data.sessionId, body.data);
      return await reply.status(202).send(queued);
    } catch (err) {
      const mapped = mapMutationError(err);
      return reply.status(mapped.status).send({ error: mapped.message });
    }
  });

  app.post('/v3/sessions/:sessionId/cancel', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = SessionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid session id' });
    const body = req.body as { turnId?: string; writerId?: string } | undefined;
    const cancelled = await opts.sessionManager.cancelSessionTurns(params.data.sessionId, {
      turnId: body?.turnId,
      writerId: body?.writerId,
    });
    return { cancelled };
  });

  app.post('/v3/sessions/:sessionId/permissions/:requestId', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = PermissionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid params' });
    const body = PermissionDecisionHttpSchema.safeParse(req.body ?? {});
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid body', details: body.error.issues });

    const result = opts.sessionManager.resolvePermission(params.data.sessionId, body.data);
    if (!result.ok && result.conflict) {
      return reply.status(409).send(result);
    }
    if (!result.ok) {
      return reply.status(404).send(result);
    }
    return result;
  });

  app.get('/v3/sessions/:sessionId/events', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = SessionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid session id' });
    const query = EventsQuerySchema.safeParse(req.query ?? {});
    if (!query.success) return reply.status(400).send({ error: 'Invalid query' });
    const events = await opts.sessionManager.getEventsAfter(
      params.data.sessionId,
      query.data.afterSeq
    );
    return { events };
  });

  app.get('/v3/background', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const query = BackgroundListQuerySchema.safeParse(req.query ?? {});
    if (!query.success)
      return reply.status(400).send({ error: 'Invalid query', details: query.error.issues });

    try {
      const processes = opts.sessionManager.listBackgroundProcesses(query.data.sessionId);
      return { processes };
    } catch (err) {
      const message = errorMessage(err);
      if (/Session not found/i.test(message)) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/v3/background/start', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const body = BackgroundStartHttpSchema.safeParse(req.body ?? {});
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid body', details: body.error.issues });

    try {
      const process = await opts.sessionManager.startBackgroundProcess(body.data);
      return await reply.status(201).send({ process });
    } catch (err) {
      const message = errorMessage(err);
      if (/Session not found/i.test(message)) {
        return reply.status(404).send({ error: message });
      }
      if (/Max concurrent processes/i.test(message)) {
        return reply.status(409).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  app.get('/v3/background/:processId/status', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = BackgroundProcessParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid process id' });
    const query = BackgroundStatusQuerySchema.safeParse(req.query ?? {});
    if (!query.success)
      return reply.status(400).send({ error: 'Invalid query', details: query.error.issues });

    const process = opts.sessionManager.getBackgroundStatus(params.data.processId);
    if (!process) return reply.status(404).send({ error: 'Background process not found' });
    if (query.data.sessionId && process.sessionId !== query.data.sessionId) {
      return reply.status(404).send({ error: 'Background process not found' });
    }
    return { process };
  });

  app.get('/v3/background/:processId/output', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = BackgroundProcessParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid process id' });
    const query = BackgroundOutputQuerySchema.safeParse(req.query ?? {});
    if (!query.success)
      return reply.status(400).send({ error: 'Invalid query', details: query.error.issues });

    const output = opts.sessionManager.getBackgroundOutput(params.data.processId, query.data);
    if (!output) return reply.status(404).send({ error: 'Background process not found' });
    return output;
  });

  app.post('/v3/background/:processId/kill', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const params = BackgroundProcessParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid process id' });
    const body = BackgroundKillHttpSchema.safeParse(req.body ?? {});
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid body', details: body.error.issues });

    const result = opts.sessionManager.killBackgroundProcess(
      params.data.processId,
      body.data.signal
    );
    if (!result) return reply.status(404).send({ error: 'Background process not found' });
    return result;
  });

  app.get('/v3/sse/events', async (req, reply) => {
    if (!isAuthorized(req, opts.token)) return rejectUnauthorized(reply);
    const query = req.query as { sessionId?: string; afterSeq?: string };
    const sessionId = query.sessionId;
    if (!sessionId) {
      return reply.status(400).send({ error: 'Missing sessionId query param' });
    }
    const afterSeq = Number.parseInt(query.afterSeq ?? '0', 10);
    const safeAfter = Number.isFinite(afterSeq) ? afterSeq : 0;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.write(': connected\n\n');

    let cursorSeq = safeAfter;
    let replaying = true;
    const bufferedLive: V3Envelope[] = [];

    const writeEvent = (event: V3Envelope) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const flushBufferedLive = () => {
      if (bufferedLive.length === 0) return;
      bufferedLive.sort((a, b) => a.seq - b.seq);
      for (const event of bufferedLive) {
        if (event.seq <= cursorSeq) continue;
        cursorSeq = event.seq;
        writeEvent(event);
      }
      bufferedLive.length = 0;
    };

    const unsubscribe = opts.sessionManager.subscribe(sessionId, (event) => {
      if (event.seq <= cursorSeq) return;
      if (replaying) {
        bufferedLive.push(event);
        return;
      }
      cursorSeq = event.seq;
      writeEvent(event);
    });

    try {
      const history = await opts.sessionManager.getEventsAfter(sessionId, safeAfter);
      history.sort((a, b) => a.seq - b.seq);
      for (const event of history) {
        if (event.seq <= cursorSeq) continue;
        cursorSeq = event.seq;
        writeEvent(event);
      }
    } finally {
      replaying = false;
      flushBufferedLive();
    }

    const heartbeat = setInterval(() => {
      if (!reply.raw.writable || reply.raw.destroyed) {
        clearInterval(heartbeat);
        return;
      }
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 15_000);
    heartbeat.unref();

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  });

  // Legacy compatibility endpoint for existing scripts has been removed (was /v1/chat).
}

async function listenWithPortFallback(
  app: FastifyInstance,
  host: string,
  preferredPort: number
): Promise<number> {
  const candidates = [preferredPort, ...Array.from({ length: 21 }, (_, idx) => 10_000 + idx)];
  const occupied: number[] = [];
  for (const candidate of candidates) {
    try {
      await app.listen({ host, port: candidate });
      return candidate;
    } catch (err) {
      const msg = errorMessage(err);
      if (!/EADDRINUSE/i.test(msg)) throw err;
      occupied.push(candidate);
    }
  }
  throw new Error(`No available daemon port found (occupied: ${occupied.join(', ')})`);
}

export async function startHttpServer(opts: HttpServerOptions): Promise<RunningHttpServer> {
  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  app.addHook('onRequest', (req, reply, done) => {
    applyLoopbackCorsHeaders(req, reply);
    if (req.method.toUpperCase() === 'OPTIONS') {
      reply.status(204).send();
      return;
    }
    done();
  });

  await app.register(websocket);
  registerHttpRoutes(app, opts);
  registerWsServer(app, {
    sessionManager: opts.sessionManager,
    token: opts.token,
  });

  const shouldListen = opts.listen ?? true;
  const boundPort = shouldListen
    ? await listenWithPortFallback(app, opts.host, opts.port)
    : opts.port;

  if (shouldListen) {
    const state: DaemonState = {
      pid: process.pid,
      daemonId: opts.daemonId,
      host: opts.host,
      port: boundPort,
      token: opts.token,
      startedAt: new Date().toISOString(),
      logsPath: daemonLogsPath(),
    };
    await writeDaemonState(state);
  } else {
    await app.ready();
  }

  return {
    app,
    host: opts.host,
    port: boundPort,
    close: async () => {
      await app.close();
    },
  };
}
