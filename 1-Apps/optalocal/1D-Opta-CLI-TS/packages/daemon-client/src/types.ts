import type {
  BackgroundOutputSlice,
  BackgroundProcessSnapshot,
  BackgroundSignal,
  ClientSubmitTurn,
  CreateSessionRequest,
  PermissionDecision,
  SessionSnapshot,
  V3Envelope,
  WsInbound,
} from '@opta/protocol-shared';

export type DaemonProtocol = 'http' | 'https';

export interface DaemonConnectionOptions {
  host: string;
  port: number;
  token: string;
  protocol?: DaemonProtocol;
}

export interface DaemonSessionDetail extends SessionSnapshot {
  messages: unknown[];
}

export interface DaemonHealthResponse {
  status: string;
  version?: string;
  daemonId?: string;
  runtime?: unknown;
}

export interface DaemonMetricsResponse {
  daemonId: string;
  runtime: unknown;
  ts: string;
}

export interface DaemonSubmitTurnResponse {
  turnId: string;
  queued: number;
}

export interface DaemonCancelResponse {
  cancelled: number;
}

export interface DaemonPermissionResponse {
  ok: boolean;
  conflict: boolean;
  message?: string;
}

export interface DaemonEventsResponse {
  events: V3Envelope[];
}

export interface DaemonBackgroundStartRequest {
  sessionId: string;
  command: string;
  label?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface DaemonBackgroundListResponse {
  processes: BackgroundProcessSnapshot[];
}

export interface DaemonBackgroundStatusResponse {
  process: BackgroundProcessSnapshot;
}

export type DaemonBackgroundOutputResponse = BackgroundOutputSlice;

export interface DaemonBackgroundOutputOptions {
  afterSeq?: number;
  limit?: number;
  stream?: 'stdout' | 'stderr' | 'both';
}

export interface DaemonBackgroundKillResponse {
  killed: boolean;
  process: BackgroundProcessSnapshot;
}

export interface DaemonHttpApi {
  health(): Promise<DaemonHealthResponse>;
  metrics(): Promise<DaemonMetricsResponse>;
  createSession(req: CreateSessionRequest): Promise<SessionSnapshot>;
  getSession(sessionId: string): Promise<DaemonSessionDetail>;
  submitTurn(sessionId: string, payload: ClientSubmitTurn): Promise<DaemonSubmitTurnResponse>;
  cancel(sessionId: string, payload?: { turnId?: string; writerId?: string }): Promise<DaemonCancelResponse>;
  resolvePermission(sessionId: string, payload: PermissionDecision): Promise<DaemonPermissionResponse>;
  events(sessionId: string, afterSeq?: number): Promise<DaemonEventsResponse>;
  listBackground(sessionId?: string): Promise<DaemonBackgroundListResponse>;
  startBackground(payload: DaemonBackgroundStartRequest): Promise<DaemonBackgroundStatusResponse>;
  backgroundStatus(processId: string, sessionId?: string): Promise<DaemonBackgroundStatusResponse>;
  backgroundOutput(
    processId: string,
    options?: DaemonBackgroundOutputOptions
  ): Promise<DaemonBackgroundOutputResponse>;
  killBackground(processId: string, signal?: BackgroundSignal): Promise<DaemonBackgroundKillResponse>;
}

export interface DaemonWsConnectOptions {
  sessionId: string;
  afterSeq?: number;
  includeTokenInQuery?: boolean;
}

export type DaemonWsServerMessage =
  | V3Envelope
  | { type: 'ack'; action?: string; [key: string]: unknown }
  | { error: string; [key: string]: unknown };

export interface DaemonWsHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  onEvent?: (event: V3Envelope) => void;
  onMessage?: (message: DaemonWsServerMessage) => void;
}

export type DaemonWsMessage = WsInbound;
export type DaemonWsHelloMessage = Extract<WsInbound, { type: 'hello' }>;
export type DaemonWsSubmitTurnMessage = Extract<WsInbound, { type: 'turn.submit' }>;
export type DaemonWsResolvePermissionMessage = Extract<WsInbound, { type: 'permission.resolve' }>;
export type DaemonWsCancelMessage = Extract<WsInbound, { type: 'turn.cancel' }>;

export type DaemonWsHelloPayload = Omit<DaemonWsHelloMessage, 'type'>;
export type DaemonWsSubmitTurnPayload = Omit<DaemonWsSubmitTurnMessage, 'type'>;
export type DaemonWsResolvePermissionPayload = Omit<DaemonWsResolvePermissionMessage, 'type'>;
export type DaemonWsCancelPayload = Omit<DaemonWsCancelMessage, 'type'>;
