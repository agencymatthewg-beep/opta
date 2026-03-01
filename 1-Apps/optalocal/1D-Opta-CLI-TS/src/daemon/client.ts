import WebSocket, { type RawData } from 'ws';
import { ensureDaemonRunning } from './lifecycle.js';
import {
  expectedDaemonContract,
  type DaemonHealthLike,
  validateDaemonContract,
} from './contract.js';
import type {
  ClientSubmitTurn,
  CreateSessionRequest,
  PermissionDecision,
  SessionSnapshot,
  V3Envelope,
} from '../protocol/v3/types.js';

interface SessionDetail extends SessionSnapshot {
  messages: Array<{ role: string; content?: unknown }>;
}

interface LegacyChatStats {
  toolCalls?: number;
}

interface LegacyChatResponse {
  session_id: string;
  response: string;
  stats?: LegacyChatStats;
  model?: string;
}

export interface DaemonHealthResponse {
  status: string;
  version?: string;
  daemonId?: string;
  contract: {
    name: string;
    version: number;
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseDaemonHealth(data: unknown): DaemonHealthResponse {
  const object = asObject(data);
  if (!object) {
    throw new Error('Daemon health response was not an object.');
  }

  const status = object['status'];
  if (typeof status !== 'string' || status.length === 0) {
    throw new Error('Daemon health response missing required `status` string.');
  }

  const versionRaw = object['version'];
  const daemonIdRaw = object['daemonId'];
  const contractRaw = asObject(object['contract']);

  const parsed: DaemonHealthResponse = {
    status,
    contract: {
      name: typeof contractRaw?.['name'] === 'string' ? contractRaw.name : '',
      version: typeof contractRaw?.['version'] === 'number' ? contractRaw.version : NaN,
    },
  };

  if (typeof versionRaw === 'string') parsed.version = versionRaw;
  if (typeof daemonIdRaw === 'string') parsed.daemonId = daemonIdRaw;

  return parsed;
}

function contractMismatchErrorMessage(health: DaemonHealthLike): string {
  const mismatch = validateDaemonContract(health);
  if (!mismatch) return '';

  const daemonHint = typeof health.daemonId === 'string' ? ` daemonId=${health.daemonId}` : '';
  const actualName =
    mismatch.actual.name === undefined ? 'missing' : JSON.stringify(mismatch.actual.name);
  const actualVersion =
    mismatch.actual.version === undefined ? 'missing' : JSON.stringify(mismatch.actual.version);

  return [
    `Daemon/API contract mismatch.${daemonHint}`,
    `Expected ${mismatch.expected.name}@${mismatch.expected.version}.`,
    `Got name=${actualName} version=${actualVersion}.`,
    'Upgrade/restart the daemon (`opta daemon restart`) or upgrade this CLI so both sides share the same contract.',
  ].join(' ');
}

export class DaemonClient {
  constructor(
    readonly host: string,
    readonly port: number,
    readonly token: string
  ) {}

  static async connect(opts?: { host?: string; port?: number }): Promise<DaemonClient> {
    const state = await ensureDaemonRunning(opts);
    const client = new DaemonClient(state.host, state.port, state.token);

    const health = await client.health();
    const mismatchMessage = contractMismatchErrorMessage(health);
    if (mismatchMessage) {
      throw new Error(mismatchMessage);
    }

    return client;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `http://${this.host}:${this.port}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`Daemon request failed (${res.status}): ${msg || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async health(): Promise<DaemonHealthResponse> {
    const health = parseDaemonHealth(await this.request<unknown>('/v3/health'));

    if (!Number.isFinite(health.contract.version) || !health.contract.name) {
      const expected = expectedDaemonContract();
      const daemonHint = health.daemonId ? ` daemonId=${health.daemonId}` : '';
      throw new Error(
        `Daemon health response missing contract metadata.${daemonHint} Expected ${expected.name}@${expected.version}. ` +
          'Restart or upgrade daemon/CLI to a compatible version.'
      );
    }

    return health;
  }

  async createSession(req: CreateSessionRequest): Promise<SessionSnapshot> {
    return this.request('/v3/sessions', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}`);
  }

  async submitTurn(
    sessionId: string,
    payload: ClientSubmitTurn
  ): Promise<{ turnId: string; queued: number }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancel(
    sessionId: string,
    payload: { turnId?: string; writerId?: string }
  ): Promise<{ cancelled: number }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resolvePermission(
    sessionId: string,
    payload: PermissionDecision
  ): Promise<{ ok: boolean; conflict: boolean; message?: string }> {
    return this.request(
      `/v3/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(payload.requestId)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async events(sessionId: string, afterSeq: number): Promise<{ events: V3Envelope[] }> {
    return this.request(
      `/v3/sessions/${encodeURIComponent(sessionId)}/events?afterSeq=${afterSeq}`
    );
  }

  async legacyChat(message: string, sessionId?: string): Promise<LegacyChatResponse> {
    const session = await this.createSession({ sessionId });
    const { turnId } = await this.submitTurn(session.sessionId, {
      clientId: 'legacy-http',
      writerId: 'legacy-http',
      content: message,
      mode: 'do',
    });

    return new Promise((resolve, reject) => {
      const { socket, close } = this.connectWebSocket(session.sessionId, 0, {
        onEvent: (event) => {
          if (event.event === 'turn.done') {
            const payload = event.payload as { turnId?: string; stats?: LegacyChatStats };
            if (payload.turnId === turnId) {
              close();
              this.getSession(session.sessionId)
                .then((detail) => {
                  const assistantMsgs = detail.messages.filter((m) => m.role === 'assistant');
                  const last = assistantMsgs[assistantMsgs.length - 1];
                  const text = typeof last?.content === 'string' ? last.content : '';
                  resolve({
                    session_id: session.sessionId,
                    response: text,
                    stats: payload.stats,
                    model: detail.model,
                  });
                })
                .catch(reject);
            }
          } else if (event.event === 'turn.error') {
            const payload = event.payload as { turnId?: string; message?: string };
            if (payload.turnId === turnId) {
              close();
              reject(new Error(payload.message ?? 'Turn failed'));
            }
          }
        },
        onError: (err) => {
          close();
          reject(err);
        },
      });
    });
  }

  connectWebSocket(
    sessionId: string,
    afterSeq: number,
    handlers: {
      onEvent: (event: V3Envelope) => void;
      onError?: (err: Error) => void;
      onOpen?: () => void;
      onClose?: () => void;
    }
  ): { socket: WebSocket; close: () => void } {
    const wsUrl = `ws://${this.host}:${this.port}/v3/ws?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}`;
    const socket = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    socket.on('open', () => {
      handlers.onOpen?.();
    });
    socket.on('close', () => {
      handlers.onClose?.();
    });
    socket.on('error', (err: Error) => {
      handlers.onError?.(err);
    });
    socket.on('message', (data: RawData) => {
      try {
        const decoded: unknown = JSON.parse(
          Buffer.isBuffer(data)
            ? data.toString()
            : Array.isArray(data)
              ? Buffer.concat(data).toString()
              : Buffer.from(data).toString()
        );
        if (typeof decoded !== 'object' || !decoded || !('event' in decoded)) return;
        handlers.onEvent(decoded as V3Envelope);
      } catch {
        // Ignore malformed events.
      }
    });

    return {
      socket,
      close: () => {
        if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) {
          socket.close();
        }
      },
    };
  }
}
