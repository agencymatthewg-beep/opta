import WebSocket, { type RawData } from 'ws';
import type {
  V3Envelope,
} from '@opta/protocol-shared';
import type {
  DaemonConnectionOptions,
  DaemonWsCancelPayload,
  DaemonWsConnectOptions,
  DaemonWsHandlers,
  DaemonWsHelloPayload,
  DaemonWsMessage,
  DaemonWsResolvePermissionPayload,
  DaemonWsServerMessage,
  DaemonWsSubmitTurnPayload,
} from './types.js';

export interface DaemonWsConnection {
  readonly socket: WebSocket;
  close(code?: number, reason?: string): void;
  send(message: DaemonWsMessage): void;
  sendHello(payload: DaemonWsHelloPayload): void;
  submitTurn(payload: DaemonWsSubmitTurnPayload): void;
  resolvePermission(payload: DaemonWsResolvePermissionPayload): void;
  cancel(payload: DaemonWsCancelPayload): void;
}

function toWsProtocol(protocol: DaemonConnectionOptions['protocol']): 'ws' | 'wss' {
  return protocol === 'https' ? 'wss' : 'ws';
}

function wsUrl(
  connection: DaemonConnectionOptions,
  options: DaemonWsConnectOptions
): string {
  const params = new URLSearchParams({
    sessionId: options.sessionId,
    afterSeq: String(options.afterSeq ?? 0),
  });

  if (options.includeTokenInQuery) {
    params.set('token', connection.token);
  }

  const protocol = toWsProtocol(connection.protocol);
  return `${protocol}://${connection.host}:${connection.port}/v3/ws?${params.toString()}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope(value: unknown): value is V3Envelope {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.v === 'string' &&
    typeof value.event === 'string' &&
    typeof value.daemonId === 'string' &&
    typeof value.seq === 'number' &&
    typeof value.ts === 'string' &&
    'payload' in value
  );
}

function parseMessage(data: RawData): unknown {
  return JSON.parse(String(data)) as unknown;
}

export class DaemonWsClient {
  constructor(private readonly connection: DaemonConnectionOptions) {}

  connect(
    options: DaemonWsConnectOptions,
    handlers: DaemonWsHandlers = {}
  ): DaemonWsConnection {
    const socket = new WebSocket(wsUrl(this.connection, options), {
      headers: {
        Authorization: `Bearer ${this.connection.token}`,
      },
    });

    socket.on('open', () => {
      handlers.onOpen?.();
    });

    socket.on('close', (code: number, reason: Buffer) => {
      handlers.onClose?.(code, reason.toString('utf-8'));
    });

    socket.on('error', (error: Error) => {
      handlers.onError?.(error);
    });

    socket.on('message', (data: RawData) => {
      let parsed: unknown;
      try {
        parsed = parseMessage(data);
      } catch {
        return;
      }

      if (isEnvelope(parsed)) {
        handlers.onEvent?.(parsed);
        handlers.onMessage?.(parsed);
        return;
      }

      if (isObjectRecord(parsed)) {
        handlers.onMessage?.(parsed as DaemonWsServerMessage);
      }
    });

    const send = (message: DaemonWsMessage): void => {
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not open');
      }
      socket.send(JSON.stringify(message));
    };

    return {
      socket,
      close: (code, reason) => {
        if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
          return;
        }
        socket.close(code, reason);
      },
      send,
      sendHello: (payload) => send({ type: 'hello', ...payload }),
      submitTurn: (payload) => send({ type: 'turn.submit', ...payload }),
      resolvePermission: (payload) => send({ type: 'permission.resolve', ...payload }),
      cancel: (payload) => send({ type: 'turn.cancel', ...payload }),
    };
  }
}
