import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { WsInboundSchema } from '../protocol/v3/ws.js';
import type { V3Envelope } from '../protocol/v3/types.js';
import type { SessionManager } from './session-manager.js';

export interface WsServerDeps {
  sessionManager: SessionManager;
  token: string;
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  return trimmed.slice(7).trim() || null;
}

function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

export async function registerWsServer(app: FastifyInstance, deps: WsServerDeps): Promise<void> {
  app.get('/v3/ws', { websocket: true }, (socket, req) => {
    const query = req.query as { sessionId?: string; afterSeq?: string; token?: string };
    const bearer = readBearer(req.headers.authorization);
    const token = bearer ?? query.token;
    if (!token || token !== deps.token) {
      sendJson(socket, { error: 'Unauthorized' });
      socket.close(4001, 'unauthorized');
      return;
    }

    const sessionId = query.sessionId;
    const afterSeq = Number.parseInt(query.afterSeq ?? '0', 10);
    if (!sessionId) {
      sendJson(socket, { error: 'Missing sessionId query parameter' });
      socket.close(4000, 'missing sessionId');
      return;
    }

    const startAfterSeq = Number.isFinite(afterSeq) ? afterSeq : 0;
    let cursorSeq = startAfterSeq;
    let replaying = true;
    const bufferedLive: V3Envelope[] = [];

    const flushBufferedLive = () => {
      if (bufferedLive.length === 0) return;
      bufferedLive.sort((a, b) => a.seq - b.seq);
      for (const event of bufferedLive) {
        if (event.seq <= cursorSeq) continue;
        cursorSeq = event.seq;
        sendJson(socket, event);
      }
      bufferedLive.length = 0;
    };

    const unsubscribe = deps.sessionManager.subscribe(sessionId, (event) => {
      if (event.seq <= cursorSeq) return;
      if (replaying) {
        bufferedLive.push(event);
        return;
      }
      cursorSeq = event.seq;
      sendJson(socket, event);
    });

    void deps.sessionManager.getEventsAfter(sessionId, startAfterSeq).then((events) => {
      events.sort((a, b) => a.seq - b.seq);
      for (const event of events) {
        if (event.seq <= cursorSeq) continue;
        cursorSeq = event.seq;
        sendJson(socket, event);
      }
    }).catch((err: unknown) => {
      // Notify client that replay was incomplete so it can reconnect if needed.
      const message = err instanceof Error ? err.message : String(err);
      sendJson(socket, { error: 'Event replay failed', message, afterSeq: startAfterSeq });
    }).finally(() => {
      replaying = false;
      flushBufferedLive();
    });

    socket.on('message', (message: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message));
      } catch {
        sendJson(socket, { error: 'Invalid JSON payload' });
        return;
      }

      const decoded = WsInboundSchema.safeParse(parsed);
      if (!decoded.success) {
        sendJson(socket, { error: 'Invalid WS payload', details: decoded.error.issues });
        return;
      }

      const inbound = decoded.data;
      if (inbound.type === 'turn.submit') {
        void deps.sessionManager.submitTurn(inbound.sessionId, {
          clientId: inbound.clientId,
          writerId: inbound.writerId,
          content: inbound.content,
          mode: inbound.mode,
          metadata: inbound.metadata,
        }).then((queued) => {
          sendJson(socket, { type: 'ack', action: 'turn.submit', ...queued });
        }).catch((err: unknown) => {
          sendJson(socket, { error: err instanceof Error ? err.message : String(err) });
        });
        return;
      }

      if (inbound.type === 'permission.resolve') {
        const result = deps.sessionManager.resolvePermission(inbound.sessionId, {
          requestId: inbound.requestId,
          decision: inbound.decision,
          decidedBy: inbound.decidedBy,
        });
        sendJson(socket, { type: 'ack', action: 'permission.resolve', result });
        return;
      }

      if (inbound.type === 'turn.cancel') {
        void deps.sessionManager.cancelSessionTurns(inbound.sessionId, {
          turnId: inbound.turnId,
          writerId: inbound.writerId,
        }).then((cancelled) => {
          sendJson(socket, { type: 'ack', action: 'turn.cancel', cancelled });
        }).catch((err: unknown) => {
          sendJson(socket, { error: err instanceof Error ? err.message : String(err) });
        });
      }
    });

    socket.on('close', () => {
      unsubscribe();
    });
    socket.on('error', () => {
      unsubscribe();
    });
  });
}
