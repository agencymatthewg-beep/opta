import { errorMessage } from '../utils/errors.js';
import { deriveBridgeAgentId, normalizeBridgeScope } from '../utils/bridge-scope.js';
import { loadConfig } from '../core/config.js';
import {
  getBridgeState,
  getBridgeWorkerSnapshot,
  markBridgeConnected,
  markBridgeDegraded,
  markBridgeUnauthorized,
} from './bridge-state.js';
import {
  executeDaemonOperation,
  type ExecuteDaemonOperationResult,
} from './operations/execute.js';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const STREAM_TIMEOUT_MS = 30_000;
const RESULT_TIMEOUT_MS = 10_000;
const FAILURE_BACKOFF_BASE_MS = 1_000;
const FAILURE_BACKOFF_MAX_MS = 8_000;
const FAILURE_DEGRADED_THRESHOLD = 3;
const IDLE_POLL_DELAY_MS = 300;

interface BridgeStreamCommand {
  id: string;
  command: string;
  payload: unknown;
  confirmDangerous?: boolean;
  scope?: string | null;
  actor?: string | null;
}

interface LmxProxyMutationPayload {
  method: 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const BRIDGE_IDENTITY_PATHS = new Set([
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/responses',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringHeaderMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'string') continue;
    const headerKey = key.trim();
    const headerValue = raw.trim();
    if (!headerKey || !headerValue) continue;
    normalized[headerKey] = headerValue;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function hasHeader(headers: Record<string, string> | undefined, targetName: string): boolean {
  if (!headers) return false;
  const lowered = targetName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lowered);
}

export function resolveBridgeScopeSeed(input: {
  scope?: string | null;
  actor?: string | null;
  bridgeSessionId?: string | null;
}): string | null {
  return (
    normalizeBridgeScope(input.scope) ??
    normalizeBridgeScope(input.actor) ??
    normalizeBridgeScope(input.bridgeSessionId) ??
    null
  );
}

function supportsScopedIdentity(path: string): boolean {
  return BRIDGE_IDENTITY_PATHS.has(path);
}

export function applyBridgeIdentityToMutation(
  payload: LmxProxyMutationPayload,
  scopeSeed: string | null
): LmxProxyMutationPayload {
  if (!scopeSeed || !supportsScopedIdentity(payload.path)) return payload;

  const bridgeAgentId = deriveBridgeAgentId(scopeSeed);
  const headers = { ...(payload.headers ?? {}) };

  if (!hasHeader(headers, 'x-client-id') && !hasHeader(headers, 'x-opta-bridge-id')) {
    headers['X-Client-ID'] = bridgeAgentId;
    headers['X-Opta-Bridge-ID'] = bridgeAgentId;
  }

  const shouldInjectUser = payload.method === 'POST' && isRecord(payload.body);
  if (!shouldInjectUser) {
    return {
      ...payload,
      headers,
    };
  }

  const currentUser = normalizeOptionalString((payload.body as Record<string, unknown>)['user']);
  if (currentUser) {
    return {
      ...payload,
      headers,
    };
  }

  return {
    ...payload,
    headers,
    body: {
      ...(payload.body as Record<string, unknown>),
      user: bridgeAgentId,
    },
  };
}

function resolveAccountsBaseUrl(): string {
  const value = process.env['OPTA_ACCOUNTS_URL']?.trim();
  if (!value) return DEFAULT_ACCOUNTS_URL;
  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_ACCOUNTS_URL;
  }
}

function normalizeCommand(input: unknown): BridgeStreamCommand | null {
  if (!isRecord(input)) return null;
  const idRaw = input.id ?? input.commandId;
  const commandRaw = input.command ?? input.operationId;
  if ((typeof idRaw !== 'string' && typeof idRaw !== 'number') || typeof commandRaw !== 'string') {
    return null;
  }

  const command = commandRaw.trim();
  if (!command) return null;

  const payload = input.payload ?? input.input ?? {};
  const confirmDangerous =
    typeof input.confirmDangerous === 'boolean' ? input.confirmDangerous : undefined;
  const scope = normalizeOptionalString(input.scope);
  const actor = normalizeOptionalString(input.actor);

  return {
    id: String(idRaw),
    command,
    payload,
    confirmDangerous,
    scope,
    actor,
  };
}

function parseLmxProxyMutationPayload(payload: unknown): LmxProxyMutationPayload | null {
  if (!isRecord(payload)) return null;
  const methodRaw = typeof payload.method === 'string' ? payload.method.trim().toUpperCase() : '';
  if (methodRaw !== 'POST' && methodRaw !== 'DELETE') return null;
  const pathRaw = typeof payload.path === 'string' ? payload.path.trim() : '';
  if (!pathRaw.startsWith('/')) return null;

  return {
    method: methodRaw,
    path: pathRaw,
    body: payload.body,
    headers: normalizeStringHeaderMap(payload.headers),
  };
}

export function applyOperationScope(command: BridgeStreamCommand, scopeSeed: string | null): unknown {
  if (command.command !== 'models.skills') return command.payload ?? {};
  if (!isRecord(command.payload)) return command.payload ?? {};
  if (normalizeBridgeScope(command.payload.scope) !== null) return command.payload;
  const scope = normalizeBridgeScope(scopeSeed);
  if (!scope) return command.payload;
  return {
    ...command.payload,
    scope,
  };
}

function deriveResultStatus(statusCode: number): 'completed' | 'failed' | 'denied' {
  if (statusCode >= 200 && statusCode < 300) return 'completed';
  if (statusCode === 401 || statusCode === 403) return 'denied';
  return 'failed';
}

function deriveResultError(result: ExecuteDaemonOperationResult): string | undefined {
  if (result.statusCode >= 200 && result.statusCode < 300) return undefined;
  const body = result.body as unknown;
  if (isRecord(body)) {
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (isRecord(body.error) && typeof body.error.message === 'string') {
      return body.error.message;
    }
  }
  return `bridge_command_failed:${result.statusCode}`;
}

function parseCommandStreamPayload(payload: unknown): BridgeStreamCommand[] {
  if (payload == null) return [];

  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeCommand(item))
      .filter((item): item is BridgeStreamCommand => item !== null);
  }

  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.commands)) {
    return payload.commands
      .map((item) => normalizeCommand(item))
      .filter((item): item is BridgeStreamCommand => item !== null);
  }

  if (isRecord(payload.command)) {
    const command = normalizeCommand(payload.command);
    return command ? [command] : [];
  }

  if (payload.command === null) return [];

  const single = normalizeCommand(payload);
  return single ? [single] : [];
}

class BridgeUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeUnauthorizedError';
  }
}

async function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class BridgeOutboundWorker {
  private readonly fetchImpl: typeof fetch;
  private readonly accountsBaseUrl: string;
  private active:
    | {
        connectionId: string;
        controller: AbortController;
        done: Promise<void>;
      }
    | null = null;
  private closed = false;

  constructor(options?: { fetchImpl?: typeof fetch; accountsBaseUrl?: string }) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.accountsBaseUrl = options?.accountsBaseUrl ?? resolveAccountsBaseUrl();
  }

  start(): void {
    if (this.closed) return;

    const snapshot = getBridgeWorkerSnapshot();
    if (!snapshot || snapshot.status === 'offline') {
      this.stop();
      return;
    }

    if (!snapshot.bridgeToken) {
      markBridgeDegraded('bridge_worker_missing_token');
      this.stop();
      return;
    }

    if (this.active?.connectionId === snapshot.connectionId) return;

    this.stop();
    const controller = new AbortController();
    const done = this.runLoop(snapshot.connectionId, controller.signal)
      .catch(() => undefined)
      .finally(() => {
        if (this.active?.connectionId === snapshot.connectionId) {
          this.active = null;
        }
      });
    this.active = {
      connectionId: snapshot.connectionId,
      controller,
      done,
    };
  }

  stop(): void {
    if (!this.active) return;
    this.active.controller.abort();
    this.active = null;
  }

  async close(): Promise<void> {
    this.closed = true;
    const active = this.active;
    this.active = null;
    if (!active) return;
    active.controller.abort();
    await active.done;
  }

  private async runLoop(connectionId: string, signal: AbortSignal): Promise<void> {
    let consecutiveFailures = 0;

    while (!signal.aborted) {
      const snapshot = getBridgeWorkerSnapshot();
      if (!snapshot || snapshot.connectionId !== connectionId || snapshot.status === 'offline') {
        return;
      }

      if (!snapshot.bridgeToken) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= FAILURE_DEGRADED_THRESHOLD) {
          markBridgeDegraded('bridge_worker_missing_token');
        }
        await waitWithAbort(this.failureBackoffMs(consecutiveFailures), signal);
        continue;
      }

      try {
        const commands = await this.pollCommandStream({
          deviceId: snapshot.deviceId,
          bridgeToken: snapshot.bridgeToken,
          signal,
        });

        for (const command of commands) {
          const current = getBridgeWorkerSnapshot();
          if (
            !current ||
            current.connectionId !== connectionId ||
            current.status === 'offline' ||
            signal.aborted
          ) {
            return;
          }
          await this.processCommand(
            command,
            current.deviceId,
            current.bridgeToken,
            current.sessionId,
            signal
          );
        }

        consecutiveFailures = 0;
        const state = getBridgeState();
        if (state.status === 'degraded' || state.status === 'unauthorized') {
          markBridgeConnected();
        }

        if (commands.length === 0) {
          await waitWithAbort(IDLE_POLL_DELAY_MS, signal);
        }
      } catch (err) {
        if (signal.aborted) return;
        consecutiveFailures += 1;

        if (err instanceof BridgeUnauthorizedError) {
          markBridgeUnauthorized(err.message);
        } else if (consecutiveFailures >= FAILURE_DEGRADED_THRESHOLD) {
          markBridgeDegraded(`bridge_worker:${errorMessage(err)}`);
        }

        await waitWithAbort(this.failureBackoffMs(consecutiveFailures), signal);
      }
    }
  }

  private failureBackoffMs(consecutiveFailures: number): number {
    const exponent = Math.max(consecutiveFailures - 1, 0);
    return Math.min(FAILURE_BACKOFF_BASE_MS * 2 ** exponent, FAILURE_BACKOFF_MAX_MS);
  }

  private async processCommand(
    command: BridgeStreamCommand,
    deviceId: string,
    bridgeToken: string | null,
    bridgeSessionId: string | null,
    signal: AbortSignal
  ): Promise<void> {
    if (!bridgeToken) {
      throw new Error('Bridge token unavailable while processing command');
    }

    const scopeSeed = resolveBridgeScopeSeed({
      scope: command.scope,
      actor: command.actor,
      bridgeSessionId,
    });
    const lmxProxyPayload = parseLmxProxyMutationPayload(command.payload);
    const scopedLmxProxyPayload = lmxProxyPayload
      ? applyBridgeIdentityToMutation(lmxProxyPayload, scopeSeed)
      : null;
    const result = lmxProxyPayload
      ? await this.executeLmxProxyMutation(scopedLmxProxyPayload ?? lmxProxyPayload, signal)
      : await executeDaemonOperation({
          id: command.command as never,
          input: applyOperationScope(command, scopeSeed),
          confirmDangerous: command.confirmDangerous,
        });

    await this.postCommandResult({
      command,
      deviceId,
      result,
      bridgeToken,
      signal,
    });
  }

  private async pollCommandStream(input: {
    deviceId: string;
    bridgeToken: string;
    signal: AbortSignal;
  }): Promise<BridgeStreamCommand[]> {
    const endpoint = new URL('/api/device-commands/stream', this.accountsBaseUrl);
    endpoint.searchParams.set('deviceId', input.deviceId);

    const response = await this.fetchWithTimeout(
      endpoint.toString(),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.bridgeToken}`,
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
      },
      STREAM_TIMEOUT_MS,
      input.signal
    );

    if (response.status === 204) {
      return [];
    }

    if (response.status === 401 || response.status === 403) {
      throw new BridgeUnauthorizedError(`Bridge stream rejected token (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(`Bridge stream request failed (${response.status})`);
    }

    const payload = await response.json().catch(() => null);
    return parseCommandStreamPayload(payload);
  }

  private async postCommandResult(input: {
    command: BridgeStreamCommand;
    deviceId: string;
    result: ExecuteDaemonOperationResult;
    bridgeToken: string;
    signal: AbortSignal;
  }): Promise<void> {
    const endpoint = new URL(
      `/api/device-commands/${encodeURIComponent(input.command.id)}/result`,
      this.accountsBaseUrl
    );

    const response = await this.fetchWithTimeout(
      endpoint.toString(),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.bridgeToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: input.deviceId,
          status: deriveResultStatus(input.result.statusCode),
          result: input.result.body,
          error: deriveResultError(input.result),
        }),
      },
      RESULT_TIMEOUT_MS,
      input.signal
    );

    if (response.status === 401 || response.status === 403) {
      throw new BridgeUnauthorizedError(`Bridge result rejected token (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(`Bridge result request failed (${response.status})`);
    }
  }

  private async executeLmxProxyMutation(
    payload: LmxProxyMutationPayload,
    signal: AbortSignal
  ): Promise<ExecuteDaemonOperationResult> {
    const config = await loadConfig();
    const host = config.connection.host.trim() || '127.0.0.1';
    const base = `http://${host}:${config.connection.port}`;
    const endpoint = new URL(payload.path, base);
    const adminKey = config.connection.adminKeysByHost?.[host] ?? config.connection.adminKey;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(payload.headers ?? {}),
    };
    if (payload.method === 'POST') {
      if (!hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
    if (
      adminKey
      && (payload.path.startsWith('/admin') || payload.path.startsWith('/v1') || payload.path.startsWith('/mcp'))
    ) {
      headers['X-Admin-Key'] = adminKey;
    }

    const response = await this.fetchWithTimeout(
      endpoint.toString(),
      {
        method: payload.method,
        headers,
        body:
          payload.method === 'POST' && payload.body !== undefined
            ? JSON.stringify(payload.body)
            : undefined,
      },
      STREAM_TIMEOUT_MS,
      signal
    );

    const text = await response.text();
    let parsed: unknown = {};
    if (text.trim().length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }

    return {
      statusCode: response.status,
      body: (isRecord(parsed) ? parsed : { value: parsed }) as ExecuteDaemonOperationResult['body'],
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timeout.unref === 'function') timeout.unref();

    const onAbort = () => controller.abort();
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    }
  }
}
